/**
 * Video Processor
 * Handles video clipping and preview generation
 */

import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MediaProcessingConfig } from './media-utils';
import { getContentTypeForProcessedFile, uploadProcessedFileToS3, S3UploadOptions } from './s3-helper';
import { S3 } from '@aws-sdk/client-s3';
import { generatePreviewPath } from './media-utils';
import { randomUUID } from 'crypto';

export interface VideoProcessingResult {
	previewKey: string;
	previewCdn: string;
	originalSize: number;
	previewSize: number;
	duration: number;
}

export class VideoProcessor {
	private s3: S3;
	private config: MediaProcessingConfig['video'];

	constructor(s3: S3, config: MediaProcessingConfig['video']) {
		this.s3 = s3;
		this.config = config;
	}

	/**
	 * Process a video and generate a preview clip
	 */
	async processVideo(
		videoBuffer: Buffer,
		originalS3Path: string,
		bucket: string,
		originalContentType: string,
		startTime?: number,
		duration?: number
	): Promise<VideoProcessingResult> {
		const originalSize = videoBuffer.length;
		const tempDir = join(tmpdir(), 'video-processing');
		const tempInputPath = join(tempDir, `input_${randomUUID()}.mp4`);
		const tempOutputPath = join(tempDir, `output_${randomUUID()}.mp4`);

		// Ensure temp directory exists
		try {
			await fs.mkdir(tempDir, { recursive: true });
		} catch (error) {
			// Directory might already exist, that's fine
		}

		try {
			console.log(`🎬 [VIDEO PROCESSING] Starting video processing for: ${originalS3Path}`);

			// Write buffer to temporary file
			await fs.writeFile(tempInputPath, videoBuffer);

			// Get video duration first
			const videoDuration = await this.getVideoDuration(tempInputPath);
			console.log(`📊 [VIDEO PROCESSING] Video duration: ${videoDuration} seconds, size: ${originalSize} bytes`);

			// Use provided values or fall back to config defaults
			const clipStartTime = startTime !== undefined ? startTime : this.config.startPoint;
			let clipDuration = duration !== undefined ? duration : this.config.clipDuration;

			// Validate and clamp duration to 5-60 seconds
			clipDuration = Math.max(5, Math.min(60, clipDuration));

			// Ensure startTime is valid
			if (clipStartTime < 0) {
				throw new Error(`Start time must be greater than or equal to 0, got ${clipStartTime}`);
			}

			// Calculate clip duration (don't exceed video duration)
			const availableDuration = videoDuration - clipStartTime;
			if (availableDuration <= 0) {
				throw new Error(`Video duration (${videoDuration}s) is shorter than start point (${clipStartTime}s)`);
			}

			// Clamp duration to available duration
			const finalClipDuration = Math.min(clipDuration, availableDuration);
			if (finalClipDuration < 5) {
				throw new Error(`Available duration (${availableDuration}s) is less than minimum required duration (5s)`);
			}

			console.log(`✂️ [VIDEO PROCESSING] Extracting clip: ${clipStartTime}s - ${clipStartTime + finalClipDuration}s`);

			// Detect video rotation
			const rotation = await this.getVideoRotation(tempInputPath);
			if (rotation !== 0) {
				console.log(`🔄 [VIDEO PROCESSING] Applying rotation correction: ${rotation}°`);
			}

			// Process video with FFmpeg
			await this.extractClip(tempInputPath, tempOutputPath, clipStartTime, finalClipDuration, rotation);

			// Read processed file
			const processedBuffer = await fs.readFile(tempOutputPath);
			const previewSize = processedBuffer.length;

			console.log(
				`✅ [VIDEO PROCESSING] Processed clip: ${previewSize} bytes (${(
					((originalSize - previewSize) / originalSize) *
					100
				).toFixed(1)}% reduction)`
			);

			// Generate preview path
			const previewPath = generatePreviewPath(originalS3Path, this.config.suffix);

			// Determine content type for preview
			const previewContentType = getContentTypeForProcessedFile(previewPath, originalContentType);

			// Upload to S3
			const uploadOptions: S3UploadOptions = {
				bucket,
				key: previewPath,
				body: processedBuffer,
				contentType: previewContentType,
			};

			const result = await uploadProcessedFileToS3(this.s3, uploadOptions);

			console.log(`🎉 [VIDEO PROCESSING] Successfully processed and uploaded preview: ${result.key}`);

			return {
				previewKey: result.key,
				previewCdn: result.cdn,
				originalSize,
				previewSize,
				duration: finalClipDuration,
			};
		} catch (error) {
			console.error(`❌ [VIDEO PROCESSING] Error processing video:`, error);
			throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			// Clean up temporary files
			await this.cleanupFiles([tempInputPath, tempOutputPath]);
		}
	}

	/**
	 * Get video duration in seconds
	 */
	private async getVideoDuration(filePath: string): Promise<number> {
		return new Promise((resolve, reject) => {
			ffmpeg.ffprobe(filePath, (err, metadata) => {
				if (err) {
					reject(new Error(`Failed to get video metadata: ${err.message}`));
					return;
				}

				const duration = metadata.format?.duration;
				if (duration === undefined) {
					reject(new Error('Could not determine video duration'));
					return;
				}

				resolve(duration);
			});
		});
	}

	/**
	 * Get video rotation in degrees
	 * Returns rotation angle: 0, 90, 180, 270, or -90
	 * Returns 0 if no rotation detected or if rotation is already applied
	 */
	private async getVideoRotation(filePath: string): Promise<number> {
		return new Promise((resolve, reject) => {
			ffmpeg.ffprobe(filePath, (err, metadata) => {
				if (err) {
					console.warn(`⚠️ [VIDEO PROCESSING] Failed to get video rotation metadata: ${err.message}, assuming 0°`);
					resolve(0);
					return;
				}

				// Check video streams
				const videoStream = metadata.streams?.find((stream) => stream.codec_type === 'video');
				if (!videoStream) {
					resolve(0);
					return;
				}

				// Check for rotation in tags (common in MOV files)
				const rotationTag = videoStream.tags?.rotate;
				if (rotationTag) {
					const rotation = parseInt(rotationTag, 10);
					if (!isNaN(rotation)) {
						// Normalize rotation to 0-360 range
						const normalizedRotation = ((rotation % 360) + 360) % 360;
						console.log(`🔄 [VIDEO PROCESSING] Detected rotation from tags: ${rotation}° (normalized: ${normalizedRotation}°)`);
						resolve(normalizedRotation);
						return;
					}
				}

				// Check for rotation in side_data_list (display matrix)
				if (videoStream.side_data_list) {
					for (const sideData of videoStream.side_data_list) {
						if (sideData.side_data_type === 'Display Matrix' && sideData.rotation) {
							const rotation = parseInt(sideData.rotation.toString(), 10);
							if (!isNaN(rotation)) {
								const normalizedRotation = ((rotation % 360) + 360) % 360;
								console.log(
									`🔄 [VIDEO PROCESSING] Detected rotation from side_data: ${rotation}° (normalized: ${normalizedRotation}°)`
								);
								resolve(normalizedRotation);
								return;
							}
						}
					}
				}

				// Check display_aspect_ratio vs coded dimensions for rotation hints
				// If width < height but display_aspect_ratio suggests landscape, might be rotated
				// This is a fallback check
				if (videoStream.width && videoStream.height) {
					const isPortrait = videoStream.height > videoStream.width;
					const displayAspectRatio = videoStream.display_aspect_ratio;
					if (displayAspectRatio) {
						const [w, h] = displayAspectRatio.split(':').map(Number);
						if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
							const isDisplayLandscape = w > h;
							// If dimensions suggest portrait but display suggests landscape, might be rotated 90°
							if (isPortrait && isDisplayLandscape) {
								console.log(`🔄 [VIDEO PROCESSING] Detected potential 90° rotation from aspect ratio mismatch`);
								resolve(90);
								return;
							}
						}
					}
				}

				// No rotation detected
				resolve(0);
			});
		});
	}

	/**
	 * Extract a clip from video using FFmpeg
	 * @param rotation Rotation angle in degrees (0, 90, 180, 270)
	 */
	private async extractClip(
		inputPath: string,
		outputPath: string,
		startTime: number,
		duration: number,
		rotation: number = 0
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const qualitySettings = this.getQualitySettings();
			const command = ffmpeg(inputPath)
				.seekInput(startTime)
				.duration(duration)
				.videoCodec(qualitySettings.videoCodec)
				.audioCodec(qualitySettings.audioCodec)
				.videoBitrate(qualitySettings.videoBitrate)
				.audioBitrate(qualitySettings.audioBitrate);

			// Apply rotation filter if needed
			if (rotation !== 0) {
				let rotationFilter: string;
				// Normalize rotation to 0-360 range
				const normalizedRotation = ((rotation % 360) + 360) % 360;

				switch (normalizedRotation) {
					case 90:
					case -270:
						// Rotate 90° clockwise
						rotationFilter = 'transpose=1';
						break;
					case 180:
					case -180:
						// Rotate 180°
						rotationFilter = 'transpose=1,transpose=1';
						break;
					case 270:
					case -90:
						// Rotate 90° counter-clockwise (270° clockwise)
						rotationFilter = 'transpose=2';
						break;
					default:
						// For any other rotation, use rotate filter
						// Convert degrees to radians
						const radians = (normalizedRotation * Math.PI) / 180;
						rotationFilter = `rotate=${radians}:fillcolor=black@0`;
						break;
				}

				// Add rotation filter
				command.outputOptions(['-vf', rotationFilter]);
			}

			// Add quality settings output options (preset, crf, etc.)
			command.outputOptions(qualitySettings.outputOptions);

			command
				.on('start', (commandLine) => {
					console.log(`🚀 [VIDEO PROCESSING] FFmpeg command: ${commandLine}`);
				})
				.on('progress', (progress) => {
					if (progress.percent) {
						console.log(`⏳ [VIDEO PROCESSING] Processing: ${progress.percent.toFixed(1)}%`);
					}
				})
				.on('end', () => {
					console.log(`✅ [VIDEO PROCESSING] FFmpeg processing completed`);
					resolve();
				})
				.on('error', (err) => {
					console.error(`❌ [VIDEO PROCESSING] FFmpeg error:`, err);
					reject(new Error(`FFmpeg processing failed: ${err.message}`));
				})
				.save(outputPath);
		});
	}

	/**
	 * Get quality settings based on configuration
	 */
	private getQualitySettings(): {
		videoCodec: string;
		audioCodec: string;
		videoBitrate: string;
		audioBitrate: string;
		outputOptions: string[];
	} {
		switch (this.config.quality) {
			case 'high':
				return {
					videoCodec: 'libx264',
					audioCodec: 'aac',
					videoBitrate: '2000k',
					audioBitrate: '192k',
					outputOptions: ['-preset', 'medium', '-crf', '23'],
				};
			case 'low':
				return {
					videoCodec: 'libx264',
					audioCodec: 'aac',
					videoBitrate: '800k',
					audioBitrate: '96k',
					outputOptions: ['-preset', 'fast', '-crf', '28'],
				};
			case 'medium':
			default:
				return {
					videoCodec: 'libx264',
					audioCodec: 'aac',
					videoBitrate: '1200k',
					audioBitrate: '128k',
					outputOptions: ['-preset', 'medium', '-crf', '25'],
				};
		}
	}

	/**
	 * Clean up temporary files
	 */
	private async cleanupFiles(filePaths: string[]): Promise<void> {
		for (const filePath of filePaths) {
			try {
				await fs.unlink(filePath);
			} catch (error) {
				// File might not exist or already deleted, that's fine
				console.warn(`⚠️ [VIDEO PROCESSING] Could not delete temp file ${filePath}:`, error);
			}
		}
	}
}
