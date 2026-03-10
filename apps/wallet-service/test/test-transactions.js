// Test script for the new transactions endpoint
const http = require('http');

const testChainId = '0x14a34'; // Base Sepolia chain ID

console.log('🧪 Testing Transactions Endpoint...\n');

// Test 1: Get transactions for a wallet address
console.log('1. Testing get wallet transactions...');
const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

const transactionsReq = http.get(`http://localhost:3001/api/transactions/${testChainId}?walletAddress=${testAddress}`, (res) => {
	let data = '';
	res.on('data', (chunk) => (data += chunk));
	res.on('end', () => {
		const response = JSON.parse(data);
		console.log('✅ Get wallet transactions:', response.success ? 'PASSED' : 'FAILED');
		console.log('   Response:', response.message);

		if (response.success && response.data) {
			console.log('   📊 Transactions found:', response.data.length);
			if (response.data.length > 0) {
				console.log('   📋 Sample transaction:');
				const tx = response.data[0];
				console.log('   - Hash:', tx.hash);
				console.log('   - From:', tx.fromAddress);
				console.log('   - To:', tx.toAddress);
				console.log('   - Value:', tx.valueFormatted);
				console.log('   - Timestamp:', tx.timestamp);
			}
		}

		testMissingAddress();
	});
});

transactionsReq.on('error', (err) => {
	console.error('❌ Get transactions test failed:', err.message);
	testMissingAddress();
});

// Test 2: Test with missing wallet address
function testMissingAddress() {
	console.log('\n2. Testing missing wallet address...');

	const missingAddressReq = http.get(`http://localhost:3001/api/transactions/${testChainId}`, (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			const response = JSON.parse(data);
			console.log('✅ Missing wallet address:', response.success === false ? 'PASSED' : 'FAILED');
			console.log('   Error:', response.message);
			testInvalidAddress();
		});
	});

	missingAddressReq.on('error', (err) => {
		console.error('❌ Missing address test failed:', err.message);
		testInvalidAddress();
	});
}

// Test 3: Test with invalid wallet address format
function testInvalidAddress() {
	console.log('\n3. Testing invalid wallet address format...');
	const invalidAddress = 'invalid-address';

	const invalidAddressReq = http.get(`http://localhost:3001/api/transactions/${testChainId}?walletAddress=${invalidAddress}`, (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			const response = JSON.parse(data);
			console.log('✅ Invalid wallet address format:', response.success === false ? 'PASSED' : 'FAILED');
			console.log('   Error:', response.message);
			console.log('\n🎉 Transactions endpoint tests completed!');
		});
	});

	invalidAddressReq.on('error', (err) => {
		console.error('❌ Invalid address test failed:', err.message);
		console.log('\n🎉 Transactions endpoint tests completed!');
	});
}
