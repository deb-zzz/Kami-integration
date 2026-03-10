/**
 * Media Utilities
 * Shared utilities for file type detection, path generation, and configuration
 */

// Image file extensions and MIME types
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'ico'];
export const IMAGE_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/bmp',
	'image/tiff',
	'image/svg+xml',
	'image/x-icon',
];

// Video file extensions and MIME types
export const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp', 'ogv'];
export const VIDEO_MIME_TYPES = [
	'video/mp4',
	'video/x-msvideo',
	'video/quicktime',
	'video/x-ms-wmv',
	'video/x-flv',
	'video/webm',
	'video/x-matroska',
	'video/x-m4v',
	'video/3gpp',
	'video/ogg',
];

// Audio file extensions and MIME types
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'];
export const AUDIO_MIME_TYPES = [
	'audio/mpeg',
	'audio/wav',
	'audio/flac',
	'audio/aac',
	'audio/ogg',
	'audio/x-ms-wma',
	'audio/x-m4a',
];

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
	const parts = fileName.toLowerCase().split('.');
	return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Check if a file is a media file (image, video, or audio)
 */
export function isMediaFile(fileName: string, contentType?: string): boolean {
	return isImage(fileName, contentType) || isVideo(fileName, contentType) || isAudio(fileName, contentType);
}

/**
 * Check if a file is an image
 */
export function isImage(fileName: string, contentType?: string): boolean {
	const extension = getFileExtension(fileName);
	
	// Check by extension
	if (IMAGE_EXTENSIONS.includes(extension)) {
		return true;
	}
	
	// Check by MIME type if provided
	if (contentType && IMAGE_MIME_TYPES.includes(contentType.toLowerCase())) {
		return true;
	}
	
	return false;
}

/**
 * Check if a file is a video
 */
export function isVideo(fileName: string, contentType?: string): boolean {
	const extension = getFileExtension(fileName);
	
	// Check by extension
	if (VIDEO_EXTENSIONS.includes(extension)) {
		return true;
	}
	
	// Check by MIME type if provided
	if (contentType && VIDEO_MIME_TYPES.includes(contentType.toLowerCase())) {
		return true;
	}
	
	return false;
}

/**
 * Check if a file is an audio file
 */
export function isAudio(fileName: string, contentType?: string): boolean {
	const extension = getFileExtension(fileName);
	
	// Check by extension
	if (AUDIO_EXTENSIONS.includes(extension)) {
		return true;
	}
	
	// Check by MIME type if provided
	if (contentType && AUDIO_MIME_TYPES.includes(contentType.toLowerCase())) {
		return true;
	}
	
	return false;
}

/**
 * Generate preview file path from original S3 path
 * Original: Project/123/image.jpg -> Preview: Project/123/image_preview.jpg
 */
export function generatePreviewPath(originalPath: string, suffix: string = '_preview'): string {
	const lastDotIndex = originalPath.lastIndexOf('.');
	if (lastDotIndex === -1) {
		// No extension, just append suffix
		return `${originalPath}${suffix}`;
	}
	
	const pathWithoutExt = originalPath.substring(0, lastDotIndex);
	const extension = originalPath.substring(lastDotIndex);
	
	return `${pathWithoutExt}${suffix}${extension}`;
}

/**
 * Get filename without extension
 */
export function getFileNameWithoutExtension(fileName: string): string {
	const lastDotIndex = fileName.lastIndexOf('.');
	return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
}

/**
 * Media processing configuration
 */
export interface MediaProcessingConfig {
	enabled: boolean;
	image: {
		maxWidth: number;
		maxHeight: number;
		quality: number; // 0-100
		format: 'auto' | 'jpeg' | 'webp' | 'png';
		suffix: string;
	};
	video: {
		clipDuration: number; // seconds
		startPoint: number; // seconds
		quality: 'high' | 'medium' | 'low';
		suffix: string;
	};
	audio: {
		clipDuration: number; // seconds
		startPoint: number; // seconds
		bitrate: string; // e.g., '128k'
		suffix: string;
	};
}

/**
 * Get media processing configuration from environment variables
 */
export function getMediaProcessingConfig(): MediaProcessingConfig {
	return {
		enabled: process.env.ENABLE_MEDIA_PROCESSING !== 'false', // Default to true
		image: {
			maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '1920', 10),
			maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '1080', 10),
			quality: parseInt(process.env.IMAGE_QUALITY || '80', 10),
			format: (process.env.IMAGE_FORMAT || 'auto') as 'auto' | 'jpeg' | 'webp' | 'png',
			suffix: process.env.IMAGE_SUFFIX || '_preview',
		},
		video: {
			clipDuration: parseInt(process.env.VIDEO_CLIP_DURATION || '60', 10),
			startPoint: parseInt(process.env.VIDEO_CLIP_START || '0', 10),
			quality: (process.env.VIDEO_QUALITY || 'medium') as 'high' | 'medium' | 'low',
			suffix: process.env.VIDEO_SUFFIX || '_preview',
		},
		audio: {
			clipDuration: parseInt(process.env.AUDIO_CLIP_DURATION || '60', 10),
			startPoint: parseInt(process.env.AUDIO_CLIP_START || '0', 10),
			bitrate: process.env.AUDIO_BITRATE || '128k',
			suffix: process.env.AUDIO_SUFFIX || '_preview',
		},
	};
}

