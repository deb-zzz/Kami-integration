import React, { useState } from 'react';
import { useChunkedUpload, UploadProgress } from './hooks/useChunkedUpload';
import ChunkedUploader from './components/ChunkedUploader';

// Example 1: Basic Hook Usage
function BasicUploadExample() {
	const { uploadFile, cancelUpload, isUploading, currentUpload, error } = useChunkedUpload();
	const [uploadResults, setUploadResults] = useState<UploadProgress[]>([]);

	const handleFileUpload = async (file: File) => {
		try {
			const result = await uploadFile(file, {
				projectId: 'your-project-id',
				category: 'project',
				folder: 'uploads',
				onProgress: (progress) => {
					console.log('Chunk progress:', progress);
				},
				onStatusChange: (status) => {
					console.log('Upload status:', status);
				},
				onComplete: (result) => {
					console.log('Upload completed:', result);
					setUploadResults((prev) => [...prev, result]);
				},
				onError: (error) => {
					console.error('Upload error:', error);
				},
			});
		} catch (err) {
			console.error('Upload failed:', err);
		}
	};

	return (
		<div className='p-6'>
			<h2 className='text-2xl font-bold mb-4'>Basic Hook Usage</h2>

			<input type='file' onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} className='mb-4' />

			{isUploading && currentUpload && (
				<div className='mb-4 p-4 bg-blue-50 rounded-lg'>
					<p>Uploading: {currentUpload.fileName}</p>
					<p>
						Progress: {currentUpload.receivedChunks}/{currentUpload.totalChunks} chunks
					</p>
					<button onClick={() => cancelUpload(currentUpload.uploadId)} className='mt-2 px-3 py-1 bg-red-500 text-white rounded'>
						Cancel Upload
					</button>
				</div>
			)}

			{error && <div className='mb-4 p-4 bg-red-50 text-red-700 rounded-lg'>Error: {error}</div>}

			{uploadResults.length > 0 && (
				<div className='mt-4'>
					<h3 className='text-lg font-semibold mb-2'>Upload Results:</h3>
					{uploadResults.map((result, index) => (
						<div key={result.uploadId} className='p-3 bg-green-50 rounded-lg mb-2'>
							<p>
								<strong>File:</strong> {result.fileName}
							</p>
							<p>
								<strong>Size:</strong> {(result.fileSize / (1024 * 1024)).toFixed(2)} MB
							</p>
							{result.cdn && (
								<p>
									<strong>URL:</strong>{' '}
									<a href={result.cdn} target='_blank' rel='noopener noreferrer'>
										{result.cdn}
									</a>
								</p>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// Example 2: Using the Complete Component
function ComponentExample() {
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
		<div className='p-6'>
			<h2 className='text-2xl font-bold mb-4'>Component Usage</h2>

			<ChunkedUploader
				projectId='your-project-id'
				category='project'
				folder='uploads'
				onUploadComplete={handleUploadComplete}
				onUploadError={handleUploadError}
			/>

			{/* Upload Results */}
			{uploadResults.length > 0 && (
				<div className='mt-8'>
					<h3 className='text-xl font-bold mb-4'>Upload Results</h3>
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
												className='text-blue-600 hover:text-blue-800 break-all text-xs'>
												{result.cdn}
											</a>
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Upload Errors */}
			{uploadErrors.length > 0 && (
				<div className='mt-8'>
					<h3 className='text-xl font-bold mb-4'>Upload Errors</h3>
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
			)}
		</div>
	);
}

// Example 3: Custom Upload with Progress Tracking
function CustomUploadExample() {
	const { uploadFile, isUploading, currentUpload } = useChunkedUpload();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number>(0);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files?.[0]) {
			setSelectedFile(e.target.files[0]);
		}
	};

	const handleUpload = async () => {
		if (!selectedFile) return;

		try {
			await uploadFile(selectedFile, {
				projectId: 'your-project-id',
				category: 'product',
				folder: 'products',
				onProgress: (progress) => {
					setUploadProgress(progress.progress);
					console.log(`Chunk ${progress.chunkIndex + 1}/${progress.totalChunks}: ${progress.progress}%`);
				},
				onStatusChange: (status) => {
					console.log('Status:', status.status);
				},
				onComplete: (result) => {
					console.log('Upload completed:', result);
					alert(`Upload completed! File URL: ${result.cdn}`);
				},
				onError: (error) => {
					console.error('Upload error:', error);
					alert(`Upload failed: ${error}`);
				},
			});
		} catch (err) {
			console.error('Upload failed:', err);
		}
	};

	return (
		<div className='p-6'>
			<h2 className='text-2xl font-bold mb-4'>Custom Upload with Progress</h2>

			<div className='mb-4'>
				<input type='file' onChange={handleFileSelect} className='mb-2' />
				{selectedFile && (
					<p className='text-sm text-gray-600'>
						Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
					</p>
				)}
			</div>

			<button
				onClick={handleUpload}
				disabled={!selectedFile || isUploading}
				className='px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300'>
				{isUploading ? 'Uploading...' : 'Upload File'}
			</button>

			{isUploading && currentUpload && (
				<div className='mt-4 p-4 bg-blue-50 rounded-lg'>
					<p className='font-medium'>Uploading: {currentUpload.fileName}</p>
					<div className='mt-2'>
						<div className='flex justify-between text-sm text-gray-600 mb-1'>
							<span>Progress</span>
							<span>{uploadProgress}%</span>
						</div>
						<div className='w-full bg-gray-200 rounded-full h-2'>
							<div
								className='bg-blue-600 h-2 rounded-full transition-all duration-300'
								style={{ width: `${uploadProgress}%` }}
							/>
						</div>
						<p className='text-sm text-gray-600 mt-1'>
							{currentUpload.receivedChunks}/{currentUpload.totalChunks} chunks uploaded
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

// Main Example Component
export default function ChunkedUploadExamples() {
	return (
		<div className='min-h-screen bg-gray-100 py-8'>
			<div className='container mx-auto px-4'>
				<h1 className='text-3xl font-bold text-center mb-8 text-gray-800'>Chunked Upload Hook Examples</h1>

				<div className='max-w-6xl mx-auto space-y-12'>
					<BasicUploadExample />
					<ComponentExample />
					<CustomUploadExample />
				</div>
			</div>
		</div>
	);
}
