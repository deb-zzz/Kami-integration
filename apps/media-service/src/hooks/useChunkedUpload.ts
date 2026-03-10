// Re-export from the npm package for backward compatibility
// The package hook uses environment variables by default, so this maintains compatibility
export {
	useChunkedUpload,
	type UploadProgress,
	type ChunkProgress,
	type UploadOptions,
	type UseChunkedUploadReturn,
} from '@paulstinchcombe/chunked-upload';
