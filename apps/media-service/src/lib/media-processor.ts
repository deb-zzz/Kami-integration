/**
 * Media Processor
 * Main orchestrator for media processing - routes to appropriate processors
 */

import { S3 } from '@aws-sdk/client-s3';
import { ImageProcessor } from './image-processor';
import { VideoProcessor } from './video-processor';
import { AudioProcessor } from './audio-processor';
import {
	isMediaFile,
	isImage,
	isVideo,
	isAudio,
	getMediaProcessingConfig,
	MediaProcessingConfig,
} from './media-utils';
import { ChunkInfo, getChunkManager } from './chunk-manager';

export interface MediaProcessingResult {
	success: boolean;
	previewKey?: string;
	previewCdn?: string;
	originalSize: number;
	previewSize?: number;
	error?: string;
}

export class MediaProcessor {
	private s3: S3;
	private config: MediaProcessingConfig;
	private imageProcessor: ImageProcessor;
	private videoProcessor: VideoProcessor;
	private audioProcessor: AudioProcessor;

	constructor(s3: S3) {
		this.s3 = s3;
		this.config = getMediaProcessingConfig();
		this.imageProcessor = new ImageProcessor(s3, this.config.image);
		this.videoProcessor = new VideoProcessor(s3, this.config.video);
		this.audioProcessor = new AudioProcessor(s3, this.config.audio);
	}

	/**
	 * Process a media file based on its type
	 */
	async process(
		fileBuffer: Buffer,
		uploadInfo: ChunkInfo,
		originalS3Path: string,
		bucket: string,
		contentType: string,
		startTime?: number,
		duration?: number
	): Promise<MediaProcessingResult> {
		// Check if media processing is enabled
		if (!this.config.enabled) {
			console.log(`⏭️ [MEDIA PROCESSING] Media processing is disabled, skipping`);
			return {
				success: false,
				originalSize: fileBuffer.length,
				error: 'Media processing is disabled',
			};
		}

		// Check if file is a media file
		if (!isMediaFile(uploadInfo.fileName, contentType)) {
			console.log(`⏭️ [MEDIA PROCESSING] File is not a media file, skipping: ${uploadInfo.fileName}`);
			return {
				success: false,
				originalSize: fileBuffer.length,
				error: 'File is not a media file',
			};
		}

		try {
			console.log(`🎬 [MEDIA PROCESSING] Starting media processing for: ${uploadInfo.fileName}`);

			let result: MediaProcessingResult;

			if (isImage(uploadInfo.fileName, contentType)) {
				console.log(`🖼️ [MEDIA PROCESSING] Processing as image`);
				const imageResult = await this.imageProcessor.processImage(
					fileBuffer,
					originalS3Path,
					bucket,
					contentType
				);
				result = {
					success: true,
					previewKey: imageResult.previewKey,
					previewCdn: imageResult.previewCdn,
					originalSize: imageResult.originalSize,
					previewSize: imageResult.previewSize,
				};
			} else if (isVideo(uploadInfo.fileName, contentType)) {
				console.log(`🎥 [MEDIA PROCESSING] Processing as video`);
				const videoResult = await this.videoProcessor.processVideo(
					fileBuffer,
					originalS3Path,
					bucket,
					contentType,
					startTime,
					duration
				);
				result = {
					success: true,
					previewKey: videoResult.previewKey,
					previewCdn: videoResult.previewCdn,
					originalSize: videoResult.originalSize,
					previewSize: videoResult.previewSize,
				};
			} else if (isAudio(uploadInfo.fileName, contentType)) {
				console.log(`🎵 [MEDIA PROCESSING] Processing as audio`);
				const audioResult = await this.audioProcessor.processAudio(
					fileBuffer,
					originalS3Path,
					bucket,
					contentType,
					startTime,
					duration
				);
				result = {
					success: true,
					previewKey: audioResult.previewKey,
					previewCdn: audioResult.previewCdn,
					originalSize: audioResult.originalSize,
					previewSize: audioResult.previewSize,
				};
			} else {
				throw new Error(`Unsupported media type for file: ${uploadInfo.fileName}`);
			}

			console.log(`✅ [MEDIA PROCESSING] Successfully processed media file: ${uploadInfo.fileName}`);
			return result;
		} catch (error) {
			console.error(`❌ [MEDIA PROCESSING] Error processing media file ${uploadInfo.fileName}:`, error);
			return {
				success: false,
				originalSize: fileBuffer.length,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}
}

/**
 * Process media file asynchronously (non-blocking)
 * This function triggers processing in the background without blocking the main upload flow
 */
export async function processMediaFileAsync(
	fileBuffer: Buffer,
	uploadInfo: ChunkInfo,
	originalS3Path: string,
	bucket: string,
	contentType: string,
	s3: S3,
	startTime?: number,
	duration?: number
): Promise<void> {
	// Store uploadId for later reference
	const uploadId = uploadInfo.uploadId;
	const fileName = uploadInfo.fileName;

	// Run in background, don't await
	setImmediate(async () => {
		try {
			const processor = new MediaProcessor(s3);
			const result = await processor.process(
				fileBuffer,
				uploadInfo,
				originalS3Path,
				bucket,
				contentType,
				startTime,
				duration
			);

			if (result.success && result.previewCdn) {
				console.log(
					`✅ [MEDIA PROCESSING] Background processing completed for ${fileName}. Preview: ${result.previewKey}`
				);
				// Store preview URL in ChunkInfo so it's available via status endpoint
				const chunkManager = getChunkManager();
				const updated = chunkManager.updatePreviewUrl(uploadId, result.previewCdn);
				if (updated) {
					console.log(`📝 [MEDIA PROCESSING] Stored preview URL for ${fileName}: ${result.previewCdn}`);
				} else {
					console.warn(`⚠️ [MEDIA PROCESSING] Could not update preview URL for ${uploadId} - upload not found`);
				}
			} else {
				console.warn(
					`⚠️ [MEDIA PROCESSING] Background processing skipped or failed for ${fileName}: ${result.error}`
				);
			}
		} catch (error) {
			// Log error but don't fail the upload
			console.error(`❌ [MEDIA PROCESSING] Background processing error for ${fileName}:`, error);
		}
	});
}

