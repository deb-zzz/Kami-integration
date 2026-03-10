const fs = require('fs');
const path = require('path');

// Test script for chunked upload functionality
async function testChunkedUpload() {
	console.log('Testing chunked upload functionality...\n');

	// Create a test file (1MB)
	const testFilePath = path.join(__dirname, 'test-file.txt');
	const testData = 'A'.repeat(1024 * 1024); // 1MB of 'A' characters
	fs.writeFileSync(testFilePath, testData);

	console.log(`Created test file: ${testFilePath} (${testData.length} bytes)`);

	const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
	const totalChunks = Math.ceil(testData.length / CHUNK_SIZE);
	const uploadId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	console.log(`File will be split into ${totalChunks} chunks of ${CHUNK_SIZE} bytes each`);
	console.log(`Upload ID: ${uploadId}\n`);

	try {
		// Upload chunks
		for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
			const start = chunkIndex * CHUNK_SIZE;
			const end = Math.min(start + CHUNK_SIZE, testData.length);
			const chunk = testData.slice(start, end);

			console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} bytes)...`);

			const formData = new FormData();
			formData.append('chunk', new Blob([chunk]), 'chunk.txt');
			formData.append('uploadId', uploadId);
			formData.append('chunkIndex', chunkIndex.toString());
			formData.append('totalChunks', totalChunks.toString());
			formData.append('fileName', 'test-file.txt');
			formData.append('fileSize', testData.length.toString());

			const response = await fetch('http://localhost:3001/api/upload?id=999&c=project', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(`Chunk upload failed: ${error.error}`);
			}

			const result = await response.json();
			console.log(`  ✓ Chunk ${chunkIndex + 1} uploaded successfully`);

			// Show response details for the last chunk
			if (chunkIndex === totalChunks - 1) {
				console.log(`  📋 Upload Response:`, {
					message: result.message,
					uploadId: result.uploadId,
					key: result.key,
					cdn: result.cdn,
					size: result.size,
					method: result.method,
				});
			}
		}

		console.log('\nAll chunks uploaded! Monitoring S3 upload progress...\n');

		// Monitor progress
		let completed = false;
		let attempts = 0;
		const maxAttempts = 60; // 60 seconds timeout

		while (!completed && attempts < maxAttempts) {
			await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
			attempts++;

			try {
				const response = await fetch(`http://localhost:3001/api/upload?uploadId=${uploadId}`);
				const status = await response.json();

				if (response.ok) {
					console.log(`Status: ${status.status} | Chunks: ${status.receivedChunks}/${status.totalChunks}`);

					if (status.uploadedSize && status.percentage) {
						console.log(`Progress: ${status.percentage}% (${status.uploadedSize}/${status.fileSize} bytes)`);
					}

					if (status.status === 'completed') {
						console.log('\n✅ Upload completed successfully!');
						completed = true;
					} else if (status.status === 'failed') {
						console.log(`\n❌ Upload failed: ${status.error}`);
						completed = true;
					}
				} else {
					console.log(`Failed to get status: ${status.error}`);
				}
			} catch (error) {
				console.log(`Error checking status: ${error.message}`);
			}
		}

		if (!completed) {
			console.log('\n⏰ Upload monitoring timed out');
		}
	} catch (error) {
		console.error(`\n❌ Test failed: ${error.message}`);
	} finally {
		// Clean up test file
		if (fs.existsSync(testFilePath)) {
			fs.unlinkSync(testFilePath);
			console.log('\nCleaned up test file');
		}
	}
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
	console.log('This test requires Node.js 18+ or a fetch polyfill');
	console.log('You can also test using the HTML files:');
	console.log('  - tests/upload-example.html (basic upload)');
	console.log('  - tests/upload-with-progress.html (upload with progress tracking)');
	process.exit(1);
}

// Run the test
testChunkedUpload().catch(console.error);
