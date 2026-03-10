// Progress tracking system for file uploads
export interface UploadProgress {
	uploadId: string;
	fileName: string;
	totalSize: number;
	uploadedSize: number;
	percentage: number;
	status: 'uploading' | 'completed' | 'failed';
	startTime: number;
	lastUpdate: number;
	error?: string;
}

// In-memory storage for upload progress
// In production, this should be replaced with Redis or a database
const uploadProgress = new Map<string, UploadProgress>();

// Mapping from temp upload IDs to real S3 upload IDs
const uploadIdMapping = new Map<string, string>();

export class ProgressTracker {
	static createProgress(uploadId: string, fileName: string, totalSize: number): UploadProgress {
		const progress: UploadProgress = {
			uploadId,
			fileName,
			totalSize,
			uploadedSize: 0,
			percentage: 0,
			status: 'uploading',
			startTime: Date.now(),
			lastUpdate: Date.now(),
		};

		uploadProgress.set(uploadId, progress);
		return progress;
	}

	static updateProgress(
		uploadId: string,
		uploadedSize: number,
		status?: 'uploading' | 'completed' | 'failed',
		error?: string
	): UploadProgress | null {
		const progress = uploadProgress.get(uploadId);
		if (!progress) return null;

		progress.uploadedSize = uploadedSize;
		progress.percentage = Math.round((uploadedSize / progress.totalSize) * 100);
		progress.lastUpdate = Date.now();

		if (status) {
			progress.status = status;
		}

		if (error) {
			progress.error = error;
		}

		uploadProgress.set(uploadId, progress);
		return progress;
	}

	static getProgress(uploadId: string): UploadProgress | null {
		// Check if this is a temp upload ID that has been mapped
		const realUploadId = uploadIdMapping.get(uploadId);
		const actualUploadId = realUploadId || uploadId;

		return uploadProgress.get(actualUploadId) || null;
	}

	static deleteProgress(uploadId: string): boolean {
		return uploadProgress.delete(uploadId);
	}

	static mapUploadId(tempUploadId: string, realUploadId: string): void {
		uploadIdMapping.set(tempUploadId, realUploadId);
	}

	static getAllProgress(): UploadProgress[] {
		return Array.from(uploadProgress.values());
	}

	// Clean up old completed uploads (older than 1 hour)
	static cleanupOldUploads(): number {
		const oneHourAgo = Date.now() - 60 * 60 * 1000;
		let cleaned = 0;

		for (const [uploadId, progress] of uploadProgress.entries()) {
			if (progress.status === 'completed' && progress.lastUpdate < oneHourAgo) {
				uploadProgress.delete(uploadId);
				cleaned++;
			}
		}

		return cleaned;
	}

	// Get estimated time remaining
	static getEstimatedTimeRemaining(progress: UploadProgress): number | null {
		if (progress.status !== 'uploading' || progress.uploadedSize === 0) return null;

		const elapsed = Date.now() - progress.startTime;
		const rate = progress.uploadedSize / elapsed; // bytes per millisecond
		const remaining = progress.totalSize - progress.uploadedSize;

		return Math.round(remaining / rate);
	}
}

// Clean up old uploads every 5 minutes
setInterval(() => {
	const cleaned = ProgressTracker.cleanupOldUploads();
	if (cleaned > 0) {
		console.log(`Cleaned up ${cleaned} old upload progress records`);
	}
}, 5 * 60 * 1000);
