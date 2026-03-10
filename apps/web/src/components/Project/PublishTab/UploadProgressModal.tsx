'use client';

import { Modal, ModalContent, ModalBody, Progress } from '@nextui-org/react';
import { UploadProgress } from '@/lib/chunked-upload-package';

interface UploadProgressModalProps {
	isOpen: boolean;
	uploadProgress: UploadProgress | null;
	onClose: () => void;
}

export default function UploadProgressModal({ isOpen, uploadProgress, onClose }: UploadProgressModalProps) {
	if (!uploadProgress) return null;

	const getStatusMessage = (status: string) => {
		switch (status) {
			case 'uploading':
				return uploadProgress.receivedChunks === uploadProgress.totalChunks ? 'Uploading...' : 'Uploading ....';
			case 'uploading_to_s3':
				return 'Uploading to S3...';
			case 'completed':
				return 'Upload completed';
			case 'failed':
				return 'Upload failed';
			case 'cancelled':
				return 'Upload cancelled';
			default:
				return 'Uploading...';
		}
	};

	const getProgressPercentage = () => {
		const chunkProgress = Math.round((uploadProgress.receivedChunks / uploadProgress.totalChunks) * 100);

		// If all chunks are received and we have S3 progress, show combined progress
		if (uploadProgress.receivedChunks === uploadProgress.totalChunks && uploadProgress.percentage !== undefined) {
			// Combined progress: 50% for chunk completion + 50% for S3 progress
			return Math.round(50 + uploadProgress.percentage * 0.5);
		}

		// Otherwise show chunk progress
		return chunkProgress;
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} isDismissable={false} hideCloseButton>
			<ModalContent className='bg-[#6c6c6b] text-white p-6 max-w-md'>
				<ModalBody className='text-center'>
					<div className='flex flex-col items-center gap-4'>
						{/* Upload Icon */}
						<div className='w-16 h-16 bg-[#11FF49] rounded-full flex items-center justify-center'>
							<svg
								className='w-8 h-8 text-black'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
								xmlns='http://www.w3.org/2000/svg'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
								/>
							</svg>
						</div>

						{/* Upload Status */}
						<div className='text-center'>
							<h3 className='text-lg font-semibold text-white mb-2'>{getStatusMessage(uploadProgress.status)}</h3>
							<p className='text-sm text-gray-300 mb-1'>{uploadProgress.fileName}</p>
							<p className='text-xs text-gray-400'>{formatBytes(uploadProgress.fileSize)}</p>
						</div>

						{/* Progress Bar */}
						<div className='w-full'>
							<Progress
								value={getProgressPercentage()}
								color='success'
								className='w-full'
								classNames={{
									track: 'bg-gray-700',
									indicator: 'bg-[#11FF49]',
								}}
							/>
							<div className='flex justify-between text-xs text-gray-400 mt-2'>
								<span>{getProgressPercentage()}%</span>
								<span>
									{uploadProgress.receivedChunks}/{uploadProgress.totalChunks} chunks
								</span>
							</div>
						</div>

						{/* Additional Status Info */}
						{uploadProgress.status === 'uploading' && uploadProgress.receivedChunks === uploadProgress.totalChunks && (
							<div className='text-xs text-gray-400'>Uploading to cloud storage...</div>
						)}

						{uploadProgress.status === 'completed' && (
							<div className='text-center'>
								<div className='w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2'>
									<svg className='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
									</svg>
								</div>
								<p className='text-sm text-green-400 font-medium'>Upload Successful!</p>
							</div>
						)}

						{uploadProgress.status === 'failed' && (
							<div className='text-center'>
								<div className='w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2'>
									<svg className='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
									</svg>
								</div>
								<p className='text-sm text-red-400 font-medium'>Upload Failed</p>
								{uploadProgress.error && <p className='text-xs text-red-300 mt-1'>{uploadProgress.error}</p>}
							</div>
						)}
					</div>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}
