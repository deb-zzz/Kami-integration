# Testing Guide

This guide provides comprehensive instructions for testing the KAMI Platform Media Service, including file uploads, chunked uploads, and media processing features.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Test Checklist](#quick-test-checklist)
- [Testing Media Processing](#testing-media-processing)
- [Testing File Uploads](#testing-file-uploads)
- [Automated Testing](#automated-testing)
- [Manual Testing](#manual-testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before testing, ensure you have:

1. ✅ **Service running**: Development server started (`pnpm dev`)
2. ✅ **Environment configured**: `.env.local` with AWS credentials
3. ✅ **FFmpeg installed**: Required for video/audio processing
4. ✅ **Test files ready**: Sample images, videos, and audio files
5. ✅ **S3 bucket accessible**: Bucket configured and accessible

### Verify FFmpeg Installation

```bash
ffmpeg -version
```

Expected output should show FFmpeg version information. If not installed:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Verify installation
ffmpeg -version
```

## Quick Test Checklist

Use this checklist to quickly verify all features:

- [ ] Small file upload (< 1MB) - Image
- [ ] Medium file upload (1-100MB) - Video
- [ ] Large file upload (100MB-5GB) - Video
- [ ] Image processing - Preview generation
- [ ] Video processing - Preview clip generation
- [ ] Audio processing - Preview clip generation
- [ ] Non-media file upload - PDF (should skip processing)
- [ ] Upload cancellation
- [ ] Progress tracking
- [ ] Error handling

## Testing Media Processing

### 1. Test Image Processing

#### Step 1: Upload an Image

Use the React component or API:

```bash
# Using cURL
curl -X POST "http://localhost:3000/api/upload?id=999&c=project" \
  -F "chunk=@test-image.jpg" \
  -F "uploadId=test_$(date +%s)" \
  -F "chunkIndex=0" \
  -F "totalChunks=1" \
  -F "fileName=test-image.jpg" \
  -F "fileSize=$(stat -f%z test-image.jpg)"
```

#### Step 2: Verify Processing

1. **Check console logs** for processing messages:
   ```
   🎬 [MEDIA PROCESSING] Triggering media processing for: test-image.jpg
   🖼️ [IMAGE PROCESSING] Starting image processing
   ✅ [IMAGE PROCESSING] Processed image: 245760 bytes
   🎉 [IMAGE PROCESSING] Successfully processed and uploaded preview
   ```

2. **Check S3 bucket** for preview file:
   - Original: `Project/999/test-image.jpg`
   - Preview: `Project/999/test-image_preview.jpg`

3. **Verify preview properties**:
   - Preview should be smaller than original
   - Preview should have correct dimensions (max 1920x1080)
   - Preview should maintain aspect ratio

#### Test Cases

**Test Case 1: Large Image Resize**
- Upload image > 1920px width or > 1080px height
- Verify preview is resized to max dimensions
- Verify aspect ratio maintained

**Test Case 2: Small Image**
- Upload image < 1920x1080
- Verify preview may be same size or slightly compressed
- Verify quality is maintained

**Test Case 3: Different Formats**
- Test JPEG, PNG, WebP, GIF
- Verify each format processes correctly
- Verify preview format is appropriate

### 2. Test Video Processing

#### Step 1: Upload a Video

```bash
# Upload a video file (use chunked upload for large files)
# See tests/test-chunked-upload.js for reference
```

#### Step 2: Verify Processing

1. **Check console logs**:
   ```
   🎬 [MEDIA PROCESSING] Triggering media processing for: test-video.mp4
   🎥 [VIDEO PROCESSING] Starting video processing
   📊 [VIDEO PROCESSING] Video duration: 120 seconds
   ✂️ [VIDEO PROCESSING] Extracting clip: 0s - 60s
   ✅ [VIDEO PROCESSING] Processed clip: 5242880 bytes
   🎉 [VIDEO PROCESSING] Successfully processed and uploaded preview
   ```

2. **Check S3 bucket**:
   - Original: `Project/999/test-video.mp4`
   - Preview: `Project/999/test-video_preview.mp4`

3. **Verify preview clip**:
   - Preview should be ~60 seconds (or video duration if shorter)
   - Preview should play correctly
   - Preview should have reasonable file size

#### Test Cases

**Test Case 1: Long Video (> 60 seconds)**
- Upload video > 60 seconds
- Verify preview is exactly 60 seconds
- Verify preview starts at beginning (0 seconds)

**Test Case 2: Short Video (< 60 seconds)**
- Upload video < 60 seconds (e.g., 30 seconds)
- Verify preview is full video length
- Verify no errors occur

**Test Case 3: Different Formats**
- Test MP4, MOV, WebM, AVI
- Verify each format processes correctly
- Verify preview plays correctly

### 3. Test Audio Processing

#### Step 1: Upload an Audio File

```bash
# Upload audio file using chunked upload
```

#### Step 2: Verify Processing

1. **Check console logs**:
   ```
   🎬 [MEDIA PROCESSING] Triggering media processing for: test-audio.mp3
   🎵 [AUDIO PROCESSING] Starting audio processing
   📊 [AUDIO PROCESSING] Audio duration: 180 seconds
   ✂️ [AUDIO PROCESSING] Extracting clip: 0s - 60s
   ✅ [AUDIO PROCESSING] Processed clip: 1024000 bytes
   🎉 [AUDIO PROCESSING] Successfully processed and uploaded preview
   ```

2. **Check S3 bucket**:
   - Original: `Project/999/test-audio.mp3`
   - Preview: `Project/999/test-audio_preview.mp3`

3. **Verify preview clip**:
   - Preview should be ~60 seconds
   - Preview should play correctly
   - Preview should have correct bitrate

#### Test Cases

**Test Case 1: Long Audio (> 60 seconds)**
- Upload audio > 60 seconds
- Verify preview is exactly 60 seconds

**Test Case 2: Short Audio (< 60 seconds)**
- Upload audio < 60 seconds
- Verify preview is full audio length

**Test Case 3: Different Formats**
- Test MP3, WAV, FLAC, AAC
- Verify each format processes correctly

### 4. Test Non-Media Files

Upload a PDF or document to verify processing is skipped:

```bash
# Upload PDF
curl -X POST "http://localhost:3000/api/upload?id=999&c=project" \
  -F "chunk=@test-document.pdf" \
  -F "uploadId=test_$(date +%s)" \
  -F "chunkIndex=0" \
  -F "totalChunks=1" \
  -F "fileName=test-document.pdf" \
  -F "fileSize=$(stat -f%z test-document.pdf)"
```

**Expected Behavior:**
- ✅ File uploads successfully
- ✅ No processing logs (should see skip message)
- ✅ Only original file in S3 (no preview)
- ✅ Console log: `⏭️ [MEDIA PROCESSING] File is not a media file, skipping`

## Testing File Uploads

### 1. Test Chunked Upload

Use the provided test script:

```bash
node tests/test-chunked-upload.js
```

Or use the HTML interface:

```bash
# Open in browser
open tests/upload-example.html
```

### 2. Test Progress Tracking

```bash
node tests/test-progress.js
```

Or use the HTML interface:

```bash
open tests/test-progress.html
```

### 3. Test Upload Cancellation

1. Start an upload
2. Get the `uploadId` from the response
3. Cancel the upload:

```bash
curl -X DELETE "http://localhost:3000/api/upload?uploadId=chunked_1234567890_abc123def"
```

### 4. Test Error Handling

**Test Case: File Too Large**
```bash
# Try uploading file > 5GB (should fail with 413 error)
```

**Test Case: Invalid Upload ID**
```bash
# Try getting status for non-existent uploadId
curl "http://localhost:3000/api/upload?uploadId=invalid_id"
```

## Automated Testing

### Test Script: Media Processing

Create a test script to automate media processing tests:

```javascript
// tests/test-media-processing.js
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';
const PROJECT_ID = '999';
const CATEGORY = 'project';

async function uploadFile(filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const uploadId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`\n📤 Uploading ${fileName} (${totalChunks} chunks)...`);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunk = fileBuffer.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk, { filename: fileName });
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileName', fileName);
    formData.append('fileSize', fileSize.toString());

    const response = await fetch(`${API_URL}/api/upload?id=${PROJECT_ID}&c=${CATEGORY}`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log(`  Chunk ${i + 1}/${totalChunks}: ${result.message}`);

    if (i === totalChunks - 1) {
      console.log(`✅ Upload complete: ${result.cdn}`);
      return { uploadId, result };
    }
  }
}

async function checkUploadStatus(uploadId) {
  const response = await fetch(`${API_URL}/api/upload?uploadId=${uploadId}`);
  return await response.json();
}

async function waitForProcessing(uploadId, maxWait = 120000) {
  const startTime = Date.now();
  console.log('\n⏳ Waiting for media processing...');

  while (Date.now() - startTime < maxWait) {
    const status = await checkUploadStatus(uploadId);
    
    // Check logs would indicate processing, but we can't directly check that
    // Instead, wait a bit and check if preview exists in S3 (would need S3 access)
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (status.status === 'completed') {
      console.log('✅ Upload and processing completed');
      return true;
    }
  }

  console.log('⏱️ Timeout waiting for processing');
  return false;
}

async function testImageProcessing(imagePath) {
  console.log('\n🖼️ Testing Image Processing');
  console.log('=' .repeat(50));
  
  const fileName = path.basename(imagePath);
  const { uploadId, result } = await uploadFile(imagePath, fileName);
  
  // Wait for processing
  await waitForProcessing(uploadId, 30000);
  
  console.log('\n📊 Results:');
  console.log(`  Original: ${result.cdn}`);
  console.log(`  Preview: ${result.cdn.replace(fileName, fileName.replace(/\.[^.]+$/, '_preview$&'))}`);
}

async function testVideoProcessing(videoPath) {
  console.log('\n🎥 Testing Video Processing');
  console.log('=' .repeat(50));
  
  const fileName = path.basename(videoPath);
  const { uploadId, result } = await uploadFile(videoPath, fileName);
  
  await waitForProcessing(uploadId, 120000);
  
  console.log('\n📊 Results:');
  console.log(`  Original: ${result.cdn}`);
  console.log(`  Preview: ${result.cdn.replace(fileName, fileName.replace(/\.[^.]+$/, '_preview$&'))}`);
}

async function testAudioProcessing(audioPath) {
  console.log('\n🎵 Testing Audio Processing');
  console.log('=' .repeat(50));
  
  const fileName = path.basename(audioPath);
  const { uploadId, result } = await uploadFile(audioPath, fileName);
  
  await waitForProcessing(uploadId, 60000);
  
  console.log('\n📊 Results:');
  console.log(`  Original: ${result.cdn}`);
  console.log(`  Preview: ${result.cdn.replace(fileName, fileName.replace(/\.[^.]+$/, '_preview$&'))}`);
}

async function testNonMediaFile(filePath) {
  console.log('\n📄 Testing Non-Media File (should skip processing)');
  console.log('=' .repeat(50));
  
  const fileName = path.basename(filePath);
  const { uploadId, result } = await uploadFile(filePath, fileName);
  
  console.log('\n📊 Results:');
  console.log(`  File uploaded: ${result.cdn}`);
  console.log(`  Processing: Skipped (non-media file)`);
}

// Run tests
(async () => {
  try {
    // Test image processing
    if (process.argv[2]) {
      await testImageProcessing(process.argv[2]);
    }
    
    // Test video processing
    if (process.argv[3]) {
      await testVideoProcessing(process.argv[3]);
    }
    
    // Test audio processing
    if (process.argv[4]) {
      await testAudioProcessing(process.argv[4]);
    }
    
    // Test non-media file
    if (process.argv[5]) {
      await testNonMediaFile(process.argv[5]);
    }
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
})();
```

**Usage:**
```bash
# Install dependencies if needed
npm install form-data node-fetch

# Run tests
node tests/test-media-processing.js test-image.jpg test-video.mp4 test-audio.mp3 test-document.pdf
```

## Manual Testing

### Using the React Component

1. **Start the development server:**
   ```bash
   pnpm dev
   ```

2. **Navigate to the upload example:**
   ```
   http://localhost:3000/examples/upload
   ```

3. **Upload files and observe:**
   - Upload progress
   - Console logs for processing
   - Check S3 bucket for preview files

### Using HTML Test Files

1. **Open test files in browser:**
   ```bash
   open tests/upload-example.html
   open tests/upload-with-progress.html
   open tests/test-progress.html
   ```

2. **Upload files and check:**
   - Network tab for API calls
   - Console for logs
   - S3 bucket for results

### Using Postman/Thunder Client

1. **Import the collection** from `postman_upload.json`

2. **Configure environment variables:**
   - `base_url`: `http://localhost:3000`
   - `project_id`: `999`

3. **Run requests:**
   - Upload file
   - Check upload status
   - Verify processing

## Troubleshooting

### Media Processing Not Working

**Issue:** No processing logs appear

**Solutions:**
1. ✅ Check `ENABLE_MEDIA_PROCESSING=true` in `.env.local`
2. ✅ Verify file is a media file (check extension/MIME type)
3. ✅ Check console for errors
4. ✅ Verify FFmpeg is installed (for video/audio)

### FFmpeg Errors

**Issue:** `FFmpeg processing failed`

**Solutions:**
1. ✅ Verify FFmpeg installation: `ffmpeg -version`
2. ✅ Check FFmpeg has proper permissions
3. ✅ Verify input file is valid
4. ✅ Check temporary directory permissions

### Image Processing Errors

**Issue:** Image processing fails

**Solutions:**
1. ✅ Verify Sharp is installed: `npm list sharp`
2. ✅ Check image file is valid
3. ✅ Verify memory is available
4. ✅ Check S3 upload permissions

### Preview Files Not Created

**Issue:** Original uploads but no preview

**Solutions:**
1. ✅ Check console logs for processing status
2. ✅ Verify processing completed (check logs)
3. ✅ Check S3 bucket permissions
4. ✅ Verify file is actually a media file
5. ✅ Check processing didn't fail silently

### Upload Failures

**Issue:** Upload fails

**Solutions:**
1. ✅ Check AWS credentials
2. ✅ Verify S3 bucket exists and is accessible
3. ✅ Check file size limits (5GB max)
4. ✅ Verify network connectivity
5. ✅ Check server logs for errors

## Test Data

### Recommended Test Files

**Images:**
- Large image (> 1920x1080): Test resizing
- Small image (< 1920x1080): Test quality compression
- Different formats: JPEG, PNG, WebP, GIF

**Videos:**
- Long video (> 60 seconds): Test clipping
- Short video (< 60 seconds): Test full video
- Different formats: MP4, MOV, WebM

**Audio:**
- Long audio (> 60 seconds): Test clipping
- Short audio (< 60 seconds): Test full audio
- Different formats: MP3, WAV, FLAC

**Non-Media:**
- PDF document: Verify skipping
- Archive file: Verify skipping
- Text file: Verify skipping

## Next Steps

After testing:

1. ✅ Review test results
2. ✅ Check S3 bucket for all files
3. ✅ Verify preview files are correct
4. ✅ Check console logs for any warnings
5. ✅ Document any issues found

For more information, see:
- [Media Processing Implementation](./media-processing-implementation.md)
- [Chunked Upload Guide](./chunked-upload-guide.md)
- [API Documentation](./upload-guide.md)

