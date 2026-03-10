// Test script for comprehensive gas estimation functionality
const http = require('http');

const testChainId = '0x14a34'; // Base Sepolia chain ID

console.log('🧪 Testing Gas Estimation API...\n');

// Test 1: Valid gas estimation request
console.log('1. Testing valid gas estimation request...');
const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const testToAddress = '0xDF3E77baa2d18974820703af3167166243D97E15'; // Valid test address

const validGasData = JSON.stringify({
	fromAddress: testAddress,
	toAddress: testToAddress,
	amount: '100.0',
});

const validGasReq = http.request(
	{
		hostname: 'localhost',
		port: 3001,
		path: `/api/transfer/${testChainId}/estimate-gas`,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(validGasData),
		},
	},
	(res) => {
		let data = '';
		res.on('data', (chunk) => (data += chunk));
		res.on('end', () => {
			const response = JSON.parse(data);
			console.log('✅ Valid gas estimation:', response.success ? 'PASSED' : 'FAILED');
			console.log('   Response:', response.message);
			if (response.success && response.data) {
				console.log('   📊 Gas Estimation Details:');
				console.log('   - Estimated Gas:', response.data.estimatedGas);
				console.log('   - Gas in Wei:', response.data.estimatedGas);
			} else if (response.error) {
				console.log('   Error (expected):', response.error);
			}
			testInvalidFromAddress();
		});
	}
);

validGasReq.write(validGasData);
validGasReq.end();

validGasReq.on('error', (err) => {
	console.error('❌ Valid gas estimation test failed:', err.message);
	testInvalidFromAddress();
});

// Test 2: Invalid from address
function testInvalidFromAddress() {
	console.log('\n2. Testing invalid from address...');
	const invalidFromData = JSON.stringify({
		fromAddress: 'invalid-address',
		toAddress: testToAddress,
		amount: '100.0',
	});

	const invalidFromReq = http.request(
		{
			hostname: 'localhost',
			port: 3001,
			path: `/api/transfer/${testChainId}/estimate-gas`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(invalidFromData),
			},
		},
		(res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const response = JSON.parse(data);
				console.log('✅ Invalid from address:', response.success === false ? 'PASSED' : 'FAILED');
				console.log('   Error:', response.message);
				if (response.details) {
					console.log('   Details:', response.details);
				}
				testInvalidToAddress();
			});
		}
	);

	invalidFromReq.write(invalidFromData);
	invalidFromReq.end();

	invalidFromReq.on('error', (err) => {
		console.error('❌ Invalid from address test failed:', err.message);
		testInvalidToAddress();
	});
}

// Test 3: Invalid to address
function testInvalidToAddress() {
	console.log('\n3. Testing invalid to address...');
	const invalidToData = JSON.stringify({
		fromAddress: testAddress,
		toAddress: 'invalid-address',
		amount: '100.0',
	});

	const invalidToReq = http.request(
		{
			hostname: 'localhost',
			port: 3001,
			path: `/api/transfer/${testChainId}/estimate-gas`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(invalidToData),
			},
		},
		(res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const response = JSON.parse(data);
				console.log('✅ Invalid to address:', response.success === false ? 'PASSED' : 'FAILED');
				console.log('   Error:', response.message);
				if (response.details) {
					console.log('   Details:', response.details);
				}
				testInvalidAmount();
			});
		}
	);

	invalidToReq.write(invalidToData);
	invalidToReq.end();

	invalidToReq.on('error', (err) => {
		console.error('❌ Invalid to address test failed:', err.message);
		testInvalidAmount();
	});
}

// Test 4: Invalid amount
function testInvalidAmount() {
	console.log('\n4. Testing invalid amount...');
	const invalidAmountData = JSON.stringify({
		fromAddress: testAddress,
		toAddress: testToAddress,
		amount: '-100.0', // Negative amount
	});

	const invalidAmountReq = http.request(
		{
			hostname: 'localhost',
			port: 3001,
			path: `/api/transfer/${testChainId}/estimate-gas`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(invalidAmountData),
			},
		},
		(res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const response = JSON.parse(data);
				console.log('✅ Invalid amount:', response.success === false ? 'PASSED' : 'FAILED');
				console.log('   Error:', response.message);
				if (response.details) {
					console.log('   Details:', response.details);
				}
				testMissingFields();
			});
		}
	);

	invalidAmountReq.write(invalidAmountData);
	invalidAmountReq.end();

	invalidAmountReq.on('error', (err) => {
		console.error('❌ Invalid amount test failed:', err.message);
		testMissingFields();
	});
}

// Test 5: Missing required fields
function testMissingFields() {
	console.log('\n5. Testing missing required fields...');
	const missingFieldsData = JSON.stringify({
		fromAddress: testAddress,
		// Missing toAddress and amount
	});

	const missingFieldsReq = http.request(
		{
			hostname: 'localhost',
			port: 3001,
			path: `/api/transfer/${testChainId}/estimate-gas`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(missingFieldsData),
			},
		},
		(res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const response = JSON.parse(data);
				console.log('✅ Missing fields:', response.success === false ? 'PASSED' : 'FAILED');
				console.log('   Error:', response.message);
				if (response.details) {
					console.log('   Details:', response.details);
				}
				testDifferentAmounts();
			});
		}
	);

	missingFieldsReq.write(missingFieldsData);
	missingFieldsReq.end();

	missingFieldsReq.on('error', (err) => {
		console.error('❌ Missing fields test failed:', err.message);
		testDifferentAmounts();
	});
}

// Test 6: Different amounts to test gas estimation accuracy
function testDifferentAmounts() {
	console.log('\n6. Testing different amounts...');

	const amounts = ['1.0', '10.0', '100.0', '1000.0'];
	let completedTests = 0;

	amounts.forEach((amount, index) => {
		const amountData = JSON.stringify({
			fromAddress: testAddress,
			toAddress: testToAddress,
			amount: amount,
		});

		const amountReq = http.request(
			{
				hostname: 'localhost',
				port: 3001,
				path: `/api/transfer/${testChainId}/estimate-gas`,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(amountData),
				},
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					const response = JSON.parse(data);
					console.log(`   ${index + 1}. Amount ${amount}:`, response.success ? 'PASSED' : 'FAILED');
					if (response.success && response.data) {
						console.log(`      Gas: ${response.data.estimatedGas}`);
					} else {
						console.log(`      Error: ${response.message}`);
					}

					completedTests++;
					if (completedTests === amounts.length) {
						console.log('\n🎉 Gas estimation tests completed!');
						console.log(
							'\n📝 Note: Gas estimation may fail due to network issues or invalid addresses, but this demonstrates the expected response format.'
						);
					}
				});
			}
		);

		amountReq.write(amountData);
		amountReq.end();

		amountReq.on('error', (err) => {
			console.error(`❌ Amount ${amount} test failed:`, err.message);
			completedTests++;
			if (completedTests === amounts.length) {
				console.log('\n🎉 Gas estimation tests completed!');
				console.log(
					'\n📝 Note: Gas estimation may fail due to network issues or invalid addresses, but this demonstrates the expected response format.'
				);
			}
		});
	});
}
