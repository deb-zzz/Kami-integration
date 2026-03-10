/**
 * S3 Helper for Media Processing
 * Handles uploading processed media files to S3
 */

import { S3 } from '@aws-sdk/client-s3';

export interface S3UploadOptions {
	bucket: string;
	key: string;
	body: Buffer;
	contentType: string;
}

/**
 * Upload a processed file to S3
 */
export async function uploadProcessedFileToS3(
	s3: S3,
	options: S3UploadOptions
): Promise<{ key: string; cdn: string }> {
	try {
		await s3.putObject({
			Bucket: options.bucket,
			Key: options.key,
			Body: options.body,
			ContentType: options.contentType,
		});

		const cdnUrl = `${process.env.CDN_URL || ''}/${options.key}`;

		console.log(`✅ [MEDIA PROCESSING] Uploaded processed file to S3: ${options.key}`);

		return {
			key: options.key,
			cdn: cdnUrl,
		};
	} catch (error) {
		console.error(`❌ [MEDIA PROCESSING] Failed to upload processed file to S3:`, error);
		throw new Error(`Failed to upload processed file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Get content type for processed file based on original file extension
 */
export function getContentTypeForProcessedFile(fileName: string, originalContentType?: string): string {
	const extension = fileName.toLowerCase().split('.').pop() || '';

	const mimeTypes: { [key: string]: string } = {
		// Image formats
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		webp: 'image/webp',
		bmp: 'image/bmp',
		tiff: 'image/tiff',
		svg: 'image/svg+xml',

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
	};

	return mimeTypes[extension] || originalContentType || 'application/octet-stream';
}

