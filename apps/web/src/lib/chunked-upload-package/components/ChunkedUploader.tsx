import React, { useState } from 'react';
import { useChunkedUpload, UploadProgress, ChunkProgress } from '../hooks/useChunkedUpload';
import styles from './ChunkedUploader.module.css';

interface ChunkedUploaderProps {
	projectId: string;
	category?: 'project' | 'product' | 'profile';
	folder?: string;
	onUploadComplete?: (result: UploadProgress) => void;
	onUploadError?: (error: string) => void;
	className?: string;
}

export const ChunkedUploader: React.FC<ChunkedUploaderProps> = ({
	projectId,
	category = 'project',
	folder,
	onUploadComplete,
	onUploadError,
	className = '',
}) => {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [dragActive, setDragActive] = useState(false);
	const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null);

	const { uploadFile, cancelUpload, isUploading, currentUpload, error } = useChunkedUpload();

	const handleFileSelect = (file: File) => {
		setSelectedFile(file);
		setChunkProgress(null);
	};

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === 'dragenter' || e.type === 'dragover') {
			setDragActive(true);
		} else if (e.type === 'dragleave') {
			setDragActive(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			handleFileSelect(e.dataTransfer.files[0]);
		}
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			handleFileSelect(e.target.files[0]);
		}
	};

	const handleUpload = async () => {
		if (!selectedFile) return;

		try {
			const result = await uploadFile(selectedFile, {
				projectId,
				category,
				folder,
				onProgress: (progress) => {
					setChunkProgress(progress);
				},
				onStatusChange: (status) => {
					console.log('Upload status changed:', status);
				},
				onComplete: (result) => {
					console.log('Upload completed:', result);
					onUploadComplete?.(result);
				},
				onError: (error) => {
					console.error('Upload error:', error);
					onUploadError?.(error);
				},
			});
		} catch (err) {
			console.error('Upload failed:', err);
			onUploadError?.(err instanceof Error ? err.message : 'Upload failed');
		}
	};

	const handleCancel = async () => {
		if (currentUpload?.uploadId) {
			try {
				await cancelUpload(currentUpload.uploadId);
				setSelectedFile(null);
				setChunkProgress(null);
			} catch (err) {
				console.error('Cancel failed:', err);
			}
		}
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'completed':
				return 'text-green-600';
			case 'failed':
				return 'text-red-600';
			case 'cancelled':
				return 'text-gray-600';
			case 'uploading':
				return 'text-blue-600';
			default:
				return 'text-gray-600';
		}
	};

	return (
		<div className={`max-w-2xl mx-auto p-6 ${className}`}>
			<div className='bg-white rounded-lg shadow-lg p-6'>
				<h2 className='text-2xl font-bold mb-6 text-gray-800'>Chunked File Upload</h2>

				{/* File Drop Zone */}
				<div
					className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
						dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
					}`}
					onDragEnter={handleDrag}
					onDragLeave={handleDrag}
					onDragOver={handleDrag}
					onDrop={handleDrop}>
					<input type='file' onChange={handleFileInputChange} className='hidden' id='file-upload' disabled={isUploading} />
					<label htmlFor='file-upload' className='cursor-pointer block'>
						<div className='text-6xl text-gray-400 mb-4'>📁</div>
						<p className='text-lg text-gray-600 mb-2'>
							{dragActive ? 'Drop the file here' : 'Drag & drop a file here, or click to select'}
						</p>
						<p className='text-sm text-gray-500'>Supports files up to 5GB with chunked upload</p>
					</label>
				</div>

				{/* Selected File Info */}
				{selectedFile && (
					<div className='mt-4 p-4 bg-gray-50 rounded-lg'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='font-medium text-gray-800'>{selectedFile.name}</p>
								<p className='text-sm text-gray-600'>
									{formatBytes(selectedFile.size)} • {Math.ceil(selectedFile.size / (5 * 1024 * 1024))} chunks
								</p>
							</div>
							{!isUploading && (
								<button onClick={() => setSelectedFile(null)} className='text-red-500 hover:text-red-700'>
									✕
								</button>
							)}
						</div>
					</div>
				)}

				{/* Upload Progress */}
				{isUploading && currentUpload && (
					<div className='mt-6'>
						<div className='flex items-center justify-between mb-2'>
							<span className='text-sm font-medium text-gray-700'>Upload Progress</span>
							<span className='text-sm text-gray-500'>
								{currentUpload.receivedChunks}/{currentUpload.totalChunks} chunks
							</span>
						</div>

						{/* Chunk Progress */}
						{chunkProgress && (
							<div className='mb-4'>
								<div className='flex items-center justify-between mb-1'>
									<span className='text-xs text-gray-600'>Chunk Upload</span>
									<span className='text-xs text-gray-500'>{chunkProgress.progress}%</span>
								</div>
								<div className={styles.chunkProgressContainer}>
									<div
										className={styles.chunkProgressBar}
										// eslint-disable-next-line @next/next/no-css-tags
										style={{ width: `${chunkProgress.progress}%` }}
									/>
								</div>
							</div>
						)}

						{/* Overall Progress */}
						<div className='mt-4'>
							<div className='flex items-center justify-between mb-1'>
								<span className='text-xs text-gray-600'>Overall Progress</span>
								<span className='text-xs text-gray-500'>
									{(() => {
										const chunkProgress = Math.round((currentUpload.receivedChunks / currentUpload.totalChunks) * 100);

										// If all chunks are received and we have S3 progress, show combined progress
										if (
											currentUpload.receivedChunks === currentUpload.totalChunks &&
											currentUpload.percentage !== undefined
										) {
											// Combined progress: 50% for chunk completion + 50% for S3 progress
											const combinedProgress = Math.round(50 + currentUpload.percentage * 0.5);
											return `${combinedProgress}%`;
										}

										// Otherwise show chunk progress
										return `${chunkProgress}%`;
									})()}
								</span>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2'>
								<div
									className='bg-green-600 h-2 rounded-full transition-all duration-300'
									// eslint-disable-next-line @next/next/no-css-tags
									style={{
										width: (() => {
											const chunkProgress = Math.round(
												(currentUpload.receivedChunks / currentUpload.totalChunks) * 100
											);

											// If all chunks are received and we have S3 progress, show combined progress
											if (
												currentUpload.receivedChunks === currentUpload.totalChunks &&
												currentUpload.percentage !== undefined
											) {
												// Combined progress: 50% for chunk completion + 50% for S3 progress
												const combinedProgress = Math.round(50 + currentUpload.percentage * 0.5);
												return `${combinedProgress}%`;
											}

											// Otherwise show chunk progress
											return `${chunkProgress}%`;
										})(),
									}}
								/>
							</div>
						</div>

						<div className='mt-2 flex items-center justify-between'>
							<span className='text-sm text-gray-600'>
								Status:{' '}
								<span className={getStatusColor(currentUpload.status)}>
									{currentUpload.status === 'uploading' && currentUpload.receivedChunks === currentUpload.totalChunks
										? 'Uploading ....'
										: currentUpload.status === 'uploading'
										? 'Uploading ...'
										: currentUpload.status}
								</span>
							</span>
							<button onClick={handleCancel} className='px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600'>
								Cancel
							</button>
						</div>
					</div>
				)}

				{/* Upload Result */}
				{currentUpload?.status === 'completed' && (
					<div className='mt-6 p-4 bg-green-50 border border-green-200 rounded-lg'>
						<div className='flex items-center mb-2'>
							<span className='text-green-600 text-xl mr-2'>✅</span>
							<span className='font-medium text-green-800'>Upload Completed!</span>
						</div>
						<p className='text-sm text-green-700 mb-2'>
							File: {currentUpload.fileName} ({formatBytes(currentUpload.fileSize)})
						</p>
						{currentUpload.cdn && (
							<div className='mt-2'>
								<p className='text-sm text-green-700 mb-1'>CDN URL:</p>
								<a
									href={currentUpload.cdn}
									target='_blank'
									rel='noopener noreferrer'
									className='text-sm text-blue-600 hover:text-blue-800 break-all'>
									{currentUpload.cdn}
								</a>
							</div>
						)}
					</div>
				)}

				{/* Error Display */}
				{error && (
					<div className='mt-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
						<div className='flex items-center'>
							<span className='text-red-600 text-xl mr-2'>❌</span>
							<span className='font-medium text-red-800'>Upload Error</span>
						</div>
						<p className='text-sm text-red-700 mt-1'>{error}</p>
					</div>
				)}

				{/* Upload Button */}
				<div className='mt-6 flex justify-end'>
					<button
						onClick={handleUpload}
						disabled={!selectedFile || isUploading}
						className={`px-6 py-2 rounded-lg font-medium transition-colors ${
							!selectedFile || isUploading
								? 'bg-gray-300 text-gray-500 cursor-not-allowed'
								: 'bg-blue-600 text-white hover:bg-blue-700'
						}`}>
						{isUploading ? 'Uploading...' : 'Upload File'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default ChunkedUploader;
