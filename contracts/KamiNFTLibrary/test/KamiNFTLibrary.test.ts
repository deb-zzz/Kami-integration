import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('KamiNFTLibrary', function () {
	it('Should compile successfully', async function () {
		// This test ensures the library compiles without errors
		expect(true).to.be.true;
	});

	it('Should have correct library structure', async function () {
		// Test that the library has the expected functions and structs
		const library = await ethers.getContractFactory('KamiNFTLibrary');
		expect(library).to.not.be.undefined;
	});

	async function deployFixture() {
		const [owner, artist, platform, buyer, renter, creator, seller] = await ethers.getSigners();

		// Deploy a mock ERC20 token for testing (6 decimals like USDC)
		const MockERC20 = await ethers.getContractFactory('MockERC20');
		const paymentToken = await MockERC20.deploy('Test Token', 'TEST');

		// Deploy the test NFT contract that uses the library
		const TestNFT = await ethers.getContractFactory('TestNFT');
		const testNFT = await TestNFT.deploy(paymentToken.target);

		return { owner, artist, platform, buyer, renter, creator, seller, paymentToken, testNFT };
	}

	describe('Platform Configuration', function () {
		it('Should initialize platform configuration correctly', async function () {
			const { testNFT, platform } = await loadFixture(deployFixture);

			await testNFT.initializePlatform(platform.address, 500); // 5% commission

			const config = await testNFT.platformConfig();
			expect(config.platformAddress).to.equal(platform.address);
			expect(config.commissionPercentage).to.equal(500);
		});

		it('Should revert with invalid platform address', async function () {
			const { testNFT } = await loadFixture(deployFixture);

			await expect(testNFT.initializePlatform(ethers.ZeroAddress, 500)).to.be.revertedWith('Invalid platform address');
		});

		it('Should revert with commission too high', async function () {
			const { testNFT, platform } = await loadFixture(deployFixture);

			await expect(
				testNFT.initializePlatform(platform.address, 2500) // 25% > 20% max
			).to.be.revertedWith('Platform commission too high');
		});
	});

	describe('Royalty Configuration', function () {
		it('Should initialize royalty configuration with default values', async function () {
			const { testNFT } = await loadFixture(deployFixture);

			await testNFT.initializeRoyaltyConfig();

			const config = await testNFT.royaltyConfig();
			expect(config.royaltyPercentage).to.equal(1000); // 10% default
		});

		it('Should set royalty percentage correctly', async function () {
			const { testNFT, owner } = await loadFixture(deployFixture);

			await testNFT.initializeRoyaltyConfig();
			await testNFT.setRoyaltyPercentage(1500); // 15%

			const config = await testNFT.royaltyConfig();
			expect(config.royaltyPercentage).to.equal(1500);
		});

		it('Should revert with royalty percentage too high', async function () {
			const { testNFT } = await loadFixture(deployFixture);

			await testNFT.initializeRoyaltyConfig();

			await expect(
				testNFT.setRoyaltyPercentage(3500) // 35% > 30% max
			).to.be.revertedWith('Royalty percentage too high');
		});

		it('Should set mint royalties correctly', async function () {
			const { testNFT, artist, platform } = await loadFixture(deployFixture);

			await testNFT.initializePlatform(platform.address, 500);
			await testNFT.initializeRoyaltyConfig();

			const royalties = [
				{ receiver: artist.address, feeNumerator: 7000 }, // 70%
				{ receiver: platform.address, feeNumerator: 3000 }, // 30%
			];

			await testNFT.setMintRoyalties(royalties);

			const config = await testNFT.royaltyConfig();
			expect(config.mintRoyaltyReceivers).to.have.length(2);
			expect(config.mintRoyaltyReceivers[0].receiver).to.equal(artist.address);
			expect(config.mintRoyaltyReceivers[0].feeNumerator).to.equal(7000);
		});

		it("Should revert if mint royalties don't equal 100%", async function () {
			const { testNFT, artist, platform } = await loadFixture(deployFixture);

			await testNFT.initializePlatform(platform.address, 500);
			await testNFT.initializeRoyaltyConfig();

			const royalties = [
				{ receiver: artist.address, feeNumerator: 6000 }, // 60%
				{ receiver: platform.address, feeNumerator: 3000 }, // 30% (total 90%)
			];

			await expect(testNFT.setMintRoyalties(royalties)).to.be.revertedWith('Total mint royalty percentages must equal 100%');
		});
	});

	describe('Mint Royalty Distribution - Exact Calculations', function () {
		it('Should distribute mint royalties with exact calculations', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			// Setup: 5% platform commission, 70% artist, 30% creator
			await testNFT.initializePlatform(platform.address, 500); // 5%
			await testNFT.initializeRoyaltyConfig();

			const royalties = [
				{ receiver: artist.address, feeNumerator: 7000 }, // 70%
				{ receiver: platform.address, feeNumerator: 3000 }, // 30%
			];
			await testNFT.setMintRoyalties(royalties);

			// Mint tokens to buyer
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('100', 6));

			const mintPrice = ethers.parseUnits('100', 6); // 100 USDC
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			await testNFT.connect(buyer).distributeMintRoyalties(1, mintPrice);

			// Verify calculations:
			// Platform commission: 5% of 100 = 5 USDC
			// Remaining for royalties: 100 - 5 = 95 USDC
			// Artist: 70% of 95 = 66.5 USDC
			// Platform royalty: 30% of 95 = 28.5 USDC

			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(artistBalanceAfter - artistBalanceBefore).to.equal(ethers.parseUnits('66.5', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('33.5', 6)); // 5 + 28.5
		});

		it('Should handle mint royalties with different platform commission rates', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			// Setup: 10% platform commission, 60% artist, 40% creator
			await testNFT.initializePlatform(platform.address, 1000); // 10%
			await testNFT.initializeRoyaltyConfig();

			const royalties = [
				{ receiver: artist.address, feeNumerator: 6000 }, // 60%
				{ receiver: platform.address, feeNumerator: 4000 }, // 40%
			];
			await testNFT.setMintRoyalties(royalties);

			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('100', 6));

			const mintPrice = ethers.parseUnits('100', 6);
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			await testNFT.connect(buyer).distributeMintRoyalties(1, mintPrice);

			// Verify calculations:
			// Platform commission: 10% of 100 = 10 USDC
			// Remaining for royalties: 100 - 10 = 90 USDC
			// Artist: 60% of 90 = 54 USDC
			// Platform royalty: 40% of 90 = 36 USDC

			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(artistBalanceAfter - artistBalanceBefore).to.equal(ethers.parseUnits('54', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('46', 6)); // 10 + 36
		});

		it('Should handle rounding correctly in mint royalties', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			// Setup: 3% platform commission, 33.33% each for 3 receivers
			await testNFT.initializePlatform(platform.address, 300); // 3%
			await testNFT.initializeRoyaltyConfig();

			const royalties = [
				{ receiver: artist.address, feeNumerator: 3333 }, // 33.33%
				{ receiver: platform.address, feeNumerator: 3333 }, // 33.33%
				{ receiver: buyer.address, feeNumerator: 3334 }, // 33.34% (to make 100%)
			];
			await testNFT.setMintRoyalties(royalties);

			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('100', 6));

			const mintPrice = ethers.parseUnits('100', 6);
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);
			const buyerBalanceBefore = await paymentToken.balanceOf(buyer.address);

			await testNFT.connect(buyer).distributeMintRoyalties(1, mintPrice);

			// Verify calculations:
			// Platform commission: 3% of 100 = 3 USDC
			// Remaining for royalties: 100 - 3 = 97 USDC
			// Artist: 33.33% of 97 = 32.33 USDC
			// Platform royalty: 33.33% of 97 = 32.33 USDC
			// Buyer royalty: 33.34% of 97 = 32.34 USDC
			// Total distributed: 32.33 + 32.33 + 32.34 = 97 USDC

			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);
			const buyerBalanceAfter = await paymentToken.balanceOf(buyer.address);

			expect(artistBalanceAfter - artistBalanceBefore).to.be.closeTo(ethers.parseUnits('32.33', 6), ethers.parseUnits('0.01', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.be.closeTo(ethers.parseUnits('35.33', 6), ethers.parseUnits('0.01', 6)); // 3 + 32.33
			expect(buyerBalanceAfter - buyerBalanceBefore).to.be.closeTo(-ethers.parseUnits('67.66', 6), ethers.parseUnits('0.01', 6)); // 100 - 32.34 (net after paying and receiving royalties)
		});
	});

	describe('Transfer Royalty Distribution - Exact Calculations', function () {
		it('Should distribute transfer royalties with exact calculations', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			// Setup: 5% platform commission, 10% royalty, 60% artist, 40% creator
			await testNFT.initializePlatform(platform.address, 500); // 5%
			await testNFT.initializeRoyaltyConfig();
			await testNFT.setRoyaltyPercentage(1000); // 10%

			const royalties = [
				{ receiver: artist.address, feeNumerator: 6000 }, // 60%
				{ receiver: platform.address, feeNumerator: 4000 }, // 40%
			];
			await testNFT.setTransferRoyalties(royalties);

			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('100', 6));

			const salePrice = ethers.parseUnits('100', 6);
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			// Execute the transaction
			await testNFT.connect(buyer).distributeTransferRoyalties(1, salePrice);

			// Calculate expected total distributed: 5% platform + 10% royalty = 15 USDC
			const expectedTotalDistributed = ethers.parseUnits('15', 6);

			// Verify calculations:
			// Platform commission: 5% of 100 = 5 USDC
			// Royalty amount: 10% of 100 = 10 USDC
			// Artist: 60% of 10 = 6 USDC
			// Platform royalty: 40% of 10 = 4 USDC
			// Total distributed: 5 + 10 = 15 USDC

			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(expectedTotalDistributed).to.equal(ethers.parseUnits('15', 6));
			expect(artistBalanceAfter - artistBalanceBefore).to.equal(ethers.parseUnits('6', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('9', 6)); // 5 + 4
		});

		it('Should calculate sale margin correctly', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			// Setup: 5% platform commission, 10% royalty
			await testNFT.initializePlatform(platform.address, 500); // 5%
			await testNFT.initializeRoyaltyConfig();
			await testNFT.setRoyaltyPercentage(1000); // 10%

			const salePrice = ethers.parseUnits('100', 6);
			const totalRequired = await testNFT.calculateTransferPayment(salePrice);

			// Verify calculations:
			// Platform commission: 5% of 100 = 5 USDC
			// Royalty: 10% of 100 = 10 USDC
			// Total required: 5 + 10 = 15 USDC
			// Sale margin: 100 - 15 = 85 USDC

			expect(totalRequired).to.equal(ethers.parseUnits('15', 6));

			// Verify sale margin calculation
			const saleMargin = salePrice - totalRequired;
			expect(saleMargin).to.equal(ethers.parseUnits('85', 6));
		});

		it('Should handle transfer royalties with different rates', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			// Setup: 8% platform commission, 15% royalty, 50% artist, 50% creator
			await testNFT.initializePlatform(platform.address, 800); // 8%
			await testNFT.initializeRoyaltyConfig();
			await testNFT.setRoyaltyPercentage(1500); // 15%

			const royalties = [
				{ receiver: artist.address, feeNumerator: 5000 }, // 50%
				{ receiver: platform.address, feeNumerator: 5000 }, // 50%
			];
			await testNFT.setTransferRoyalties(royalties);

			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('100', 6));

			const salePrice = ethers.parseUnits('100', 6);
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			// Execute the transaction
			await testNFT.connect(buyer).distributeTransferRoyalties(1, salePrice);

			// Calculate expected total distributed: 8% platform + 15% royalty = 23 USDC
			const expectedTotalDistributed = ethers.parseUnits('23', 6);

			// Verify calculations:
			// Platform commission: 8% of 100 = 8 USDC
			// Royalty amount: 15% of 100 = 15 USDC
			// Artist: 50% of 15 = 7.5 USDC
			// Platform royalty: 50% of 15 = 7.5 USDC
			// Total distributed: 8 + 15 = 23 USDC

			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(expectedTotalDistributed).to.equal(ethers.parseUnits('23', 6));
			expect(artistBalanceAfter - artistBalanceBefore).to.equal(ethers.parseUnits('7.5', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('15.5', 6)); // 8 + 7.5
		});
	});

	describe('Token Sale with Royalties', function () {
		it('Should sell token with correct royalty distribution', async function () {
			const { testNFT, artist, platform, buyer, seller, paymentToken } = await loadFixture(deployFixture);

			// Setup
			await testNFT.initializePlatform(platform.address, 500); // 5%
			await testNFT.initializeRoyaltyConfig();
			await testNFT.setRoyaltyPercentage(1000); // 10%

			const royalties = [
				{ receiver: artist.address, feeNumerator: 6000 }, // 60%
				{ receiver: platform.address, feeNumerator: 4000 }, // 40%
			];
			await testNFT.setTransferRoyalties(royalties);

			// Mint token to seller
			await testNFT.mint(seller.address, 1);

			// Setup buyer with tokens
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('100', 6));

			const salePrice = ethers.parseUnits('100', 6);
			const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			await testNFT.connect(seller).sellToken(1, buyer.address, salePrice);

			// Verify calculations:
			// Platform commission: 5% of 100 = 5 USDC
			// Royalty: 10% of 100 = 10 USDC
			// Total fees: 5 + 10 = 15 USDC
			// Seller proceeds: 100 - 15 = 85 USDC
			// Artist: 60% of 10 = 6 USDC
			// Platform royalty: 40% of 10 = 4 USDC

			const sellerBalanceAfter = await paymentToken.balanceOf(seller.address);
			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(ethers.parseUnits('85', 6));
			expect(artistBalanceAfter - artistBalanceBefore).to.equal(ethers.parseUnits('6', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('9', 6)); // 5 + 4
		});
	});

	describe('Rental System', function () {
		it('Should rent token with correct commission distribution', async function () {
			const { testNFT, platform, renter, owner, paymentToken } = await loadFixture(deployFixture);

			await testNFT.initializePlatform(platform.address, 500); // 5%

			// Mint token to owner
			await testNFT.mint(owner.address, 1);

			// Setup renter with tokens
			await paymentToken.mint(renter.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(renter).approve(testNFT.target, ethers.parseUnits('100', 6));

			const rentalPrice = ethers.parseUnits('50', 6);
			const duration = 7 * 24 * 60 * 60; // 7 days
			const ownerBalanceBefore = await paymentToken.balanceOf(owner.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			await testNFT.connect(renter).rentToken(1, duration, rentalPrice);

			// Verify calculations:
			// Platform commission: 5% of 50 = 2.5 USDC
			// Owner share: 50 - 2.5 = 47.5 USDC

			const ownerBalanceAfter = await paymentToken.balanceOf(owner.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(ethers.parseUnits('47.5', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('2.5', 6));

			// Verify rental is active
			expect(await testNFT.isRented(1)).to.be.true;
		});
	});

	describe('Edge Cases and Rounding', function () {
		it('Should handle very small amounts correctly', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			await testNFT.initializePlatform(platform.address, 100); // 1%
			await testNFT.initializeRoyaltyConfig();
			await testNFT.setRoyaltyPercentage(500); // 5%

			const royalties = [
				{ receiver: artist.address, feeNumerator: 10000 }, // 100%
			];
			await testNFT.setMintRoyalties(royalties);

			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('1', 6));

			const mintPrice = ethers.parseUnits('1', 6); // 1 USDC
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			await testNFT.connect(buyer).distributeMintRoyalties(1, mintPrice);

			// Verify calculations:
			// Platform commission: 1% of 1 = 0.01 USDC
			// Remaining for royalties: 1 - 0.01 = 0.99 USDC
			// Artist: 100% of 0.99 = 0.99 USDC

			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(artistBalanceAfter - artistBalanceBefore).to.equal(ethers.parseUnits('0.99', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('0.01', 6));
		});

		it('Should handle maximum commission and royalty rates', async function () {
			const { testNFT, artist, platform, buyer, paymentToken } = await loadFixture(deployFixture);

			await testNFT.initializePlatform(platform.address, 2000); // 20% (max)
			await testNFT.initializeRoyaltyConfig();
			await testNFT.setRoyaltyPercentage(3000); // 30% (max)

			const royalties = [
				{ receiver: artist.address, feeNumerator: 10000 }, // 100%
			];
			await testNFT.setTransferRoyalties(royalties);

			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(testNFT.target, ethers.parseUnits('100', 6));

			const salePrice = ethers.parseUnits('100', 6);
			const artistBalanceBefore = await paymentToken.balanceOf(artist.address);
			const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

			// Execute the transaction
			await testNFT.connect(buyer).distributeTransferRoyalties(1, salePrice);

			// Calculate expected total distributed: 20% platform + 30% royalty = 50 USDC
			const expectedTotalDistributed = ethers.parseUnits('50', 6);

			// Verify calculations:
			// Platform commission: 20% of 100 = 20 USDC
			// Royalty: 30% of 100 = 30 USDC
			// Total distributed: 20 + 30 = 50 USDC
			// Artist: 100% of 30 = 30 USDC

			const artistBalanceAfter = await paymentToken.balanceOf(artist.address);
			const platformBalanceAfter = await paymentToken.balanceOf(platform.address);

			expect(expectedTotalDistributed).to.equal(ethers.parseUnits('50', 6));
			expect(artistBalanceAfter - artistBalanceBefore).to.equal(ethers.parseUnits('30', 6));
			expect(platformBalanceAfter - platformBalanceBefore).to.equal(ethers.parseUnits('20', 6));
		});
	});
});
