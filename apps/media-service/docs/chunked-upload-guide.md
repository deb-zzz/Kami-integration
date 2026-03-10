# Chunked Upload Implementation

This implementation provides chunked file uploads with real-time progress indication as the **default and only upload method**. It solves the issue where large files had to be fully uploaded to the backend before any progress indication was available.

## How It Works

### Frontend Process

1. **File Selection**: User selects a file (up to 5GB)
2. **Chunking**: File is split into 5MB chunks on the frontend
3. **Sequential Upload**: Chunks are uploaded one by one to the backend
4. **Progress Tracking**: Real-time progress indication throughout the process
5. **Status Monitoring**: Frontend monitors backend progress for S3 upload

### Backend Process

1. **Chunk Reception**: Backend receives and stores individual chunks
2. **File Assembly**: When all chunks are received, file is reassembled
3. **S3 Upload**: Reassembled file is uploaded to S3 using multipart upload
4. **Progress Tracking**: Progress is tracked through both phases

## API Endpoints

### POST /api/upload

Upload a file chunk to the backend (main upload endpoint).

**Parameters:**

-   `chunk`: The file chunk (FormData)
-   `uploadId`: Unique identifier for this upload
-   `chunkIndex`: Index of this chunk (0-based)
-   `totalChunks`: Total number of chunks
-   `fileName`: Original filename
-   `fileSize`: Total file size in bytes
-   `folder`: Optional folder name
-   `id`: Project ID (query parameter)
-   `c`: Category (query parameter)

**Response:**

```json
{
	"message": "Chunk received",
	"uploadId": "chunked_1234567890_abc123",
	"chunkIndex": 0,
	"totalChunks": 10,
	"received": 1,
	"remaining": 9
}
```

### GET /api/upload?uploadId=xxx

Get the current status of an upload.

**Response:**

```json
{
	"uploadId": "chunked_1234567890_abc123",
	"fileName": "large-file.zip",
	"fileSize": 52428800,
	"totalChunks": 10,
	"receivedChunks": 10,
	"status": "uploading_to_s3",
	"uploadedSize": 26214400,
	"percentage": 50,
	"elapsedTime": 30000,
	"estimatedTimeRemaining": 30000
}
```

### DELETE /api/upload?uploadId=xxx

Cancel an ongoing upload.

**Response:**

```json
{
	"message": "Upload cancelled successfully"
}
```

## File Structure

```
src/
├── app/api/upload/
│   └── route.ts              # Main upload API endpoint (chunked)
├── app/api/upload/progress/
│   └── route.ts              # Progress tracking endpoint
└── lib/
    ├── chunk-manager.ts      # Chunk storage and reassembly
    ├── s3-upload.ts          # Enhanced S3 uploader with buffer support
    └── progress.ts           # Progress tracking system

tests/
├── test-chunked-upload.js    # Node.js test script
├── upload-example.html        # Basic upload testing interface
└── upload-with-progress.html  # Upload with progress tracking interface
```

## Key Features

### 1. Immediate Progress Indication

-   Progress starts immediately when first chunk is uploaded
-   No waiting for entire file to be uploaded to backend
-   Real-time chunk progress and overall progress

### 2. Robust Error Handling

-   Individual chunk retry logic
-   Upload cancellation support
-   Comprehensive error reporting

### 3. Memory Efficient

-   Chunks are processed individually
-   Temporary files are cleaned up automatically
-   No need to load entire file into memory

### 4. Scalable Architecture

-   Chunk size is configurable (default: 5MB)
-   Supports files up to 5GB
-   Automatic cleanup of old uploads

### 5. Proper MIME Type Detection

-   Automatic content type detection based on file extension
-   Video files stream instead of download
-   Support for all major media formats (MP4, MP3, JPG, PNG, etc.)
-   Fallback to `application/octet-stream` for unknown types

## Configuration

### Chunk Size

Default chunk size is 5MB. You can modify this in:

-   Frontend: `DEFAULT_CHUNK_SIZE` constant in `src/hooks/useChunkedUpload.ts` or `CHUNK_SIZE` in test HTML files (`tests/upload-example.html`, `tests/upload-with-progress.html`)
-   Backend: `CHUNK_SIZE` constant in `src/app/api/upload/route.ts`

### File Size Limits

Maximum file size is 5GB. Modify `MAX_FILE_SIZE` in `src/app/api/upload/route.ts` if needed.

### Temporary Storage

Chunks are stored in `/tmp/chunked-uploads/` by default. Ensure this directory is writable.

## Testing

### 1. HTML Interface

Open the test HTML files in a browser to test with various file sizes:

```bash
# Basic upload testing
open tests/upload-example.html

# Upload with progress tracking
open tests/upload-with-progress.html

# Progress tracking system testing
open tests/test-progress.html
```

### 2. Node.js Test Script

```bash
node tests/test-chunked-upload.js
```

### 3. Manual API Testing

Use the provided endpoints with tools like Postman or curl. See `tests/test.http` for API testing examples.

## Performance Benefits

### Before (Original Implementation)

-   Large files had to be fully uploaded to backend before any progress indication
-   Memory usage: Entire file loaded into memory
-   User experience: Long wait with no feedback

### After (Chunked Implementation)

-   Progress indication starts immediately
-   Memory usage: Only 5MB chunks in memory at a time
-   User experience: Continuous feedback and ability to cancel

## Monitoring and Debugging

### Logs

The system provides detailed logging:

-   Chunk reception and storage
-   File assembly progress
-   S3 upload progress
-   Error conditions

### Progress Tracking

Multiple progress indicators:

-   Chunk upload progress (frontend to backend)
-   File assembly progress
-   S3 upload progress (backend to S3)

## Cleanup

The system automatically cleans up:

-   Temporary chunk files after successful upload
-   Failed uploads after 1 hour
-   Old progress records after 1 hour

## Security Considerations

-   Upload IDs are generated with timestamp and random components
-   Temporary files are stored in a restricted directory
-   File size limits prevent abuse
-   Input validation on all parameters

## Future Enhancements

1. **Parallel Chunk Upload**: Upload multiple chunks simultaneously
2. **Resume Capability**: Resume interrupted uploads
3. **Encryption**: Encrypt chunks during transmission
4. **Compression**: Compress chunks before upload
5. **CDN Integration**: Direct upload to CDN for better performance
