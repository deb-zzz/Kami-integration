import { ethers } from 'hardhat';
import { KAMI721C, MockERC20 } from '../typechain-types';

/**
 * Example: Deploy KAMI721C Contract
 *
 * This example demonstrates how to deploy the KAMI721C contract
 * with proper configuration including payment token, platform settings,
 * and initial parameters.
 */
async function main() {
	console.log('🚀 Starting KAMI721C deployment...');

	// Get signers
	const [deployer, platform, collaborator] = await ethers.getSigners();
	console.log(`📝 Deployer: ${deployer.address}`);
	console.log(`🏢 Platform: ${platform.address}`);
	console.log(`👥 Collaborator: ${collaborator.address}`);

	// Deploy MockERC20 as payment token (for testing)
	console.log('\n💰 Deploying MockERC20 payment token...');
	const MockERC20Factory = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20Factory.deploy('KAMI Token', 'KAMI', 18);
	await paymentToken.waitForDeployment();
	console.log(`✅ Payment token deployed: ${await paymentToken.getAddress()}`);

	// Mint some tokens to deployer for testing
	const mintAmount = ethers.parseEther('10000');
	await paymentToken.mint(deployer.address, mintAmount);
	console.log(`💸 Minted ${ethers.formatEther(mintAmount)} tokens to deployer`);

	// Deploy KAMI721C contract
	console.log('\n🎨 Deploying KAMI721C contract...');
	const KAMI721CFactory = await ethers.getContractFactory('KAMI721C');
	const kami721c = await KAMI721CFactory.deploy(
		await paymentToken.getAddress(), // payment token
		'KAMI NFT Collection', // name
		'KAMI', // symbol
		'https://api.kami.com/metadata/', // base URI
		ethers.parseEther('0.1'), // mint price (0.1 tokens)
		platform.address, // platform address
		500 // platform commission (5%)
	);
	await kami721c.waitForDeployment();
	console.log(`✅ KAMI721C deployed: ${await kami721c.getAddress()}`);

	// Verify deployment
	console.log('\n🔍 Verifying deployment...');
	const name = await kami721c.name();
	const symbol = await kami721c.symbol();
	const hasOwnerRole = await kami721c.hasRole(await kami721c.OWNER_ROLE(), deployer.address);
	const mintPrice = await kami721c.mintPrice();
	// Library-only values (platformCommission, platformAddress) are not accessible from the contract
	// const platformCommission = await kami721c.platformCommission();
	// const platformAddress = await kami721c.platformAddress();

	console.log(`📋 Contract Details:`);
	console.log(`   Name: ${name}`);
	console.log(`   Symbol: ${symbol}`);
	console.log(`   Deployer has owner role: ${hasOwnerRole}`);
	console.log(`   Mint Price: ${ethers.formatEther(mintPrice)} tokens`);
	// console.log(`   Platform: ${platformAddress}`);
	// console.log(`   Platform Commission: ${platformCommission}%`);

	// Set up royalty configuration
	console.log('\n👑 Setting up royalty configuration...');
	const royaltyPercentage = 500; // 5%
	await kami721c.setRoyaltyPercentage(royaltyPercentage);
	console.log(`✅ Royalty percentage set to ${royaltyPercentage / 100}%`);

	// Set mint royalties (example: 50% to creator, 50% to platform)
	const mintRoyaltyReceivers = [
		{ receiver: deployer.address, feeNumerator: 5000 }, // 50% to creator
		{ receiver: collaborator.address, feeNumerator: 5000 }, // 50% to platform
	];
	await kami721c.setMintRoyalties(mintRoyaltyReceivers);
	console.log(`✅ Mint royalties configured`);

	// Set transfer royalties (example: 100% to current owner)
	const transferRoyaltyReceivers = [
		{ receiver: deployer.address, feeNumerator: 10000 }, // 100% to current owner
	];
	await kami721c.setTransferRoyalties(transferRoyaltyReceivers);
	console.log(`✅ Transfer royalties configured`);

	console.log('\n🎉 Deployment completed successfully!');
	console.log(`📄 Contract Address: ${await kami721c.getAddress()}`);
	console.log(`💰 Payment Token: ${await paymentToken.getAddress()}`);

	return {
		kami721c,
		paymentToken,
		deployer,
		platform,
		collaborator,
	};
}

// Handle errors
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Deployment failed:', error);
		process.exit(1);
	});
