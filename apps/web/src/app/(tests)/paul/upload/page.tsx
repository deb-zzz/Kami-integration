'use client';

import { useState, useRef, useCallback } from 'react';

interface UploadProgress {
	percentage: number;
	totalSize: number;
	uploadedSize: number;
	estimatedTimeRemaining?: number;
	status: 'uploading' | 'completed' | 'failed';
	fileName?: string;
	cdn?: string;
	error?: string;
}

interface UploadResult {
	success: boolean;
	key?: string;
	size?: number;
	method?: string;
	uploadId?: string;
	cdn?: string;
	error?: string;
}

export default function UploadPage() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [projectId, setProjectId] = useState('999');
	const [category, setCategory] = useState('project');
	const [folder, setFolder] = useState('');
	const [isUploading, setIsUploading] = useState(false);
	const [progress, setProgress] = useState<UploadProgress | null>(null);
	const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
	const [showFileInfo, setShowFileInfo] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

	const formatFileSize = useCallback((bytes: number): string => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}, []);

	const formatTime = useCallback((milliseconds: number): string => {
		const seconds = Math.floor(milliseconds / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}, []);

	const handleFileSelect = useCallback((file: File) => {
		setSelectedFile(file);
		setShowFileInfo(true);
		setResult(null);
	}, []);

	const handleFileInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				handleFileSelect(file);
			}
		},
		[handleFileSelect]
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const files = e.dataTransfer.files;
			if (files.length > 0) {
				handleFileSelect(files[0]);
			}
		},
		[handleFileSelect]
	);

	const startProgressTracking = useCallback(
		(uploadId: string, initialCdnUrl?: string) => {
			console.log('Starting progress tracking for uploadId:', uploadId);
			let pollCount = 0;
			const maxPolls = 120; // Stop after 120 seconds (120 polls * 1000ms)

			progressIntervalRef.current = setInterval(async () => {
				try {
					pollCount++;
					console.log(`Fetching progress for uploadId: ${uploadId} (poll ${pollCount})`);
					const response = await fetch(`/api/upload/progress?uploadId=${uploadId}`);

					// Check for server errors immediately
					if (!response.ok) {
						console.error(`Server error: ${response.status} ${response.statusText}`);
						if (progressIntervalRef.current) {
							clearInterval(progressIntervalRef.current);
							progressIntervalRef.current = null;
						}
						setResult({
							message: `Upload failed: Server error ${response.status} - ${response.statusText}`,
							type: 'error',
						});
						resetUpload();
						return;
					}

					const progressData = await response.json();
					console.log('Progress response:', progressData);
					console.log('CDN URL in progress data:', progressData.cdn);

					// Always update progress with server data when available
					// Use initial CDN URL if progress data doesn't have one
					const progressWithCdn = {
						...progressData,
						cdn: progressData.cdn || initialCdnUrl,
					};
					setProgress(progressWithCdn);

					if (progressData.status === 'completed') {
						if (progressIntervalRef.current) {
							clearInterval(progressIntervalRef.current);
							progressIntervalRef.current = null;
						}
						const cdnUrl = progressData.cdn || initialCdnUrl;
						setResult({
							message: `Upload completed!<br>
							<strong>File:</strong> ${progressData.fileName}<br>
							<strong>Size:</strong> ${formatFileSize(progressData.totalSize)}<br>
							<strong>CDN URL:</strong> <a href="${cdnUrl || '#'}" target="_blank">${cdnUrl || 'Available after completion'}</a>`,
							type: 'success',
						});
						// Reset after a short delay to show completion
						setTimeout(() => {
							resetUpload();
						}, 3000);
					} else if (progressData.status === 'failed') {
						if (progressIntervalRef.current) {
							clearInterval(progressIntervalRef.current);
							progressIntervalRef.current = null;
						}
						setResult({
							message: `Upload failed: ${progressData.error || 'Unknown error'}`,
							type: 'error',
						});
						resetUpload();
					} else if (pollCount >= maxPolls) {
						// Timeout after max polls
						console.log('Progress tracking timeout reached');
						if (progressIntervalRef.current) {
							clearInterval(progressIntervalRef.current);
							progressIntervalRef.current = null;
						}
						setProgress((prev) => (prev ? { ...prev, status: 'completed', percentage: 100 } : null));
						setResult({
							message: `Upload completed!<br>
							<strong>Note:</strong> Progress tracking timed out, but upload may still be processing in the background.`,
							type: 'success',
						});
						// Reset after a short delay to show completion
						setTimeout(() => {
							resetUpload();
						}, 3000);
					}
				} catch (error) {
					console.error('Error fetching progress:', error);
					if (progressIntervalRef.current) {
						clearInterval(progressIntervalRef.current);
						progressIntervalRef.current = null;
					}
					setResult({
						message: `Upload failed: Network error - ${error instanceof Error ? error.message : 'Unknown error'}`,
						type: 'error',
					});
					resetUpload();
				}
			}, 1000);
		},
		[formatFileSize]
	);

	const resetUpload = useCallback(() => {
		setIsUploading(false);
		setProgress(null);
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
			progressIntervalRef.current = null;
		}
		abortControllerRef.current = null;
	}, []);

	const uploadFile = useCallback(
		async (file: File, projectId: string, category: string, folder: string) => {
			const formData = new FormData();
			formData.append('file', file);
			if (folder) {
				formData.append('folder', folder);
			}

			const url = `/api/upload?id=${projectId}&c=${category}`;
			abortControllerRef.current = new AbortController();

			setIsUploading(true);
			setResult(null);

			// Initialize progress for all uploads
			setProgress({
				percentage: 0,
				totalSize: file.size,
				uploadedSize: 0,
				status: 'uploading',
				fileName: file.name,
			});

			try {
				const response = await fetch(url, {
					method: 'POST',
					body: formData,
					signal: abortControllerRef.current.signal,
				});

				// Check for server errors before parsing JSON
				if (!response.ok) {
					const errorText = await response.text();
					console.error(`Upload failed: ${response.status} ${response.statusText}`, errorText);
					setResult({
						message: `Upload failed: Server error ${response.status} - ${response.statusText}`,
						type: 'error',
					});
					resetUpload();
					return;
				}

				const result: UploadResult = await response.json();
				console.log('Initial upload response:', result);

				if (response.ok) {
					// Update progress to show completion
					setProgress({
						percentage: 100,
						totalSize: result.size || file.size,
						uploadedSize: result.size || file.size,
						status: 'completed',
						fileName: file.name,
					});

					if (result.uploadId) {
						setResult({
							message: `Upload started!<br>
							<strong>File:</strong> ${result.key}<br>
							<strong>Size:</strong> ${formatFileSize(result.size || 0)}<br>
							<strong>Method:</strong> ${result.method}<br>
							<strong>Upload ID:</strong> ${result.uploadId}`,
							type: 'success',
						});
						startProgressTracking(result.uploadId, result.cdn);
					} else {
						setResult({
							message: `Upload successful!<br>
							<strong>File:</strong> ${result.key}<br>
							<strong>CDN URL:</strong> <a href="${result.cdn}" target="_blank">${result.cdn}</a><br>
							<strong>Size:</strong> ${formatFileSize(result.size || 0)}<br>
							<strong>Method:</strong> ${result.method}`,
							type: 'success',
						});
						// Reset after a short delay to show completion
						setTimeout(() => {
							resetUpload();
						}, 2000);
					}
				} else {
					setResult({
						message: `Upload failed: ${result.error}`,
						type: 'error',
					});
					resetUpload();
				}
			} catch (error: any) {
				if (error.name === 'AbortError') {
					setResult({
						message: 'Upload cancelled.',
						type: 'error',
					});
				} else {
					setResult({
						message: `Upload failed: ${error.message}`,
						type: 'error',
					});
				}
				resetUpload();
			}
		},
		[formatFileSize, startProgressTracking]
	);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!selectedFile) {
				setResult({
					message: 'Please select a file to upload.',
					type: 'error',
				});
				return;
			}
			await uploadFile(selectedFile, projectId, category, folder);
		},
		[selectedFile, projectId, category, folder, uploadFile]
	);

	const handleCancel = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Also stop progress tracking
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
			progressIntervalRef.current = null;
		}

		setResult({
			message: 'Upload cancelled.',
			type: 'error',
		});
		setIsUploading(false);
		setProgress(null);
	}, []);

	return (
		<div className='min-h-screen bg-gray-100 py-8'>
			<div className='max-w-4xl mx-auto px-4'>
				<div className='bg-white rounded-lg shadow-lg p-8'>
					<h1 className='text-3xl font-bold text-gray-900 mb-4'>File Upload with Progress Tracking</h1>
					<p className='text-gray-600 mb-8'>
						Upload files up to 5GB with real-time progress tracking. Files larger than 100MB will use multipart upload.
					</p>

					<form onSubmit={handleSubmit} className='space-y-6'>
						<div className='space-y-4'>
							<div>
								<label htmlFor='projectId' className='block text-sm font-medium text-gray-700 mb-2'>
									Project ID:
								</label>
								<input
									type='text'
									id='projectId'
									value={projectId}
									onChange={(e) => setProjectId(e.target.value)}
									required
									className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
								/>
							</div>

							<div>
								<label htmlFor='category' className='block text-sm font-medium text-gray-700 mb-2'>
									Category:
								</label>
								<select
									id='category'
									value={category}
									onChange={(e) => setCategory(e.target.value)}
									className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
								>
									<option value='project'>Project</option>
									<option value='product'>Product</option>
									<option value='profile'>Profile</option>
								</select>
							</div>

							<div>
								<label htmlFor='folder' className='block text-sm font-medium text-gray-700 mb-2'>
									Folder (optional):
								</label>
								<input
									type='text'
									id='folder'
									value={folder}
									onChange={(e) => setFolder(e.target.value)}
									placeholder='e.g., Videos, Images'
									className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500'
								/>
							</div>
						</div>

						<div
							className='border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors'
							onClick={() => fileInputRef.current?.click()}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
						>
							<input
								ref={fileInputRef}
								type='file'
								onChange={handleFileInputChange}
								accept='*/*'
								className='hidden'
								aria-label='Select file to upload'
							/>
							<p className='text-lg text-gray-600 mb-2'>Click to select a file or drag and drop</p>
							<p className='text-sm text-gray-500'>Maximum file size: 5GB</p>
						</div>

						{showFileInfo && selectedFile && (
							<div className='bg-gray-50 rounded-lg p-4'>
								<p className='text-gray-900'>
									<strong>Selected file:</strong> {selectedFile.name}
								</p>
								<p className='text-gray-900'>
									<strong>Size:</strong> {formatFileSize(selectedFile.size)}
								</p>
							</div>
						)}

						{progress && (
							<div className='space-y-3'>
								<div className='flex justify-between items-center'>
									<span className='text-sm font-medium text-gray-700'>{progress.fileName}</span>
									<span className='text-sm font-semibold text-blue-600'>{progress.percentage}%</span>
								</div>
								<div className='w-full bg-gray-200 rounded-full h-3 overflow-hidden'>
									<div
										className='h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-300 ease-out'
										style={{ width: `${progress.percentage}%` }}
									/>
								</div>
								<div className='flex justify-between text-sm text-gray-600'>
									<span>
										{formatFileSize(progress.uploadedSize)} / {formatFileSize(progress.totalSize)}
									</span>
									<span className='text-blue-600 font-medium'>
										{progress.status === 'uploading'
											? 'Uploading...'
											: progress.status === 'completed'
											? 'Completed!'
											: progress.status === 'failed'
											? 'Failed'
											: progress.status}
									</span>
								</div>
								{progress.status === 'uploading' && progress.percentage > 0 && (
									<div className='text-xs text-gray-500 text-center'>
										{Math.round((progress.uploadedSize / progress.totalSize) * 100)}% complete
									</div>
								)}
							</div>
						)}

						<div className='flex gap-4'>
							<button
								type='submit'
								disabled={isUploading}
								className='bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed'
							>
								{isUploading ? 'Uploading...' : 'Upload File'}
							</button>
							{isUploading && (
								<button
									type='button'
									onClick={handleCancel}
									className='bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-6 rounded-lg transition-colors'
								>
									Cancel Upload
								</button>
							)}
						</div>
					</form>

					{result && (
						<div
							className={`mt-6 p-4 rounded-lg ${
								result.type === 'success'
									? 'bg-green-50 border border-green-200 text-green-800'
									: 'bg-red-50 border border-red-200 text-red-800'
							}`}
						>
							<div dangerouslySetInnerHTML={{ __html: result.message }} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
