import {
	S3,
	CreateMultipartUploadCommand,
	UploadPartCommand,
	CompleteMultipartUploadCommand,
	AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { ProgressTracker } from './progress';

// Global reference to ChunkManager for cancellation checks
let globalChunkManager: any = null;

export function setGlobalChunkManager(manager: any) {
	globalChunkManager = manager;
}

// Configuration constants
const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RETRIES = 3;

export interface UploadResult {
	key: string;
	cdn: string;
	size: number;
	method: 'regular' | 'multipart';
	uploadId?: string;
}

export class S3Uploader {
	private s3: S3;
	private activeUploads: Map<string, { s3UploadId: string; key: string; bucket: string }> = new Map(); // Map uploadId to S3 upload details

	constructor(s3: S3) {
		this.s3 = s3;
	}

	async uploadFile(file: File, bucket: string, key: string, contentType: string, uploadId?: string): Promise<UploadResult> {
		const fileSize = file.size;
		const cdnUrl = `${process.env.CDN_URL}/${key}`;

		// Use multipart upload for large files
		if (fileSize > MULTIPART_THRESHOLD) {
			console.log(`Using multipart upload for file: ${file.name} (${fileSize} bytes)`);
			return this.uploadMultipart(file, bucket, key, contentType, uploadId);
		} else {
			console.log(`Using regular upload for file: ${file.name} (${fileSize} bytes)`);
			return this.uploadRegular(file, bucket, key, contentType);
		}
	}

	// Upload file from buffer (for chunked uploads)
	async uploadFileFromBuffer(
		fileBuffer: Buffer,
		fileName: string,
		bucket: string,
		key: string,
		contentType: string,
		uploadId?: string,
		isCancelled?: () => boolean,
		chunkManager?: any
	): Promise<UploadResult> {
		const fileSize = fileBuffer.length;
		const cdnUrl = `${process.env.CDN_URL}/${key}`;

		// Use multipart upload for large files
		if (fileSize > MULTIPART_THRESHOLD) {
			console.log(`Using multipart upload for file: ${fileName} (${fileSize} bytes)`);
			return this.uploadMultipartFromBuffer(fileBuffer, fileName, bucket, key, contentType, uploadId, isCancelled, chunkManager);
		} else {
			console.log(`Using regular upload for file: ${fileName} (${fileSize} bytes)`);
			return this.uploadRegularFromBuffer(fileBuffer, bucket, key, contentType);
		}
	}

	// Start multipart upload asynchronously (for immediate response)
	async startMultipartUpload(file: File, bucket: string, key: string, contentType: string, tempUploadId: string): Promise<void> {
		// This runs asynchronously after the response is sent
		process.nextTick(async () => {
			try {
				await this.uploadMultipart(file, bucket, key, contentType, tempUploadId);
			} catch (error) {
				console.error('Async multipart upload failed:', error);
				ProgressTracker.updateProgress(tempUploadId, 0, 'failed', error instanceof Error ? error.message : 'Unknown error');
			}
		});
	}

	private async uploadRegular(file: File, bucket: string, key: string, contentType: string): Promise<UploadResult> {
		// For small files, we can still use arrayBuffer but with better error handling
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		await this.s3.putObject({
			Bucket: bucket,
			Key: key,
			Body: buffer,
			ContentType: contentType,
		});

		return {
			key,
			cdn: `${process.env.CDN_URL}/${key}`,
			size: file.size,
			method: 'regular',
		};
	}

	private async uploadRegularFromBuffer(buffer: Buffer, bucket: string, key: string, contentType: string): Promise<UploadResult> {
		await this.s3.putObject({
			Bucket: bucket,
			Key: key,
			Body: buffer,
			ContentType: contentType,
		});

		return {
			key,
			cdn: `${process.env.CDN_URL}/${key}`,
			size: buffer.length,
			method: 'regular',
		};
	}

	private async uploadMultipart(
		file: File,
		bucket: string,
		key: string,
		contentType: string,
		existingUploadId?: string
	): Promise<UploadResult> {
		let uploadId = existingUploadId;
		const totalParts = Math.ceil(file.size / CHUNK_SIZE);
		const uploadedParts: { ETag: string; PartNumber: number }[] = [];
		let uploadedSize = 0;

		try {
			// Create multipart upload
			const createCommand = new CreateMultipartUploadCommand({
				Bucket: bucket,
				Key: key,
				ContentType: contentType,
			});

			const createResponse = await this.s3.send(createCommand);
			const s3UploadId = createResponse.UploadId!;

			// If we have an existing uploadId (from client), update the progress tracking
			if (existingUploadId) {
				const progress = ProgressTracker.getProgress(existingUploadId);
				if (progress) {
					// Create new progress entry with real S3 upload ID
					ProgressTracker.createProgress(s3UploadId, progress.fileName, progress.totalSize);
					// Map the temp upload ID to the real S3 upload ID
					ProgressTracker.mapUploadId(existingUploadId, s3UploadId);
					// Delete the old progress
					ProgressTracker.deleteProgress(existingUploadId);
				}
			} else {
				// Create progress tracking with S3 upload ID
				ProgressTracker.createProgress(s3UploadId, file.name, file.size);
			}

			uploadId = s3UploadId;

			// Upload parts
			for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
				const start = (partNumber - 1) * CHUNK_SIZE;
				const end = Math.min(start + CHUNK_SIZE, file.size);
				const chunk = file.slice(start, end);

				// Convert chunk to buffer
				const chunkBytes = await chunk.arrayBuffer();
				const chunkBuffer = Buffer.from(chunkBytes);

				// Upload part with retry logic
				const partResult = await this.uploadPartWithRetry(bucket, key, uploadId!, partNumber, chunkBuffer);

				uploadedParts.push({
					ETag: partResult.ETag!,
					PartNumber: partNumber,
				});

				uploadedSize += chunkBuffer.length;

				// Update progress
				ProgressTracker.updateProgress(uploadId!, uploadedSize);

				console.log(`Uploaded part ${partNumber}/${totalParts} (${uploadedSize}/${file.size} bytes)`);
			}

			// Complete multipart upload
			const completeCommand = new CompleteMultipartUploadCommand({
				Bucket: bucket,
				Key: key,
				UploadId: uploadId,
				MultipartUpload: {
					Parts: uploadedParts,
				},
			});

			await this.s3.send(completeCommand);

			// Mark as completed
			ProgressTracker.updateProgress(uploadId!, uploadedSize, 'completed');

			console.log(`Multipart upload completed: ${key}`);

			return {
				key,
				cdn: `${process.env.CDN_URL}/${key}`,
				size: file.size,
				method: 'multipart',
				uploadId,
			};
		} catch (error) {
			console.error('Multipart upload failed:', error);

			// Mark as failed
			if (uploadId) {
				ProgressTracker.updateProgress(uploadId, uploadedSize, 'failed', error instanceof Error ? error.message : 'Unknown error');
			}

			// Abort multipart upload
			if (uploadId) {
				try {
					await this.s3.send(
						new AbortMultipartUploadCommand({
							Bucket: bucket,
							Key: key,
							UploadId: uploadId,
						})
					);
				} catch (abortError) {
					console.error('Failed to abort multipart upload:', abortError);
				}
			}

			throw error;
		}
	}

	private async uploadPartWithRetry(
		bucket: string,
		key: string,
		uploadId: string,
		partNumber: number,
		body: Buffer
	): Promise<{ ETag: string }> {
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const command = new UploadPartCommand({
					Bucket: bucket,
					Key: key,
					UploadId: uploadId,
					PartNumber: partNumber,
					Body: body,
				});

				const result = await this.s3.send(command);
				return { ETag: result.ETag! };
			} catch (error) {
				lastError = error as Error;
				console.warn(`Upload part ${partNumber} attempt ${attempt} failed:`, error);

				if (attempt < MAX_RETRIES) {
					// Wait before retry (exponential backoff)
					await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
				}
			}
		}

		throw lastError || new Error('Upload part failed after all retries');
	}

	private async uploadMultipartFromBuffer(
		fileBuffer: Buffer,
		fileName: string,
		bucket: string,
		key: string,
		contentType: string,
		existingUploadId?: string,
		isCancelled?: () => boolean,
		chunkManager?: any
	): Promise<UploadResult> {
		let uploadId = existingUploadId;
		const totalParts = Math.ceil(fileBuffer.length / CHUNK_SIZE);
		const uploadedParts: { ETag: string; PartNumber: number }[] = [];
		let uploadedSize = 0;

		try {
			// Create multipart upload
			const createCommand = new CreateMultipartUploadCommand({
				Bucket: bucket,
				Key: key,
				ContentType: contentType,
			});

			const createResponse = await this.s3.send(createCommand);
			const s3UploadId = createResponse.UploadId!;

			// If we have an existing uploadId (from client), update the progress tracking
			if (existingUploadId) {
				const progress = ProgressTracker.getProgress(existingUploadId);
				if (progress) {
					// Create new progress entry with real S3 upload ID
					ProgressTracker.createProgress(s3UploadId, progress.fileName, progress.totalSize);
					// Map the temp upload ID to the real S3 upload ID
					ProgressTracker.mapUploadId(existingUploadId, s3UploadId);
					// Delete the old progress
					ProgressTracker.deleteProgress(existingUploadId);
				}
			} else {
				// Create progress tracking with S3 upload ID
				ProgressTracker.createProgress(s3UploadId, fileName, fileBuffer.length);
			}

			uploadId = s3UploadId;

			// Track active upload for cancellation
			if (existingUploadId) {
				this.activeUploads.set(existingUploadId, {
					s3UploadId,
					key,
					bucket,
				});
			}

			// Upload parts
			for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
				// Check for cancellation before each part
				let cancelled = false;
				if (isCancelled) {
					cancelled = isCancelled();
					console.log(`🔄 [AWS CHECK] Checking cancellation for part ${partNumber}/${totalParts}: ${cancelled}`);
				}

				// Also check using passed ChunkManager reference
				// Use the existingUploadId (chunked upload ID) for cancellation checks
				if (existingUploadId && chunkManager) {
					const chunkManagerCancelled = chunkManager.isCancelled(existingUploadId);
					console.log(`🔍 [AWS CHECK] Passed ChunkManager check for ${existingUploadId}: ${chunkManagerCancelled}`);
					cancelled = cancelled || chunkManagerCancelled;
				}

				if (cancelled) {
					console.log(`❌ [AWS CANCEL] Upload ${uploadId} was cancelled during part ${partNumber}/${totalParts}`);
					// Abort the multipart upload
					try {
						console.log(`🛑 [AWS ABORT] Aborting multipart upload ${uploadId} for ${key}`);
						await this.s3.send(
							new AbortMultipartUploadCommand({
								Bucket: bucket,
								Key: key,
								UploadId: uploadId!,
							})
						);
						console.log(`✅ [AWS ABORT] Successfully aborted multipart upload ${uploadId}`);
					} catch (abortError) {
						console.error('❌ [AWS ABORT] Failed to abort multipart upload:', abortError);
					}
					const cancelError = new Error('Upload cancelled by user');
					cancelError.name = 'UploadCancelledError';
					throw cancelError;
				}

				const start = (partNumber - 1) * CHUNK_SIZE;
				const end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
				const chunkBuffer = fileBuffer.subarray(start, end);

				// Upload part with retry logic
				console.log(`🚀 [AWS UPLOAD] Starting upload of part ${partNumber}/${totalParts} (${chunkBuffer.length} bytes) to S3`);
				const partResult = await this.uploadPartWithRetry(bucket, key, uploadId!, partNumber, chunkBuffer);

				uploadedParts.push({
					ETag: partResult.ETag!,
					PartNumber: partNumber,
				});

				uploadedSize += chunkBuffer.length;

				// Update progress
				ProgressTracker.updateProgress(uploadId!, uploadedSize);

				console.log(
					`✅ [AWS UPLOAD] Successfully uploaded part ${partNumber}/${totalParts} (${uploadedSize}/${fileBuffer.length} bytes) - ETag: ${partResult.ETag}`
				);
			}

			// Complete multipart upload
			console.log(`🎯 [AWS COMPLETE] Completing multipart upload ${uploadId} with ${uploadedParts.length} parts`);
			const completeCommand = new CompleteMultipartUploadCommand({
				Bucket: bucket,
				Key: key,
				UploadId: uploadId,
				MultipartUpload: {
					Parts: uploadedParts,
				},
			});

			await this.s3.send(completeCommand);
			console.log(`🎉 [AWS COMPLETE] Successfully completed multipart upload ${uploadId} for ${key}`);

			// Mark as completed
			ProgressTracker.updateProgress(uploadId!, uploadedSize, 'completed');

			console.log(`Multipart upload completed: ${key}`);

			return {
				key,
				cdn: `${process.env.CDN_URL}/${key}`,
				size: fileBuffer.length,
				method: 'multipart',
				uploadId,
			};
		} catch (error) {
			console.error('Multipart upload failed:', error);

			// Mark as failed
			if (uploadId) {
				ProgressTracker.updateProgress(uploadId, uploadedSize, 'failed', error instanceof Error ? error.message : 'Unknown error');
			}

			// Abort multipart upload
			if (uploadId) {
				try {
					await this.s3.send(
						new AbortMultipartUploadCommand({
							Bucket: bucket,
							Key: key,
							UploadId: uploadId,
						})
					);
				} catch (abortError) {
					console.error('Failed to abort multipart upload:', abortError);
				}
			}

			throw error;
		}
	}

	// Cancel an active upload
	async cancelUpload(uploadId: string): Promise<boolean> {
		const uploadDetails = this.activeUploads.get(uploadId);
		if (!uploadDetails) {
			return false;
		}

		try {
			// Abort the multipart upload
			await this.s3.send(
				new AbortMultipartUploadCommand({
					Bucket: uploadDetails.bucket,
					Key: uploadDetails.key,
					UploadId: uploadDetails.s3UploadId,
				})
			);

			// Remove from active uploads
			this.activeUploads.delete(uploadId);
			return true;
		} catch (error) {
			console.error('Failed to cancel S3 upload:', error);
			return false;
		}
	}
}
