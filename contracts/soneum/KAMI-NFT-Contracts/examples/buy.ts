import { ethers } from 'hardhat';
import { KAMI721C, MockERC20 } from '../typechain-types';

/**
 * Example: Buy/Sell NFT
 *
 * This example demonstrates how to buy and sell NFTs using the KAMI721C contract.
 * It includes transfer validation, royalty distribution, and platform commission.
 */
async function main() {
	console.log('🛒 Starting NFT buying/selling process...');

	// Get signers
	const [deployer, collaborator, seller, buyer, platform] = await ethers.getSigners();
	console.log(`📝 Deployer: ${deployer.address}`);
	console.log(`👤 Seller: ${seller.address}`);
	console.log(`🛒 Buyer: ${buyer.address}`);
	console.log(`🏢 Platform: ${platform.address}`);
	console.log(`👥 Collaborator: ${collaborator.address}`);

	// Deploy contracts
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
	await kami721c.setRoyaltyPercentage(1000); // 10%

	// Set transfer royalties (100% to current owner)
	const initialTransferRoyaltyReceivers = [
		{ receiver: deployer.address, feeNumerator: 10000 }, // 100% to current owner
	];
	await kami721c.setTransferRoyalties(initialTransferRoyaltyReceivers);

	// Mint tokens to seller and buyer
	console.log('\n💸 Setting up payment tokens...');
	const tokenAmount = ethers.parseEther('1000');
	await paymentToken.mint(seller.address, tokenAmount);
	await paymentToken.mint(buyer.address, tokenAmount);
	console.log(`✅ Minted ${ethers.formatEther(tokenAmount)} tokens to seller and buyer`);

	// Mint NFT to seller
	console.log('\n🎨 Minting NFT to seller...');
	await paymentToken.connect(seller).approve(await kami721c.getAddress(), ethers.parseEther('0.1'));
	const mintTx = await kami721c.connect(seller).mint();
	const mintReceipt = await mintTx.wait();

	// Get minted token ID
	const mintEvent = mintReceipt?.logs.find((log: any) => log.fragment?.name === 'Transfer') as any;
	const tokenId = mintEvent?.args?.[2];
	console.log(`✅ NFT minted to seller with Token ID: ${tokenId}`);

	// Verify seller owns the token
	const owner = await kami721c.ownerOf(tokenId);
	console.log(`👤 Current owner: ${owner}`);
	console.log(`✅ Ownership verified: ${owner === seller.address}`);

	// Set sale price
	const salePrice = ethers.parseEther('0.5'); // 0.5 tokens
	console.log(`💰 Sale price: ${ethers.formatEther(salePrice)} tokens`);

	// Approve payment tokens for buyer
	console.log('\n✅ Buyer approving payment tokens...');
	await paymentToken.connect(buyer).approve(await kami721c.getAddress(), salePrice);
	console.log(`✅ Buyer approved ${ethers.formatEther(salePrice)} tokens`);

	// Check balances before sale
	console.log('\n💰 Balances before sale:');
	const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
	const buyerBalanceBefore = await paymentToken.balanceOf(buyer.address);
	const platformBalanceBefore = await paymentToken.balanceOf(platform.address);
	console.log(`   Seller: ${ethers.formatEther(sellerBalanceBefore)} tokens`);
	console.log(`   Buyer: ${ethers.formatEther(buyerBalanceBefore)} tokens`);
	console.log(`   Platform: ${ethers.formatEther(platformBalanceBefore)} tokens`);

	// Sell NFT
	console.log('\n🛒 Selling NFT...');
	const sellTx = await kami721c.connect(seller).sellToken(buyer.address, tokenId, salePrice);
	const sellReceipt = await sellTx.wait();
	console.log(`✅ NFT sold successfully!`);

	// Verify new ownership
	const newOwner = await kami721c.ownerOf(tokenId);
	console.log(`👤 New owner: ${newOwner}`);
	console.log(`✅ Ownership transferred: ${newOwner === buyer.address}`);

	// Check balances after sale
	console.log('\n💰 Balances after sale:');
	const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);
	const buyerBalanceAfter = await paymentToken.balanceOf(buyer.address);
	const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

	console.log(`   Seller: ${ethers.formatEther(sellerBalanceAfter)} tokens`);
	console.log(`   Buyer: ${ethers.formatEther(buyerBalanceAfter)} tokens`);
	console.log(`   Platform: ${ethers.formatEther(platformBalanceAfter)} tokens`);

	// Calculate royalty and commission
	// Library-only values (platformCommission, platformAddress) are not accessible from the contract
	// const royaltyPercentage = await kami721c.royaltyPercentage();
	// const platformCommission = await kami721c.platformCommission();
	const royaltyPercentage = 1000; // 10% (hardcoded for example)
	const platformCommission = 500; // 5% (hardcoded for example)
	const royaltyAmount = (salePrice * BigInt(royaltyPercentage)) / BigInt(10000);
	const platformCommissionAmount = (salePrice * BigInt(platformCommission)) / BigInt(10000);
	const sellerNetAmount = salePrice - royaltyAmount - platformCommissionAmount;

	console.log('\n📊 Sale Breakdown:');
	console.log(`   Sale Price: ${ethers.formatEther(salePrice)} tokens`);
	console.log(`   Royalty (${royaltyPercentage / 100}%): ${ethers.formatEther(royaltyAmount)} tokens`);
	console.log(`   Platform Commission (${platformCommission / 100}%): ${ethers.formatEther(platformCommissionAmount)} tokens`);
	console.log(`   Seller Net: ${ethers.formatEther(sellerNetAmount)} tokens`);

	// Verify royalty info for the token
	console.log('\n👑 Royalty Information:');
	const royaltyInfo = await kami721c.royaltyInfo(tokenId, salePrice);
	console.log(`   Royalty Amount: ${ethers.formatEther(royaltyInfo[1])} tokens`);
	console.log(`   Royalty Receiver: ${royaltyInfo[0]}`);

	// Get transfer royalty receivers
	const contractTransferRoyaltyReceivers = await kami721c.getTransferRoyaltyReceivers(tokenId);
	console.log('\n📋 Transfer Royalty Receivers:');
	for (let i = 0; i < contractTransferRoyaltyReceivers.length; i++) {
		const receiver = contractTransferRoyaltyReceivers[i];
		const percentage = Number(receiver.feeNumerator) / 100;
		console.log(`   ${i + 1}. ${receiver.receiver} - ${percentage}%`);
	}

	// Test rental functionality
	console.log('\n🏠 Testing rental functionality...');

	// Rent token from buyer to seller
	const rentalDuration = 3600; // 1 hour
	const rentalPrice = ethers.parseEther('0.05'); // 0.05 tokens

	console.log(`⏰ Rental duration: ${rentalDuration} seconds`);
	console.log(`💰 Rental price: ${ethers.formatEther(rentalPrice)} tokens`);

	// Approve rental payment
	await paymentToken.connect(seller).approve(await kami721c.getAddress(), rentalPrice);

	// Rent token
	const rentTx = await kami721c.connect(seller).rentToken(tokenId, rentalDuration, rentalPrice);
	await rentTx.wait();
	console.log(`✅ Token rented successfully!`);

	// Check rental info
	const rental = await kami721c.getRentalInfo(tokenId);
	console.log(`📅 Rental end time: ${rental.endTime}`);
	console.log(`👤 Renter: ${rental.renter}`);
	console.log(`💰 Rental price: ${ethers.formatEther(rental.rentalPrice)} tokens`);

	// End rental
	console.log('\n⏰ Ending rental...');
	const endRentalTx = await kami721c.connect(buyer).endRental(tokenId);
	await endRentalTx.wait();
	console.log(`✅ Rental ended successfully!`);

	console.log('\n🎉 Buy/Sell process completed successfully!');
	console.log(`📄 Contract: ${await kami721c.getAddress()}`);
	console.log(`🆔 Token ID: ${tokenId}`);
	console.log(`👤 Final Owner: ${buyer.address}`);

	return {
		kami721c,
		paymentToken,
		tokenId,
		seller,
		buyer,
		platform,
		collaborator,
		salePrice,
	};
}

// Handle errors
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Buy/Sell failed:', error);
		process.exit(1);
	});
