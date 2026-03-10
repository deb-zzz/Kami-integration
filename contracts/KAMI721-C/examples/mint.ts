import { ethers } from 'hardhat';
import { KAMI721C, MockERC20 } from '../typechain-types';

/**
 * Example: Mint NFT
 *
 * This example demonstrates how to mint an NFT using the KAMI721C contract.
 * It includes payment token approval, minting, and royalty setup.
 */
async function main() {
	console.log('🎨 Starting NFT minting process...');

	// Get signers
	const [deployer, minter, platform, collaborator] = await ethers.getSigners();
	console.log(`📝 Deployer: ${deployer.address}`);
	console.log(`🎨 Minter: ${minter.address}`);
	console.log(`🏢 Platform: ${platform.address}`);
	console.log(`👥 Collaborator: ${collaborator.address}`);

	// Deploy contracts (reusing deployment logic)
	console.log('\n🚀 Deploying contracts...');

	// Deploy MockERC20 as payment token
	const MockERC20Factory = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20Factory.deploy('KAMI Token', 'KAMI', 18);
	await paymentToken.waitForDeployment();
	console.log(`✅ Payment token deployed: ${await paymentToken.getAddress()}`);

	// Deploy KAMI721C contract
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

	// Set up royalty configuration
	await kami721c.setRoyaltyPercentage(500); // 5%
	let mintRoyaltyReceivers = [
		{ receiver: deployer.address, feeNumerator: 5000 }, // 50% to creator
		{ receiver: collaborator.address, feeNumerator: 5000 }, // 50% to platform
	];
	await kami721c.setMintRoyalties(mintRoyaltyReceivers);

	// Mint tokens to minter for payment
	console.log('\n💸 Setting up payment tokens...');
	const mintAmount = ethers.parseEther('1000');
	await paymentToken.mint(minter.address, mintAmount);
	console.log(`✅ Minted ${ethers.formatEther(mintAmount)} tokens to minter`);

	// Check minter's balance
	const minterBalance = await paymentToken.balanceOf(minter.address);
	console.log(`💰 Minter balance: ${ethers.formatEther(minterBalance)} tokens`);

	// Get mint price
	const mintPrice = await kami721c.mintPrice();
	console.log(`🎯 Mint price: ${ethers.formatEther(mintPrice)} tokens`);
	// Library-only values (platformCommission, platformAddress) are not accessible from the contract
	// const platformCommission = await kami721c.platformCommission();
	// const platformAddress = await kami721c.platformAddress();

	// Approve payment tokens for minting
	console.log('\n✅ Approving payment tokens...');
	const approveTx = await paymentToken.connect(minter).approve(await kami721c.getAddress(), mintPrice);
	await approveTx.wait();
	console.log(`✅ Approved ${ethers.formatEther(mintPrice)} tokens for minting`);

	// Check allowance
	const allowance = await paymentToken.allowance(minter.address, await kami721c.getAddress());
	console.log(`🔐 Allowance: ${ethers.formatEther(allowance)} tokens`);

	// Mint NFT
	console.log('\n🎨 Minting NFT...');
	const mintTx = await kami721c.connect(minter).mint();
	const mintReceipt = await mintTx.wait();
	console.log(`✅ NFT minted successfully!`);

	// Get minted token ID
	const mintEvent = mintReceipt?.logs.find((log: any) => log.fragment?.name === 'Transfer') as any;
	const tokenId = mintEvent?.args?.[2];
	console.log(`🆔 Token ID: ${tokenId}`);

	// Verify ownership
	const owner = await kami721c.ownerOf(tokenId);
	console.log(`👤 Token owner: ${owner}`);
	console.log(`✅ Ownership verified: ${owner === minter.address}`);

	// Check token URI
	const tokenURI = await kami721c.tokenURI(tokenId);
	console.log(`🔗 Token URI: ${tokenURI}`);

	// Check balances after minting
	const minterBalanceAfter = await paymentToken.balanceOf(minter.address);
	const platformBalance = await paymentToken.balanceOf(platform.address);
	const deployerBalance = await paymentToken.balanceOf(deployer.address);

	console.log('\n💰 Balance Summary:');
	console.log(`   Minter: ${ethers.formatEther(minterBalanceAfter)} tokens`);
	console.log(`   Platform: ${ethers.formatEther(platformBalance)} tokens`);
	console.log(`   Creator: ${ethers.formatEther(deployerBalance)} tokens`);

	// Verify royalty info
	console.log('\n👑 Royalty Information:');
	const royaltyInfo = await kami721c.royaltyInfo(tokenId, mintPrice);
	console.log(`   Royalty Amount: ${ethers.formatEther(royaltyInfo[1])} tokens`);
	console.log(`   Royalty Receiver: ${royaltyInfo[0]}`);

	// Get mint royalty receivers
	const contractMintRoyaltyReceivers = await kami721c.getMintRoyaltyReceivers(tokenId);
	console.log('\n📋 Mint Royalty Receivers:');
	for (let i = 0; i < contractMintRoyaltyReceivers.length; i++) {
		const receiver = contractMintRoyaltyReceivers[i];
		console.log(`   ${i + 1}. ${receiver.receiver} - ${Number(receiver.feeNumerator) / 100}%`);
	}

	console.log('\n🎉 Minting process completed successfully!');
	console.log(`📄 Contract: ${await kami721c.getAddress()}`);
	console.log(`🆔 Token ID: ${tokenId}`);
	console.log(`👤 Owner: ${minter.address}`);

	return {
		kami721c,
		paymentToken,
		tokenId,
		minter,
		platform,
		deployer,
		collaborator,
	};
}

// Handle errors
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Minting failed:', error);
		process.exit(1);
	});
