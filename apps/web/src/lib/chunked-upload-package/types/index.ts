// Re-export all types for easy importing
export type { UploadProgress, ChunkProgress, UploadOptions, UseChunkedUploadReturn } from '../hooks/useChunkedUpload';

// Additional utility types
export interface UploadResult {
	uploadId: string;
	fileName: string;
	fileSize: number;
	cdnUrl: string;
	s3Key: string;
	status: 'completed' | 'failed' | 'cancelled';
}

export interface UploadConfig {
	apiBaseUrl: string;
	cdnUrl: string;
	maxFileSize: number; // in bytes
	chunkSize: number; // in bytes
	allowedMimeTypes?: string[];
	allowedExtensions?: string[];
}

export interface UploadValidation {
	isValid: boolean;
	errors: string[];
}

// Utility functions for file validation
export const validateFile = (file: File, config: Partial<UploadConfig> = {}): UploadValidation => {
	const errors: string[] = [];

	// Check file size
	const maxSize = config.maxFileSize || 5 * 1024 * 1024 * 1024; // 5GB default
	if (file.size > maxSize) {
		errors.push(`File size exceeds maximum allowed size of ${(maxSize / (1024 * 1024 * 1024)).toFixed(1)}GB`);
	}

	// Check MIME types
	if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(file.type)) {
		errors.push(`File type ${file.type} is not allowed`);
	}

	// Check file extensions
	if (config.allowedExtensions) {
		const extension = file.name.split('.').pop()?.toLowerCase();
		if (!extension || !config.allowedExtensions.includes(extension)) {
			errors.push(`File extension .${extension} is not allowed`);
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};

// Utility function to format file sizes
export const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Utility function to estimate upload time
export const estimateUploadTime = (fileSize: number, averageSpeed: number = 1024 * 1024): number => {
	return Math.round(fileSize / averageSpeed); // returns seconds
};
