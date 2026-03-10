/**
 * Image Processor
 * Handles image optimization and preview generation
 */

import sharp from 'sharp';
import { MediaProcessingConfig } from './media-utils';
import { getContentTypeForProcessedFile, uploadProcessedFileToS3, S3UploadOptions } from './s3-helper';
import { S3 } from '@aws-sdk/client-s3';
import { generatePreviewPath } from './media-utils';

export interface ImageProcessingResult {
	previewKey: string;
	previewCdn: string;
	originalSize: number;
	previewSize: number;
}

export class ImageProcessor {
	private s3: S3;
	private config: MediaProcessingConfig['image'];

	constructor(s3: S3, config: MediaProcessingConfig['image']) {
		this.s3 = s3;
		this.config = config;
	}

	/**
	 * Process an image and generate a preview version
	 */
	async processImage(
		imageBuffer: Buffer,
		originalS3Path: string,
		bucket: string,
		originalContentType: string
	): Promise<ImageProcessingResult> {
		try {
			console.log(`🖼️ [IMAGE PROCESSING] Starting image processing for: ${originalS3Path}`);

			// Get image metadata
			const metadata = await sharp(imageBuffer).metadata();
			const originalSize = imageBuffer.length;

			console.log(`📊 [IMAGE PROCESSING] Original dimensions: ${metadata.width}x${metadata.height}, size: ${originalSize} bytes`);
			if (metadata.orientation && metadata.orientation > 1) {
				console.log(`🔄 [IMAGE PROCESSING] EXIF orientation detected: ${metadata.orientation}`);
			}

			// Determine actual dimensions (after EXIF rotation)
			// When orientation is > 1, width and height may be swapped in EXIF
			let actualWidth = metadata.width || 0;
			let actualHeight = metadata.height || 0;

			// For orientations 5, 6, 7, 8, the dimensions are swapped
			if (metadata.orientation && [5, 6, 7, 8].includes(metadata.orientation)) {
				[actualWidth, actualHeight] = [actualHeight, actualWidth];
			}

			// Determine if resize is needed
			let shouldResize = false;
			let targetWidth = actualWidth;
			let targetHeight = actualHeight;

			if (actualWidth && actualHeight) {
				if (actualWidth > this.config.maxWidth || actualHeight > this.config.maxHeight) {
					shouldResize = true;
					// Calculate new dimensions maintaining aspect ratio
					const aspectRatio = actualWidth / actualHeight;

					if (actualWidth > actualHeight) {
						// Landscape
						targetWidth = Math.min(actualWidth, this.config.maxWidth);
						targetHeight = Math.round(targetWidth / aspectRatio);
						if (targetHeight > this.config.maxHeight) {
							targetHeight = this.config.maxHeight;
							targetWidth = Math.round(targetHeight * aspectRatio);
						}
					} else {
						// Portrait or square
						targetHeight = Math.min(actualHeight, this.config.maxHeight);
						targetWidth = Math.round(targetHeight * aspectRatio);
						if (targetWidth > this.config.maxWidth) {
							targetWidth = this.config.maxWidth;
							targetHeight = Math.round(targetWidth / aspectRatio);
						}
					}
				}
			}

			// Start processing pipeline
			// Apply EXIF orientation rotation first, then strip orientation metadata
			// Sharp's rotate() method when called without parameters uses EXIF orientation
			// This ensures images are rotated correctly based on how they were captured
			let pipeline = sharp(imageBuffer).rotate(); // Auto-rotate based on EXIF orientation

			// Resize if needed
			if (shouldResize && targetWidth && targetHeight) {
				console.log(`📐 [IMAGE PROCESSING] Resizing to: ${targetWidth}x${targetHeight}`);
				pipeline = pipeline.resize(targetWidth, targetHeight, {
					fit: 'inside',
					withoutEnlargement: true,
				});
			}

			// Determine output format
			let outputFormat: 'jpeg' | 'png' | 'webp' = 'jpeg';
			const extension = originalS3Path.toLowerCase().split('.').pop();

			if (this.config.format !== 'auto') {
				outputFormat = this.config.format;
			} else {
				// Auto-detect based on original format
				if (extension === 'png' || originalContentType === 'image/png') {
					outputFormat = 'png';
				} else if (extension === 'webp' || originalContentType === 'image/webp') {
					outputFormat = 'webp';
				} else {
					// Default to JPEG for most cases
					outputFormat = 'jpeg';
				}
			}

			// Apply format-specific options
			// Use withMetadata to strip EXIF orientation after rotation (set to 1 = normal)
			let processedBuffer: Buffer;
			if (outputFormat === 'jpeg') {
				processedBuffer = await pipeline
					.jpeg({ quality: this.config.quality })
					.withMetadata({ orientation: 1 }) // Strip EXIF orientation after rotation
					.toBuffer();
			} else if (outputFormat === 'png') {
				processedBuffer = await pipeline
					.png({ quality: this.config.quality, compressionLevel: 9 })
					.withMetadata({ orientation: 1 }) // Strip EXIF orientation after rotation
					.toBuffer();
			} else if (outputFormat === 'webp') {
				processedBuffer = await pipeline
					.webp({ quality: this.config.quality })
					.withMetadata({ orientation: 1 }) // Strip EXIF orientation after rotation
					.toBuffer();
			} else {
				// Fallback to JPEG
				processedBuffer = await pipeline
					.jpeg({ quality: this.config.quality })
					.withMetadata({ orientation: 1 }) // Strip EXIF orientation after rotation
					.toBuffer();
			}

			const previewSize = processedBuffer.length;
			console.log(`✅ [IMAGE PROCESSING] Processed image: ${previewSize} bytes (${((originalSize - previewSize) / originalSize * 100).toFixed(1)}% reduction)`);

			// Generate preview path
			const previewPath = generatePreviewPath(originalS3Path, this.config.suffix);
			
			// Update extension if format changed
			const previewPathWithExt = this.updateExtension(previewPath, outputFormat);

			// Determine content type for preview
			const previewContentType = getContentTypeForProcessedFile(previewPathWithExt, originalContentType);

			// Upload to S3
			const uploadOptions: S3UploadOptions = {
				bucket,
				key: previewPathWithExt,
				body: processedBuffer,
				contentType: previewContentType,
			};

			const result = await uploadProcessedFileToS3(this.s3, uploadOptions);

			console.log(`🎉 [IMAGE PROCESSING] Successfully processed and uploaded preview: ${result.key}`);

			return {
				previewKey: result.key,
				previewCdn: result.cdn,
				originalSize,
				previewSize,
			};
		} catch (error) {
			console.error(`❌ [IMAGE PROCESSING] Error processing image:`, error);
			throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Update file extension in path
	 */
	private updateExtension(path: string, format: 'jpeg' | 'png' | 'webp'): string {
		const extensionMap: { [key: string]: string } = {
			jpeg: 'jpg',
			png: 'png',
			webp: 'webp',
		};

		const newExtension = extensionMap[format] || 'jpg';
		const lastDotIndex = path.lastIndexOf('.');

		if (lastDotIndex === -1) {
			return `${path}.${newExtension}`;
		}

		return `${path.substring(0, lastDotIndex)}.${newExtension}`;
	}
}

