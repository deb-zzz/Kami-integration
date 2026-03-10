// Simple test script to verify API endpoints
const http = require('http');

const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address for testing
const testChainId = '0x14a34'; // Base Sepolia chain ID

console.log('🧪 Testing KAMI Wallet Service API...\n');

// Test health endpoint
console.log('1. Testing health endpoint...');
const healthReq = http.get('http://localhost:3001/health', (res) => {
	let data = '';
	res.on('data', (chunk) => (data += chunk));
	res.on('end', () => {
		console.log('✅ Health check:', JSON.parse(data));
		testBalances();
	});
});

healthReq.on('error', (err) => {
	console.error('❌ Health check failed:', err.message);
	console.log('Make sure the server is running with: pnpm run dev');
});

function testBalances() {
	console.log('\n2. Testing balances endpoint...');
	const balancesReq = http.get(`http://localhost:3001/api/balances/${testChainId}?address=${testAddress}`, (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			console.log('✅ Balances:', JSON.parse(data));
			testUSDCInfo();
		});
	});

	balancesReq.on('error', (err) => {
		console.error('❌ Balances test failed:', err.message);
	});
}

function testUSDCInfo() {
	console.log('\n3. Testing USDC info endpoint...');
	const usdcReq = http.get(`http://localhost:3001/api/balances/${testChainId}/usdc-info`, (res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			console.log('✅ USDC Info:', JSON.parse(data));
			testGasEstimation();
		});
	});

	usdcReq.on('error', (err) => {
		console.error('❌ USDC info test failed:', err.message);
	});
}

function testGasEstimation() {
	console.log('\n4. Testing gas estimation endpoint...');
	const gasData = JSON.stringify({
		fromAddress: testAddress,
		toAddress: '0xDF3E77baa2d18974820703af3167166243D97E15',
		amount: '100.0',
	});

	const gasReq = http.request(
		{
			hostname: 'localhost',
			port: 3001,
			path: `/api/transfer/${testChainId}/estimate-gas`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(gasData),
			},
		},
		(res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const response = JSON.parse(data);
				console.log('✅ Gas Estimation:', response.success ? 'PASSED' : 'FAILED');
				console.log('   Response:', response.message);
				if (response.success && response.data) {
					console.log('   Estimated Gas:', response.data.estimatedGas);
				} else if (response.error) {
					console.log('   Error (expected):', response.error);
				}
				console.log('\n🎉 All tests completed!');
				console.log('\n📝 Note: Transfer endpoint is available at /api/transfer/usdc');
			});
		}
	);

	gasReq.write(gasData);
	gasReq.end();

	gasReq.on('error', (err) => {
		console.error('❌ Gas estimation test failed:', err.message);
		console.log('\n🎉 All tests completed!');
		console.log('\n📝 Note: Transfer endpoint is available at /api/transfer/usdc');
	});
}
