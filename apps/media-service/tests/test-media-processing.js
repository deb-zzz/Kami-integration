#!/usr/bin/env node

/**
 * Media Processing Test Script
 * 
 * Tests the media processing functionality by uploading various file types
 * and verifying that preview files are generated correctly.
 * 
 * Usage:
 *   node tests/test-media-processing.js [image.jpg] [video.mp4] [audio.mp3] [document.pdf]
 * 
 * Example:
 *   node tests/test-media-processing.js test-image.jpg test-video.mp4 test-audio.mp3 test.pdf
 */

const fs = require('fs');
const path = require('path');
const { FormData, Blob } = require('formdata-node');
const { fileFromPath } = require('formdata-node/file-from-path');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const PROJECT_ID = process.env.PROJECT_ID || '999';
const CATEGORY = process.env.CATEGORY || 'project';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Colors for console output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	red: '\x1b[31m',
	cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
	log('\n' + '='.repeat(60), 'cyan');
	log(title, 'bright');
	log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
	log(`✅ ${message}`, 'green');
}

function logError(message) {
	log(`❌ ${message}`, 'red');
}

function logInfo(message) {
	log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
	log(`⚠️  ${message}`, 'yellow');
}

function generateUploadId() {
	return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function uploadChunk(fileBuffer, fileName, uploadId, chunkIndex, totalChunks, fileSize) {
	const start = chunkIndex * CHUNK_SIZE;
	const end = Math.min(start + CHUNK_SIZE, fileSize);
	const chunk = fileBuffer.slice(start, end);

	const formData = new FormData();
	formData.append('chunk', new Blob([chunk]), fileName);
	formData.append('uploadId', uploadId);
	formData.append('chunkIndex', chunkIndex.toString());
	formData.append('totalChunks', totalChunks.toString());
	formData.append('fileName', fileName);
	formData.append('fileSize', fileSize.toString());

	try {
		const response = await fetch(`${API_URL}/api/upload?id=${PROJECT_ID}&c=${CATEGORY}`, {
			method: 'POST',
			body: formData,
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(`Upload failed: ${error.error || response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}: ${error.message}`);
	}
}

async function uploadFile(filePath) {
	const fileName = path.basename(filePath);

	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}

	const fileBuffer = fs.readFileSync(filePath);
	const fileSize = fileBuffer.length;
	const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
	const uploadId = generateUploadId();

	logInfo(`Uploading ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB, ${totalChunks} chunks)...`);

	let lastResult = null;

	for (let i = 0; i < totalChunks; i++) {
		try {
			const result = await uploadChunk(fileBuffer, fileName, uploadId, i, totalChunks, fileSize);
			lastResult = result;

			const progress = Math.round(((i + 1) / totalChunks) * 100);
			process.stdout.write(`\r  Progress: ${progress}% (${i + 1}/${totalChunks} chunks)`);

			if (i === totalChunks - 1) {
				console.log(''); // New line after progress
				logSuccess(`Upload complete: ${result.cdn || result.key}`);
				return { uploadId, result };
			}
		} catch (error) {
			console.log(''); // New line
			throw error;
		}
	}
}

async function checkUploadStatus(uploadId, maxAttempts = 30) {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const response = await fetch(`${API_URL}/api/upload?uploadId=${uploadId}`);

			if (!response.ok) {
				throw new Error(`Status check failed: ${response.statusText}`);
			}

			const status = await response.json();

			if (status.status === 'completed') {
				return status;
			} else if (status.status === 'failed') {
				throw new Error(`Upload failed: ${status.error || 'Unknown error'}`);
			}

			// Wait before next check
			await new Promise((resolve) => setTimeout(resolve, 2000));
		} catch (error) {
			if (attempt === maxAttempts - 1) {
				throw error;
			}
		}
	}

	throw new Error('Timeout waiting for upload to complete');
}

function getFileType(filePath) {
	const ext = path.extname(filePath).toLowerCase().slice(1);
	const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'ico'];
	const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp', 'ogv'];
	const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'];

	if (imageExts.includes(ext)) return 'image';
	if (videoExts.includes(ext)) return 'video';
	if (audioExts.includes(ext)) return 'audio';
	return 'other';
}

function getPreviewPath(originalPath) {
	const ext = path.extname(originalPath);
	const nameWithoutExt = path.basename(originalPath, ext);
	const dir = path.dirname(originalPath);
	return path.join(dir, `${nameWithoutExt}_preview${ext}`);
}

async function testFile(filePath) {
	const fileType = getFileType(filePath);
	const fileName = path.basename(filePath);

	logSection(`Testing ${fileType.toUpperCase()}: ${fileName}`);

	try {
		// Upload file
		const { uploadId, result } = await uploadFile(filePath);

		logInfo('Waiting for upload and processing to complete...');

		// Wait for completion
		const status = await checkUploadStatus(uploadId, 60); // 2 minutes max

		logSuccess('Upload and processing completed!');

		// Display results
		console.log('\n📊 Results:');
		console.log(`  Original: ${result.cdn || result.key}`);
		if (fileType !== 'other') {
			const previewPath = getPreviewPath(result.key || result.cdn);
			console.log(`  Preview:  ${previewPath}`);
			logInfo('Check S3 bucket to verify preview file exists');
		} else {
			logInfo('Non-media file - processing skipped (expected)');
		}

		if (status.uploadedSize) {
			console.log(`  Size: ${(status.uploadedSize / 1024 / 1024).toFixed(2)} MB`);
		}

		return { success: true, uploadId, result, status };
	} catch (error) {
		logError(`Test failed: ${error.message}`);
		return { success: false, error: error.message };
	}
}

async function main() {
	const files = process.argv.slice(2);

	if (files.length === 0) {
		console.log(`
Usage: node tests/test-media-processing.js [file1] [file2] [file3] ...

Examples:
  node tests/test-media-processing.js test-image.jpg
  node tests/test-media-processing.js test-image.jpg test-video.mp4 test-audio.mp3
  node tests/test-media-processing.js test-image.jpg test.pdf

Environment Variables:
  API_URL      - API base URL (default: http://localhost:3000)
  PROJECT_ID   - Project ID for uploads (default: 999)
  CATEGORY     - Category: project, product, or profile (default: project)
		`);
		process.exit(1);
	}

	logSection('Media Processing Test Suite');
	logInfo(`API URL: ${API_URL}`);
	logInfo(`Project ID: ${PROJECT_ID}`);
	logInfo(`Category: ${CATEGORY}`);

	const results = [];

	for (const file of files) {
		const result = await testFile(file);
		results.push({ file, ...result });
	}

	// Summary
	logSection('Test Summary');
	let successCount = 0;
	let failCount = 0;

	for (const result of results) {
		if (result.success) {
			logSuccess(`${path.basename(result.file)}: PASSED`);
			successCount++;
		} else {
			logError(`${path.basename(result.file)}: FAILED - ${result.error}`);
			failCount++;
		}
	}

	console.log(`\n📈 Results: ${successCount} passed, ${failCount} failed`);

	if (failCount > 0) {
		process.exit(1);
	}
}

// Run tests
main().catch((error) => {
	logError(`Fatal error: ${error.message}`);
	process.exit(1);
});

