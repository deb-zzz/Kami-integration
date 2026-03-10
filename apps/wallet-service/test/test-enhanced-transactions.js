const http = require('http');

const BASE_URL = 'http://localhost:3001';
const testChainId = '0x14a34'; // Base Sepolia testnet

console.log('🧪 Testing Enhanced Transactions API with Token Data...\n');

// Test data
const testData = {
	chainId: testChainId,
	walletAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik's address for testing
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

// Test 1: Get enhanced wallet transactions with token data
async function testGetEnhancedWalletTransactions() {
	console.log('📋 Test 1: Get enhanced wallet transactions with token data');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: `/api/transactions/${testData.chainId}?walletAddress=${testData.walletAddress}`,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const response = await makeRequest(options);
		console.log(`   Status: ${response.statusCode}`);
		console.log(`   Response:`, JSON.stringify(response.data, null, 2));

		if (response.statusCode === 200 && response.data.success) {
			console.log('   ✅ SUCCESS: Enhanced wallet transactions retrieved');

			// Validate enhanced response structure
			const transactions = response.data.data;
			if (Array.isArray(transactions)) {
				console.log(`   📝 Found ${transactions.length} transactions`);

				// Check if transactions have the new tokenData field
				const hasTokenData = transactions.some((tx) => tx.tokenData !== undefined);
				if (hasTokenData) {
					console.log('   ✅ SUCCESS: Transactions include token data');

					// Show sample token data
					const txWithTokenData = transactions.find((tx) => tx.tokenData && tx.tokenData.length > 0);
					if (txWithTokenData) {
						console.log('   📝 Sample token data:');
						console.log(`     Contract: ${txWithTokenData.tokenData[0].contractAddress}`);
						console.log(`     Type: ${txWithTokenData.tokenData[0].tokenType}`);
						console.log(`     Symbol: ${txWithTokenData.tokenData[0].tokenSymbol}`);
						console.log(`     From: ${txWithTokenData.tokenData[0].fromAddress}`);
						console.log(`     To: ${txWithTokenData.tokenData[0].toAddress}`);
					}
				} else {
					console.log('   ⚠️  WARNING: No token data found in transactions');
				}

				// Check if BigInt values are properly converted to strings
				const hasBigIntValues = transactions.some(
					(tx) => typeof tx.value === 'bigint' || typeof tx.gasLimit === 'bigint' || typeof tx.timestamp === 'bigint'
				);

				if (!hasBigIntValues) {
					console.log('   ✅ SUCCESS: BigInt values properly converted to strings');
				} else {
					console.log('   ❌ FAILED: BigInt values not properly converted');
				}
			} else {
				console.log('   ❌ FAILED: Invalid response structure - not an array');
			}
		} else {
			console.log('   ❌ FAILED: Request failed');
		}
	} catch (error) {
		console.log(`   ❌ ERROR: ${error.message}`);
	}
	console.log('');
}

// Test 2: Get wallet transactions with invalid wallet address
async function testGetWalletTransactionsInvalidAddress() {
	console.log('📋 Test 2: Get wallet transactions with invalid wallet address');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: `/api/transactions/${testData.chainId}?walletAddress=invalid-address`,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const response = await makeRequest(options);
		console.log(`   Status: ${response.statusCode}`);
		console.log(`   Response:`, JSON.stringify(response.data, null, 2));

		if (response.statusCode === 400 && !response.data.success) {
			console.log('   ✅ SUCCESS: Properly handled invalid wallet address');
		} else {
			console.log('   ❌ FAILED: Should return error for invalid wallet address');
		}
	} catch (error) {
		console.log(`   ❌ ERROR: ${error.message}`);
	}
	console.log('');
}

// Test 3: Get wallet transactions with missing wallet address
async function testGetWalletTransactionsMissingAddress() {
	console.log('📋 Test 3: Get wallet transactions with missing wallet address');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: `/api/transactions/${testData.chainId}`,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const response = await makeRequest(options);
		console.log(`   Status: ${response.statusCode}`);
		console.log(`   Response:`, JSON.stringify(response.data, null, 2));

		if (response.statusCode === 400 && !response.data.success) {
			console.log('   ✅ SUCCESS: Properly handled missing wallet address');
		} else {
			console.log('   ❌ FAILED: Should return error for missing wallet address');
		}
	} catch (error) {
		console.log(`   ❌ ERROR: ${error.message}`);
	}
	console.log('');
}

// Test 4: Get wallet transactions with invalid chainId
async function testGetWalletTransactionsInvalidChainId() {
	console.log('📋 Test 4: Get wallet transactions with invalid chainId');
	try {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: `/api/transactions/invalid-chain-id?walletAddress=${testData.walletAddress}`,
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

// Run all tests
async function runAllTests() {
	console.log('🚀 Starting Enhanced Transactions API Tests...\n');

	await testGetEnhancedWalletTransactions();
	await testGetWalletTransactionsInvalidAddress();
	await testGetWalletTransactionsMissingAddress();
	await testGetWalletTransactionsInvalidChainId();

	console.log('🏁 Enhanced Transactions API Tests completed!');
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
