const { ethers } = require('hardhat');

async function main() {
	console.log('Starting deployment...');

	// Get the deployer account
	const [deployer] = await ethers.getSigners();
	console.log('Deploying contracts with the account:', deployer.address);
	console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

	// Deploy PaymentToken first
	console.log('\n1. Deploying PaymentToken...');
	const PaymentToken = await ethers.getContractFactory('PaymentToken');
	const paymentToken = await PaymentToken.deploy(
		'KAMI Token', // name
		'KAMI', // symbol
		18, // decimals
		ethers.parseEther('1000000') // initial supply (1M tokens)
	);
	await paymentToken.waitForDeployment();
	const paymentTokenAddress = await paymentToken.getAddress();
	console.log('PaymentToken deployed to:', paymentTokenAddress);

	// Deploy BasicNFT
	console.log('\n2. Deploying BasicNFT...');
	const BasicNFT = await ethers.getContractFactory('BasicNFT');
	const basicNFT = await BasicNFT.deploy(
		'KAMI NFT Collection', // name
		'KAMINFT', // symbol
		paymentTokenAddress, // payment token address
		18, // payment token decimals
		ethers.parseEther('10') // mint price (10 KAMI tokens)
	);
	await basicNFT.waitForDeployment();
	const basicNFTAddress = await basicNFT.getAddress();
	console.log('BasicNFT deployed to:', basicNFTAddress);

	// Display deployment summary
	console.log('\n=== Deployment Summary ===');
	console.log('PaymentToken Address:', paymentTokenAddress);
	console.log('BasicNFT Address:', basicNFTAddress);
	console.log('Mint Price: 10 KAMI tokens');
	console.log('Payment Token Decimals: 18');

	// Save deployment addresses to a file for easy reference
	const deploymentInfo = {
		network: 'hardhat',
		paymentToken: {
			address: paymentTokenAddress,
			name: 'KAMI Token',
			symbol: 'KAMI',
			decimals: 18,
			initialSupply: '1000000000000000000000000', // 1M tokens in wei
		},
		basicNFT: {
			address: basicNFTAddress,
			name: 'KAMI NFT Collection',
			symbol: 'KAMINFT',
			mintPrice: '10000000000000000000', // 10 tokens in wei
		},
		deployer: deployer.address,
	};

	const fs = require('fs');
	fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
	console.log('\nDeployment info saved to deployment.json');

	console.log('\n=== Next Steps ===');
	console.log('1. Users need to approve the NFT contract to spend their KAMI tokens');
	console.log('2. Users can then call mint() or mintWithAutoId() to create NFTs');
	console.log('3. Each mint costs 10 KAMI tokens');
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
