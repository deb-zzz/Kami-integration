# Manual Testing Guide for Media Preview Options

## Test 1: Basic Upload Without Preview Options

```typescript
const { uploadFile } = useChunkedUpload();

await uploadFile(file, {
  projectId: '999',
  category: 'project',
});
```

**Expected:** Upload should work normally, using server defaults (startTime: 0, duration: 30)

## Test 2: Upload With Custom Preview Options

```typescript
const { uploadFile } = useChunkedUpload();

await uploadFile(videoFile, {
  projectId: '999',
  category: 'project',
  startTime: 10,
  duration: 45,
});
```

**Expected:** 
- Upload should succeed
- Preview should be generated starting at 10 seconds
- Preview should be 45 seconds long
- Check server logs for: `Extracting clip: 10s - 55s`

## Test 3: Validation - Duration Too Low

```typescript
await uploadFile(videoFile, {
  projectId: '999',
  duration: 3, // Below minimum
});
```

**Expected:** Should throw error: "duration must be between 5 and 60 seconds"

## Test 4: Validation - Duration Too High

```typescript
await uploadFile(videoFile, {
  projectId: '999',
  duration: 65, // Above maximum
});
```

**Expected:** Should throw error: "duration must be between 5 and 60 seconds"

## Test 5: Validation - StartTime Negative

```typescript
await uploadFile(videoFile, {
  projectId: '999',
  startTime: -1,
});
```

**Expected:** Should throw error: "startTime must be greater than or equal to 0"

## Test 6: Boundary Values

```typescript
// Minimum valid duration
await uploadFile(videoFile, {
  projectId: '999',
  startTime: 0,
  duration: 5, // Minimum
});

// Maximum valid duration
await uploadFile(videoFile, {
  projectId: '999',
  startTime: 0,
  duration: 60, // Maximum
});
```

**Expected:** Both should succeed without errors

## Test 7: Check FormData Contains Preview Options

In browser DevTools Network tab:
1. Upload a file with `startTime: 10, duration: 45`
2. Inspect the POST request to `/api/upload`
3. Check FormData contains:
   - `startTime: "10"`
   - `duration: "45"`

## Test 8: Server-Side Validation

Send a direct POST request with invalid values:

```bash
curl -X POST http://localhost:3000/api/upload?id=999&c=project \
  -F "chunk=@test.mp4" \
  -F "uploadId=test-123" \
  -F "chunkIndex=0" \
  -F "totalChunks=1" \
  -F "fileName=test.mp4" \
  -F "fileSize=1000" \
  -F "duration=100" \
  -F "startTime=-5"
```

**Expected:** Should return 400 error with validation messages

## Test 9: Video Processing With Custom Options

1. Upload a video file (at least 60 seconds long) with:
   ```typescript
   {
     projectId: '999',
     startTime: 15,
     duration: 30,
   }
   ```

2. Check server logs for:
   ```
   ✂️ [VIDEO PROCESSING] Extracting clip: 15s - 45s
   ```

3. Verify preview file is created in S3

## Test 10: Audio Processing With Custom Options

1. Upload an audio file (at least 60 seconds long) with:
   ```typescript
   {
     projectId: '999',
     startTime: 5,
     duration: 20,
   }
   ```

2. Check server logs for:
   ```
   ✂️ [AUDIO PROCESSING] Extracting clip: 5s - 25s
   ```

3. Verify preview file is created in S3

## Test 11: Duration Clamping

Upload a video that's only 10 seconds long with:
```typescript
{
  projectId: '999',
  startTime: 0,
  duration: 60, // Requested 60s but video is only 10s
}
```

**Expected:** 
- Should clamp to available duration (10 seconds)
- Should not throw error
- Check logs: `Extracting clip: 0s - 10s`

## Test 12: StartTime + Duration Exceeds Media Length

Upload a video that's 30 seconds long with:
```typescript
{
  projectId: '999',
  startTime: 20,
  duration: 30, // Would go to 50s but video is only 30s
}
```

**Expected:**
- Should clamp duration to available (10 seconds: 30s - 20s)
- Should not throw error if result >= 5 seconds
- Check logs: `Extracting clip: 20s - 30s`

