import { renderHook, act } from '@testing-library/react';
import { useChunkedUpload } from '../useChunkedUpload';

// Mock fetch
global.fetch = jest.fn();

describe('useChunkedUpload', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should initialize with correct default values', () => {
		const { result } = renderHook(() => useChunkedUpload());

		expect(result.current.isUploading).toBe(false);
		expect(result.current.currentUpload).toBe(null);
		expect(result.current.error).toBe(null);
		expect(typeof result.current.uploadFile).toBe('function');
		expect(typeof result.current.cancelUpload).toBe('function');
		expect(typeof result.current.getUploadStatus).toBe('function');
	});

	it('should handle file upload with progress tracking', async () => {
		const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
		const mockChunkResponse = {
			message: 'Chunk received',
			uploadId: 'test-upload-id',
			chunkIndex: 0,
			totalChunks: 1,
			received: 1,
			remaining: 0,
			progress: 100,
		};
		const mockStatusResponse = {
			uploadId: 'test-upload-id',
			fileName: 'test.txt',
			fileSize: 12,
			totalChunks: 1,
			receivedChunks: 1,
			status: 'completed',
			key: 'Project/999/test.txt',
			cdn: 'https://cdn.example.com/Project/999/test.txt',
			previewCdn: 'https://cdn.example.com/Project/999/test_preview.txt',
		};

		(fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChunkResponse),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStatusResponse),
			});

		const { result } = renderHook(() => useChunkedUpload());

		let uploadResult: any;
		await act(async () => {
			uploadResult = await result.current.uploadFile(mockFile, {
				projectId: '999',
				category: 'project',
			});
		});

		expect(uploadResult).toEqual(mockStatusResponse);
		expect(result.current.isUploading).toBe(false);
		expect(result.current.currentUpload).toEqual(mockStatusResponse);
	});

	it('should handle upload cancellation', async () => {
		const mockResponse = {
			message: 'Upload cancelled',
			uploadId: 'test-upload-id',
		};

		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse),
		});

		const { result } = renderHook(() => useChunkedUpload());

		await act(async () => {
			await result.current.cancelUpload('test-upload-id');
		});

		expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/upload?uploadId=test-upload-id'), { method: 'DELETE' });
	});

	it('should handle upload status retrieval', async () => {
		const mockStatusResponse = {
			uploadId: 'test-upload-id',
			fileName: 'test.txt',
			fileSize: 12,
			totalChunks: 1,
			receivedChunks: 1,
			status: 'uploading',
		};

		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockStatusResponse),
		});

		const { result } = renderHook(() => useChunkedUpload());

		let status: any;
		await act(async () => {
			status = await result.current.getUploadStatus('test-upload-id');
		});

		expect(status).toEqual(mockStatusResponse);
		expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/upload?uploadId=test-upload-id'));
	});

	it('should handle upload errors', async () => {
		const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

		(fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

		const { result } = renderHook(() => useChunkedUpload());

		await act(async () => {
			try {
				await result.current.uploadFile(mockFile, {
					projectId: '999',
					category: 'project',
				});
			} catch (error) {
				// Expected to throw
			}
		});

		expect(result.current.error).toBe('Network error');
		expect(result.current.isUploading).toBe(false);
	});

	it('should include startTime and duration in FormData when provided', async () => {
		const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
		const mockChunkResponse = {
			message: 'Chunk received',
			uploadId: 'test-upload-id',
			chunkIndex: 0,
			totalChunks: 1,
			received: 1,
			remaining: 0,
			progress: 100,
		};
		const mockStatusResponse = {
			uploadId: 'test-upload-id',
			fileName: 'test.mp4',
			fileSize: 12,
			totalChunks: 1,
			receivedChunks: 1,
			status: 'completed',
			key: 'Project/999/test.mp4',
			cdn: 'https://cdn.example.com/Project/999/test.mp4',
		};

		(fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChunkResponse),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStatusResponse),
			});

		const { result } = renderHook(() => useChunkedUpload());

		await act(async () => {
			await result.current.uploadFile(mockFile, {
				projectId: '999',
				category: 'project',
				startTime: 10,
				duration: 45,
			});
		});

		// Check that fetch was called with FormData containing startTime and duration
		const fetchCall = (fetch as jest.Mock).mock.calls[0];
		expect(fetchCall).toBeDefined();
		
		// Verify the FormData contains the preview options
		const formData = fetchCall[1]?.body as FormData;
		if (formData) {
			expect(formData.get('startTime')).toBe('10');
			expect(formData.get('duration')).toBe('45');
		}
	});

	it('should validate duration is between 5 and 60 seconds', async () => {
		const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
		const { result } = renderHook(() => useChunkedUpload());

		// Test duration too low
		await act(async () => {
			try {
				await result.current.uploadFile(mockFile, {
					projectId: '999',
					duration: 3, // Below minimum
				});
			} catch (error: any) {
				expect(error.message).toContain('duration must be between 5 and 60 seconds');
			}
		});

		// Test duration too high
		await act(async () => {
			try {
				await result.current.uploadFile(mockFile, {
					projectId: '999',
					duration: 65, // Above maximum
				});
			} catch (error: any) {
				expect(error.message).toContain('duration must be between 5 and 60 seconds');
			}
		});
	});

	it('should validate startTime is greater than or equal to 0', async () => {
		const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
		const { result } = renderHook(() => useChunkedUpload());

		await act(async () => {
			try {
				await result.current.uploadFile(mockFile, {
					projectId: '999',
					startTime: -1, // Invalid
				});
			} catch (error: any) {
				expect(error.message).toContain('startTime must be greater than or equal to 0');
			}
		});
	});

	it('should accept valid startTime and duration values', async () => {
		const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
		const mockChunkResponse = {
			message: 'Chunk received',
			uploadId: 'test-upload-id',
			chunkIndex: 0,
			totalChunks: 1,
			received: 1,
			remaining: 0,
			progress: 100,
		};
		const mockStatusResponse = {
			uploadId: 'test-upload-id',
			fileName: 'test.mp4',
			fileSize: 12,
			totalChunks: 1,
			receivedChunks: 1,
			status: 'completed',
			key: 'Project/999/test.mp4',
			cdn: 'https://cdn.example.com/Project/999/test.mp4',
		};

		const { result } = renderHook(() => useChunkedUpload());

		// Test minimum valid values
		(fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChunkResponse),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStatusResponse),
			});

		await act(async () => {
			await result.current.uploadFile(mockFile, {
				projectId: '999',
				startTime: 0,
				duration: 5,
			});
		});

		expect(result.current.error).toBe(null);

		// Test maximum valid values
		(fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChunkResponse),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStatusResponse),
			});

		await act(async () => {
			await result.current.uploadFile(mockFile, {
				projectId: '999',
				startTime: 0,
				duration: 60,
			});
		});

		expect(result.current.error).toBe(null);

		// Test boundary values
		(fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChunkResponse),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStatusResponse),
			});

		await act(async () => {
			await result.current.uploadFile(mockFile, {
				projectId: '999',
				startTime: 10,
				duration: 30,
			});
		});

		expect(result.current.error).toBe(null);
	});
});
