# React Hook for Chunked Uploads

This guide explains how to use the `useChunkedUpload` React hook to integrate chunked file uploads with progress tracking into your React applications.

## 🚀 Quick Start

### Installation

The hook is already included in the project. Import it in your React components:

```typescript
import { useChunkedUpload } from '../hooks/useChunkedUpload';
```

### Basic Usage

```tsx
import React from 'react';
import { useChunkedUpload } from '../hooks/useChunkedUpload';

const MyUploadComponent = () => {
	const { uploadFile, isUploading, currentUpload, error } = useChunkedUpload();

	const handleFileUpload = async (file: File) => {
		try {
			const result = await uploadFile(file, {
				projectId: '999',
				category: 'project',
				folder: 'uploads',
				// Optional: Customize media preview (for video/audio files)
				// startTime: 0, // Start preview at 0 seconds (default: 0)
				// duration: 30, // Preview duration of 30 seconds (default: 30, min: 5, max: 60)
				onProgress: (progress) => {
					console.log(`Chunk ${progress.chunkIndex + 1}/${progress.totalChunks}: ${progress.progress}%`);
				},
				onComplete: (result) => {
					console.log('Upload completed:', result.cdn);
					// Preview URL is available for media files (images, videos, audio)
					if (result.previewCdn) {
						console.log('Preview URL:', result.previewCdn);
					}
				},
				onError: (error) => {
					console.error('Upload failed:', error);
				},
			});
		} catch (err) {
			console.error('Upload error:', err);
		}
	};

	return (
		<div>
			<input type='file' onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} disabled={isUploading} />
			{isUploading && (
				<p>
					Uploading... {currentUpload?.receivedChunks}/{currentUpload?.totalChunks} chunks
				</p>
			)}
			{error && <p style={{ color: 'red' }}>Error: {error}</p>}
		</div>
	);
};
```

## 📚 API Reference

### `useChunkedUpload()`

Returns an object with the following properties and methods:

#### State Properties

-   **`isUploading`**: `boolean` - Whether an upload is currently in progress
-   **`currentUpload`**: `UploadProgress | null` - Current upload progress information
-   **`error`**: `string | null` - Current error message, if any

#### Methods

-   **`uploadFile(file, options)`**: `Promise<UploadProgress>` - Upload a file with progress tracking
-   **`cancelUpload(uploadId)`**: `Promise<void>` - Cancel an ongoing upload
-   **`getUploadStatus(uploadId)`**: `Promise<UploadProgress>` - Get the status of a specific upload

### Types

#### `UploadProgress`

```typescript
interface UploadProgress {
	uploadId: string; // Unique upload identifier
	fileName: string; // Original file name
	fileSize: number; // File size in bytes
	totalChunks: number; // Total number of chunks
	receivedChunks: number; // Number of chunks received
	status: 'uploading' | 'uploading_to_s3' | 'completed' | 'failed' | 'cancelled';
	key?: string; // S3 key (available after completion)
	cdn?: string; // CDN URL (available after completion)
	previewCdn?: string; // Preview CDN URL (available when media processing completes for images/videos/audio)
	error?: string; // Error message (if failed)
	startTime?: string; // Upload start time (ISO string)
	lastUpdate?: string; // Last update time (ISO string)
	percentage?: number; // Upload progress percentage (0-100)
	uploadedSize?: number; // Bytes uploaded so far
}
```

#### `ChunkProgress`

```typescript
interface ChunkProgress {
	chunkIndex: number; // Current chunk index (0-based)
	totalChunks: number; // Total number of chunks
	received: number; // Number of chunks received so far
	remaining: number; // Number of chunks remaining
	progress: number; // Progress percentage (0-100)
}
```

#### `UploadOptions`

```typescript
interface UploadOptions {
	projectId: string; // Project/Product/Profile ID (required)
	category?: 'project' | 'product' | 'profile'; // Category (default: 'project')
	folder?: string; // Subfolder within the project (optional)
	chunkSize?: number; // Chunk size in bytes (default: 5MB)
	startTime?: number; // Start time for media preview in seconds (default: 0)
	duration?: number; // Duration for media preview in seconds (min: 5, max: 60, default: 30)
	onProgress?: (progress: ChunkProgress) => void; // Progress callback
	onStatusChange?: (status: UploadProgress) => void; // Status change callback
	onComplete?: (result: UploadProgress) => void; // Completion callback
	onError?: (error: string) => void; // Error callback
}
```

## 🎯 Advanced Usage

### Custom Progress Tracking

```tsx
const MyAdvancedUploader = () => {
	const { uploadFile, isUploading, currentUpload } = useChunkedUpload();
	const [progress, setProgress] = useState(0);

	const handleUpload = async (file: File) => {
		await uploadFile(file, {
			projectId: '999',
			category: 'project',
			// Optional: Customize media preview (for video/audio files)
			// startTime: 10, // Start preview at 10 seconds
			// duration: 45, // Preview duration of 45 seconds
			onProgress: (chunkProgress) => {
				// Update progress bar
				setProgress(chunkProgress.progress);
				console.log(`Chunk ${chunkProgress.chunkIndex + 1}: ${chunkProgress.progress}%`);
			},
			onStatusChange: (status) => {
				console.log('Status changed:', status.status);
			},
			onComplete: (result) => {
				console.log('Upload completed!', result.cdn);
				if (result.previewCdn) {
					console.log('Preview available:', result.previewCdn);
				}
				setProgress(100);
			},
			onError: (error) => {
				console.error('Upload failed:', error);
				setProgress(0);
			},
		});
	};

	return (
		<div>
			<input type='file' onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
			<div className='progress-bar'>
				<div className='progress-fill' style={{ width: `${progress}%` }} />
			</div>
			{isUploading && (
				<p>
					Uploading: {currentUpload?.receivedChunks}/{currentUpload?.totalChunks} chunks
				</p>
			)}
		</div>
	);
};
```

### Upload Cancellation

```tsx
const CancellableUploader = () => {
	const { uploadFile, cancelUpload, isUploading, currentUpload } = useChunkedUpload();

	const handleCancel = async () => {
		if (currentUpload?.uploadId) {
			try {
				await cancelUpload(currentUpload.uploadId);
				console.log('Upload cancelled');
			} catch (error) {
				console.error('Failed to cancel upload:', error);
			}
		}
	};

	return (
		<div>
			{/* Upload UI */}
			{isUploading && <button onClick={handleCancel}>Cancel Upload</button>}
		</div>
	);
};
```

### Multiple File Uploads

```tsx
const MultipleFileUploader = () => {
	const { uploadFile, isUploading } = useChunkedUpload();
	const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());

	const handleMultipleFiles = async (files: FileList) => {
		const uploadPromises = Array.from(files).map(async (file) => {
			const uploadId = `upload_${Date.now()}_${Math.random()}`;

			try {
				const result = await uploadFile(file, {
					projectId: '999',
					// Optional: Customize media preview (for video/audio files)
					// startTime: 0,
					// duration: 30,
					onStatusChange: (status) => {
						setUploads((prev) => new Map(prev.set(uploadId, status)));
					},
				});

				setUploads((prev) => new Map(prev.set(uploadId, result)));
			} catch (error) {
				console.error(`Upload failed for ${file.name}:`, error);
			}
		});

		await Promise.all(uploadPromises);
	};

	return (
		<div>
			<input type='file' multiple onChange={(e) => e.target.files && handleMultipleFiles(e.target.files)} disabled={isUploading} />

			<div className='upload-list'>
				{Array.from(uploads.values()).map((upload) => (
					<div key={upload.uploadId} className='upload-item'>
						<span>{upload.fileName}</span>
						<span>{upload.status}</span>
						<span>
							{upload.receivedChunks}/{upload.totalChunks} chunks
						</span>
					</div>
				))}
			</div>
		</div>
	);
};
```

## 🎨 Styling Examples

### Tailwind CSS

```tsx
const StyledUploader = () => {
	const { uploadFile, isUploading, currentUpload, error } = useChunkedUpload();

	return (
		<div className='max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg'>
			<h2 className='text-xl font-bold mb-4'>File Upload</h2>

			<input
				type='file'
				onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], { projectId: '999' })}
				className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
				disabled={isUploading}
			/>

			{isUploading && currentUpload && (
				<div className='mt-4'>
					<div className='flex justify-between text-sm text-gray-600 mb-1'>
						<span>Uploading...</span>
						<span>
							{currentUpload.receivedChunks}/{currentUpload.totalChunks} chunks
						</span>
					</div>
					<div className='w-full bg-gray-200 rounded-full h-2'>
						<div
							className='bg-blue-600 h-2 rounded-full transition-all duration-300'
							style={{
								width: `${Math.round((currentUpload.receivedChunks / currentUpload.totalChunks) * 100)}%`,
							}}
						/>
					</div>
				</div>
			)}

			{error && <div className='mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>{error}</div>}
		</div>
	);
};
```

### Material-UI

```tsx
import { Button, LinearProgress, Alert, Box, Typography } from '@mui/material';

const MaterialUploader = () => {
	const { uploadFile, isUploading, currentUpload, error } = useChunkedUpload();

	return (
		<Box sx={{ maxWidth: 400, mx: 'auto', p: 2 }}>
			<Typography variant='h6' gutterBottom>
				File Upload
			</Typography>

			<Button variant='contained' component='label' disabled={isUploading} fullWidth>
				Choose File
				<input type='file' hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], { projectId: '999' })} />
			</Button>

			{isUploading && currentUpload && (
				<Box sx={{ mt: 2 }}>
					<Typography variant='body2' color='text.secondary'>
						Uploading: {currentUpload.receivedChunks}/{currentUpload.totalChunks} chunks
					</Typography>
					<LinearProgress
						variant='determinate'
						value={Math.round((currentUpload.receivedChunks / currentUpload.totalChunks) * 100)}
						sx={{ mt: 1 }}
					/>
				</Box>
			)}

			{error && (
				<Alert severity='error' sx={{ mt: 2 }}>
					{error}
				</Alert>
			)}
		</Box>
	);
};
```

## 🔧 Configuration

### Environment Variables

Make sure to set the API base URL in your environment:

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Custom Chunk Size

```tsx
const CustomChunkUploader = () => {
	const { uploadFile } = useChunkedUpload();

	const handleUpload = async (file: File) => {
		await uploadFile(file, {
			projectId: '999',
			chunkSize: 10 * 1024 * 1024, // 10MB chunks
			// Optional: Customize media preview (for video/audio files)
			// startTime: 5, // Start preview at 5 seconds
			// duration: 20, // Preview duration of 20 seconds
			onProgress: (progress) => {
				console.log(`Progress: ${progress.progress}%`);
			},
		});
	};

	return <input type='file' onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />;
};
```

## 🐛 Error Handling

### Common Errors

1. **Network Errors**: Connection issues or server unavailability
2. **File Size Errors**: Files exceeding the 5GB limit
3. **Upload Cancellation**: User-initiated or timeout cancellations
4. **Server Errors**: Backend processing errors

### Error Handling Best Practices

```tsx
const RobustUploader = () => {
	const { uploadFile, isUploading, error } = useChunkedUpload();
	const [retryCount, setRetryCount] = useState(0);

	const handleUpload = async (file: File) => {
		try {
			await uploadFile(file, {
				projectId: '999',
				// Optional: Customize media preview (for video/audio files)
				// startTime: 0,
				// duration: 30,
				onError: (error) => {
					console.error('Upload error:', error);
					// Implement retry logic
					if (retryCount < 3) {
						setRetryCount((prev) => prev + 1);
						setTimeout(() => handleUpload(file), 1000);
					}
				},
			});
			setRetryCount(0); // Reset on success
		} catch (err) {
			console.error('Upload failed:', err);
		}
	};

	return (
		<div>
			<input type='file' onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={isUploading} />
			{error && (
				<div>
					<p>Error: {error}</p>
					{retryCount > 0 && <p>Retrying... ({retryCount}/3)</p>}
				</div>
			)}
		</div>
	);
};
```

## 📱 Mobile Support

The hook works seamlessly on mobile devices with touch support:

```tsx
const MobileUploader = () => {
	const { uploadFile, isUploading } = useChunkedUpload();

	return (
		<div className='mobile-upload'>
			<input
				type='file'
				onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], { projectId: '999' })}
				disabled={isUploading}
				className='w-full p-4 text-lg'
			/>
			{isUploading && <p>Uploading on mobile...</p>}
		</div>
	);
};
```

## 🖼️ Preview URL Support

For media files (images, videos, audio), the hook automatically receives a preview URL once media processing completes:

```tsx
const MediaUploader = () => {
	const { uploadFile, isUploading, currentUpload } = useChunkedUpload();

	const handleUpload = async (file: File) => {
		const result = await uploadFile(file, {
			projectId: '999',
			// Optional: Customize media preview (for video/audio files)
			startTime: 10, // Start preview at 10 seconds (default: 0)
			duration: 45, // Preview duration of 45 seconds (default: 30, min: 5, max: 60)
			onComplete: (result) => {
				console.log('Original URL:', result.cdn);
				// Preview URL is available for media files after processing completes
				if (result.previewCdn) {
					console.log('Preview URL:', result.previewCdn);
					// Use preview URL for thumbnails, previews, etc.
				}
			},
			onStatusChange: (status) => {
				// Preview URL may appear in status updates once processing completes
				if (status.previewCdn) {
					console.log('Preview now available:', status.previewCdn);
				}
			},
		});
	};

	return (
		<div>
			<input type='file' accept='image/*,video/*,audio/*' onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
			{currentUpload?.previewCdn && (
				<div>
					<p>Preview available:</p>
					<img src={currentUpload.previewCdn} alt='Preview' style={{ maxWidth: '200px' }} />
				</div>
			)}
		</div>
	);
};
```

**Note:** Preview URLs are generated asynchronously after upload completes. The hook will automatically receive the `previewCdn` field in status updates once media processing finishes.

### Customizing Media Preview Options

For video and audio files, you can customize the preview clip by specifying `startTime` and `duration`:

```tsx
const CustomPreviewUploader = () => {
	const { uploadFile, isUploading } = useChunkedUpload();

	const handleUpload = async (file: File) => {
		const result = await uploadFile(file, {
			projectId: '999',
			startTime: 10, // Start preview at 10 seconds (default: 0)
			duration: 45, // Preview duration of 45 seconds (default: 30, min: 5, max: 60)
			onComplete: (result) => {
				console.log('Preview URL:', result.previewCdn);
				// Preview will be a 45-second clip starting at 10 seconds
			},
		});
	};

	return (
		<div>
			<input type='file' accept='video/*,audio/*' onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
		</div>
	);
};
```

**Preview Options:**
- **`startTime`**: Start time in seconds (default: 0, must be >= 0)
- **`duration`**: Duration in seconds (default: 30, must be between 5 and 60)
- If the specified duration exceeds the available media length, it will be clamped to the available duration
- If the startTime + duration exceeds the media length, duration will be adjusted accordingly

## 🚀 Performance Tips

1. **Chunk Size**: Use 5MB chunks for optimal performance
2. **Progress Updates**: Debounce progress updates to avoid excessive re-renders
3. **Memory Management**: The hook automatically handles memory cleanup
4. **Concurrent Uploads**: Limit concurrent uploads to prevent overwhelming the server
5. **Preview URLs**: Preview URLs are available asynchronously - poll status or use `onStatusChange` to detect when they're ready

## 📝 Complete Example

See `src/components/ChunkedUploader.tsx` for a complete, production-ready upload component with drag & drop, progress tracking, and error handling.

## 🤝 Contributing

When extending the hook:

1. Maintain backward compatibility
2. Add proper TypeScript types
3. Include error handling
4. Update this documentation
5. Add tests for new features
