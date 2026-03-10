# Media Processing Implementation Plan

## Overview
This plan outlines the implementation of media processing features that will automatically generate optimized versions of uploaded media files:
- **Images**: Lower quality versions (preview/medium quality, larger than thumbnails)
- **Video/Audio**: 1-minute clips with custom start points

**Important**: This will only affect media files (images, videos, audio). Documents, archives, and other file types will be unaffected.

---

## 1. Architecture Overview

### 1.1 Integration Point
The media processing will be triggered **after** the original file is successfully uploaded to S3, but **asynchronously** to avoid blocking the upload response. This ensures:
- The original upload completes quickly
- Processing happens in the background
- Failures in processing don't affect the main upload

### 1.2 Processing Flow
```
Upload Chunks → Assemble File → Upload Original to S3 → [Trigger Media Processing] → Generate Variants → Upload Variants to S3
```

---

## 2. File Structure

### 2.1 New Utility Files to Create

```
src/lib/
├── media-processor.ts          # Main orchestrator - detects file type and routes to appropriate processor
├── image-processor.ts          # Image optimization utilities
├── video-processor.ts          # Video clipping utilities
├── audio-processor.ts          # Audio clipping utilities
├── media-utils.ts              # Shared utilities (file type detection, path helpers, etc.)
└── s3-helper.ts                # S3 upload helper for processed files
```

### 2.2 File Responsibilities

#### `media-processor.ts`
- Main entry point for media processing
- Detects file type (image, video, audio)
- Routes to appropriate processor
- Handles error recovery and logging
- Manages async processing lifecycle

#### `image-processor.ts`
- Generates lower quality preview versions
- Supports multiple image formats (JPEG, PNG, WebP, etc.)
- Configurable quality settings
- Handles image resizing and compression

#### `video-processor.ts`
- Extracts 1-minute clips from video files
- Supports custom start points
- Handles multiple video formats (MP4, WebM, MOV, etc.)
- Maintains video quality while reducing file size

#### `audio-processor.ts`
- Extracts 1-minute clips from audio files
- Supports custom start points
- Handles multiple audio formats (MP3, WAV, AAC, etc.)
- Maintains audio quality

#### `media-utils.ts`
- File type detection (isMediaFile, isImage, isVideo, isAudio)
- MIME type classification
- Path generation helpers (original path → processed path)
- Temporary file management
- Configuration constants

#### `s3-helper.ts`
- Upload processed files to S3
- Generate S3 paths for variants
- Handle CDN URL generation
- Error handling for S3 uploads

---

## 3. Implementation Details

### 3.1 Image Processing

#### Features
- Generate preview/medium quality versions (larger than thumbnails)
- Configurable dimensions (e.g., max width: 1920px, max height: 1080px)
- Quality compression (e.g., 80% quality for JPEG)
- Format conversion where appropriate (e.g., PNG → WebP for preview)

#### Configuration
```typescript
interface ImageProcessingConfig {
  maxWidth: number;        // e.g., 1920
  maxHeight: number;       // e.g., 1080
  quality: number;         // 0-100, e.g., 80
  format: 'auto' | 'jpeg' | 'webp' | 'png';  // 'auto' maintains original or converts
  suffix: string;          // e.g., '_preview' -> image_preview.jpg
}
```

#### Output
- Original: `Project/123/image.jpg`
- Preview: `Project/123/image_preview.jpg`

#### Dependencies
- `sharp` (recommended) - Fast, efficient image processing
- Alternative: `jimp` or `image-js` (if sharp has compatibility issues)

---

### 3.2 Video Processing

#### Features
- Extract 1-minute clips (60 seconds)
- Custom start point support (default: 0 seconds)
- Maintain video quality and codec
- Generate preview clips in efficient format

#### Configuration
```typescript
interface VideoProcessingConfig {
  clipDuration: number;    // Duration in seconds, e.g., 60
  startPoint: number;      // Start time in seconds, e.g., 0 (can be configurable per upload)
  quality: 'high' | 'medium' | 'low';  // Quality preset
  suffix: string;          // e.g., '_preview' -> video_preview.mp4
}
```

#### Output
- Original: `Project/123/video.mp4`
- Preview: `Project/123/video_preview.mp4`

#### Dependencies
- `ffmpeg` (via `fluent-ffmpeg` package) - Industry standard for video processing
- Requires `ffmpeg` binary to be installed on the server

#### Custom Start Point
- Initially: Default to start at 0 seconds (beginning of video)
- Future: Allow custom start point via upload metadata or query parameter
- For now: Extract first 60 seconds

---

### 3.3 Audio Processing

#### Features
- Extract 1-minute clips (60 seconds)
- Custom start point support (default: 0 seconds)
- Maintain audio quality
- Generate preview clips in efficient format

#### Configuration
```typescript
interface AudioProcessingConfig {
  clipDuration: number;    // Duration in seconds, e.g., 60
  startPoint: number;       // Start time in seconds, e.g., 0
  bitrate: string;          // e.g., '128k' for MP3
  suffix: string;           // e.g., '_preview' -> audio_preview.mp3
}
```

#### Output
- Original: `Project/123/audio.mp3`
- Preview: `Project/123/audio_preview.mp3`

#### Dependencies
- `ffmpeg` (via `fluent-ffmpeg` package) - Same as video processing

---

### 3.4 File Type Detection

#### Media File Categories
```typescript
// Images
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', ...];

// Videos
const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp', 'ogv'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', ...];

// Audio
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', ...];
```

#### Utility Functions
```typescript
function isMediaFile(fileName: string, contentType?: string): boolean
function isImage(fileName: string, contentType?: string): boolean
function isVideo(fileName: string, contentType?: string): boolean
function isAudio(fileName: string, contentType?: string): boolean
```

---

## 4. Integration with Existing Code

### 4.1 Modification Point: `chunk-manager.ts`

#### Location
In `startS3Upload()` method, after successful S3 upload (around line 246):

```typescript
// After upload completes successfully
uploadInfo.status = 'completed';
uploadInfo.lastUpdate = Date.now();

// NEW: Trigger media processing asynchronously
if (isMediaFile(uploadInfo.fileName, contentType)) {
  processMediaFileAsync(fileBuffer, uploadInfo, s3Path, bucket, contentType);
}
```

#### Key Points
- Processing happens **asynchronously** (non-blocking)
- Original file upload is not affected by processing failures
- Processing runs in background after upload completes

### 4.2 Async Processing Function

```typescript
async function processMediaFileAsync(
  fileBuffer: Buffer,
  uploadInfo: ChunkInfo,
  originalS3Path: string,
  bucket: string,
  contentType: string
): Promise<void> {
  // Run in background, don't await
  setImmediate(async () => {
    try {
      const processor = new MediaProcessor();
      await processor.process(fileBuffer, uploadInfo, originalS3Path, bucket, contentType);
    } catch (error) {
      // Log error but don't fail the upload
      console.error(`Media processing failed for ${uploadInfo.fileName}:`, error);
    }
  });
}
```

---

## 5. S3 Storage Strategy

### 5.1 Path Structure
```
Original:  {category}/{pId}/{folder?}/{fileName}
Preview:   {category}/{pId}/{folder?}/{fileNameWithoutExt}_preview.{ext}
```

### 5.2 Example Paths
```
Original:  Project/123/image.jpg
Preview:    Project/123/image_preview.jpg

Original:  Project/123/videos/video.mp4
Preview:    Project/123/videos/video_preview.mp4
```

### 5.3 Metadata
- Store processing metadata if needed (optional)
- Original file reference
- Processing timestamp

---

## 6. Error Handling

### 6.1 Processing Failures
- **Never** fail the original upload if processing fails
- Log errors for debugging
- Optionally track processing status in a separate status system

### 6.2 File Format Issues
- Skip unsupported formats gracefully
- Log warnings for formats that can't be processed
- Continue processing for supported formats

### 6.3 Resource Constraints
- Handle memory constraints for large files
- Use streaming where possible
- Clean up temporary files immediately after processing

---

## 7. Configuration

### 7.1 Environment Variables
```env
# Media Processing
ENABLE_MEDIA_PROCESSING=true
IMAGE_MAX_WIDTH=1920
IMAGE_MAX_HEIGHT=1080
IMAGE_QUALITY=80
VIDEO_CLIP_DURATION=60
AUDIO_CLIP_DURATION=60
```

### 7.2 Feature Flags
- Allow enabling/disabling processing per media type
- Allow disabling processing entirely for testing

---

## 8. Dependencies to Add

### 8.1 Required Packages
```json
{
  "dependencies": {
    "sharp": "^0.33.0",              // Image processing
    "fluent-ffmpeg": "^2.1.2",       // Video/audio processing
    "@ffmpeg-installer/ffmpeg": "^1.1.0"  // FFmpeg binary (optional, if needed)
  },
  "devDependencies": {
    "@types/fluent-ffmpeg": "^2.1.24"
  }
}
```

### 8.2 System Requirements
- **FFmpeg**: Must be installed on the server for video/audio processing
  - Can be installed via package manager or bundled
  - Check installation: `ffmpeg -version`
- **Node.js**: Must support native modules (for Sharp)

---

## 9. Processing Workflow

### 9.1 Image Processing Flow
```
1. Check if file is an image
2. Download original from S3 (or use buffer if available)
3. Load image into Sharp
4. Resize if needed (maintain aspect ratio)
5. Compress/optimize
6. Convert format if needed
7. Upload preview to S3
8. Clean up temporary files
```

### 9.2 Video Processing Flow
```
1. Check if file is a video
2. Write buffer to temporary file
3. Use FFmpeg to extract clip:
   - Input: temporary file
   - Start: 0 seconds (or custom)
   - Duration: 60 seconds
   - Output: temporary preview file
4. Upload preview to S3
5. Clean up temporary files
```

### 9.3 Audio Processing Flow
```
1. Check if file is audio
2. Write buffer to temporary file
3. Use FFmpeg to extract clip:
   - Input: temporary file
   - Start: 0 seconds (or custom)
   - Duration: 60 seconds
   - Output: temporary preview file
4. Upload preview to S3
5. Clean up temporary files
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
- Test file type detection
- Test image processing with various formats
- Test video/audio processing with various formats
- Test error handling

### 10.2 Integration Tests
- Test end-to-end upload with processing
- Test that original upload isn't affected by processing failures
- Test S3 upload of processed files

### 10.3 Manual Testing
- Upload various image formats
- Upload various video formats
- Upload various audio formats
- Verify preview files are created
- Verify non-media files are unaffected

---

## 11. Performance Considerations

### 11.1 Processing Time
- Image processing: Usually < 1 second for typical images
- Video processing: 10-60 seconds depending on video length and complexity
- Audio processing: Usually < 10 seconds

### 11.2 Resource Usage
- Use streaming where possible
- Process files in chunks if needed
- Clean up temporary files immediately
- Consider queue system for high-volume processing

### 11.3 Optimization
- Cache processed files if same file uploaded multiple times (optional)
- Use worker threads for CPU-intensive processing (optional)
- Consider external processing service for very large files (optional)

---

## 12. Future Enhancements

### 12.1 Custom Start Points
- Allow specifying start point via upload metadata
- Support query parameter: `?clipStart=30` (start at 30 seconds)

### 12.2 Multiple Variants
- Generate multiple sizes (thumbnail, preview, medium, large)
- Generate different quality levels

### 12.3 Processing Queue
- Implement queue system for high-volume scenarios
- Retry failed processing
- Track processing status

### 12.4 Metadata Storage
- Store processing metadata (dimensions, duration, etc.)
- Track processing history

---

## 13. Implementation Checklist

### Phase 1: Setup
- [ ] Add required dependencies to `package.json`
- [ ] Install FFmpeg on server (if not already installed)
- [ ] Create utility files structure
- [ ] Implement file type detection utilities

### Phase 2: Image Processing
- [ ] Implement `image-processor.ts`
- [ ] Test with various image formats
- [ ] Integrate with upload flow

### Phase 3: Video Processing
- [ ] Implement `video-processor.ts`
- [ ] Test with various video formats
- [ ] Integrate with upload flow

### Phase 4: Audio Processing
- [ ] Implement `audio-processor.ts`
- [ ] Test with various audio formats
- [ ] Integrate with upload flow

### Phase 5: Integration
- [ ] Implement `media-processor.ts` orchestrator
- [ ] Integrate with `chunk-manager.ts`
- [ ] Implement error handling
- [ ] Add logging

### Phase 6: Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing with various file types
- [ ] Performance testing

### Phase 7: Documentation
- [ ] Update API documentation
- [ ] Document processing behavior
- [ ] Document configuration options

---

## 14. Notes

- All processing happens **asynchronously** after the original upload completes
- Processing failures **never** affect the original upload
- Only **media files** (images, videos, audio) are processed
- All code is in **separate utility files** as requested
- No changes to existing upload flow except for triggering processing
- Processing is **optional** and can be disabled via configuration

---

## 15. File Type Handling Summary

### Processed (Media Files)
- ✅ Images: JPEG, PNG, GIF, WebP, BMP, TIFF
- ✅ Videos: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP, OGV
- ✅ Audio: MP3, WAV, FLAC, AAC, OGG, WMA, M4A

### Not Processed (Other Files)
- ❌ Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF
- ❌ Archives: ZIP, RAR, 7Z, TAR, GZ
- ❌ Code: JS, TS, HTML, CSS, JSON, XML, CSV
- ❌ Other: Any file type not in media categories

---

## End of Plan

This plan provides a comprehensive roadmap for implementing media processing features while maintaining separation of concerns and ensuring non-media files remain unaffected.

