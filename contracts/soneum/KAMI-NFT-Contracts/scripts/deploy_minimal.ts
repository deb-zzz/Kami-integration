import { ethers } from 'hardhat';

async function main() {
	console.log('🚀 Starting KAMI721CMinimal deployment...');

	// Get the deployer account
	const [deployer] = await ethers.getSigners();
	console.log('📝 Deployer:', deployer.address);

	// Deploy MockERC20 payment token
	console.log('💰 Deploying MockERC20 payment token...');
	const MockERC20 = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20.deploy('Mock USDC', 'USDC', 6);
	await paymentToken.waitForDeployment();
	const paymentTokenAddress = await paymentToken.getAddress();
	console.log('✅ Payment token deployed:', paymentTokenAddress);

	// Deploy KAMI721CMinimal
	console.log('🎨 Deploying KAMI721CMinimal contract...');
	const KAMI721CMinimal = await ethers.getContractFactory('KAMI721CMinimal');
	const kami721cMinimal = await KAMI721CMinimal.deploy(
		paymentTokenAddress,
		'KAMI NFT Collection Minimal',
		'KAMI-MIN',
		'https://api.kami.com/token/',
		ethers.parseUnits('100', 6), // 100 USDC mint price
		deployer.address, // Platform address
		500 // 5% platform commission
	);
	await kami721cMinimal.waitForDeployment();
	const contractAddress = await kami721cMinimal.getAddress();
	console.log('✅ KAMI721CMinimal deployed:', contractAddress);

	// Display contract details
	console.log('\n📋 Contract Details:');
	console.log('   Name:', await kami721cMinimal.name());
	console.log('   Symbol:', await kami721cMinimal.symbol());
	console.log('   Mint Price:', ethers.formatUnits(await kami721cMinimal.mintPrice(), 6), 'tokens');
	console.log('   Platform Address:', await kami721cMinimal.platformAddress());
	console.log('   Platform Commission:', await kami721cMinimal.platformCommission(), 'basis points');

	// Set up royalty configuration
	console.log('\n👑 Setting up royalty configuration...');

	// Set royalty percentage to 5%
	await kami721cMinimal.setRoyaltyPercentage(500);
	console.log('✅ Royalty percentage set to 5%');

	// Set mint royalties (50% creator, 50% collaborator)
	const mintRoyalties = [
		{ receiver: deployer.address, feeNumerator: 5000 }, // 50%
		{ receiver: deployer.address, feeNumerator: 5000 }, // 50% (using same address for demo)
	];
	await kami721cMinimal.setMintRoyalties(mintRoyalties);
	console.log('✅ Mint royalties configured');

	// Set transfer royalties (100% to deployer)
	const transferRoyalties = [
		{ receiver: deployer.address, feeNumerator: 10000 }, // 100%
	];
	await kami721cMinimal.setTransferRoyalties(transferRoyalties);
	console.log('✅ Transfer royalties configured');

	console.log('\n🎉 Deployment completed successfully!');
	console.log('Contract Address:', contractAddress);
	console.log('Payment Token:', paymentTokenAddress);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Deployment failed:', error);
		process.exit(1);
	});
