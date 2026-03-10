const http = require('http');

const BASE_URL = 'http://localhost:3001';
const testChainId = '0x14a34'; // Base Sepolia testnet

console.log('🧪 Testing Enhanced USDC Info API Endpoint...\n');

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

// Test 1: Get enhanced USDC info (with name field)
async function testGetEnhancedUSDCInfo() {
	console.log('📋 Test 1: Get enhanced USDC info with name field');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: `/api/balances/${testData.chainId}/usdc-info`,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const response = await makeRequest(options);
		console.log(`   Status: ${response.statusCode}`);
		console.log(`   Response:`, JSON.stringify(response.data, null, 2));

		if (response.statusCode === 200 && response.data.success) {
			console.log('   ✅ SUCCESS: USDC info retrieved');

			// Validate enhanced response structure
			const usdcInfo = response.data.data;
			if (usdcInfo && usdcInfo.symbol && usdcInfo.decimals && usdcInfo.contractAddress && usdcInfo.name) {
				console.log('   ✅ SUCCESS: Enhanced response structure is valid (includes name field)');
				console.log(`   📝 Token Name: ${usdcInfo.name}`);
				console.log(`   📝 Token Symbol: ${usdcInfo.symbol}`);
				console.log(`   📝 Token Decimals: ${usdcInfo.decimals}`);
				console.log(`   📝 Contract Address: ${usdcInfo.contractAddress}`);
			} else {
				console.log('   ❌ FAILED: Invalid enhanced response structure (missing name field)');
			}
		} else {
			console.log('   ❌ FAILED: Request failed');
		}
	} catch (error) {
		console.log(`   ❌ ERROR: ${error.message}`);
	}
	console.log('');
}

// Test 2: Get USDC info with invalid chainId
async function testGetUSDCInfoInvalidChainId() {
	console.log('📋 Test 2: Get USDC info with invalid chainId');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: '/api/balances/invalid-chain-id/usdc-info',
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
			path: '/api/balances//usdc-info',
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
	console.log('🚀 Starting Enhanced USDC Info API Tests...\n');

	await testGetEnhancedUSDCInfo();
	await testGetUSDCInfoInvalidChainId();
	await testMissingChainId();

	console.log('🏁 Enhanced USDC Info API Tests completed!');
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
