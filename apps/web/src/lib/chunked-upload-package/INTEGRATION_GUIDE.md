# Integration Guide

This guide will help you integrate the chunked upload hook into your existing project.

## Step 1: Copy the Package

Copy the entire `chunked-upload-package` folder to your project. You can place it anywhere in your project structure, for example:

```
your-project/
├── src/
│   ├── components/
│   ├── hooks/
│   └── utils/
├── chunked-upload-package/  ← Copy here
│   ├── hooks/
│   ├── components/
│   ├── utils/
│   └── types/
└── ...
```

## Step 2: Install Dependencies

Install the required dependencies in your project:

```bash
npm install @aws-sdk/client-s3
```

If you're using TypeScript, also install the type definitions:

```bash
npm install --save-dev @types/react @types/react-dom typescript
```

## Step 3: Set Environment Variables

Add these environment variables to your `.env.local` file:

```env
NEXT_PUBLIC_UPLOAD_API_URL=https://your-api-domain.com
CDN_URL=https://your-cdn-domain.com
```

## Step 4: Configure Your Backend

Your backend needs to handle the following API endpoints:

### POST /api/upload

Handles chunk uploads.

**Query Parameters:**

-   `id`: Project ID
-   `c`: Category ('project', 'product', or 'profile')

**Request Body (FormData):**

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

Gets upload status.

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

Cancels an upload.

## Step 5: Basic Integration

### Using the Hook

```tsx
import { useChunkedUpload } from './chunked-upload-package/hooks/useChunkedUpload';

function MyUploadComponent() {
	const { uploadFile, isUploading, currentUpload, error } = useChunkedUpload();

	const handleFileUpload = async (file: File) => {
		try {
			const result = await uploadFile(file, {
				projectId: 'your-project-id',
				category: 'project',
				folder: 'uploads',
				onComplete: (result) => {
					console.log('Upload completed:', result.cdn);
				},
				onError: (error) => {
					console.error('Upload failed:', error);
				},
			});
		} catch (err) {
			console.error('Upload failed:', err);
		}
	};

	return (
		<div>
			<input type='file' onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
			{isUploading && <p>Uploading...</p>}
			{error && <p>Error: {error}</p>}
		</div>
	);
}
```

### Using the Component

```tsx
import ChunkedUploader from './chunked-upload-package/components/ChunkedUploader';

function MyPage() {
	return (
		<ChunkedUploader
			projectId='your-project-id'
			category='project'
			folder='uploads'
			onUploadComplete={(result) => {
				console.log('Upload completed:', result.cdn);
			}}
			onUploadError={(error) => {
				console.error('Upload failed:', error);
			}}
		/>
	);
}
```

## Step 6: Styling

The component uses Tailwind CSS classes. Make sure Tailwind CSS is configured in your project, or customize the styles in `ChunkedUploader.module.css`.

If you're not using Tailwind, you can replace the classes with your preferred CSS framework or custom styles.

## Step 7: Advanced Usage

### Custom Progress Tracking

```tsx
import { useChunkedUpload } from './chunked-upload-package/hooks/useChunkedUpload';
import { calculateTotalProgress, formatBytes } from './chunked-upload-package/utils/upload-helpers';

function AdvancedUploadComponent() {
	const { uploadFile, isUploading, currentUpload } = useChunkedUpload();
	const [progress, setProgress] = useState(0);

	const handleUpload = async (file: File) => {
		await uploadFile(file, {
			projectId: 'your-project-id',
			onProgress: (chunkProgress) => {
				if (currentUpload) {
					const totalProgress = calculateTotalProgress(currentUpload, chunkProgress);
					setProgress(totalProgress);
				}
			},
			onStatusChange: (status) => {
				console.log('Status:', status.status);
				if (status.cdn) {
					console.log('File URL:', status.cdn);
				}
			},
		});
	};

	return (
		<div>
			{/* Your upload UI */}
			{isUploading && (
				<div>
					<p>Uploading: {currentUpload?.fileName}</p>
					<p>Progress: {progress}%</p>
					<p>Size: {currentUpload ? formatBytes(currentUpload.fileSize) : 'Unknown'}</p>
				</div>
			)}
		</div>
	);
}
```

### Multiple File Uploads

```tsx
function MultipleUploadComponent() {
	const { uploadFile } = useChunkedUpload();
	const [uploads, setUploads] = useState<Map<string, any>>(new Map());

	const handleMultipleFiles = async (files: FileList) => {
		const uploadPromises = Array.from(files).map(async (file) => {
			const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			setUploads((prev) => new Map(prev.set(uploadId, { file, status: 'pending' })));

			try {
				const result = await uploadFile(file, {
					projectId: 'your-project-id',
					onStatusChange: (status) => {
						setUploads((prev) => new Map(prev.set(uploadId, { ...prev.get(uploadId), status })));
					},
				});

				setUploads((prev) => new Map(prev.set(uploadId, { ...prev.get(uploadId), result })));
			} catch (error) {
				setUploads((prev) => new Map(prev.set(uploadId, { ...prev.get(uploadId), error })));
			}
		});

		await Promise.all(uploadPromises);
	};

	return (
		<div>
			<input type='file' multiple onChange={(e) => e.target.files && handleMultipleFiles(e.target.files)} />

			{Array.from(uploads.entries()).map(([uploadId, upload]) => (
				<div key={uploadId}>
					<p>{upload.file.name}</p>
					<p>Status: {upload.status}</p>
				</div>
			))}
		</div>
	);
}
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Working**

    - Make sure your environment variables are prefixed with `NEXT_PUBLIC_` for client-side access
    - Restart your development server after adding environment variables

2. **CORS Issues**

    - Ensure your backend API allows CORS requests from your frontend domain
    - Check that the API endpoints are accessible

3. **File Size Limits**

    - The default chunk size is 5MB
    - Large files are automatically split into chunks
    - Make sure your server can handle the chunked uploads

4. **TypeScript Errors**
    - Make sure you have the correct type definitions installed
    - Check that your TypeScript configuration includes the package files

### Debug Mode

Enable debug logging by adding this to your component:

```tsx
const { uploadFile } = useChunkedUpload();

const handleUpload = async (file: File) => {
	await uploadFile(file, {
		projectId: 'your-project-id',
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
};
```

## Support

For issues and questions, refer to the main README.md file or check the example-usage.tsx file for complete implementation examples.
