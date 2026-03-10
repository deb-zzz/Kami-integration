/**
 * Audio Processor
 * Handles audio clipping and preview generation
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

export interface AudioProcessingResult {
	previewKey: string;
	previewCdn: string;
	originalSize: number;
	previewSize: number;
	duration: number;
}

export class AudioProcessor {
	private s3: S3;
	private config: MediaProcessingConfig['audio'];

	constructor(s3: S3, config: MediaProcessingConfig['audio']) {
		this.s3 = s3;
		this.config = config;
	}

	/**
	 * Process an audio file and generate a preview clip
	 */
	async processAudio(
		audioBuffer: Buffer,
		originalS3Path: string,
		bucket: string,
		originalContentType: string,
		startTime?: number,
		duration?: number
	): Promise<AudioProcessingResult> {
		const originalSize = audioBuffer.length;
		const tempDir = join(tmpdir(), 'audio-processing');
		const extension = originalS3Path.toLowerCase().split('.').pop() || 'mp3';
		const tempInputPath = join(tempDir, `input_${randomUUID()}.${extension}`);
		
		// Determine output format based on original
		const outputExtension = extension === 'wav' ? 'mp3' : extension;
		const tempOutputPath = join(tempDir, `output_${randomUUID()}.${outputExtension}`);

		// Ensure temp directory exists
		try {
			await fs.mkdir(tempDir, { recursive: true });
		} catch (error) {
			// Directory might already exist, that's fine
		}

		try {
			console.log(`🎵 [AUDIO PROCESSING] Starting audio processing for: ${originalS3Path}`);

			// Write buffer to temporary file
			await fs.writeFile(tempInputPath, audioBuffer);

			// Get audio duration first
			const audioDuration = await this.getAudioDuration(tempInputPath);
			console.log(`📊 [AUDIO PROCESSING] Audio duration: ${audioDuration} seconds, size: ${originalSize} bytes`);

			// Use provided values or fall back to config defaults
			const clipStartTime = startTime !== undefined ? startTime : this.config.startPoint;
			let clipDuration = duration !== undefined ? duration : this.config.clipDuration;

			// Validate and clamp duration to 5-60 seconds
			clipDuration = Math.max(5, Math.min(60, clipDuration));

			// Ensure startTime is valid
			if (clipStartTime < 0) {
				throw new Error(`Start time must be greater than or equal to 0, got ${clipStartTime}`);
			}

			// Calculate clip duration (don't exceed audio duration)
			const availableDuration = audioDuration - clipStartTime;
			if (availableDuration <= 0) {
				throw new Error(`Audio duration (${audioDuration}s) is shorter than start point (${clipStartTime}s)`);
			}

			// Clamp duration to available duration
			const finalClipDuration = Math.min(clipDuration, availableDuration);
			if (finalClipDuration < 5) {
				throw new Error(
					`Available duration (${availableDuration}s) is less than minimum required duration (5s)`
				);
			}

			console.log(
				`✂️ [AUDIO PROCESSING] Extracting clip: ${clipStartTime}s - ${clipStartTime + finalClipDuration}s`
			);

			// Process audio with FFmpeg
			await this.extractClip(tempInputPath, tempOutputPath, clipStartTime, finalClipDuration);

			// Read processed file
			const processedBuffer = await fs.readFile(tempOutputPath);
			const previewSize = processedBuffer.length;

			console.log(`✅ [AUDIO PROCESSING] Processed clip: ${previewSize} bytes (${((originalSize - previewSize) / originalSize * 100).toFixed(1)}% reduction)`);

			// Generate preview path
			const previewPath = generatePreviewPath(originalS3Path, this.config.suffix);
			
			// Update extension if format changed
			const previewPathWithExt = this.updateExtension(previewPath, outputExtension);

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

			console.log(`🎉 [AUDIO PROCESSING] Successfully processed and uploaded preview: ${result.key}`);

			return {
				previewKey: result.key,
				previewCdn: result.cdn,
				originalSize,
				previewSize,
				duration: finalClipDuration,
			};
		} catch (error) {
			console.error(`❌ [AUDIO PROCESSING] Error processing audio:`, error);
			throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			// Clean up temporary files
			await this.cleanupFiles([tempInputPath, tempOutputPath]);
		}
	}

	/**
	 * Get audio duration in seconds
	 */
	private async getAudioDuration(filePath: string): Promise<number> {
		return new Promise((resolve, reject) => {
			ffmpeg.ffprobe(filePath, (err, metadata) => {
				if (err) {
					reject(new Error(`Failed to get audio metadata: ${err.message}`));
					return;
				}

				const duration = metadata.format?.duration;
				if (duration === undefined) {
					reject(new Error('Could not determine audio duration'));
					return;
				}

				resolve(duration);
			});
		});
	}

	/**
	 * Extract a clip from audio using FFmpeg
	 */
	private async extractClip(
		inputPath: string,
		outputPath: string,
		startTime: number,
		duration: number
	): Promise<void> {
		return new Promise((resolve, reject) => {
			ffmpeg(inputPath)
				.seekInput(startTime)
				.duration(duration)
				.audioCodec('libmp3lame') // Use MP3 codec for output
				.audioBitrate(this.config.bitrate)
				.outputOptions(['-q:a', '2']) // High quality
				.on('start', (commandLine) => {
					console.log(`🚀 [AUDIO PROCESSING] FFmpeg command: ${commandLine}`);
				})
				.on('progress', (progress) => {
					if (progress.percent) {
						console.log(`⏳ [AUDIO PROCESSING] Processing: ${progress.percent.toFixed(1)}%`);
					}
				})
				.on('end', () => {
					console.log(`✅ [AUDIO PROCESSING] FFmpeg processing completed`);
					resolve();
				})
				.on('error', (err) => {
					console.error(`❌ [AUDIO PROCESSING] FFmpeg error:`, err);
					reject(new Error(`FFmpeg processing failed: ${err.message}`));
				})
				.save(outputPath);
		});
	}

	/**
	 * Update file extension in path
	 */
	private updateExtension(path: string, extension: string): string {
		const lastDotIndex = path.lastIndexOf('.');

		if (lastDotIndex === -1) {
			return `${path}.${extension}`;
		}

		return `${path.substring(0, lastDotIndex)}.${extension}`;
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
				console.warn(`⚠️ [AUDIO PROCESSING] Could not delete temp file ${filePath}:`, error);
			}
		}
	}
}

