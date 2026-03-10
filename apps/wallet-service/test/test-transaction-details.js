// Test script to demonstrate transaction details functionality
const http = require('http');

const testChainId = '0x14a34'; // Base Sepolia chain ID

console.log('🧪 Testing Transaction Details API...\n');

// Test 1: Get transaction details for a known transaction hash
console.log('1. Testing transaction details endpoint...');
const testTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

const txDetailsReq = http.get(`http://localhost:3001/api/transactions/${testChainId}/transaction/${testTxHash}`, (res) => {
	let data = '';
	res.on('data', (chunk) => (data += chunk));
	res.on('end', () => {
		const response = JSON.parse(data);
		console.log('✅ Transaction details request:', response.success ? 'PASSED' : 'FAILED');
		console.log('   Response:', response.message);

		if (response.success && response.data) {
			console.log('   📊 Transaction Details:');
			console.log('   - Hash:', response.data.hash);
			console.log('   - From:', response.data.from);
			console.log('   - To:', response.data.to);
			console.log('   - Value:', response.data.value);
			console.log('   - Value Formatted:', response.data.valueFormatted);
			console.log('   - Gas Limit:', response.data.gasLimit);
			console.log('   - Gas Price:', response.data.gasPrice);
			console.log('   - Gas Used:', response.data.gasUsed);
			console.log('   - Block Number:', response.data.blockNumber);
			console.log('   - Status:', response.data.status);
			console.log('   - Nonce:', response.data.nonce);
		}

		testInvalidTxHash();
	});
});

txDetailsReq.on('error', (err) => {
	console.error('❌ Transaction details test failed:', err.message);
	console.log("   Note: This is expected if the transaction hash doesn't exist on the network");
	testInvalidTxHash();
});

// Test 2: Test with invalid transaction hash format
function testInvalidTxHash() {
	console.log('\n2. Testing invalid transaction hash format...');
	const invalidTxHash = 'invalid-hash';

	const invalidTxReq = http.get(`http://localhost:3001/api/transactions/${testChainId}/transaction/${invalidTxHash}`, (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			const response = JSON.parse(data);
			console.log('✅ Invalid transaction hash format:', response.success === false ? 'PASSED' : 'FAILED');
			console.log('   Error:', response.message);
			testTransferResponse();
		});
	});

	invalidTxReq.on('error', (err) => {
		console.error('❌ Invalid transaction hash test failed:', err.message);
		testTransferResponse();
	});
}

// Test 3: Test transfer response format (this will likely fail due to insufficient funds, but shows the expected format)
function testTransferResponse() {
	console.log('\n3. Testing transfer response format...');
	const transferData = JSON.stringify({
		fromAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
		toAddress: '0xDF3E77baa2d18974820703af3167166243D97E15',
		amount: '100.0',
		chainId: testChainId,
	});

	const transferReq = http.request(
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
				console.log('✅ Transfer response format test:', response.success ? 'PASSED' : 'FAILED');
				console.log('   Response:', response.message);

				if (response.success && response.data) {
					console.log('   📊 Transfer Response Details:');
					console.log('   - Transaction Hash:', response.data.hash);
					console.log('   - From Address:', response.data.from);
					console.log('   - To Address:', response.data.to);
					console.log('   - Gas Limit:', response.data.gasLimit);
					console.log('   - Gas Price:', response.data.gasPrice);
					console.log('   - Block Number:', response.data.blockNumber);
					console.log('   - Transaction Status:', response.data.status);
				} else if (response.error) {
					console.log('   Error (expected):', response.error);
				}

				console.log('\n🎉 Transaction details tests completed!');
				console.log(
					'\n📝 Note: The transfer test may fail due to insufficient funds, but this demonstrates the expected response format.'
				);
			});
		}
	);

	transferReq.write(transferData);
	transferReq.end();

	transferReq.on('error', (err) => {
		console.error('❌ Transfer response test failed:', err.message);
		console.log('\n🎉 Transaction details tests completed!');
	});
}
