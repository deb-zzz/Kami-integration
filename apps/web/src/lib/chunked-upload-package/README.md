# Chunked Upload Hook Package

A portable React hook for chunked file uploads with progress tracking, cancellation support, and drag & drop functionality.

## Features

-   **Chunked Uploads**: Automatically splits large files into 5MB chunks
-   **Real-time Progress**: Track upload progress with detailed status updates
-   **Upload Cancellation**: Cancel ongoing uploads at any time
-   **Drag & Drop Support**: Modern file selection interface
-   **Large File Support**: Handle files up to 5GB
-   **TypeScript Support**: Full TypeScript definitions included

## Installation

Copy this entire `chunked-upload-package` folder to your project and install the required dependencies:

```bash
npm install @aws-sdk/client-s3 react
```

## Quick Start

### 1. Basic Hook Usage

```tsx
import { useChunkedUpload } from './chunked-upload-package/hooks/useChunkedUpload';

function MyUploadComponent() {
	const { uploadFile, cancelUpload, isUploading, currentUpload, error } = useChunkedUpload();

	const handleUpload = async (file: File) => {
		try {
			const result = await uploadFile(file, {
				projectId: 'your-project-id',
				category: 'project', // or 'product' | 'profile'
				folder: 'optional-folder',
				onProgress: (progress) => {
					console.log('Chunk progress:', progress);
				},
				onStatusChange: (status) => {
					console.log('Upload status:', status);
				},
				onComplete: (result) => {
					console.log('Upload completed:', result);
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
		<div>
			<input type='file' onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
			{isUploading && (
				<div>
					<p>
						Uploading... {currentUpload?.receivedChunks}/{currentUpload?.totalChunks} chunks
					</p>
					<button onClick={() => currentUpload && cancelUpload(currentUpload.uploadId)}>Cancel</button>
				</div>
			)}
		</div>
	);
}
```

### 2. Using the Complete Component

```tsx
import ChunkedUploader from './chunked-upload-package/components/ChunkedUploader';

function MyPage() {
	const handleUploadComplete = (result) => {
		console.log('Upload completed:', result);
		// Access result.cdn for the file URL
	};

	const handleUploadError = (error) => {
		console.error('Upload failed:', error);
	};

	return (
		<ChunkedUploader
			projectId='your-project-id'
			category='project'
			folder='uploads'
			onUploadComplete={handleUploadComplete}
			onUploadError={handleUploadError}
		/>
	);
}
```

## API Reference

### useChunkedUpload Hook

#### Return Values

-   `uploadFile(file, options)`: Upload a file with chunked upload
-   `cancelUpload(uploadId)`: Cancel an ongoing upload
-   `getUploadStatus(uploadId)`: Get current upload status
-   `isUploading`: Boolean indicating if an upload is in progress
-   `currentUpload`: Current upload progress object
-   `error`: Current error message

#### UploadOptions

```typescript
interface UploadOptions {
	projectId: string; // Required: Your project ID
	category?: 'project' | 'product' | 'profile'; // Optional: Default 'project'
	folder?: string; // Optional: Subfolder in S3
	chunkSize?: number; // Optional: Default 5MB
	onProgress?: (progress: ChunkProgress) => void;
	onStatusChange?: (status: UploadProgress) => void;
	onComplete?: (result: UploadProgress) => void;
	onError?: (error: string) => void;
}
```

#### UploadProgress Interface

```typescript
interface UploadProgress {
	uploadId: string;
	fileName: string;
	fileSize: number;
	totalChunks: number;
	receivedChunks: number;
	status: 'uploading' | 'uploading_to_s3' | 'completed' | 'failed' | 'cancelled';
	key?: string; // S3 key
	cdn?: string; // CDN URL for the uploaded file
	error?: string;
	startTime?: string;
	lastUpdate?: string;
	percentage?: number; // S3 upload progress percentage
	uploadedSize?: number; // Bytes uploaded to S3
}
```

### ChunkedUploader Component

#### Props

```typescript
interface ChunkedUploaderProps {
	projectId: string; // Required: Your project ID
	category?: 'project' | 'product' | 'profile'; // Optional: Default 'project'
	folder?: string; // Optional: Subfolder in S3
	onUploadComplete?: (result: UploadProgress) => void;
	onUploadError?: (error: string) => void;
	className?: string; // Optional: Additional CSS classes
}
```

## Backend Requirements

This package requires a backend API with the following endpoints:

### POST /api/upload

Upload a file chunk.

**Query Parameters:**

-   `id`: Project ID
-   `c`: Category ('project', 'product', or 'profile')

**Body (FormData):**

-   `chunk`: File chunk blob
-   `uploadId`: Unique upload identifier
-   `chunkIndex`: Current chunk index
-   `totalChunks`: Total number of chunks
-   `fileName`: Original file name
-   `fileSize`: Total file size in bytes
-   `folder`: Optional subfolder

**Response:**

```json
{
	"chunkIndex": 0,
	"totalChunks": 10,
	"received": 1,
	"remaining": 9,
	"progress": 10
}
```

### GET /api/upload?uploadId={uploadId}

Get upload status.

**Response:**

```json
{
	"uploadId": "chunked_1234567890_abc123",
	"fileName": "example.mp4",
	"fileSize": 104857600,
	"totalChunks": 20,
	"receivedChunks": 20,
	"status": "completed",
	"key": "projects/123/videos/example.mp4",
	"cdn": "https://cdn.example.com/projects/123/videos/example.mp4",
	"percentage": 100,
	"uploadedSize": 104857600
}
```

### DELETE /api/upload?uploadId={uploadId}

Cancel an upload.

## Environment Variables

Set these environment variables in your project:

```env
NEXT_PUBLIC_UPLOAD_API_URL=https://your-api-domain.com
CDN_URL=https://your-cdn-domain.com
```

## Styling

The component uses Tailwind CSS classes. Make sure Tailwind CSS is configured in your project, or customize the styles in `ChunkedUploader.module.css`.

## Error Handling

The hook provides comprehensive error handling:

-   Network errors during chunk upload
-   Server errors (4xx, 5xx responses)
-   Upload cancellation
-   File validation errors
-   S3 upload failures

## Examples

See `example-usage.tsx` for complete integration examples.

## License

This package is part of the KAMI Platform Media Service.
