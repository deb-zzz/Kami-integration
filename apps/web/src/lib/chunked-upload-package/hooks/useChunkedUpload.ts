import { useState, useCallback, useRef } from 'react';

export interface UploadProgress {
	uploadId: string;
	fileName: string;
	fileSize: number;
	totalChunks: number;
	receivedChunks: number;
	status: 'uploading' | 'uploading_to_s3' | 'completed' | 'failed' | 'cancelled';
	key?: string;
	cdn?: string;
	error?: string;
	startTime?: string;
	lastUpdate?: string;
	percentage?: number;
	uploadedSize?: number;
}

export interface ChunkProgress {
	chunkIndex: number;
	totalChunks: number;
	received: number;
	remaining: number;
	progress: number;
}

export interface UploadOptions {
	projectId: string;
	category?: 'project' | 'product' | 'profile';
	folder?: string;
	chunkSize?: number;
	onProgress?: (progress: ChunkProgress) => void;
	onStatusChange?: (status: UploadProgress) => void;
	onComplete?: (result: UploadProgress) => void;
	onError?: (error: string) => void;
}

export interface UseChunkedUploadReturn {
	uploadFile: (file: File, options: UploadOptions) => Promise<UploadProgress>;
	cancelUpload: (uploadId: string) => Promise<void>;
	getUploadStatus: (uploadId: string) => Promise<UploadProgress>;
	isUploading: boolean;
	currentUpload: UploadProgress | null;
	error: string | null;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const API_BASE_URL = process.env.NEXT_PUBLIC_UPLOAD_API_URL || 'https://uploads.staging.kamiunlimited.com';

export function useChunkedUpload(): UseChunkedUploadReturn {
	const [isUploading, setIsUploading] = useState(false);
	const [currentUpload, setCurrentUpload] = useState<UploadProgress | null>(null);
	const [error, setError] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const generateUploadId = useCallback(() => {
		return `chunked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}, []);

	const uploadChunk = useCallback(
		async (
			chunk: Blob,
			uploadId: string,
			chunkIndex: number,
			totalChunks: number,
			fileName: string,
			fileSize: number,
			options: UploadOptions
		): Promise<ChunkProgress> => {
			const formData = new FormData();
			formData.append('chunk', chunk);
			formData.append('uploadId', uploadId);
			formData.append('chunkIndex', chunkIndex.toString());
			formData.append('totalChunks', totalChunks.toString());
			formData.append('fileName', fileName);
			formData.append('fileSize', fileSize.toString());
			if (options.folder) {
				formData.append('folder', options.folder);
			}

			const response = await fetch(`${API_BASE_URL}/api/upload?id=${options.projectId}&c=${options.category || 'project'}`, {
				method: 'POST',
				body: formData,
				signal: abortControllerRef.current?.signal,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			return result;
		},
		[]
	);

	const pollUploadStatus = useCallback(async (uploadId: string, options: UploadOptions): Promise<UploadProgress> => {
		return new Promise((resolve, reject) => {
			const poll = async () => {
				try {
					const response = await fetch(`${API_BASE_URL}/api/upload?uploadId=${uploadId}`, {
						signal: abortControllerRef.current?.signal,
					});

					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`);
					}

					const status: UploadProgress = await response.json();

					// Update current upload state
					setCurrentUpload(status);

					// Call status change callback
					options.onStatusChange?.(status);

					if (status.status === 'completed') {
						resolve(status);
					} else if (status.status === 'failed') {
						reject(new Error(status.error || 'Upload failed'));
					} else {
						// Still uploading, poll again in 500ms for more responsive updates
						setTimeout(poll, 500);
					}
				} catch (err) {
					if (err instanceof Error && err.name === 'AbortError') {
						reject(new Error('Upload cancelled'));
					} else {
						reject(err);
					}
				}
			};

			poll();
		});
	}, []);

	const uploadFile = useCallback(
		async (file: File, options: UploadOptions): Promise<UploadProgress> => {
			try {
				setIsUploading(true);
				setError(null);
				setCurrentUpload(null);

				const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
				const totalChunks = Math.ceil(file.size / chunkSize);
				const uploadId = generateUploadId();

				// Create abort controller for this upload
				abortControllerRef.current = new AbortController();

				// Initialize upload progress
				const initialProgress: UploadProgress = {
					uploadId,
					fileName: file.name,
					fileSize: file.size,
					totalChunks,
					receivedChunks: 0,
					status: 'uploading',
					startTime: new Date().toISOString(),
					lastUpdate: new Date().toISOString(),
				};

				setCurrentUpload(initialProgress);
				options.onStatusChange?.(initialProgress);

				// Upload chunks sequentially
				for (let i = 0; i < totalChunks; i++) {
					const start = i * chunkSize;
					const end = Math.min(start + chunkSize, file.size);
					const chunk = file.slice(start, end);

					const chunkProgress = await uploadChunk(chunk, uploadId, i, totalChunks, file.name, file.size, options);

					// Update progress
					const progress: ChunkProgress = {
						chunkIndex: i,
						totalChunks,
						received: chunkProgress.received || i + 1,
						remaining: chunkProgress.remaining || totalChunks - (i + 1),
						progress: chunkProgress.progress || Math.round(((i + 1) / totalChunks) * 100),
					};

					options.onProgress?.(progress);

					// Update current upload state
					const updatedProgress: UploadProgress = {
						...initialProgress,
						receivedChunks: i + 1,
						lastUpdate: new Date().toISOString(),
					};
					setCurrentUpload(updatedProgress);
					options.onStatusChange?.(updatedProgress);

					// If this is the last chunk, start polling for S3 upload status
					if (i === totalChunks - 1) {
						// Start polling for S3 upload completion
						const finalStatus = await pollUploadStatus(uploadId, options);
						setCurrentUpload(finalStatus);
						options.onComplete?.(finalStatus);
						return finalStatus;
					}
				}

				throw new Error('Upload failed - no chunks were processed');
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
				setError(errorMessage);
				options.onError?.(errorMessage);
				throw err;
			} finally {
				setIsUploading(false);
				abortControllerRef.current = null;
			}
		},
		[generateUploadId, uploadChunk, pollUploadStatus]
	);

	const cancelUpload = useCallback(
		async (uploadId: string): Promise<void> => {
			try {
				// Cancel the current upload if it matches
				if (currentUpload?.uploadId === uploadId) {
					abortControllerRef.current?.abort();
				}

				// Send cancel request to server
				const response = await fetch(`${API_BASE_URL}/api/upload?uploadId=${uploadId}`, {
					method: 'DELETE',
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				// Update current upload state
				if (currentUpload?.uploadId === uploadId) {
					const cancelledProgress: UploadProgress = {
						...currentUpload,
						status: 'cancelled',
						lastUpdate: new Date().toISOString(),
					};
					setCurrentUpload(cancelledProgress);
				}

				setIsUploading(false);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Failed to cancel upload';
				setError(errorMessage);
				throw err;
			}
		},
		[currentUpload]
	);

	const getUploadStatus = useCallback(async (uploadId: string): Promise<UploadProgress> => {
		try {
			const response = await fetch(`${API_BASE_URL}/api/upload?uploadId=${uploadId}`);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const status: UploadProgress = await response.json();
			return status;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to get upload status';
			setError(errorMessage);
			throw err;
		}
	}, []);

	return {
		uploadFile,
		cancelUpload,
		getUploadStatus,
		isUploading,
		currentUpload,
		error,
	};
}
