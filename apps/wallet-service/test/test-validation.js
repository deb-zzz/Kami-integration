// Test script to demonstrate Zod validation
const http = require('http');

const testChainId = '0x14a34'; // Base Sepolia chain ID

console.log('🧪 Testing Zod Validation...\n');

// Test 1: Valid balance request
console.log('1. Testing valid balance request...');
const validBalanceReq = http.get(
	`http://localhost:3001/api/balances/${testChainId}?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`,
	(res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			console.log('✅ Valid balance request:', JSON.parse(data).success ? 'PASSED' : 'FAILED');
			testInvalidBalance();
		});
	}
);

validBalanceReq.on('error', (err) => {
	console.error('❌ Valid balance test failed:', err.message);
});

// Test 2: Invalid balance request (missing address)
function testInvalidBalance() {
	console.log('\n2. Testing invalid balance request (missing address)...');
	const invalidBalanceReq = http.get(`http://localhost:3001/api/balances/${testChainId}`, (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			const response = JSON.parse(data);
			console.log('✅ Invalid balance request:', response.success === false ? 'PASSED' : 'FAILED');
			console.log('   Error:', response.message);
			if (response.details) {
				console.log('   Details:', response.details);
			}
			testMissingChainId();
		});
	});

	invalidBalanceReq.on('error', (err) => {
		console.error('❌ Invalid balance test failed:', err.message);
	});
}

// Test 2.5: Missing chainId
function testMissingChainId() {
	console.log('\n2.5. Testing missing chainId...');
	const missingChainIdReq = http.get('http://localhost:3001/api/balances?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			const response = JSON.parse(data);
			console.log('✅ Missing chainId:', response.success === false ? 'PASSED' : 'FAILED');
			console.log('   Error:', response.message);
			if (response.details) {
				console.log('   Details:', response.details);
			}
			testInvalidAddress();
		});
	});

	missingChainIdReq.on('error', (err) => {
		console.error('❌ Missing chainId test failed:', err.message);
	});
}

// Test 3: Invalid address format
function testInvalidAddress() {
	console.log('\n3. Testing invalid address format...');
	const invalidAddressReq = http.get(`http://localhost:3001/api/balances?address=invalid-address&chainId=${testChainId}`, (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			const response = JSON.parse(data);
			console.log('✅ Invalid address format:', response.success === false ? 'PASSED' : 'FAILED');
			console.log('   Error:', response.message);
			if (response.details) {
				console.log('   Details:', response.details);
			}
			testValidTransfer();
		});
	});

	invalidAddressReq.on('error', (err) => {
		console.error('❌ Invalid address test failed:', err.message);
	});
}

// Test 4: Valid transfer request (this will fail due to insufficient funds, but validation should pass)
function testValidTransfer() {
	console.log('\n4. Testing valid transfer request format...');
	const transferData = JSON.stringify({
		fromAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
		toAddress: '0xDF3E77baa2d18974820703af3167166243D97E15',
		amount: '100.0',
		chainId: testChainId,
	});

	const validTransferReq = http.request(
		{
			hostname: 'localhost',
			port: 3001,
			path: `/api/transfer/${testChainId}/usdc`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(transferData),
			},
		},
		(res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const response = JSON.parse(data);
				console.log(
					'✅ Valid transfer format:',
					response.success !== false || response.error !== 'VALIDATION_ERROR' ? 'PASSED' : 'FAILED'
				);
				console.log('   Response:', response.message);
				if (response.success && response.data) {
					console.log('   Transaction Hash:', response.data.hash);
					console.log('   Gas Used:', response.data.gasUsed);
					console.log('   Block Number:', response.data.blockNumber);
				}
				testInvalidTransfer();
			});
		}
	);

	validTransferReq.write(transferData);
	validTransferReq.end();

	validTransferReq.on('error', (err) => {
		console.error('❌ Valid transfer test failed:', err.message);
	});
}

// Test 5: Invalid transfer request (missing fields)
function testInvalidTransfer() {
	console.log('\n5. Testing invalid transfer request (missing fields)...');
	const invalidTransferData = JSON.stringify({
		fromAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
		chainId: testChainId,
		// Missing toAddress and amount
	});

	const invalidTransferReq = http.request(
		{
			hostname: 'localhost',
			port: 3001,
			path: `/api/transfer/${testChainId}/usdc`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(invalidTransferData),
			},
		},
		(res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const response = JSON.parse(data);
				console.log(
					'✅ Invalid transfer format:',
					response.success === false && response.error === 'VALIDATION_ERROR' ? 'PASSED' : 'FAILED'
				);
				console.log('   Error:', response.message);
				if (response.details) {
					console.log('   Details:', response.details);
				}
				console.log('\n🎉 Validation tests completed!');
			});
		}
	);

	invalidTransferReq.write(invalidTransferData);
	invalidTransferReq.end();

	invalidTransferReq.on('error', (err) => {
		console.error('❌ Invalid transfer test failed:', err.message);
	});
}
