const http = require('http');

const BASE_URL = 'http://localhost:3001';
const testChainId = '0x14a34'; // Base Sepolia testnet

console.log('🧪 Testing Blockchain API Endpoints...\n');

// Test data
const testData = {
	chainId: testChainId,
};

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
	return new Promise((resolve, reject) => {
		const req = http.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				try {
					const parsedData = JSON.parse(data);
					resolve({ statusCode: res.statusCode, data: parsedData });
				} catch (error) {
					resolve({ statusCode: res.statusCode, data: data });
				}
			});
		});

		req.on('error', (error) => {
			reject(error);
		});

		if (postData) {
			req.write(JSON.stringify(postData));
		}

		req.end();
	});
}

// Test 1: Get blockchain information
async function testGetBlockchainInfo() {
	console.log('📋 Test 1: Get blockchain information');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: `/api/blockchain/${testData.chainId}`,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const response = await makeRequest(options);
		console.log(`   Status: ${response.statusCode}`);
		console.log(`   Response:`, JSON.stringify(response.data, null, 2));

		if (response.statusCode === 200 && response.data.success) {
			console.log('   ✅ SUCCESS: Blockchain information retrieved');

			// Validate response structure
			const blockchain = response.data.data;
			if (blockchain && blockchain.chainId && blockchain.name && blockchain.rpcUrl) {
				console.log('   ✅ SUCCESS: Response structure is valid');
			} else {
				console.log('   ❌ FAILED: Invalid response structure');
			}
		} else {
			console.log('   ❌ FAILED: Request failed');
		}
	} catch (error) {
		console.log(`   ❌ ERROR: ${error.message}`);
	}
	console.log('');
}

// Test 2: Get blockchain information with invalid chainId
async function testGetBlockchainInfoInvalidChainId() {
	console.log('📋 Test 2: Get blockchain information with invalid chainId');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: '/api/blockchain/invalid-chain-id',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const response = await makeRequest(options);
		console.log(`   Status: ${response.statusCode}`);
		console.log(`   Response:`, JSON.stringify(response.data, null, 2));

		if (response.statusCode === 500 && !response.data.success) {
			console.log('   ✅ SUCCESS: Properly handled invalid chainId');
		} else {
			console.log('   ❌ FAILED: Should return error for invalid chainId');
		}
	} catch (error) {
		console.log(`   ❌ ERROR: ${error.message}`);
	}
	console.log('');
}

// Test 3: Test missing chainId parameter
async function testMissingChainId() {
	console.log('📋 Test 3: Test missing chainId parameter');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: '/api/blockchain/',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const response = await makeRequest(options);
		console.log(`   Status: ${response.statusCode}`);
		console.log(`   Response:`, JSON.stringify(response.data, null, 2));

		if (response.statusCode === 404) {
			console.log('   ✅ SUCCESS: Properly handled missing chainId (404)');
		} else {
			console.log('   ❌ FAILED: Should return 404 for missing chainId');
		}
	} catch (error) {
		console.log(`   ❌ ERROR: ${error.message}`);
	}
	console.log('');
}

// Run all tests
async function runAllTests() {
	console.log('🚀 Starting Blockchain API Tests...\n');

	await testGetBlockchainInfo();
	await testGetBlockchainInfoInvalidChainId();
	await testMissingChainId();

	console.log('🏁 Blockchain API Tests completed!');
}

// Check if server is running
async function checkServer() {
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: '/health',
			method: 'GET',
		};

		const response = await makeRequest(options);
		if (response.statusCode === 200) {
			console.log('✅ Server is running on port 3001\n');
			return true;
		} else {
			console.log('❌ Server is not responding properly\n');
			return false;
		}
	} catch (error) {
		console.log('❌ Server is not running. Please start the server with: pnpm run dev\n');
		return false;
	}
}

// Main execution
async function main() {
	const serverRunning = await checkServer();
	if (serverRunning) {
		await runAllTests();
	}
}

main().catch(console.error);
