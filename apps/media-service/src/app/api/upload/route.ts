import { NextRequest, NextResponse } from 'next/server';
import { S3Uploader } from '@/lib/s3-upload';
import { ProgressTracker } from '@/lib/progress';
import { S3 } from '@aws-sdk/client-s3';
import { getChunkManager } from '@/lib/chunk-manager';
import { isMediaFile, generatePreviewPath, getMediaProcessingConfig } from '@/lib/media-utils';

export const dynamic = 'force-dynamic';

// Configuration constants
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for frontend upload

// Configure S3 client
const s3 = new S3({
	region: process.env.AWS_REGION as string,
	credentials: {
		accessKeyId: process.env.ACCESS_KEY as string,
		secretAccessKey: process.env.SECRET_KEY as string,
	},
});

// Initialize S3 uploader and chunk manager
const uploader = new S3Uploader(s3);
const chunkManager = getChunkManager();

// POST /api/upload - Upload a file chunk
export async function POST(request: NextRequest) {
	try {
		// Parse form data with error handling
		let data: FormData;
		try {
			data = await request.formData();
		} catch (error) {
			console.error('❌ [ERROR] Failed to parse form data:', error);
			return NextResponse.json(
				{
					error: 'Invalid request format',
					details: 'Unable to parse form data. Please ensure the request is properly formatted.',
					code: 'INVALID_FORM_DATA',
				},
				{ status: 400 }
			);
		}

		// Extract and validate required fields
		const chunk = data.get('chunk') as File;
		const uploadId = data.get('uploadId') as string;
		const chunkIndexStr = data.get('chunkIndex') as string;
		const totalChunksStr = data.get('totalChunks') as string;
		const fileName = data.get('fileName') as string;
		const fileSizeStr = data.get('fileSize') as string;
		const folder = data.get('folder') as string | null;
		const startTimeStr = data.get('startTime') as string | null;
		const durationStr = data.get('duration') as string | null;

		// Validate required fields
		const validationErrors: string[] = [];

		if (!chunk || !(chunk instanceof File)) {
			validationErrors.push('chunk is required and must be a valid file');
		}
		if (!uploadId || typeof uploadId !== 'string' || uploadId.trim().length === 0) {
			validationErrors.push('uploadId is required and must be a non-empty string');
		}
		if (!chunkIndexStr || isNaN(parseInt(chunkIndexStr))) {
			validationErrors.push('chunkIndex is required and must be a valid number');
		}
		if (!totalChunksStr || isNaN(parseInt(totalChunksStr))) {
			validationErrors.push('totalChunks is required and must be a valid number');
		}
		if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
			validationErrors.push('fileName is required and must be a non-empty string');
		}
		if (!fileSizeStr || isNaN(parseInt(fileSizeStr))) {
			validationErrors.push('fileSize is required and must be a valid number');
		}

		if (validationErrors.length > 0) {
			console.error('❌ [ERROR] Validation failed:', validationErrors);
			return NextResponse.json(
				{
					error: 'Validation failed',
					details: validationErrors.join('; '),
					code: 'VALIDATION_ERROR',
				},
				{ status: 400 }
			);
		}

		// Parse numeric values
		const chunkIndex = parseInt(chunkIndexStr);
		const totalChunks = parseInt(totalChunksStr);
		const fileSize = parseInt(fileSizeStr);

		// Parse and validate media preview options (optional)
		let startTime: number | undefined;
		let duration: number | undefined;

		if (startTimeStr !== null && startTimeStr !== undefined) {
			const parsedStartTime = parseFloat(startTimeStr);
			if (isNaN(parsedStartTime) || parsedStartTime < 0) {
				return NextResponse.json(
					{
						error: 'Invalid startTime',
						details: 'startTime must be a number greater than or equal to 0',
						code: 'INVALID_START_TIME',
					},
					{ status: 400 }
				);
			}
			startTime = parsedStartTime;
		}

		if (durationStr !== null && durationStr !== undefined) {
			const parsedDuration = parseFloat(durationStr);
			if (isNaN(parsedDuration) || parsedDuration < 5 || parsedDuration > 60) {
				return NextResponse.json(
					{
						error: 'Invalid duration',
						details: 'duration must be a number between 5 and 60 seconds',
						code: 'INVALID_DURATION',
					},
					{ status: 400 }
				);
			}
			duration = parsedDuration;
		}

		// Validate numeric ranges
		if (chunkIndex < 0 || chunkIndex >= totalChunks) {
			return NextResponse.json(
				{
					error: 'Invalid chunk index',
					details: `chunkIndex (${chunkIndex}) must be between 0 and ${totalChunks - 1}`,
					code: 'INVALID_CHUNK_INDEX',
				},
				{ status: 400 }
			);
		}

		if (totalChunks <= 0 || totalChunks > 10000) {
			return NextResponse.json(
				{
					error: 'Invalid total chunks',
					details: `totalChunks (${totalChunks}) must be between 1 and 10000`,
					code: 'INVALID_TOTAL_CHUNKS',
				},
				{ status: 400 }
			);
		}

		// Validate file size
		if (fileSize <= 0) {
			return NextResponse.json(
				{
					error: 'Invalid file size',
					details: 'fileSize must be greater than 0',
					code: 'INVALID_FILE_SIZE',
				},
				{ status: 400 }
			);
		}

		if (fileSize > MAX_FILE_SIZE) {
			return NextResponse.json(
				{
					error: 'File too large',
					details: `File size (${(fileSize / (1024 * 1024 * 1024)).toFixed(2)}GB) exceeds maximum allowed size (${
						MAX_FILE_SIZE / (1024 * 1024 * 1024)
					}GB)`,
					code: 'FILE_TOO_LARGE',
				},
				{ status: 413 }
			);
		}

		// Validate chunk size
		if (chunk.size <= 0) {
			return NextResponse.json(
				{
					error: 'Invalid chunk',
					details: 'Chunk size must be greater than 0',
					code: 'INVALID_CHUNK_SIZE',
				},
				{ status: 400 }
			);
		}

		const Categories = new Map<string, string>([
			['project', 'Project'],
			['product', 'Product'],
			['profile', 'Profile'],
		]);

		// Validate URL parameters
		const categoryParam = request.nextUrl.searchParams.get('c');
		const category = Categories.get((categoryParam ?? 'Project').toLowerCase()) ?? 'Project';
		const pId = request.nextUrl.searchParams.get('id');

		if (!pId || pId.trim().length === 0) {
			return NextResponse.json(
				{
					error: 'Missing required parameter',
					details: 'id parameter is required in the URL',
					code: 'MISSING_PROJECT_ID',
				},
				{ status: 400 }
			);
		}

		// Validate folder parameter if provided
		if (folder && (typeof folder !== 'string' || folder.trim().length === 0)) {
			return NextResponse.json(
				{
					error: 'Invalid folder parameter',
					details: 'folder parameter must be a non-empty string if provided',
					code: 'INVALID_FOLDER',
				},
				{ status: 400 }
			);
		}

		// Prepare S3 upload path with validation
		let s3Path: string;
		try {
			if (folder) {
				s3Path = `${category}/${pId}/${folder}/${fileName}`;
			} else {
				s3Path = `${category}/${pId}/${fileName}`;
			}

			// Validate S3 path length and characters
			if (s3Path.length > 1024) {
				return NextResponse.json(
					{
						error: 'Path too long',
						details: 'The resulting S3 path is too long. Please use shorter folder or file names.',
						code: 'PATH_TOO_LONG',
					},
					{ status: 400 }
				);
			}
		} catch (error) {
			console.error('❌ [ERROR] Failed to construct S3 path:', error);
			return NextResponse.json(
				{
					error: 'Invalid path construction',
					details: 'Unable to construct S3 path from provided parameters',
					code: 'PATH_CONSTRUCTION_ERROR',
				},
				{ status: 400 }
			);
		}

		// Validate environment variables
		const bucket = process.env.BUCKET_NAME;
		if (!bucket || bucket.trim().length === 0) {
			console.error('❌ [ERROR] BUCKET_NAME environment variable not set');
			return NextResponse.json(
				{
					error: 'Server configuration error',
					details: 'S3 bucket configuration is missing. Please contact support.',
					code: 'MISSING_BUCKET_CONFIG',
				},
				{ status: 500 }
			);
		}

		// Store the chunk with error handling
		console.log(
			`📦 [CLIENT CHUNK] Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName} (${
				chunk.size
			} bytes) - Upload ID: ${uploadId}`
		);

		let allChunksStored = false;
		try {
			// Store chunk and check if all chunks are now stored
			allChunksStored = await chunkManager.storeChunk(
				uploadId,
				chunkIndex,
				chunk,
				totalChunks,
				fileName,
				fileSize,
				s3Path,
				bucket,
				category,
				pId,
				folder || undefined,
				startTime,
				duration
			);
			console.log(`✅ [CLIENT CHUNK] Stored chunk ${chunkIndex + 1}/${totalChunks} for ${fileName} successfully`);
		} catch (error) {
			console.error(`❌ [ERROR] Failed to store chunk ${chunkIndex + 1}/${totalChunks}:`, error);

			// Determine error type and provide appropriate response
			if (error instanceof Error) {
				if (error.message.includes('disk space') || error.message.includes('ENOSPC')) {
					return NextResponse.json(
						{
							error: 'Storage full',
							details: 'Server storage is full. Please try again later or contact support.',
							code: 'STORAGE_FULL',
						},
						{ status: 507 }
					);
				} else if (error.message.includes('permission') || error.message.includes('EACCES')) {
					return NextResponse.json(
						{
							error: 'Permission denied',
							details: 'Insufficient permissions to store the file. Please contact support.',
							code: 'PERMISSION_DENIED',
						},
						{ status: 403 }
					);
				} else if (error.message.includes('duplicate') || error.message.includes('already exists')) {
					return NextResponse.json(
						{
							error: 'Duplicate chunk',
							details: 'This chunk has already been uploaded. Please retry the upload.',
							code: 'DUPLICATE_CHUNK',
						},
						{ status: 409 }
					);
				}
			}

			return NextResponse.json(
				{
					error: 'Chunk storage failed',
					details: 'Unable to store the file chunk. Please try again.',
					code: 'CHUNK_STORAGE_ERROR',
				},
				{ status: 500 }
			);
		}

		// Check if ALL chunks are now stored (not just if this is the last chunk)
		// This ensures we wait for all chunks to be fully stored before starting S3 upload
		if (allChunksStored) {
			// Generate preview URL if this is a media file and store it in ChunkInfo
			let previewCdn: string | undefined;
			if (isMediaFile(fileName)) {
				const config = getMediaProcessingConfig();
				// Determine which suffix to use based on file type
				let suffix: string;
				const extension = fileName.toLowerCase().split('.').pop() || '';
				if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'ico'].includes(extension)) {
					suffix = config.image.suffix;
				} else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp', 'ogv'].includes(extension)) {
					suffix = config.video.suffix;
				} else if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(extension)) {
					suffix = config.audio.suffix;
				} else {
					suffix = '_preview'; // fallback
				}

				const previewPath = generatePreviewPath(s3Path, suffix);
				previewCdn = `${process.env.CDN_URL}/${previewPath}`;
				
				// Store preview URL in ChunkInfo so it's available in status responses
				chunkManager.setExpectedPreviewUrl(uploadId, previewCdn);
			}

			// All chunks stored, start S3 upload
			console.log(`🎯 [CHUNK COMPLETE] All ${totalChunks} chunks stored for ${fileName}, starting S3 upload`);
			console.log(`📊 [CHUNK STATS] Total file size: ${fileSize} bytes, S3 path: ${s3Path}`);

			try {
				// Create progress tracking
				ProgressTracker.createProgress(uploadId, fileName, fileSize);

				// Start S3 upload asynchronously
				chunkManager.startS3Upload(uploadId, uploader, s3Path, bucket);
			} catch (error) {
				console.error(`❌ [ERROR] Failed to start S3 upload for ${uploadId}:`, error);

				// Update upload status to failed
				try {
					const uploadStatus = await chunkManager.getUploadStatus(uploadId);
					if (uploadStatus) {
						// Note: We can't directly modify the status here as it's returned from getUploadStatus
						// The error will be handled by the status polling mechanism
						console.error(`❌ [ERROR] S3 upload failed for ${uploadId}:`, error);
					}
				} catch (statusError) {
					console.error('❌ [ERROR] Failed to get upload status:', statusError);
				}

				// Don't return error here as the chunk was successfully stored
				// The S3 upload error will be handled by the status polling
			}
		}

		// For the last chunk, return the complete upload response
		if (chunkIndex === totalChunks - 1) {
			// Get preview URL from ChunkInfo if available (it was set when all chunks were stored)
			const uploadStatus = await chunkManager.getUploadStatus(uploadId);
			const previewCdn = uploadStatus?.previewCdn;

			return NextResponse.json({
				message: 'Upload started',
				uploadId,
				key: s3Path,
				cdn: `${process.env.CDN_URL}/${s3Path}`,
				previewCdn,
				size: fileSize,
				method: 'chunked',
				totalChunks,
				received: totalChunks,
				remaining: 0,
			});
		}

		// For intermediate chunks, return chunk progress
		return NextResponse.json({
			message: 'Chunk received',
			uploadId,
			chunkIndex,
			totalChunks,
			received: chunkIndex + 1,
			remaining: totalChunks - (chunkIndex + 1),
		});
	} catch (error) {
		console.error('❌ [ERROR] Chunk upload error:', error);

		// Determine error type and provide appropriate response
		let errorCode = 'UNKNOWN_ERROR';
		let statusCode = 500;
		let errorMessage = 'Chunk upload failed';
		let errorDetails = 'An unexpected error occurred during upload. Please try again.';

		if (error instanceof Error) {
			errorDetails = error.message;

			// Network and timeout errors
			if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
				errorCode = 'TIMEOUT_ERROR';
				statusCode = 408;
				errorMessage = 'Upload timeout';
				errorDetails = 'The upload request timed out. Please check your connection and try again.';
			} else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
				errorCode = 'NETWORK_ERROR';
				statusCode = 503;
				errorMessage = 'Network error';
				errorDetails = 'Unable to connect to the server. Please check your internet connection.';
			} else if (error.message.includes('memory') || error.message.includes('out of memory')) {
				errorCode = 'MEMORY_ERROR';
				statusCode = 507;
				errorMessage = 'Insufficient memory';
				errorDetails = 'Server is out of memory. Please try again later or contact support.';
			} else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
				errorCode = 'RATE_LIMIT_ERROR';
				statusCode = 429;
				errorMessage = 'Rate limit exceeded';
				errorDetails = 'Too many requests. Please wait a moment before trying again.';
			}
		}

		return NextResponse.json(
			{
				error: errorMessage,
				details: errorDetails,
				code: errorCode,
				timestamp: new Date().toISOString(),
			},
			{ status: statusCode }
		);
	}
}

// GET /api/upload?uploadId=xxx - Get upload status
export async function GET(request: NextRequest) {
	try {
		const uploadId = request.nextUrl.searchParams.get('uploadId');

		if (!uploadId || uploadId.trim().length === 0) {
			return NextResponse.json(
				{
					error: 'Missing required parameter',
					details: 'uploadId parameter is required and must be a non-empty string',
					code: 'MISSING_UPLOAD_ID',
				},
				{ status: 400 }
			);
		}

		// Validate uploadId format
		if (!uploadId.startsWith('chunked_') || uploadId.length < 20) {
			return NextResponse.json(
				{
					error: 'Invalid upload ID format',
					details: 'uploadId must be a valid chunked upload identifier',
					code: 'INVALID_UPLOAD_ID_FORMAT',
				},
				{ status: 400 }
			);
		}

		const status = await chunkManager.getUploadStatus(uploadId);

		if (!status) {
			return NextResponse.json(
				{
					error: 'Upload not found',
					details: `No upload found with ID: ${uploadId}`,
					code: 'UPLOAD_NOT_FOUND',
				},
				{ status: 404 }
			);
		}

		return NextResponse.json(status);
	} catch (error) {
		console.error('❌ [ERROR] Upload status error:', error);

		let errorCode = 'STATUS_ERROR';
		let errorMessage = 'Failed to get upload status';
		let errorDetails = 'An error occurred while retrieving upload status. Please try again.';

		if (error instanceof Error) {
			errorDetails = error.message;

			if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
				errorCode = 'TIMEOUT_ERROR';
				errorMessage = 'Status check timeout';
				errorDetails = 'The status check timed out. Please try again.';
			} else if (error.message.includes('permission') || error.message.includes('EACCES')) {
				errorCode = 'PERMISSION_ERROR';
				errorMessage = 'Permission denied';
				errorDetails = 'Insufficient permissions to check upload status.';
			}
		}

		return NextResponse.json(
			{
				error: errorMessage,
				details: errorDetails,
				code: errorCode,
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}

// DELETE /api/upload?uploadId=xxx - Cancel upload
export async function DELETE(request: NextRequest) {
	try {
		const uploadId = request.nextUrl.searchParams.get('uploadId');

		if (!uploadId || uploadId.trim().length === 0) {
			return NextResponse.json(
				{
					error: 'Missing required parameter',
					details: 'uploadId parameter is required and must be a non-empty string',
					code: 'MISSING_UPLOAD_ID',
				},
				{ status: 400 }
			);
		}

		// Validate uploadId format
		if (!uploadId.startsWith('chunked_') || uploadId.length < 20) {
			return NextResponse.json(
				{
					error: 'Invalid upload ID format',
					details: 'uploadId must be a valid chunked upload identifier',
					code: 'INVALID_UPLOAD_ID_FORMAT',
				},
				{ status: 400 }
			);
		}

		const cancelled = await chunkManager.cancelUpload(uploadId);

		if (!cancelled) {
			return NextResponse.json(
				{
					error: 'Upload not found or already completed',
					details: `No active upload found with ID: ${uploadId}. The upload may have already completed or been cancelled.`,
					code: 'UPLOAD_NOT_FOUND_OR_COMPLETED',
				},
				{ status: 404 }
			);
		}

		console.log(`✅ [CANCEL] Successfully cancelled upload ${uploadId}`);
		return NextResponse.json({
			message: 'Upload cancelled successfully',
			uploadId,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('❌ [ERROR] Upload cancel error:', error);

		let errorCode = 'CANCEL_ERROR';
		let errorMessage = 'Failed to cancel upload';
		let errorDetails = 'An error occurred while cancelling the upload. Please try again.';

		if (error instanceof Error) {
			errorDetails = error.message;

			if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
				errorCode = 'TIMEOUT_ERROR';
				errorMessage = 'Cancel timeout';
				errorDetails = 'The cancel request timed out. Please try again.';
			} else if (error.message.includes('permission') || error.message.includes('EACCES')) {
				errorCode = 'PERMISSION_ERROR';
				errorMessage = 'Permission denied';
				errorDetails = 'Insufficient permissions to cancel the upload.';
			} else if (error.message.includes('already cancelled') || error.message.includes('not active')) {
				errorCode = 'ALREADY_CANCELLED';
				errorMessage = 'Upload already cancelled';
				errorDetails = 'This upload has already been cancelled or completed.';
			}
		}

		return NextResponse.json(
			{
				error: errorMessage,
				details: errorDetails,
				code: errorCode,
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}
