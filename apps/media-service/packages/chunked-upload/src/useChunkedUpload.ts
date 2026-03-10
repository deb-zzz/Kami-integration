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
	previewCdn?: string; // Preview CDN URL (available when media processing completes)
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
	maxFileSize?: number;
	maxRetries?: number;
	retryDelay?: number;
	concurrency?: number; // Number of chunks to upload concurrently (default: 3 for internet, 20 for LAN; min: 1, max: 50 for LAN, 10 for internet)
	startTime?: number; // Start time for media preview in seconds (default: 0)
	duration?: number; // Duration for media preview in seconds (min: 5, max: 60, default: 30)
	onProgress?: (progress: ChunkProgress) => void;
	onStatusChange?: (status: UploadProgress) => void;
	onComplete?: (result: UploadProgress) => void;
	onError?: (error: string) => void;
}

export interface UseChunkedUploadOptions {
	apiBaseUrl?: string; // Override API base URL (optional)
}

export interface UseChunkedUploadReturn {
	uploadFile: (file: File, options: UploadOptions) => Promise<UploadProgress>;
	cancelUpload: (uploadId: string) => Promise<void>;
	getUploadStatus: (uploadId: string) => Promise<UploadProgress>;
	isUploading: boolean;
	currentUpload: UploadProgress | null;
	error: string | null;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB (conservative for internet)
const DEFAULT_CONCURRENCY = 3; // Default number of concurrent chunk uploads (conservative for internet)
const LAN_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB (optimized for LAN)
const LAN_CONCURRENCY = 20; // Optimized concurrency for LAN
const MAX_CONCURRENCY = 50; // Maximum concurrency for high-speed LAN connections
const INTERNET_MAX_CONCURRENCY = 10; // Maximum concurrency for internet connections

/**
 * Concurrency limiter utility to control parallel execution
 * Optimized to start tasks immediately when capacity is available
 */
class ConcurrencyLimiter {
	private running = 0;
	private queue: Array<() => void> = [];

	constructor(private limit: number) {}

	async execute<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const task = () => {
				this.running++;
				Promise.resolve(fn())
					.then(resolve, reject)
					.finally(() => {
						this.running--;
						// Process queue immediately after a task completes
						this.processQueue();
					});
			};

			// Try to start immediately if we have capacity
			if (this.running < this.limit) {
				task();
			} else {
				// Otherwise queue it
				this.queue.push(task);
			}
		});
	}

	private processQueue() {
		// Process multiple items at once if we have capacity
		while (this.running < this.limit && this.queue.length > 0) {
			const task = this.queue.shift();
			if (task) {
				task();
			}
		}
	}
}

/**
 * Get the API base URL from environment variables or use provided override
 */
function getApiBaseUrl(override?: string): string {
	if (override) {
		return override;
	}

	// Support both Next.js and Create React App environment variable patterns
	if (typeof process !== 'undefined' && process.env) {
		return process.env.NEXT_PUBLIC_UPLOAD_API_URL || process.env.REACT_APP_UPLOAD_API_URL || 'https://app.kamiunlimited.com';
	}

	return 'https://app.kamiunlimited.com';
}

/**
 * Detect if we're on a local network (localhost or LAN)
 * This helps optimize settings for high-speed local connections
 */
function isLocalNetwork(apiBaseUrl: string): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	const url = apiBaseUrl.toLowerCase();
	const hostname = window.location.hostname.toLowerCase();

	// Check for localhost, 127.0.0.1, or local IP ranges
	return (
		url.includes('localhost') ||
		url.includes('127.0.0.1') ||
		url.includes('192.168.') ||
		url.includes('10.') ||
		url.includes('172.16.') ||
		url.includes('172.17.') ||
		url.includes('172.18.') ||
		url.includes('172.19.') ||
		url.includes('172.20.') ||
		url.includes('172.21.') ||
		url.includes('172.22.') ||
		url.includes('172.23.') ||
		url.includes('172.24.') ||
		url.includes('172.25.') ||
		url.includes('172.26.') ||
		url.includes('172.27.') ||
		url.includes('172.28.') ||
		url.includes('172.29.') ||
		url.includes('172.30.') ||
		url.includes('172.31.') ||
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname.startsWith('192.168.') ||
		hostname.startsWith('10.') ||
		(hostname.startsWith('172.') && parseInt(hostname.split('.')[1] || '0') >= 16 && parseInt(hostname.split('.')[1] || '0') <= 31)
	);
}

export function useChunkedUpload(options?: UseChunkedUploadOptions): UseChunkedUploadReturn {
	const apiBaseUrl = getApiBaseUrl(options?.apiBaseUrl);

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
			options: UploadOptions,
			retryCount = 0
		): Promise<ChunkProgress> => {
			const maxRetries = options.maxRetries || 3;
			const retryDelay = options.retryDelay || 1000; // 1 second base delay

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
			// Add media preview options if provided
			if (options.startTime !== undefined) {
				formData.append('startTime', options.startTime.toString());
			}
			if (options.duration !== undefined) {
				formData.append('duration', options.duration.toString());
			}

			try {
				console.log(
					`🌐 [CLIENT] Sending chunk ${chunkIndex + 1}/${totalChunks} to server for ${fileName}${
						retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : ''
					}`
				);

				const response = await fetch(`${apiBaseUrl}:6555/api/upload?id=${options.projectId}&c=${options.category || 'project'}`, {
					method: 'POST',
					body: formData,
					signal: abortControllerRef.current?.signal,
				});

				if (!response.ok) {
					console.error(`❌ [CLIENT] Chunk upload failed with status: ${response.status}`);

					// Try to parse error response for better error messages
					let errorMessage = `HTTP error! status: ${response.status}`;
					let errorCode = 'HTTP_ERROR';
					let shouldRetry = false;

					try {
						const errorData = await response.json();
						if (errorData.error) {
							errorMessage = errorData.error;
							if (errorData.details) {
								errorMessage += `: ${errorData.details}`;
							}
							if (errorData.code) {
								errorCode = errorData.code;
							}
						}
					} catch (parseError) {
						// If we can't parse the error response, use the status code
						console.warn('Could not parse error response:', parseError);
					}

					// Determine if this error is retryable
					if (response.status >= 500 || response.status === 408 || response.status === 429) {
						shouldRetry = true;
					} else if (
						errorCode === 'NETWORK_ERROR' ||
						errorCode === 'TIMEOUT_ERROR' ||
						errorMessage.includes('timeout') ||
						errorMessage.includes('network')
					) {
						shouldRetry = true;
					}

					// Retry if appropriate
					if (shouldRetry && retryCount < maxRetries) {
						const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
						console.log(`🔄 [CLIENT] Retrying chunk ${chunkIndex + 1}/${totalChunks} in ${delay}ms...`);
						await new Promise((resolve) => setTimeout(resolve, delay));
						return uploadChunk(chunk, uploadId, chunkIndex, totalChunks, fileName, fileSize, options, retryCount + 1);
					}

					const error = new Error(errorMessage) as Error & { code?: string; shouldRetry?: boolean };
					error.code = errorCode;
					error.shouldRetry = shouldRetry;
					throw error;
				}

				console.log(`✅ [CLIENT] Chunk ${chunkIndex + 1}/${totalChunks} sent successfully to server`);
				const result = await response.json();
				return result;
			} catch (error) {
				// Handle network errors and retry if appropriate
				if (error instanceof Error && retryCount < maxRetries) {
					const isRetryableError =
						error.message.includes('network') ||
						error.message.includes('timeout') ||
						error.message.includes('ECONNREFUSED') ||
						error.message.includes('ETIMEDOUT') ||
						(error as any).shouldRetry;

					if (isRetryableError) {
						const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
						console.log(`🔄 [CLIENT] Retrying chunk ${chunkIndex + 1}/${totalChunks} in ${delay}ms due to: ${error.message}`);
						await new Promise((resolve) => setTimeout(resolve, delay));
						return uploadChunk(chunk, uploadId, chunkIndex, totalChunks, fileName, fileSize, options, retryCount + 1);
					}
				}

				// If not retryable or max retries reached, throw the error
				throw error;
			}
		},
		[apiBaseUrl]
	);

	const pollUploadStatus = useCallback(
		async (uploadId: string, options: UploadOptions): Promise<UploadProgress> => {
			return new Promise((resolve, reject) => {
				// Track when upload completed to wait for preview processing
				let completedAt: number | null = null;
				const MAX_PREVIEW_WAIT_TIME = 3 * 60 * 1000; // 3 minutes max wait for preview
				const PREVIEW_POLL_INTERVAL = 2000; // Poll every 2 seconds when waiting for preview
				const NORMAL_POLL_INTERVAL = 500; // Poll every 500ms during normal upload

				// Check if preview was requested
				const previewRequested = options.startTime !== undefined || options.duration !== undefined;

				const poll = async () => {
					try {
						const response = await fetch(`${apiBaseUrl}:6555/api/upload?uploadId=${uploadId}`, {
							signal: abortControllerRef.current?.signal,
						});

						if (!response.ok) {
							// Try to parse error response for better error messages
							let errorMessage = `HTTP error! status: ${response.status}`;
							let errorCode = 'HTTP_ERROR';

							try {
								const errorData = await response.json();
								if (errorData.error) {
									errorMessage = errorData.error;
									if (errorData.details) {
										errorMessage += `: ${errorData.details}`;
									}
									if (errorData.code) {
										errorCode = errorData.code;
									}
								}
							} catch (parseError) {
								console.warn('Could not parse error response:', parseError);
							}

							const error = new Error(errorMessage) as Error & { code?: string };
							error.code = errorCode;
							throw error;
						}

						const status: UploadProgress = await response.json();

						// Update current upload state
						setCurrentUpload(status);

						// Call status change callback
						options.onStatusChange?.(status);

						if (status.status === 'completed') {
							// Track when completion was first detected
							if (completedAt === null) {
								completedAt = Date.now();
								console.log(`🎉 [CLIENT] Upload completed successfully for ${status.fileName}`);
							}

							// If preview was requested and not yet available, continue polling
							if (previewRequested && !status.previewCdn) {
								const waitTime = Date.now() - completedAt;
								if (waitTime < MAX_PREVIEW_WAIT_TIME) {
									console.log(`⏳ [CLIENT] Waiting for preview processing... (${Math.round(waitTime / 1000)}s elapsed)`);
									setTimeout(poll, PREVIEW_POLL_INTERVAL);
									return;
								} else {
									console.warn(
										`⚠️ [CLIENT] Preview not available after ${
											MAX_PREVIEW_WAIT_TIME / 1000
										}s, completing without preview`
									);
								}
							}

							// Preview is available or not requested, resolve
							if (status.previewCdn) {
								console.log(`✨ [CLIENT] Preview CDN available: ${status.previewCdn}`);
							}
							resolve(status);
						} else if (status.status === 'failed') {
							console.error(`❌ [CLIENT] Upload failed: ${status.error}`);
							const error = new Error(status.error || 'Upload failed') as Error & { code?: string };
							error.code = 'UPLOAD_FAILED';
							reject(error);
						} else if (status.status === 'cancelled') {
							console.log(`🛑 [CLIENT] Upload was cancelled`);
							const error = new Error('Upload cancelled by user') as Error & { code?: string };
							error.code = 'UPLOAD_CANCELLED';
							reject(error);
						} else {
							// Still uploading, poll again
							setTimeout(poll, NORMAL_POLL_INTERVAL);
						}
					} catch (err) {
						if (err instanceof Error && err.name === 'AbortError') {
							console.log(`🛑 [CLIENT] Upload polling was aborted`);
							const error = new Error('Upload cancelled') as Error & { code?: string };
							error.code = 'UPLOAD_CANCELLED';
							reject(error);
						} else if (err instanceof Error) {
							console.error(`❌ [CLIENT] Status polling error:`, err);
							reject(err);
						} else {
							console.error(`❌ [CLIENT] Unknown status polling error:`, err);
							reject(new Error('Unknown error occurred during status polling'));
						}
					}
				};

				poll();
			});
		},
		[apiBaseUrl]
	);

	const uploadFile = useCallback(
		async (file: File, options: UploadOptions): Promise<UploadProgress> => {
			try {
				setIsUploading(true);
				setError(null);
				setCurrentUpload(null);

				// Validate and set defaults for media preview options
				const startTime = options.startTime ?? 0;
				const duration = options.duration ?? 30;

				// Validate startTime (must be >= 0)
				if (startTime < 0) {
					throw new Error('startTime must be greater than or equal to 0');
				}

				// Validate duration (must be between 5 and 60 seconds)
				if (duration < 5 || duration > 60) {
					throw new Error('duration must be between 5 and 60 seconds');
				}

				// Detect local network for optimization (do this once)
				const isLocal = isLocalNetwork(apiBaseUrl);

				// Use larger chunks for local networks if not explicitly set, otherwise use conservative defaults
				const chunkSize = options.chunkSize || (isLocal ? LAN_CHUNK_SIZE : DEFAULT_CHUNK_SIZE);
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

				// Validate and set concurrency
				// Auto-increase concurrency for local networks if not explicitly set, otherwise use conservative defaults
				const defaultConcurrency = isLocal && !options.concurrency ? LAN_CONCURRENCY : DEFAULT_CONCURRENCY;
				const maxConcurrency = isLocal ? MAX_CONCURRENCY : INTERNET_MAX_CONCURRENCY;
				const concurrency = Math.max(1, Math.min(maxConcurrency, options.concurrency || defaultConcurrency));
				const limiter = new ConcurrencyLimiter(concurrency);

				if (isLocal) {
					console.log(
						`🏠 [CLIENT] Local network detected - using optimized settings (concurrency: ${concurrency}, chunkSize: ${
							chunkSize / 1024 / 1024
						}MB)`
					);
				}

				// Track completed chunks for progress updates
				const completedChunks = new Set<number>();
				const updateProgress = (chunkIndex: number, chunkProgress: ChunkProgress) => {
					const completedCount = completedChunks.size;

					// Update progress callback
					options.onProgress?.(chunkProgress);

					// Update current upload state
					const updatedProgress: UploadProgress = {
						...initialProgress,
						receivedChunks: completedCount,
						lastUpdate: new Date().toISOString(),
					};
					setCurrentUpload(updatedProgress);
					options.onStatusChange?.(updatedProgress);
				};

				// Upload chunks in parallel with concurrency limit
				console.log(
					`📤 [CLIENT] Starting upload of ${file.name} (${file.size} bytes) in ${totalChunks} chunks with concurrency ${concurrency}`
				);

				// Pre-slice all chunks immediately to avoid delays during upload
				const chunks: Array<{ index: number; blob: Blob }> = [];
				for (let i = 0; i < totalChunks; i++) {
					const start = i * chunkSize;
					const end = Math.min(start + chunkSize, file.size);
					chunks.push({ index: i, blob: file.slice(start, end) });
				}

				// Create all chunk upload promises - chunks are pre-sliced so uploads start immediately
				const chunkPromises = chunks.map(({ index, blob }) => {
					return limiter.execute(async () => {
						console.log(`📦 [CLIENT] Uploading chunk ${index + 1}/${totalChunks} (${blob.size} bytes) for ${file.name}`);
						const chunkProgress = await uploadChunk(blob, uploadId, index, totalChunks, file.name, file.size, options);
						console.log(`✅ [CLIENT] Successfully uploaded chunk ${index + 1}/${totalChunks} for ${file.name}`);

						// Update progress (thread-safe)
						completedChunks.add(index);
						const currentCompleted = completedChunks.size;
						const progress: ChunkProgress = {
							chunkIndex: index,
							totalChunks,
							received: chunkProgress.received || currentCompleted,
							remaining: chunkProgress.remaining || totalChunks - currentCompleted,
							progress: chunkProgress.progress || Math.round((currentCompleted / totalChunks) * 100),
						};

						updateProgress(index, progress);
						return { success: true, chunkIndex: index };
					});
				});

				// Wait for all chunks to complete
				const results = await Promise.allSettled(chunkPromises);

				// Check for failures
				const failures = results.filter((r) => r.status === 'rejected');
				if (failures.length > 0) {
					const firstFailure = failures[0];
					if (firstFailure.status === 'rejected') {
						// Extract the actual error from the rejection
						const error = firstFailure.reason?.error || firstFailure.reason || new Error('One or more chunks failed to upload');
						throw error;
					}
				}

				// Verify all chunks completed successfully
				const successful = results.filter((r) => r.status === 'fulfilled').length;
				if (successful !== totalChunks) {
					throw new Error(`Upload incomplete: ${successful}/${totalChunks} chunks uploaded successfully`);
				}

				console.log(`🎯 [CLIENT] All ${totalChunks} chunks uploaded for ${file.name}, starting S3 upload monitoring`);
				// Start polling for S3 upload completion
				const finalStatus = await pollUploadStatus(uploadId, options);
				setCurrentUpload(finalStatus);
				options.onComplete?.(finalStatus);
				return finalStatus;
			} catch (err) {
				console.error(`❌ [CLIENT] Upload error for ${file.name}:`, err);

				let errorMessage = 'Unknown error occurred';
				let errorCode = 'UNKNOWN_ERROR';
				let shouldRetry = false;

				if (err instanceof Error) {
					errorMessage = err.message;
					errorCode = (err as any).code || 'UNKNOWN_ERROR';

					// Determine if this is a retryable error
					if (
						errorCode === 'NETWORK_ERROR' ||
						errorCode === 'TIMEOUT_ERROR' ||
						errorMessage.includes('network') ||
						errorMessage.includes('timeout')
					) {
						shouldRetry = true;
					}

					// Provide user-friendly error messages
					if (errorCode === 'FILE_TOO_LARGE') {
						errorMessage = `File is too large. Maximum size is ${
							(options.maxFileSize || 5 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)
						}GB`;
					} else if (errorCode === 'VALIDATION_ERROR') {
						errorMessage = 'Invalid file or upload parameters. Please check your file and try again.';
					} else if (errorCode === 'STORAGE_FULL') {
						errorMessage = 'Server storage is full. Please try again later.';
					} else if (errorCode === 'PERMISSION_DENIED') {
						errorMessage = 'You do not have permission to upload files. Please contact support.';
					} else if (errorCode === 'UPLOAD_CANCELLED') {
						errorMessage = 'Upload was cancelled by user';
					} else if (errorCode === 'UPLOAD_FAILED') {
						errorMessage = 'Upload failed. Please try again.';
					}
				}

				// Update upload status to failed
				if (currentUpload) {
					const failedProgress: UploadProgress = {
						...currentUpload,
						status: 'failed',
						error: errorMessage,
						lastUpdate: new Date().toISOString(),
					};
					setCurrentUpload(failedProgress);
					options.onStatusChange?.(failedProgress);
				}

				setError(errorMessage);
				options.onError?.(errorMessage);

				// Create enhanced error object
				const enhancedError = new Error(errorMessage) as Error & {
					code?: string;
					shouldRetry?: boolean;
					originalError?: any;
				};
				enhancedError.code = errorCode;
				enhancedError.shouldRetry = shouldRetry;
				enhancedError.originalError = err;

				throw enhancedError;
			} finally {
				setIsUploading(false);
				abortControllerRef.current = null;
			}
		},
		[generateUploadId, uploadChunk, pollUploadStatus, currentUpload]
	);

	const cancelUpload = useCallback(
		async (uploadId: string): Promise<void> => {
			try {
				// Cancel the current upload if it matches
				if (currentUpload?.uploadId === uploadId) {
					abortControllerRef.current?.abort();
				}

				// Send cancel request to server
				const response = await fetch(`${apiBaseUrl}:6555/api/upload?uploadId=${uploadId}`, {
					method: 'DELETE',
				});

				if (!response.ok) {
					// Try to parse error response for better error messages
					let errorMessage = `HTTP error! status: ${response.status}`;
					let errorCode = 'HTTP_ERROR';

					try {
						const errorData = await response.json();
						if (errorData.error) {
							errorMessage = errorData.error;
							if (errorData.details) {
								errorMessage += `: ${errorData.details}`;
							}
							if (errorData.code) {
								errorCode = errorData.code;
							}
						}
					} catch (parseError) {
						console.warn('Could not parse cancel error response:', parseError);
					}

					const error = new Error(errorMessage) as Error & { code?: string };
					error.code = errorCode;
					throw error;
				}

				console.log(`✅ [CLIENT] Successfully cancelled upload ${uploadId}`);

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
				console.error(`❌ [CLIENT] Cancel upload error for ${uploadId}:`, err);

				let errorMessage = 'Failed to cancel upload';
				let errorCode = 'CANCEL_ERROR';

				if (err instanceof Error) {
					errorMessage = err.message;
					errorCode = (err as any).code || 'CANCEL_ERROR';

					// Provide user-friendly error messages
					if (errorCode === 'UPLOAD_NOT_FOUND_OR_COMPLETED') {
						errorMessage = 'Upload not found or already completed. It may have finished before cancellation.';
					} else if (errorCode === 'INVALID_UPLOAD_ID_FORMAT') {
						errorMessage = 'Invalid upload ID format. Please try again.';
					} else if (errorCode === 'TIMEOUT_ERROR') {
						errorMessage = 'Cancel request timed out. The upload may still be cancelled.';
					} else if (errorCode === 'PERMISSION_ERROR') {
						errorMessage = 'You do not have permission to cancel this upload.';
					}
				}

				setError(errorMessage);

				// Create enhanced error object
				const enhancedError = new Error(errorMessage) as Error & {
					code?: string;
					originalError?: any;
				};
				enhancedError.code = errorCode;
				enhancedError.originalError = err;

				throw enhancedError;
			}
		},
		[currentUpload, abortControllerRef, apiBaseUrl]
	);

	const getUploadStatus = useCallback(
		async (uploadId: string): Promise<UploadProgress> => {
			try {
				const response = await fetch(`${apiBaseUrl}:6555/api/upload?uploadId=${uploadId}`);

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
		},
		[apiBaseUrl]
	);

	return {
		uploadFile,
		cancelUpload,
		getUploadStatus,
		isUploading,
		currentUpload,
		error,
	};
}
