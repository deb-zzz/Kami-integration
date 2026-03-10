'use client';

import React, { useState } from 'react';
import ChunkedUploader from '../../../components/ChunkedUploader';
import { UploadProgress } from '../../../hooks/useChunkedUpload';

const UploadExample: React.FC = () => {
	const [uploadResults, setUploadResults] = useState<UploadProgress[]>([]);
	const [uploadErrors, setUploadErrors] = useState<string[]>([]);

	const handleUploadComplete = (result: UploadProgress) => {
		console.log('Upload completed successfully:', result);
		setUploadResults((prev) => [...prev, result]);
	};

	const handleUploadError = (error: string) => {
		console.error('Upload failed:', error);
		setUploadErrors((prev) => [...prev, error]);
	};

	return (
		<div className='min-h-screen bg-gray-100 py-8'>
			<div className='container mx-auto px-4'>
				<h1 className='text-3xl font-bold text-center mb-8 text-gray-800'>KAMI Platform Media Service</h1>

				<div className='max-w-4xl mx-auto'>
					<ChunkedUploader
						projectId='999'
						category='project'
						folder='Pauls_uploads'
						onUploadComplete={handleUploadComplete}
						onUploadError={handleUploadError}
					/>
				</div>

				{/* Upload Results */}
				{uploadResults.length > 0 && (
					<div className='mt-8 max-w-4xl mx-auto'>
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h2 className='text-xl font-bold mb-4 text-gray-800'>Upload Results</h2>
							<div className='space-y-4'>
								{uploadResults.map((result, index) => (
									<div key={result.uploadId} className='border border-green-200 rounded-lg p-4 bg-green-50'>
										<div className='flex items-center mb-2'>
											<span className='text-green-600 text-xl mr-2'>✅</span>
											<span className='font-medium text-green-800'>Upload #{index + 1} Completed</span>
										</div>
										<div className='text-sm text-green-700 space-y-1'>
											<p>
												<strong>File:</strong> {result.fileName}
											</p>
											<p>
												<strong>Size:</strong> {(result.fileSize / (1024 * 1024)).toFixed(2)} MB
											</p>
											<p>
												<strong>Chunks:</strong> {result.receivedChunks}/{result.totalChunks}
											</p>
											{result.cdn && (
												<div className='mt-2'>
													<p>
														<strong>CDN URL:</strong>
													</p>
													<a
														href={result.cdn}
														target='_blank'
														rel='noopener noreferrer'
														className='text-blue-600 hover:text-blue-800 break-all text-xs'
													>
														{result.cdn}
													</a>
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Upload Errors */}
				{uploadErrors.length > 0 && (
					<div className='mt-8 max-w-4xl mx-auto'>
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h2 className='text-xl font-bold mb-4 text-gray-800'>Upload Errors</h2>
							<div className='space-y-2'>
								{uploadErrors.map((error, index) => (
									<div key={index} className='border border-red-200 rounded-lg p-4 bg-red-50'>
										<div className='flex items-center'>
											<span className='text-red-600 text-xl mr-2'>❌</span>
											<span className='font-medium text-red-800'>Error #{index + 1}</span>
										</div>
										<p className='text-sm text-red-700 mt-1'>{error}</p>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				<div className='mt-12 max-w-4xl mx-auto'>
					<div className='bg-white rounded-lg shadow-lg p-6'>
						<h2 className='text-xl font-bold mb-4 text-gray-800'>Features</h2>
						<div className='grid md:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<h3 className='font-semibold text-gray-700'>Upload Features</h3>
								<ul className='text-sm text-gray-600 space-y-1'>
									<li>• Chunked uploads (5MB chunks)</li>
									<li>• Real-time progress tracking</li>
									<li>• Upload cancellation</li>
									<li>• Drag & drop support</li>
									<li>• Files up to 5GB</li>
								</ul>
							</div>
							<div className='space-y-2'>
								<h3 className='font-semibold text-gray-700'>Media Support</h3>
								<ul className='text-sm text-gray-600 space-y-1'>
									<li>• Video streaming (MP4, AVI, MOV)</li>
									<li>• Audio playback (MP3, WAV, FLAC)</li>
									<li>• Image display (JPG, PNG, GIF)</li>
									<li>• Document viewing (PDF, DOC)</li>
									<li>• Automatic MIME type detection</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default UploadExample;
