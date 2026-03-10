import { UploadProgress, ChunkProgress } from '../hooks/useChunkedUpload';

// Utility functions for working with chunked uploads

/**
 * Calculate the total progress percentage based on chunk progress and S3 progress
 */
export const calculateTotalProgress = (currentUpload: UploadProgress, chunkProgress?: ChunkProgress): number => {
	const chunkPercentage = (currentUpload.receivedChunks / currentUpload.totalChunks) * 50; // 50% for chunks
	const s3Percentage = currentUpload.percentage ? currentUpload.percentage * 0.5 : 0; // 50% for S3

	if (currentUpload.receivedChunks === currentUpload.totalChunks && currentUpload.percentage !== undefined) {
		// All chunks received, show combined progress
		return Math.round(50 + s3Percentage);
	}

	// Still uploading chunks
	return Math.round(chunkPercentage);
};

/**
 * Get a human-readable status message
 */
export const getStatusMessage = (status: UploadProgress['status']): string => {
	switch (status) {
		case 'uploading':
			return 'Uploading chunks...';
		case 'uploading_to_s3':
			return 'Uploading to S3...';
		case 'completed':
			return 'Upload completed';
		case 'failed':
			return 'Upload failed';
		case 'cancelled':
			return 'Upload cancelled';
		default:
			return 'Unknown status';
	}
};

/**
 * Get status color class for styling
 */
export const getStatusColor = (status: UploadProgress['status']): string => {
	switch (status) {
		case 'completed':
			return 'text-green-600';
		case 'failed':
			return 'text-red-600';
		case 'cancelled':
			return 'text-gray-600';
		case 'uploading':
		case 'uploading_to_s3':
			return 'text-blue-600';
		default:
			return 'text-gray-600';
	}
};

/**
 * Format file size in human-readable format
 */
export const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calculate estimated time remaining
 */
export const getEstimatedTimeRemaining = (currentUpload: UploadProgress, startTime: number): string | null => {
	if (currentUpload.status !== 'uploading' && currentUpload.status !== 'uploading_to_s3') {
		return null;
	}

	const elapsed = Date.now() - startTime;
	const progress = calculateTotalProgress(currentUpload);

	if (progress === 0) return null;

	const totalTime = (elapsed / progress) * 100;
	const remaining = totalTime - elapsed;

	if (remaining <= 0) return null;

	const minutes = Math.floor(remaining / 60000);
	const seconds = Math.floor((remaining % 60000) / 1000);

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
};

/**
 * Generate a unique upload ID
 */
export const generateUploadId = (): string => {
	return `chunked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate file before upload
 */
export const validateFile = (file: File, maxSize: number = 5 * 1024 * 1024 * 1024): string[] => {
	const errors: string[] = [];

	if (file.size > maxSize) {
		errors.push(`File size exceeds maximum allowed size of ${formatBytes(maxSize)}`);
	}

	if (file.size === 0) {
		errors.push('File is empty');
	}

	return errors;
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename: string): string => {
	return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Check if file type is supported
 */
export const isSupportedFileType = (filename: string, supportedTypes: string[]): boolean => {
	const extension = getFileExtension(filename);
	return supportedTypes.includes(extension);
};

/**
 * Create a progress object for display
 */
export const createProgressDisplay = (currentUpload: UploadProgress, chunkProgress?: ChunkProgress) => {
	return {
		fileName: currentUpload.fileName,
		fileSize: formatBytes(currentUpload.fileSize),
		totalChunks: currentUpload.totalChunks,
		receivedChunks: currentUpload.receivedChunks,
		status: getStatusMessage(currentUpload.status),
		statusColor: getStatusColor(currentUpload.status),
		progress: calculateTotalProgress(currentUpload, chunkProgress),
		cdnUrl: currentUpload.cdn,
		error: currentUpload.error,
	};
};
