import { NextRequest, NextResponse } from 'next/server';
import { ProgressTracker } from '@/lib/progress';
import { getChunkManager } from '@/lib/chunk-manager';

export const dynamic = 'force-dynamic';

// Initialize chunk manager
const chunkManager = getChunkManager();

// GET /api/upload/progress?uploadId=xxx
export async function GET(request: NextRequest) {
	try {
		const uploadId = request.nextUrl.searchParams.get('uploadId');

		if (!uploadId) {
			return NextResponse.json({ error: 'uploadId parameter is required' }, { status: 400 });
		}

		// First try to get progress from chunk manager (for chunked uploads)
		const chunkStatus = await chunkManager.getUploadStatus(uploadId);
		if (chunkStatus) {
			return NextResponse.json(chunkStatus);
		}

		// Fallback to progress tracker (for legacy uploads)
		const progress = ProgressTracker.getProgress(uploadId);

		if (!progress) {
			return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
		}

		// Calculate additional metrics
		const elapsedTime = Date.now() - progress.startTime;
		const estimatedTimeRemaining = ProgressTracker.getEstimatedTimeRemaining(progress);

		return NextResponse.json({
			...progress,
			elapsedTime,
			estimatedTimeRemaining,
		});
	} catch (error) {
		console.error('Progress fetch error:', error);
		return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
	}
}

// POST /api/upload/progress (internal use)
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { uploadId, fileName, totalSize, uploadedSize, status, error } = body;

		if (!uploadId) {
			return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });
		}

		let progress = ProgressTracker.getProgress(uploadId);

		// Create new progress if it doesn't exist
		if (!progress) {
			if (!fileName || !totalSize) {
				return NextResponse.json({ error: 'fileName and totalSize are required for new progress' }, { status: 400 });
			}
			progress = ProgressTracker.createProgress(uploadId, fileName, totalSize);
		}

		// Update progress
		const updatedProgress = ProgressTracker.updateProgress(uploadId, uploadedSize || progress.uploadedSize, status, error);

		if (!updatedProgress) {
			return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
		}

		return NextResponse.json({
			message: 'Progress updated successfully',
			progress: updatedProgress,
		});
	} catch (error) {
		console.error('Progress update error:', error);
		return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
	}
}

// DELETE /api/upload/progress?uploadId=xxx
export async function DELETE(request: NextRequest) {
	try {
		const uploadId = request.nextUrl.searchParams.get('uploadId');

		if (!uploadId) {
			return NextResponse.json({ error: 'uploadId parameter is required' }, { status: 400 });
		}

		const deleted = ProgressTracker.deleteProgress(uploadId);

		if (!deleted) {
			return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
		}

		return NextResponse.json({
			message: 'Progress deleted successfully',
		});
	} catch (error) {
		console.error('Progress delete error:', error);
		return NextResponse.json({ error: 'Failed to delete progress' }, { status: 500 });
	}
}
