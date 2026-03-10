# Robust File Upload System

This document describes the enhanced file upload system that can handle large files efficiently and reliably.

## Features

### 🚀 **Large File Support**

-   **Up to 5GB** file size limit
-   **Automatic multipart upload** for files > 100MB
-   **Streaming upload** to avoid memory issues
-   **Chunked processing** for optimal performance

### 📊 **Progress Tracking**

-   Real-time upload progress monitoring
-   Upload status tracking (uploading, completed, failed)
-   Estimated time remaining
-   Error reporting with details

### ⚡ **Performance Optimizations**

-   **Memory efficient**: Uses streaming instead of loading entire file into memory
-   **Parallel processing**: Multipart uploads use concurrent chunk uploads
-   **Automatic retry**: Built-in error handling and recovery
-   **Configurable thresholds**: Optimized for different file sizes

## API Endpoints

### 1. Upload File

```
POST /api/upload?id={projectId}&c={category}
Content-Type: multipart/form-data

Form Data:
- file: The file to upload
- folder: (optional) Subfolder within the project
```

**Query Parameters:**

-   `id`: Project/Product/Profile ID (required)
-   `c`: Category - "project", "product", or "profile" (default: "project")

**Response:**

```json
{
	"message": "Upload successful",
	"key": "Project/123/folder/filename.jpg",
	"cdn": "https://cdn.example.com/Project/123/folder/filename.jpg",
	"size": 1048576,
	"method": "multipart",
	"uploadId": "upload_1234567890_abc123def"
}
```

### 2. Check Upload Progress

```
GET /api/upload/progress?uploadId={uploadId}
```

**Response:**

```json
{
	"uploadId": "upload_1234567890_abc123def",
	"fileName": "large-video.mp4",
	"totalSize": 1073741824,
	"uploadedSize": 536870912,
	"percentage": 50,
	"status": "uploading",
	"elapsedTime": 30000,
	"estimatedTimeRemaining": 30000
}
```

### 3. Update Progress (Internal)

```
POST /api/upload/progress
Content-Type: application/json

{
  "uploadId": "upload_1234567890_abc123def",
  "fileName": "large-video.mp4",
  "totalSize": 1073741824,
  "uploadedSize": 536870912,
  "status": "uploading"
}
```

## Configuration

### File Size Limits

-   **Maximum file size**: 5GB
-   **Multipart threshold**: 100MB (files larger than this use multipart upload)
-   **Chunk size**: 10MB (for multipart uploads)

### Next.js Configuration

The system is configured to handle large payloads:

```javascript
// next.config.mjs
experimental: {
  bodyParser: {
    sizeLimit: '5gb',
  },
},
api: {
  bodyParser: {
    sizeLimit: '5gb',
  },
  responseLimit: false,
}
```

## Usage Examples

### JavaScript/TypeScript Client

```javascript
async function uploadFile(file, projectId, category = 'project', folder = '') {
	const formData = new FormData();
	formData.append('file', file);
	if (folder) formData.append('folder', folder);

	const response = await fetch(`/api/upload?id=${projectId}&c=${category}`, {
		method: 'POST',
		body: formData,
	});

	const result = await response.json();

	if (result.uploadId) {
		// Track progress for large files
		trackProgress(result.uploadId);
	}

	return result;
}

async function trackProgress(uploadId) {
	const checkProgress = async () => {
		const response = await fetch(`/api/upload/progress?uploadId=${uploadId}`);
		const progress = await response.json();

		console.log(`Upload progress: ${progress.percentage}%`);

		if (progress.status === 'completed') {
			console.log('Upload completed!');
		} else if (progress.status === 'failed') {
			console.error('Upload failed:', progress.error);
		} else {
			setTimeout(checkProgress, 1000);
		}
	};

	checkProgress();
}
```

### cURL Example

```bash
# Upload a file
curl -X POST "http://localhost:3000/api/upload?id=999&c=project" \
  -F "file=@large-video.mp4" \
  -F "folder=Videos"

# Check progress
curl "http://localhost:3000/api/upload/progress?uploadId=upload_1234567890_abc123def"
```

## Error Handling

### Common Error Responses

**File too large:**

```json
{
	"error": "File too large. Maximum size is 5GB"
}
```

Status: 413

**Missing required parameters:**

```json
{
	"error": "id is missing from url parameters"
}
```

Status: 400

**Upload failed:**

```json
{
	"error": "Upload failed",
	"details": "Failed to upload part 3"
}
```

Status: 500

### Progress Tracking Errors

```json
{
	"error": "Upload not found"
}
```

Status: 404

## Performance Characteristics

### Small Files (< 100MB)

-   Uses standard S3 `putObject`
-   Fast upload with minimal overhead
-   Progress tracking shows immediate completion

### Large Files (> 100MB)

-   Uses S3 multipart upload
-   10MB chunks for optimal performance
-   Real-time progress updates
-   Automatic retry on chunk failures
-   Memory efficient streaming

### Memory Usage

-   **Before**: Entire file loaded into memory (could cause OOM for large files)
-   **After**: Streaming with 10MB chunks (constant memory usage regardless of file size)

## Monitoring and Debugging

### Logs

The system provides detailed logging:

```
Using multipart upload for file: large-video.mp4 (1073741824 bytes)
Using regular upload for file: image.jpg (1048576 bytes)
```

### Progress Tracking

-   Upload progress is stored in memory (use Redis in production)
-   Automatic cleanup after 1 hour for completed uploads
-   Manual cleanup available via DELETE endpoint

## Production Considerations

### Scaling

-   **Progress Storage**: Replace in-memory storage with Redis for multiple instances
-   **Load Balancing**: Ensure sticky sessions for progress tracking
-   **Monitoring**: Add metrics for upload success rates and performance

### Security

-   **File Validation**: Add file type validation
-   **Rate Limiting**: Implement upload rate limiting
-   **Authentication**: Add proper authentication/authorization

### Environment Variables

```bash
AWS_REGION=us-east-1
ACCESS_KEY=your-access-key
SECRET_KEY=your-secret-key
BUCKET_NAME=your-bucket-name
CDN_URL=https://your-cdn-domain.com
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Testing

Use the provided `tests/upload-example.html` for testing the upload system with a web interface, or use the examples in `tests/test.http` for API testing.

The system has been tested with:

-   ✅ Small files (< 1MB)
-   ✅ Medium files (1-100MB)
-   ✅ Large files (100MB-5GB)
-   ✅ Multiple concurrent uploads
-   ✅ Network interruptions and recovery
