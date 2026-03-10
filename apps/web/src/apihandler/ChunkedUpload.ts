'use server';
import { createSignature } from '@/lib/Util';
import { axiosInstance } from './AxiosInstance';

export type ChunkedUploadResponse = {
	chunkIndex: number;
	totalChunks: number;
	received: number;
	remaining: number;
	progress: number;
	uploadId: string;
};

export type ChunkedUploadStatus = {
	uploadId: string;
	fileName: string;
	fileSize: number;
	totalChunks: number;
	receivedChunks: number;
	status: 'uploading' | 'uploading_to_s3' | 'completed' | 'failed' | 'cancelled';
	key?: string;
	cdn?: string;
	error?: string;
	startTime?: string;
	lastUpdate?: string;
	percentage?: number;
	uploadedSize?: number;
};

export type ChunkedUploadOptions = {
	projectId: string;
	category?: 'project' | 'product' | 'profile';
	folder?: string;
	chunkSize?: number;
};

// Upload a single chunk
export const uploadChunk = async (
	chunk: Blob,
	uploadId: string,
	chunkIndex: number,
	totalChunks: number,
	fileName: string,
	fileSize: number,
	options: ChunkedUploadOptions
): Promise<ChunkedUploadResponse> => {
	try {
		const formData = new FormData();
		formData.append('chunk', chunk);
		formData.append('uploadId', uploadId);
		formData.append('chunkIndex', chunkIndex.toString());
		formData.append('totalChunks', totalChunks.toString());
		formData.append('fileName', fileName);
		formData.append('fileSize', fileSize.toString());
		if (options.folder) {
			formData.append('folder', options.folder);
		}

		const data = {
			uploadId,
			chunkIndex,
			totalChunks,
			fileName,
			fileSize,
			folder: options.folder,
		};

		const res = await axiosInstance.post(`/api/upload?id=${options.projectId}&c=${options.category || 'project'}`, formData, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
				'Content-Type': 'multipart/form-data',
			},
		});

		return <ChunkedUploadResponse>res.data;
	} catch (error) {
		console.error('Chunk upload error:', error);
		throw new Error(
			`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
};

// Get upload status
export const getUploadStatus = async (uploadId: string): Promise<ChunkedUploadStatus> => {
	try {
		const data = { uploadId };

		const res = await axiosInstance.get(`/api/upload?uploadId=${uploadId}`, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		});

		return <ChunkedUploadStatus>res.data;
	} catch (error) {
		console.error('Get upload status error:', error);
		throw new Error(`Failed to get upload status: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};

// Cancel upload
export const cancelUpload = async (uploadId: string): Promise<{ success: boolean }> => {
	try {
		const data = { uploadId };

		const res = await axiosInstance.delete(`/api/upload?uploadId=${uploadId}`, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		});

		return <{ success: boolean }>res.data;
	} catch (error) {
		console.error('Cancel upload error:', error);
		throw new Error(`Failed to cancel upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};
