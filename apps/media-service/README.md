# KAMI Platform Media Service

A robust Next.js-based media service for handling file uploads, S3 operations, CDN management, and automatic media processing for the KAMI platform. This service provides efficient chunked file upload capabilities with support for large files (up to 5GB), real-time progress tracking, comprehensive S3 integration, and automatic media optimization.

## 🌟 Features

### **Advanced Chunked Upload System**
- ✅ **Large file support** up to 5GB with chunked uploads
- ✅ **Client-side chunking** for immediate progress feedback
- ✅ **Memory efficient** processing with 5MB chunks
- ✅ **Real-time progress tracking** for both chunk upload and S3 transfer
- ✅ **Automatic file reassembly** on the server
- ✅ **Automatic retry** and error recovery
- ✅ **Upload cancellation** support

### **S3 Integration**
- ✅ **Direct file uploads** to Amazon S3
- ✅ **Presigned URL generation** for secure uploads
- ✅ **Object listing** with folder filtering
- ✅ **CDN URL generation** for public access
- ✅ **Project/Product/Profile** categorization
- ✅ **Multipart upload** for files > 100MB

### **Automatic Media Processing** 🆕
- ✅ **Image Optimization** - Generates lower quality preview versions (larger than thumbnails)
- ✅ **Video Clipping** - Extracts 1-minute preview clips with custom start points
- ✅ **Audio Clipping** - Extracts 1-minute preview clips with custom start points
- ✅ **Smart Detection** - Only processes media files (images, videos, audio)
- ✅ **Non-Blocking** - Processing happens asynchronously after upload
- ✅ **Configurable** - Customize dimensions, quality, and clip duration

### **Smart Media Handling**
- ✅ **Automatic MIME type detection** based on file extensions
- ✅ **Video streaming** - MP4, AVI, MOV, WebM files stream instead of download
- ✅ **Audio playback** - MP3, WAV, FLAC files play in browser
- ✅ **Image display** - JPG, PNG, GIF, WebP files display directly
- ✅ **Document viewing** - PDF, DOC files open in browser
- ✅ **Comprehensive format support** for all major media types

### **Performance Optimizations**
- ✅ **Memory efficient**: Chunked processing prevents memory issues
- ✅ **Parallel processing**: Concurrent chunk uploads for large files
- ✅ **Configurable chunk size**: 5MB chunks for optimal performance
- ✅ **Automatic cleanup**: Temporary files cleaned up after upload
- ✅ **Docker support**: Containerized deployment ready

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Usage Examples](#usage-examples)
- [Media Processing](#media-processing)
- [Docker Deployment](#docker-deployment)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

## 📋 Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- AWS S3 bucket with appropriate permissions
- Docker (optional, for containerized deployment)
- **FFmpeg** (required for video/audio processing) - See [Media Processing Setup](#media-processing-setup)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd kami-platform-media-service
```

### 2. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 3. Environment Setup

```bash
cp env-example .env.local
```

Configure the following environment variables:

```bash
# AWS Configuration
AWS_REGION=us-east-1
ACCESS_KEY=your-aws-access-key
SECRET_KEY=your-aws-secret-key
BUCKET_NAME=your-s3-bucket-name
CDN_URL=https://your-cdn-domain.com
NEXT_PUBLIC_API_URL=https://your-api-domain.com

# Media Processing (Optional - see Media Processing section)
ENABLE_MEDIA_PROCESSING=true
IMAGE_MAX_WIDTH=1920
IMAGE_MAX_HEIGHT=1080
IMAGE_QUALITY=80
VIDEO_CLIP_DURATION=60
AUDIO_CLIP_DURATION=60
```

### 4. Start Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the service.

## 🚀 Quick Start

### Upload a File

```typescript
import { useChunkedUpload } from './hooks/useChunkedUpload';

const { uploadFile } = useChunkedUpload();

await uploadFile(file, {
  projectId: '123',
  category: 'project',
  folder: 'uploads',
  onProgress: (progress) => {
    console.log(`Progress: ${progress.progress}%`);
  },
});
```

See [Usage Examples](#usage-examples) for more details.

## 📚 API Documentation

### **File Upload APIs**

#### 1. Chunked File Upload

Upload files using the chunked upload system with real-time progress tracking.

```http
POST /api/upload?id={projectId}&c={category}
Content-Type: multipart/form-data

Form Data:
- chunk: File chunk data (required)
- uploadId: Unique upload identifier (required)
- chunkIndex: Current chunk index (required)
- totalChunks: Total number of chunks (required)
- fileName: Original file name (required)
- fileSize: Total file size in bytes (required)
- folder: Subfolder within the project (optional)
```

**Query Parameters:**
- `id`: Project/Product/Profile ID (required)
- `c`: Category - "project", "product", or "profile" (default: "project")

**Response for Final Chunk:**
```json
{
  "message": "Upload started",
  "uploadId": "chunked_1234567890_abc123def",
  "key": "Project/123/folder/video.mp4",
  "cdn": "https://cdn.example.com/Project/123/folder/video.mp4",
  "size": 52428800,
  "method": "chunked",
  "totalChunks": 10,
  "received": 10,
  "remaining": 0
}
```

#### 2. Upload Status & Progress

Monitor upload progress for chunked uploads.

```http
GET /api/upload?uploadId={uploadId}
```

**Response:**
```json
{
  "uploadId": "chunked_1234567890_abc123def",
  "fileName": "video.mp4",
  "fileSize": 52428800,
  "totalChunks": 10,
  "receivedChunks": 10,
  "status": "completed",
  "key": "Project/123/folder/video.mp4",
  "cdn": "https://cdn.example.com/Project/123/folder/video.mp4",
  "uploadedSize": 52428800,
  "percentage": 100
}
```

#### 3. Cancel Upload

Cancel an ongoing chunked upload.

```http
DELETE /api/upload?uploadId={uploadId}
```

### **S3 Management APIs**

#### 4. Generate Presigned Upload URL

```http
POST /api/s3/url?id={projectId}&c={category}
Content-Type: application/json

{
  "name": "filename.jpg",
  "type": "image/jpeg",
  "folder": "subfolder"
}
```

#### 5. List S3 Objects

```http
GET /api/s3/objects?folder={folderPath}
```

#### 6. Get Project/Product URL

```http
GET /api/s3/getProjectUrl/{id}?key={filename}
GET /api/s3/getProductUrl/{id}?key={filename}
```

For complete API documentation, see [docs/upload-guide.md](./docs/upload-guide.md).

## 💻 Usage Examples

### React Hook (Recommended)

For React applications, use the `useChunkedUpload` hook:

```tsx
import { useChunkedUpload } from './hooks/useChunkedUpload';

const MyUploadComponent = () => {
  const { uploadFile, isUploading, currentUpload, error } = useChunkedUpload();

  const handleFileUpload = async (file: File) => {
    try {
      const result = await uploadFile(file, {
        projectId: '999',
        category: 'project',
        folder: 'uploads',
        onProgress: (progress) => {
          console.log(`Chunk ${progress.chunkIndex + 1}/${progress.totalChunks}: ${progress.progress}%`);
        },
        onComplete: (result) => {
          console.log('Upload completed:', result.cdn);
          // Preview URL available for media files (images, videos, audio)
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
        type='file' 
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
        disabled={isUploading} 
      />
      {isUploading && (
        <p>Uploading... {currentUpload?.receivedChunks}/{currentUpload?.totalChunks} chunks</p>
      )}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
};
```

**Features:**
- ✅ TypeScript support - Full type safety
- ✅ Progress tracking - Real-time chunk and S3 upload progress
- ✅ Error handling - Comprehensive error management
- ✅ Upload cancellation - Cancel ongoing uploads
- ✅ Memory efficient - Automatic cleanup
- ✅ Preview URL support - Automatic preview generation for media files (images, videos, audio)

See [docs/react-hook-guide.md](./docs/react-hook-guide.md) for detailed documentation and examples.

### JavaScript/TypeScript Client

```javascript
// Chunked file upload with progress tracking
async function uploadFileChunked(file, projectId, category = 'project', folder = '') {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `chunked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileName', file.name);
    formData.append('fileSize', file.size.toString());
    if (folder) formData.append('folder', folder);

    const response = await fetch(`/api/upload?id=${projectId}&c=${category}`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log(`Chunk ${i + 1}/${totalChunks} uploaded: ${result.progress || 0}%`);

    if (i === totalChunks - 1) {
      return result;
    }
  }
}
```

## 🎬 Media Processing

The service automatically processes uploaded media files to generate optimized preview versions.

### Features

- **Images**: Generates lower quality preview versions (larger than thumbnails)
  - Configurable dimensions (default: 1920x1080)
  - Quality compression (default: 80%)
  - Supports: JPEG, PNG, WebP, GIF, BMP, TIFF

- **Videos**: Extracts 1-minute preview clips
  - Configurable start point (default: 0 seconds)
  - Quality presets (high/medium/low)
  - Supports: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP, OGV

- **Audio**: Extracts 1-minute preview clips
  - Configurable start point (default: 0 seconds)
  - Configurable bitrate (default: 128k)
  - Supports: MP3, WAV, FLAC, AAC, OGG, WMA, M4A

### Media Processing Setup

#### 1. Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH

**Verify installation:**
```bash
ffmpeg -version
```

#### 2. Configure Environment Variables

Add to your `.env.local`:

```env
# Enable/disable media processing (default: true)
ENABLE_MEDIA_PROCESSING=true

# Image processing settings
IMAGE_MAX_WIDTH=1920
IMAGE_MAX_HEIGHT=1080
IMAGE_QUALITY=80
IMAGE_FORMAT=auto  # auto, jpeg, webp, png
IMAGE_SUFFIX=_preview

# Video processing settings
VIDEO_CLIP_DURATION=60
VIDEO_CLIP_START=0
VIDEO_QUALITY=medium  # high, medium, low
VIDEO_SUFFIX=_preview

# Audio processing settings
AUDIO_CLIP_DURATION=60
AUDIO_CLIP_START=0
AUDIO_BITRATE=128k
AUDIO_SUFFIX=_preview
```

### How It Works

1. **Upload Flow**: User uploads file → Chunks assembled → Original uploaded to S3
2. **Processing Flow**: If media file detected → Processing triggered asynchronously → Preview generated → Uploaded to S3
3. **Non-Blocking**: Processing happens in background, doesn't affect original upload

### Output Examples

```
Original: Project/123/image.jpg
Preview:  Project/123/image_preview.jpg

Original: Project/123/video.mp4
Preview:  Project/123/video_preview.mp4 (first 60 seconds)

Original: Project/123/audio.mp3
Preview:  Project/123/audio_preview.mp3 (first 60 seconds)
```

### File Type Handling

**✅ Processed (Media Files):**
- Images: JPEG, PNG, GIF, WebP, BMP, TIFF, SVG, ICO
- Videos: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP, OGV
- Audio: MP3, WAV, FLAC, AAC, OGG, WMA, M4A

**❌ Not Processed (Other Files):**
- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF
- Archives: ZIP, RAR, 7Z, TAR, GZ
- Code: JS, TS, HTML, CSS, JSON, XML, CSV

For detailed information, see [docs/media-processing-implementation.md](./docs/media-processing-implementation.md).

## 🐳 Docker Deployment

Build and run with Docker:

```bash
# Build the image
docker build -t kami-media-service .

# Run the container
docker run -p 3000:3000 \
  -e AWS_REGION=us-east-1 \
  -e ACCESS_KEY=your-access-key \
  -e SECRET_KEY=your-secret-key \
  -e BUCKET_NAME=your-bucket \
  -e CDN_URL=https://your-cdn.com \
  -e ENABLE_MEDIA_PROCESSING=true \
  kami-media-service
```

**Note:** Ensure FFmpeg is installed in your Docker image if using media processing.

## 🔧 Configuration

### File Size Limits
- **Maximum file size**: 5GB
- **Chunk size**: 5MB (for chunked uploads)
- **Multipart threshold**: 100MB (files larger use multipart upload)

### MIME Type Detection

The service automatically detects MIME types based on file extensions:

- **Video formats**: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP, OGV
- **Audio formats**: MP3, WAV, FLAC, AAC, OGG, WMA, M4A
- **Image formats**: JPG, PNG, GIF, BMP, SVG, WebP, TIFF, ICO
- **Document formats**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF
- **Archive formats**: ZIP, RAR, 7Z, TAR, GZ

### Next.js Configuration

```javascript
// next.config.mjs
export default {
  serverExternalPackages: ['@aws-sdk/client-s3'],
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
};
```

## 🧪 Testing

### Quick Start Testing

**Test Media Processing:**
```bash
# Install test dependencies (if needed)
npm install formdata-node

# Run media processing test script
node tests/test-media-processing.js test-image.jpg test-video.mp4 test-audio.mp3
```

**Test Chunked Upload:**
```bash
node tests/test-chunked-upload.js
```

### Testing Media Processing

The service includes comprehensive testing tools for media processing:

1. **Automated Test Script:**
   ```bash
   # Test single file
   node tests/test-media-processing.js test-image.jpg
   
   # Test multiple files
   node tests/test-media-processing.js test-image.jpg test-video.mp4 test-audio.mp3 test.pdf
   
   # With environment variables
   API_URL=http://localhost:3000 PROJECT_ID=999 node tests/test-media-processing.js test-image.jpg
   ```

2. **Manual Testing:**
   - Upload files via the React component at `/examples/upload`
   - Check console logs for processing messages
   - Verify preview files in S3 bucket

3. **What to Test:**
   - ✅ Image processing - Preview generation with resizing
   - ✅ Video processing - 60-second clip extraction
   - ✅ Audio processing - 60-second clip extraction
   - ✅ Non-media files - Verify processing is skipped
   - ✅ Large files - Verify processing works with large uploads
   - ✅ Error handling - Verify graceful failures

For detailed testing instructions, see [Testing Guide](./docs/testing-guide.md).

### Interactive Testing

Use the provided HTML test files for interactive testing:
- `tests/upload-example.html` - Basic upload testing
- `tests/upload-with-progress.html` - Upload with progress tracking
- `tests/test-progress.html` - Progress tracking system testing

### API Testing

Use the examples in `tests/test.http` for comprehensive API testing with tools like REST Client.

### Test Coverage

The system has been tested with:
- ✅ Small files (< 1MB) - Single chunk uploads
- ✅ Medium files (1-100MB) - Multiple chunk uploads
- ✅ Large files (100MB-5GB) - Chunked uploads with S3 multipart
- ✅ Video files (MP4, AVI, MOV) - Proper streaming
- ✅ Audio files (MP3, WAV) - Proper playback
- ✅ Image files (JPG, PNG, GIF) - Proper display
- ✅ Media processing - Preview generation
- ✅ Multiple concurrent uploads
- ✅ Network interruptions and recovery
- ✅ Upload cancellation

## 🚀 Production Deployment

### Scaling Considerations

- **Progress Storage**: Replace in-memory storage with Redis for multiple instances
- **Load Balancing**: Ensure sticky sessions for progress tracking
- **Monitoring**: Add metrics for upload success rates and performance
- **FFmpeg**: Ensure FFmpeg is installed on all production servers

### Environment Variables

```bash
AWS_REGION=us-east-1
ACCESS_KEY=your-access-key
SECRET_KEY=your-secret-key
BUCKET_NAME=your-bucket-name
CDN_URL=https://your-cdn-domain.com
NEXT_PUBLIC_API_URL=https://your-api-domain.com

# Media Processing (optional)
ENABLE_MEDIA_PROCESSING=true
IMAGE_MAX_WIDTH=1920
IMAGE_MAX_HEIGHT=1080
IMAGE_QUALITY=80
VIDEO_CLIP_DURATION=60
AUDIO_CLIP_DURATION=60
```

### Security Considerations

- ✅ **File validation**: Add file type validation as needed
- ✅ **Rate limiting**: Implement upload rate limiting for production
- ✅ **Authentication**: Add proper authentication/authorization
- ✅ **CORS**: Configure CORS settings for your domain
- ✅ **Environment variables**: Keep AWS credentials secure

## 📖 Documentation

### Main Documentation
- **[README.md](./README.md)** - This file - Main project documentation

### Detailed Guides
- **[Documentation Index](./docs/index.md)** - Complete documentation navigation
- **[Chunked Upload Guide](./docs/chunked-upload-guide.md)** - Detailed chunked upload documentation
- **[React Hook Guide](./docs/react-hook-guide.md)** - React integration guide
- **[Upload Guide](./docs/upload-guide.md)** - General upload API documentation
- **[Media Processing Plan](./docs/media-processing-plan.md)** - Media processing implementation plan
- **[Media Processing Implementation](./docs/media-processing-implementation.md)** - Media processing setup and configuration

## 🔄 Chunked Upload Flow

### How the Chunked Upload System Works

1. **File Chunking**: Client splits file into 5MB chunks using `File.slice()`
2. **Chunk Upload**: Each chunk is sent to `/api/upload` with metadata
3. **Server Storage**: Chunks are temporarily stored on the server
4. **Progress Tracking**: Real-time progress for chunk upload phase
5. **File Reassembly**: When all chunks are received, server reassembles the file
6. **S3 Upload**: Complete file is uploaded to S3 (regular or multipart based on size)
7. **Progress Tracking**: Real-time progress for S3 upload phase
8. **Media Processing**: If media file, processing is triggered asynchronously
9. **Completion**: Upload finishes and returns CDN URL with proper MIME type

### Memory Efficiency

- **Client-side chunking**: Files are split before upload, reducing memory usage
- **Server-side processing**: 5MB chunks prevent memory issues
- **Automatic cleanup**: Temporary chunks are cleaned up after upload
- **No memory issues**: Even 5GB files won't cause out-of-memory errors
- **Streaming**: Files are never fully loaded into memory at once

## 🚨 Error Handling

### Common Error Responses

**File too large:**
```json
{
  "error": "File too large",
  "details": "File size (5.2GB) exceeds maximum allowed size (5GB)",
  "code": "FILE_TOO_LARGE"
}
```
Status: 413

**Missing required parameters:**
```json
{
  "error": "Missing required parameter",
  "details": "id parameter is required in the URL",
  "code": "MISSING_PROJECT_ID"
}
```
Status: 400

**Upload failed:**
```json
{
  "error": "Upload failed",
  "details": "Failed to upload part 3",
  "code": "UPLOAD_ERROR"
}
```
Status: 500

## 📊 Monitoring and Debugging

### Logs

The system provides detailed logging:

```
📦 [CLIENT CHUNK] Received chunk 1/10 for video.mp4
✅ [CLIENT CHUNK] Stored chunk 1/10 successfully
🎯 [CHUNK COMPLETE] All 10 chunks received, starting S3 upload
🚀 [S3 START] Starting S3 upload
✅ [AWS UPLOAD] Successfully uploaded part 1/5
🎬 [MEDIA PROCESSING] Triggering media processing for: video.mp4
🖼️ [IMAGE PROCESSING] Starting image processing
```

### Progress Tracking

- **Real-time progress**: Chunk upload and S3 transfer progress tracking
- **Automatic cleanup**: Completed uploads and temporary chunks cleaned up automatically
- **Manual cleanup**: Available via DELETE endpoint for upload cancellation
- **Memory efficient**: Chunked processing uses minimal memory footprint

## 📝 License

This project is part of the KAMI platform ecosystem.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## 📞 Support

For support and questions:
- Check the [Documentation Index](./docs/index.md) for detailed guides
- Review the [API Documentation](#api-documentation) section
- Contact the KAMI platform team

---

**Version:** 0.1.0  
**Last Updated:** $(date)
