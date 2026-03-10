import { S3Uploader, setGlobalChunkManager } from './s3-upload';
import { ProgressTracker } from './progress';
import { createWriteStream, createReadStream, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { S3 } from '@aws-sdk/client-s3';
import { processMediaFileAsync } from './media-processor';
import { isMediaFile } from './media-utils';

export interface BaseChunkUploadStatus {
	uploadId: string;
	fileName: string;
	fileSize: number;
	totalChunks: number;
	receivedChunks: number;
	status: 'receiving_chunks' | 'uploading_to_s3' | 'completed' | 'failed' | 'cancelled';
	error?: string;
	startTime: number;
	lastUpdate: number;
	key: string;
	cdn: string;
	previewCdn?: string; // Preview CDN URL (available when media processing completes)
	method: string;
}

export type ChunkUploadStatus = BaseChunkUploadStatus & {
	uploadedSize: number;
	percentage: number;
	elapsedTime: number;
	estimatedTimeRemaining: number | null;
};

// Create S3 uploader instance
// Support both ACCESS_KEY/SECRET_KEY and AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY for compatibility
const s3 = new S3({
	region: process.env.AWS_REGION as string,
	credentials: {
		accessKeyId: (process.env.ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID) as string,
		secretAccessKey: (process.env.SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY) as string,
	},
});
const uploader = new S3Uploader(s3);

// MIME type detection based on file extension
function getContentType(fileName: string): string {
	const extension = fileName.toLowerCase().split('.').pop();

	const mimeTypes: { [key: string]: string } = {
		// Video formats
		mp4: 'video/mp4',
		avi: 'video/x-msvideo',
		mov: 'video/quicktime',
		wmv: 'video/x-ms-wmv',
		flv: 'video/x-flv',
		webm: 'video/webm',
		mkv: 'video/x-matroska',
		m4v: 'video/x-m4v',
		'3gp': 'video/3gpp',
		ogv: 'video/ogg',

		// Audio formats
		mp3: 'audio/mpeg',
		wav: 'audio/wav',
		flac: 'audio/flac',
		aac: 'audio/aac',
		ogg: 'audio/ogg',
		wma: 'audio/x-ms-wma',
		m4a: 'audio/x-m4a',

		// Image formats
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		bmp: 'image/bmp',
		svg: 'image/svg+xml',
		webp: 'image/webp',
		tiff: 'image/tiff',
		ico: 'image/x-icon',

		// Document formats
		pdf: 'application/pdf',
		doc: 'application/msword',
		docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		xls: 'application/vnd.ms-excel',
		xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		ppt: 'application/vnd.ms-powerpoint',
		pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		txt: 'text/plain',
		rtf: 'application/rtf',

		// Archive formats
		zip: 'application/zip',
		rar: 'application/x-rar-compressed',
		'7z': 'application/x-7z-compressed',
		tar: 'application/x-tar',
		gz: 'application/gzip',

		// Code formats
		js: 'application/javascript',
		ts: 'application/typescript',
		html: 'text/html',
		css: 'text/css',
		json: 'application/json',
		xml: 'application/xml',
		csv: 'text/csv',
	};

	return mimeTypes[extension || ''] || 'application/octet-stream';
}

export interface ChunkInfo {
	uploadId: string;
	fileName: string;
	fileSize: number;
	totalChunks: number;
	receivedChunks: Set<number>;
	s3Path: string;
	bucket: string;
	category: string;
	pId: string;
	folder?: string;
	status: 'uploading' | 'assembling' | 'uploading_to_s3' | 'completed' | 'failed' | 'cancelled';
	error?: string;
	startTime: number;
	lastUpdate: number;
	previewCdn?: string; // Preview CDN URL (set when media processing completes)
	previewStartTime?: number; // Start time for media preview in seconds (optional)
	previewDuration?: number; // Duration for media preview in seconds (optional)
}

export class ChunkManager {
	private uploads = new Map<string, ChunkInfo>();
	private tempDir = '/tmp/chunked-uploads';
	private cancellationFlags = new Map<string, boolean>();

	constructor() {
		// Ensure temp directory exists
		if (!existsSync(this.tempDir)) {
			mkdirSync(this.tempDir, { recursive: true });
		}
		// Set global reference for S3 uploader
		setGlobalChunkManager(this);
	}

	async storeChunk(
		uploadId: string,
		chunkIndex: number,
		chunk: File,
		totalChunks: number,
		fileName: string,
		fileSize: number,
		s3Path: string,
		bucket: string,
		category: string,
		pId: string,
		folder?: string,
		previewStartTime?: number,
		previewDuration?: number
	): Promise<boolean> {
		// Get or create upload info
		let uploadInfo = this.uploads.get(uploadId);
		if (!uploadInfo) {
			uploadInfo = {
				uploadId,
				fileName,
				fileSize,
				totalChunks,
				receivedChunks: new Set(),
				s3Path,
				bucket,
				category,
				pId,
				folder,
				status: 'uploading',
				startTime: Date.now(),
				lastUpdate: Date.now(),
				previewStartTime,
				previewDuration,
			};
			this.uploads.set(uploadId, uploadInfo);
		} else {
			// Update preview options if provided (only on first chunk)
			if (chunkIndex === 0) {
				if (previewStartTime !== undefined) {
					uploadInfo.previewStartTime = previewStartTime;
				}
				if (previewDuration !== undefined) {
					uploadInfo.previewDuration = previewDuration;
				}
			}
		}

		// Check if chunk already received
		if (uploadInfo.receivedChunks.has(chunkIndex)) {
			console.log(`Chunk ${chunkIndex} already received for upload ${uploadId}`);
			// Still check if all chunks are stored (in case this was a duplicate)
			return uploadInfo.receivedChunks.size === uploadInfo.totalChunks;
		}

		// Store chunk to disk FIRST (before marking as received)
		const chunkPath = this.getChunkPath(uploadId, chunkIndex);
		const chunkBuffer = Buffer.from(await chunk.arrayBuffer());

		await this.writeChunkToDisk(chunkPath, chunkBuffer);

		// Update upload info AFTER chunk is stored on disk
		uploadInfo.receivedChunks.add(chunkIndex);
		uploadInfo.lastUpdate = Date.now();

		console.log(`Stored chunk ${chunkIndex + 1}/${totalChunks} for ${fileName} (${chunkBuffer.length} bytes)`);

		// Return true if all chunks are now stored, false otherwise
		return uploadInfo.receivedChunks.size === uploadInfo.totalChunks;
	}

	async startS3Upload(uploadId: string, uploader: S3Uploader, s3Path: string, bucket: string): Promise<void> {
		const uploadInfo = this.uploads.get(uploadId);
		if (!uploadInfo) {
			throw new Error(`Upload ${uploadId} not found`);
		}

		// Prevent multiple S3 upload starts - check if upload has already started
		if (uploadInfo.status !== 'uploading') {
			console.log(`S3 upload for ${uploadId} already started or completed (status: ${uploadInfo.status}), skipping`);
			return;
		}

		// Check if all chunks received AND stored
		if (uploadInfo.receivedChunks.size !== uploadInfo.totalChunks) {
			throw new Error(`Not all chunks received. Expected ${uploadInfo.totalChunks}, got ${uploadInfo.receivedChunks.size}`);
		}

		// Update status
		uploadInfo.status = 'assembling';
		uploadInfo.lastUpdate = Date.now();

		try {
			// Check for cancellation before starting
			if (this.cancellationFlags.get(uploadId)) {
				console.log(`Upload ${uploadId} was cancelled before S3 upload started`);
				return;
			}

			// Assemble file from chunks
			const assembledFilePath = await this.assembleFile(uploadId);

			// Check for cancellation after assembly
			if (this.cancellationFlags.get(uploadId)) {
				console.log(`Upload ${uploadId} was cancelled after file assembly`);
				return;
			}

			// Update status
			uploadInfo.status = 'uploading_to_s3';
			uploadInfo.lastUpdate = Date.now();

			// Read the assembled file as buffer
			const fileBuffer = await this.readFileAsBuffer(assembledFilePath);

			// Check for cancellation before S3 upload
			if (this.cancellationFlags.get(uploadId)) {
				console.log(`Upload ${uploadId} was cancelled before S3 upload`);
				return;
			}

			// Determine content type based on file extension
			const contentType = getContentType(uploadInfo.fileName);

			// Upload to S3 using buffer method with cancellation check
			console.log(`🚀 [S3 START] Starting S3 upload for ${uploadId} with cancellation check`);
			console.log(`📊 [S3 INFO] File: ${uploadInfo.fileName}, Size: ${fileBuffer.length} bytes, Content-Type: ${contentType}`);
			console.log(`🎯 [S3 PATH] S3 Path: ${s3Path}, Bucket: ${bucket}`);
			try {
				// Create a bound function to ensure proper context
				const isCancelled = () => {
					// Get the singleton instance to ensure we're checking the right cancellation flags
					const manager = getChunkManager();
					const cancelled = manager.cancellationFlags.get(uploadId) === true;
					const hasFlag = manager.cancellationFlags.has(uploadId);
					console.log(`Cancellation check for upload ${uploadId}: ${cancelled} (hasFlag: ${hasFlag})`);
					console.log(`Current cancellation flags:`, Array.from(manager.cancellationFlags.entries()));
					console.log(`Manager instance:`, manager.constructor.name);
					console.log(`Manager cancellationFlags size:`, manager.cancellationFlags.size);
					return cancelled;
				};

				await uploader.uploadFileFromBuffer(
					fileBuffer,
					uploadInfo.fileName,
					bucket,
					s3Path,
					contentType,
					uploadId,
					isCancelled,
					this
				);

				// Mark as completed
				uploadInfo.status = 'completed';
				uploadInfo.lastUpdate = Date.now();

				// Trigger media processing asynchronously (non-blocking)
				if (isMediaFile(uploadInfo.fileName, contentType)) {
					console.log(`🎬 [MEDIA PROCESSING] Triggering media processing for: ${uploadInfo.fileName}`);
					processMediaFileAsync(
						fileBuffer,
						uploadInfo,
						s3Path,
						bucket,
						contentType,
						s3,
						uploadInfo.previewStartTime,
						uploadInfo.previewDuration
					);
				}
			} catch (error) {
				// Check if this is a cancellation error
				if (error instanceof Error && error.name === 'UploadCancelledError') {
					console.log(`Upload ${uploadId} was cancelled during S3 upload`);
					uploadInfo.status = 'cancelled';
					uploadInfo.error = 'Cancelled by user';
					uploadInfo.lastUpdate = Date.now();
					return; // Don't throw, just return
				}
				// Re-throw other errors
				throw error;
			}

			// Note: ProgressTracker is already updated by the S3 uploader

			// Clean up temporary files
			await this.cleanupUpload(uploadId);

			console.log(`Upload ${uploadId} completed successfully`);
		} catch (error) {
			console.error(`Upload ${uploadId} failed:`, error);
			uploadInfo.status = 'failed';
			uploadInfo.error = error instanceof Error ? error.message : 'Unknown error';
			uploadInfo.lastUpdate = Date.now();

			// Clean up on failure
			await this.cleanupUpload(uploadId);
			throw error;
		}
	}

	private async assembleFile(uploadId: string): Promise<string> {
		const uploadInfo = this.uploads.get(uploadId);
		if (!uploadInfo) {
			throw new Error(`Upload ${uploadId} not found`);
		}

		const assembledFilePath = join(this.tempDir, `${uploadId}_assembled`);
		const writeStream = createWriteStream(assembledFilePath);

		try {
			// Write chunks in order
			for (let i = 0; i < uploadInfo.totalChunks; i++) {
				const chunkPath = this.getChunkPath(uploadId, i);
				const readStream = createReadStream(chunkPath);

				await pipeline(readStream, writeStream, { end: false });
			}

			writeStream.end();
			await new Promise<void>((resolve, reject) => {
				writeStream.on('finish', () => resolve());
				writeStream.on('error', reject);
			});

			console.log(`Assembled file for upload ${uploadId}: ${assembledFilePath}`);
			return assembledFilePath;
		} catch (error) {
			writeStream.destroy();
			throw error;
		}
	}

	private async writeChunkToDisk(chunkPath: string, chunkBuffer: Buffer): Promise<void> {
		return new Promise((resolve, reject) => {
			const writeStream = createWriteStream(chunkPath);
			writeStream.write(chunkBuffer);
			writeStream.end();

			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
		});
	}

	private async readFileAsBuffer(filePath: string): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			const readStream = createReadStream(filePath);

			readStream.on('data', (chunk: string | Buffer) => {
				if (Buffer.isBuffer(chunk)) {
					chunks.push(chunk);
				} else {
					chunks.push(Buffer.from(chunk));
				}
			});
			readStream.on('end', () => resolve(Buffer.concat(chunks)));
			readStream.on('error', reject);
		});
	}

	private getChunkPath(uploadId: string, chunkIndex: number): string {
		return join(this.tempDir, `${uploadId}_chunk_${chunkIndex}`);
	}

	async getUploadStatus(uploadId: string): Promise<ChunkUploadStatus | BaseChunkUploadStatus | null> {
		const uploadInfo = this.uploads.get(uploadId);
		if (!uploadInfo) {
			return null;
		}

		// Get progress from ProgressTracker if available (this handles ID mapping)
		const progress = ProgressTracker.getProgress(uploadId);

		// Determine the current status based on chunk progress and S3 progress
		let currentStatus: BaseChunkUploadStatus['status'];
		if (uploadInfo.status === 'uploading' && uploadInfo.receivedChunks.size < uploadInfo.totalChunks) {
			currentStatus = 'receiving_chunks';
		} else if (uploadInfo.status === 'uploading' && uploadInfo.receivedChunks.size === uploadInfo.totalChunks) {
			// All chunks received, check if S3 upload is in progress
			if (progress && progress.status === 'uploading') {
				currentStatus = 'uploading_to_s3';
			} else if (progress && progress.status === 'completed') {
				currentStatus = 'completed';
			} else if (progress && progress.status === 'failed') {
				currentStatus = 'failed';
			} else {
				currentStatus = 'uploading_to_s3'; // Default to uploading_to_s3 if no progress yet
			}
		} else if (uploadInfo.status === 'cancelled') {
			currentStatus = 'cancelled';
		} else if (uploadInfo.status === 'failed') {
			currentStatus = 'failed';
		} else if (uploadInfo.status === 'completed') {
			currentStatus = 'completed';
		} else {
			currentStatus = 'receiving_chunks'; // Default fallback
		}

		const status: BaseChunkUploadStatus = {
			uploadId,
			fileName: uploadInfo.fileName,
			fileSize: uploadInfo.fileSize,
			totalChunks: uploadInfo.totalChunks,
			receivedChunks: uploadInfo.receivedChunks.size,
			status: currentStatus,
			error: uploadInfo.error || progress?.error,
			startTime: uploadInfo.startTime,
			lastUpdate: uploadInfo.lastUpdate,
			key: uploadInfo.s3Path,
			cdn: `${process.env.CDN_URL}/${uploadInfo.s3Path}`,
			previewCdn: uploadInfo.previewCdn, // Include preview URL if available
			method: 'chunked',
		};

		// If we have progress tracking, include that data
		if (progress) {
			const result: ChunkUploadStatus = {
				...status,
				uploadedSize: progress.uploadedSize,
				percentage: progress.percentage,
				elapsedTime: Date.now() - progress.startTime,
				estimatedTimeRemaining: ProgressTracker.getEstimatedTimeRemaining(progress),
			};
			return result;
		}

		return status;
	}

	// Check if an upload is cancelled
	isCancelled(uploadId: string): boolean {
		return this.cancellationFlags.get(uploadId) === true;
	}

	// Update preview URL for an upload (called by media processor or when generating expected preview URL)
	updatePreviewUrl(uploadId: string, previewCdn: string): boolean {
		const uploadInfo = this.uploads.get(uploadId);
		if (uploadInfo) {
			uploadInfo.previewCdn = previewCdn;
			uploadInfo.lastUpdate = Date.now();
			return true;
		}
		return false;
	}

	// Set expected preview URL for an upload (called when all chunks are stored)
	setExpectedPreviewUrl(uploadId: string, previewCdn: string): boolean {
		return this.updatePreviewUrl(uploadId, previewCdn);
	}

	async cancelUpload(uploadId: string): Promise<boolean> {
		const uploadInfo = this.uploads.get(uploadId);
		if (!uploadInfo) {
			return false;
		}

		// Set cancellation flag
		this.cancellationFlags.set(uploadId, true);
		console.log(`Cancellation flag set for upload ${uploadId}`);
		console.log(`All cancellation flags:`, Array.from(this.cancellationFlags.entries()));

		// Cancel S3 upload if it's in progress
		if (uploadInfo.status === 'uploading' && uploadInfo.receivedChunks.size === uploadInfo.totalChunks) {
			try {
				await uploader.cancelUpload(uploadId);
			} catch (error) {
				console.error('Failed to cancel S3 upload:', error);
			}
		}

		// Update status
		uploadInfo.status = 'cancelled';
		uploadInfo.error = 'Cancelled by user';
		uploadInfo.lastUpdate = Date.now();

		// Clean up files
		await this.cleanupUpload(uploadId);

		// Remove from tracking
		this.uploads.delete(uploadId);
		this.cancellationFlags.delete(uploadId);

		return true;
	}

	private async cleanupUpload(uploadId: string): Promise<void> {
		const uploadInfo = this.uploads.get(uploadId);
		if (!uploadInfo) return;

		try {
			// Delete chunk files
			for (let i = 0; i < uploadInfo.totalChunks; i++) {
				const chunkPath = this.getChunkPath(uploadId, i);
				if (existsSync(chunkPath)) {
					unlinkSync(chunkPath);
				}
			}

			// Delete assembled file
			const assembledPath = join(this.tempDir, `${uploadId}_assembled`);
			if (existsSync(assembledPath)) {
				unlinkSync(assembledPath);
			}
		} catch (error) {
			console.error(`Error cleaning up upload ${uploadId}:`, error);
		}
	}

	// Clean up old uploads (older than 1 hour)
	cleanupOldUploads(): number {
		const oneHourAgo = Date.now() - 60 * 60 * 1000;
		let cleaned = 0;

		for (const [uploadId, uploadInfo] of this.uploads.entries()) {
			if (uploadInfo.lastUpdate < oneHourAgo) {
				this.cleanupUpload(uploadId);
				this.uploads.delete(uploadId);
				cleaned++;
			}
		}

		return cleaned;
	}
}

// Clean up old uploads every 5 minutes
// Singleton instance to ensure all parts of the application use the same ChunkManager
let chunkManagerInstance: ChunkManager | null = null;

export function getChunkManager(): ChunkManager {
	if (!chunkManagerInstance) {
		chunkManagerInstance = new ChunkManager();
	}
	return chunkManagerInstance;
}

// For backward compatibility, also export the singleton instance
const chunkManager = getChunkManager();

setInterval(() => {
	const cleaned = chunkManager.cleanupOldUploads();
	if (cleaned > 0) {
		console.log(`Cleaned up ${cleaned} old chunked uploads`);
	}
}, 5 * 60 * 1000);
