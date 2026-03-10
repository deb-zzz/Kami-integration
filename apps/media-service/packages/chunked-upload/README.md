# @paulstinchcombe/chunked-upload

A React hook for chunked file uploads with progress tracking, retry logic, and media preview support.

## Features

- 📦 **Chunked Uploads**: Automatically splits large files into chunks (default 5MB)
- ⚡ **Parallel Uploads**: Uploads multiple chunks concurrently for faster upload speeds (configurable concurrency)
- 📊 **Progress Tracking**: Real-time upload progress with chunk-level and overall progress
- 🔄 **Retry Logic**: Automatic retry with exponential backoff for failed chunks
- 🎬 **Media Preview**: Support for video/audio preview generation with custom start time and duration
- 🛑 **Cancellation**: Cancel ongoing uploads
- 📱 **TypeScript**: Full TypeScript support with comprehensive type definitions
- ⚙️ **Configurable**: Flexible API base URL configuration via environment variables or runtime options

## Installation

```bash
npm install @paulstinchcombe/chunked-upload
# or
yarn add @paulstinchcombe/chunked-upload
# or
pnpm add @paulstinchcombe/chunked-upload
```

## Requirements

- React 18.0.0 or higher (or React 19.0.0+)
- A backend API that supports chunked uploads (see API requirements below)

## Quick Start

```tsx
import { useChunkedUpload } from '@paulstinchcombe/chunked-upload';

function MyComponent() {
  const { uploadFile, isUploading, currentUpload, error } = useChunkedUpload();

  const handleFileSelect = async (file: File) => {
    try {
      const result = await uploadFile(file, {
        projectId: 'your-project-id',
        category: 'project',
        startTime: 0, // Optional: Start preview at 0 seconds (default: 0)
        duration: 30, // Optional: 30 second preview (default: 30, min: 5, max: 60)
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress.progress}%`);
        },
        onComplete: (result) => {
          console.log('Upload completed!', result.cdn);
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
      <input
        type="file"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
        disabled={isUploading}
      />
      {isUploading && currentUpload && (
        <div>
          <p>Uploading: {currentUpload.fileName}</p>
          <p>
            Progress: {currentUpload.receivedChunks}/{currentUpload.totalChunks} chunks
          </p>
        </div>
      )}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Configuration

### API Base URL

The hook supports multiple ways to configure the API base URL:

#### Option 1: Environment Variable (Recommended)

Set one of these environment variables:

```bash
# For Next.js projects
NEXT_PUBLIC_UPLOAD_API_URL=https://api.example.com

# For Create React App projects
REACT_APP_UPLOAD_API_URL=https://api.example.com
```

#### Option 2: Runtime Configuration

Pass the API base URL directly to the hook:

```tsx
const { uploadFile } = useChunkedUpload({
  apiBaseUrl: 'https://api.example.com',
});
```

The runtime configuration takes precedence over environment variables.

## API Reference

### `useChunkedUpload(options?)`

The main hook for chunked file uploads.

#### Parameters

- `options` (optional): `UseChunkedUploadOptions`
  - `apiBaseUrl` (optional): Override the API base URL

#### Returns

- `uploadFile`: Function to upload a file
- `cancelUpload`: Function to cancel an ongoing upload
- `getUploadStatus`: Function to get the status of an upload
- `isUploading`: Boolean indicating if an upload is in progress
- `currentUpload`: Current upload progress object or null
- `error`: Error message string or null

### `uploadFile(file, options)`

Uploads a file in chunks.

#### Parameters

- `file`: `File` - The file to upload
- `options`: `UploadOptions`
  - `projectId`: `string` - Required project identifier
  - `category`: `'project' | 'product' | 'profile'` - Optional category (default: `'project'`)
  - `folder`: `string` - Optional folder path
  - `chunkSize`: `number` - Optional chunk size in bytes (default: 5MB)
  - `maxFileSize`: `number` - Optional maximum file size in bytes
  - `maxRetries`: `number` - Optional maximum retry attempts (default: 3)
  - `retryDelay`: `number` - Optional base retry delay in milliseconds (default: 1000)
  - `concurrency`: `number` - Optional number of chunks to upload concurrently (default: 3, min: 1, max: 10). Higher values increase upload speed but may overwhelm the server or network.
  - `startTime`: `number` - Optional start time for media preview in seconds (default: 0)
  - `duration`: `number` - Optional duration for media preview in seconds (min: 5, max: 60, default: 30)
  - `onProgress`: `(progress: ChunkProgress) => void` - Optional progress callback
  - `onStatusChange`: `(status: UploadProgress) => void` - Optional status change callback
  - `onComplete`: `(result: UploadProgress) => void` - Optional completion callback
  - `onError`: `(error: string) => void` - Optional error callback

#### Returns

Promise that resolves to `UploadProgress` when upload completes.

### `cancelUpload(uploadId)`

Cancels an ongoing upload.

#### Parameters

- `uploadId`: `string` - The upload ID to cancel

#### Returns

Promise that resolves when cancellation is complete.

### `getUploadStatus(uploadId)`

Gets the current status of an upload.

#### Parameters

- `uploadId`: `string` - The upload ID to check

#### Returns

Promise that resolves to `UploadProgress`.

## Type Definitions

### `UploadProgress`

```typescript
interface UploadProgress {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  receivedChunks: number;
  status: 'uploading' | 'uploading_to_s3' | 'completed' | 'failed' | 'cancelled';
  key?: string;
  cdn?: string;
  previewCdn?: string;
  error?: string;
  startTime?: string;
  lastUpdate?: string;
  percentage?: number;
  uploadedSize?: number;
}
```

### `ChunkProgress`

```typescript
interface ChunkProgress {
  chunkIndex: number;
  totalChunks: number;
  received: number;
  remaining: number;
  progress: number;
}
```

### `UploadOptions`

See the `uploadFile` parameters section above for details.

## Examples

### Basic Upload

```tsx
import { useChunkedUpload } from '@paulstinchcombe/chunked-upload';

function BasicUpload() {
  const { uploadFile, isUploading } = useChunkedUpload();

  const handleUpload = async (file: File) => {
    await uploadFile(file, {
      projectId: '123',
      category: 'project',
    });
  };

  return (
    <input
      type="file"
      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      disabled={isUploading}
    />
  );
}
```

### Upload with Progress Tracking

```tsx
import { useChunkedUpload } from '@paulstinchcombe/chunked-upload';

function UploadWithProgress() {
  const { uploadFile, currentUpload } = useChunkedUpload();
  const [progress, setProgress] = useState(0);

  const handleUpload = async (file: File) => {
    await uploadFile(file, {
      projectId: '123',
      startTime: 0, // Optional: Start preview at 0 seconds (default: 0)
      duration: 30, // Optional: 30 second preview (default: 30, min: 5, max: 60)
      onProgress: (chunkProgress) => {
        setProgress(chunkProgress.progress);
      },
      onStatusChange: (status) => {
        console.log('Status:', status.status);
      },
      onComplete: (result) => {
        console.log('CDN URL:', result.cdn);
        if (result.previewCdn) {
          console.log('Preview URL:', result.previewCdn);
        }
      },
    });
  };

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      {currentUpload && (
        <div>
          <progress value={progress} max={100} />
          <p>{progress}%</p>
        </div>
      )}
    </div>
  );
}
```

### Upload with Media Preview

```tsx
import { useChunkedUpload } from '@paulstinchcombe/chunked-upload';

function UploadWithPreview() {
  const { uploadFile } = useChunkedUpload();

  const handleUpload = async (file: File) => {
    const result = await uploadFile(file, {
      projectId: '123',
      startTime: 10, // Start preview at 10 seconds
      duration: 30, // 30 second preview
      onComplete: (result) => {
        if (result.previewCdn) {
          console.log('Preview URL:', result.previewCdn);
        }
      },
    });
  };

  return <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />;
}
```

### Upload with Custom Concurrency

Increase upload speed by uploading multiple chunks in parallel:

```tsx
import { useChunkedUpload } from '@paulstinchcombe/chunked-upload';

function FastUpload() {
  const { uploadFile } = useChunkedUpload();

  const handleUpload = async (file: File) => {
    await uploadFile(file, {
      projectId: '123',
      concurrency: 5, // Upload 5 chunks simultaneously (default: 3)
      // Higher concurrency = faster uploads, but may overwhelm server/network
      // Recommended: 3-5 for most cases, up to 10 for very fast connections
    });
  };

  return <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />;
}
```

### Cancellable Upload

```tsx
import { useChunkedUpload } from '@paulstinchcombe/chunked-upload';

function CancellableUpload() {
  const { uploadFile, cancelUpload, currentUpload, isUploading } = useChunkedUpload();

  const handleUpload = async (file: File) => {
    await uploadFile(file, {
      projectId: '123',
    });
  };

  const handleCancel = () => {
    if (currentUpload?.uploadId) {
      cancelUpload(currentUpload.uploadId);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      {isUploading && (
        <button onClick={handleCancel}>Cancel Upload</button>
      )}
    </div>
  );
}
```

## Backend API Requirements

Your backend API should support the following endpoints:

### POST `/api/upload`

Upload a chunk of a file.

**Query Parameters:**
- `id`: Project ID
- `c`: Category (`project`, `product`, or `profile`)

**Form Data:**
- `chunk`: The file chunk (Blob)
- `uploadId`: Unique upload identifier
- `chunkIndex`: Zero-based chunk index
- `totalChunks`: Total number of chunks
- `fileName`: Original file name
- `fileSize`: Original file size in bytes
- `folder`: (Optional) Folder path
- `startTime`: (Optional) Start time for media preview
- `duration`: (Optional) Duration for media preview

**Response:**
```json
{
  "message": "Chunk received",
  "uploadId": "chunked_1234567890_abc123",
  "chunkIndex": 0,
  "totalChunks": 10,
  "received": 1,
  "remaining": 9,
  "progress": 10
}
```

### GET `/api/upload?uploadId={uploadId}`

Get the status of an upload.

**Response:**
```json
{
  "uploadId": "chunked_1234567890_abc123",
  "fileName": "example.mp4",
  "fileSize": 52428800,
  "totalChunks": 10,
  "receivedChunks": 10,
  "status": "completed",
  "key": "Project/123/example.mp4",
  "cdn": "https://cdn.example.com/Project/123/example.mp4",
  "previewCdn": "https://cdn.example.com/Project/123/example_preview.mp4"
}
```

### DELETE `/api/upload?uploadId={uploadId}`

Cancel an ongoing upload.

**Response:**
```json
{
  "message": "Upload cancelled",
  "uploadId": "chunked_1234567890_abc123"
}
```

## Error Handling

The hook provides comprehensive error handling with retry logic for network errors and server errors (5xx, 408, 429). Errors include:

- `FILE_TOO_LARGE`: File exceeds maximum size
- `VALIDATION_ERROR`: Invalid file or parameters
- `STORAGE_FULL`: Server storage is full
- `PERMISSION_DENIED`: User lacks permission
- `UPLOAD_CANCELLED`: Upload was cancelled
- `UPLOAD_FAILED`: Upload failed
- `NETWORK_ERROR`: Network connectivity issue
- `TIMEOUT_ERROR`: Request timeout

## License

MIT

## Author

Paul Stinchcombe

