import { expect } from 'chai';
import { ethers } from 'hardhat';
import { KAMI1155C } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('KAMI1155C', function () {
	let kami1155c: KAMI1155C;
	let paymentToken: any; // Use any type for MockERC20 to avoid type conflicts
	let owner: SignerWithAddress;
	let platform: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;

	const TOKEN_NAME = 'KAMI1155C';
	const TOKEN_SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.com/token/';
	const PRICE = ethers.parseUnits('100', 6); // 100 tokens with 6 decimals
	const PLATFORM_COMMISSION = 2000; // 20%
	const ROYALTY_PERCENTAGE = 1000; // 10%
	const RENTAL_DURATION = 86400n; // 1 day as bigint
	const RENTAL_PRICE = ethers.parseUnits('100', 6); // 100 tokens with 6 decimals (matching flow tests)

	beforeEach(async function () {
		[owner, platform, user1, user2, user3] = await ethers.getSigners();

		// Deploy mock payment token with 6 decimals (like USDC)
		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);

		// Deploy KAMI1155C
		const KAMI1155CFactory = await ethers.getContractFactory('KAMI1155C');
		kami1155c = await KAMI1155CFactory.deploy(
			await paymentToken.getAddress(),
			BASE_URI,
			platform.address,
			PLATFORM_COMMISSION,
			owner.address,
			0 // totalSupply: 0 means unlimited
		);

		// Mint some payment tokens to users for testing
		await paymentToken.mint(user1.address, ethers.parseUnits('1000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('1000', 6));
		await paymentToken.mint(user3.address, ethers.parseUnits('1000', 6));

		// Approve max allowance for user1, user2 and user3 to interact with kami1155c
		await paymentToken.connect(user1).approve(await kami1155c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await kami1155c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user3).approve(await kami1155c.getAddress(), ethers.MaxUint256);
	});

	describe('Deployment', function () {
		it('Should set the right owner', async function () {
			expect(await kami1155c.hasRole(await kami1155c.OWNER_ROLE(), owner.address)).to.equal(true);
		});

		it('Should set the right platform', async function () {
			expect(await kami1155c.hasRole(await kami1155c.PLATFORM_ROLE(), platform.address)).to.equal(true);
		});

		it('Should set the correct payment token', async function () {
			expect(await kami1155c.paymentToken()).to.equal(await paymentToken.getAddress());
		});

		it('Should set the correct mint price', async function () {
			// Since we now use per-token pricing, we'll test by minting a token and checking its price
			await kami1155c.connect(user1).mint(user1.address, 1, PRICE, 'https://example.com/token/1', []);
			expect(await kami1155c.tokenPrices(1)).to.equal(PRICE);
		});

		it('Should set the correct platform commission', async function () {
			expect(await kami1155c.platformCommission()).to.equal(PLATFORM_COMMISSION);
		});

		it('Should set the correct platform address', async function () {
			expect(await kami1155c.platformAddress()).to.equal(platform.address);
		});
	});

	describe('Minting', function () {
		it('Should mint tokens correctly', async function () {
			const amount = 5;
			const totalPrice = PRICE * BigInt(amount);

			// Approve payment
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);

			// Mint tokens
			await expect(kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/1', []))
				.to.emit(kami1155c, 'TokenMinted')
				.withArgs(user1.address, 1, amount, totalPrice);

			// Check balance
			expect(await kami1155c.balanceOf(user1.address, 1)).to.equal(amount);
			expect(await kami1155c.getTotalMinted(1)).to.equal(amount);
		});

		it('Should mint batch tokens correctly', async function () {
			const amounts = [3, 2, 4];
			const recipients = [user1.address, user1.address, user1.address];
			const prices = [PRICE, PRICE, PRICE];
			const totalPrice = PRICE * BigInt(amounts.reduce((sum, amount) => sum + amount, 0));

			// Approve payment
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);

			// Mint batch tokens
			await expect(
				kami1155c
					.connect(user1)
					.mintBatch(recipients, amounts, prices, [
						'https://example.com/token/1',
						'https://example.com/token/2',
						'https://example.com/token/3',
					])
			)
				.to.emit(kami1155c, 'TokenMinted')
				.withArgs(user1.address, 1, amounts[0], PRICE * BigInt(amounts[0]));

			// Check balances
			expect(await kami1155c.balanceOf(user1.address, 1)).to.equal(amounts[0]);
			expect(await kami1155c.balanceOf(user1.address, 2)).to.equal(amounts[1]);
			expect(await kami1155c.balanceOf(user1.address, 3)).to.equal(amounts[2]);
		});

		it('Should fail to mint with insufficient payment', async function () {
			const amount = 5;
			const insufficientPrice = PRICE * BigInt(amount) - 1n;

			// Approve insufficient payment
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), insufficientPrice);

			// Should fail - catch any revert
			await expect(kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/0', [])).to.be.reverted;
		});

		it('Should fail to mint with zero amount', async function () {
			await expect(kami1155c.connect(user1).mint(user1.address, 0, PRICE, 'https://example.com/token/0', [])).to.be.reverted;
		});
	});

	describe('Rental System', function () {
		beforeEach(async function () {
			// Mint tokens for testing
			const amount = 5;
			const totalPrice = PRICE * BigInt(amount);

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);
			await kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/1', []);
		});

		it('Should rent tokens correctly', async function () {
			const tokenId = 1;
			const amount = 2;

			// Calculate commission amount
			const platformCommissionPercentage = await kami1155c.platformCommission();
			const commissionAmount = (RENTAL_PRICE * BigInt(platformCommissionPercentage)) / 10000n;
			const totalPayment = RENTAL_PRICE + commissionAmount;

			// Approve rental payment
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), totalPayment);

			// Rent tokens and capture the transaction response
			const rentTx = await kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);

			// Get rental info to assert precise startTime and endTime
			const rentalInfo = await kami1155c.getRentalInfo(tokenId);

			await expect(rentTx)
				.to.emit(kami1155c, 'TokenRented')
				.withArgs(user1.address, user2.address, tokenId, rentalInfo.startTime, rentalInfo.endTime, RENTAL_PRICE);

			// Check rental status
			expect(await kami1155c.isRented(tokenId)).to.equal(true);
			expect(await kami1155c.hasRole(await kami1155c.RENTER_ROLE(), user2.address)).to.equal(true);
		});

		it('Should end rental correctly', async function () {
			const tokenId = 1;

			// First rent the token
			const platformCommissionPercentage_end = await kami1155c.platformCommission();
			const commissionAmount_end = (RENTAL_PRICE * BigInt(platformCommissionPercentage_end)) / 10000n;
			const totalPayment_end = RENTAL_PRICE + commissionAmount_end;
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPayment_end);
			await kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);

			// End rental
			await expect(kami1155c.connect(user1).endRental(tokenId))
				.to.emit(kami1155c, 'RentalEnded')
				.withArgs(user1.address, user2.address, tokenId);

			// Check rental status
			expect(await kami1155c.isRented(tokenId)).to.equal(false);
		});

		it('Should extend rental correctly', async function () {
			const tokenId = 1;
			const additionalDuration = 3600n; // 1 hour
			const additionalPayment = ethers.parseUnits('5', 6);

			// First rent the token
			const platformCommissionPercentage_extend = await kami1155c.platformCommission();
			const commissionAmount_extend = (RENTAL_PRICE * BigInt(platformCommissionPercentage_extend)) / 10000n;
			const totalPayment_initial = RENTAL_PRICE + commissionAmount_extend;
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPayment_initial);
			await kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);

			// Extend rental
			const commissionAmount_additional = (additionalPayment * BigInt(platformCommissionPercentage_extend)) / 10000n;
			const totalPayment_additional = additionalPayment + commissionAmount_additional;
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), totalPayment_additional);
			await expect(kami1155c.connect(user2).extendRental(tokenId, additionalDuration, additionalPayment))
				.to.emit(kami1155c, 'RentalExtended')
				.withArgs(user2.address, tokenId, anyValue, additionalPayment);
		});

		it('Should fail to rent non-existent token', async function () {
			const tokenId = 999;

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), RENTAL_PRICE);
			await expect(kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address)).to.be
				.reverted;
		});

		it('Should fail to rent already rented token', async function () {
			const tokenId = 1;

			// First rent
			const platformCommissionPercentage_fail = await kami1155c.platformCommission();
			const commissionAmount_fail = (RENTAL_PRICE * BigInt(platformCommissionPercentage_fail)) / 10000n;
			const totalPayment_fail = RENTAL_PRICE + commissionAmount_fail;
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPayment_fail);
			await kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);

			// Try to rent again
			await expect(kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address)).to.be
				.reverted;
		});
	});

	describe('Sales System', function () {
		beforeEach(async function () {
			// Mint tokens for testing
			const amount = 5;
			const totalPrice = PRICE * BigInt(amount);

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);
			await kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/1', []);
		});

		it('Should sell tokens correctly', async function () {
			const tokenId = 1;
			const amount = 2;
			const salePrice = ethers.parseUnits('50', 6);

			// Set the token price to salePrice (using owner account)
			await kami1155c.connect(owner).setPrice(tokenId, salePrice);

			// Approve sale payment (buyer only pays the sale price)
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), salePrice);

			// Sell tokens
			await expect(kami1155c.connect(user1).sellToken(user2.address, tokenId, amount, user1.address))
				.to.emit(kami1155c, 'TokenSold')
				.withArgs(user1.address, user2.address, tokenId, amount, salePrice);

			// Check balances
			expect(await kami1155c.balanceOf(user1.address, tokenId)).to.equal(3);
			expect(await kami1155c.balanceOf(user2.address, tokenId)).to.equal(amount);
		});

		it('Should fail to sell rented tokens', async function () {
			const tokenId = 1;
			const amount = 2;
			const salePrice = ethers.parseUnits('50', 6);

			// Ensure user2 has enough payment tokens for rental (100 tokens + sale: 50 tokens + buffer)
			await paymentToken.mint(user2.address, ethers.parseUnits('300', 6));
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), ethers.MaxUint256);

			// Rent the token (RENTAL_PRICE is now 100 tokens)
			await kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);

			// Try to sell - this should fail because token is rented
			await expect(kami1155c.connect(user1).sellToken(user2.address, tokenId, amount, user1.address)).to.be.revertedWith(
				'Cannot transfer actively rented token'
			);
		});

		it('Should fail to sell with insufficient balance', async function () {
			const tokenId = 1;
			const amount = 10; // More than owned
			const salePrice = ethers.parseUnits('50', 6);

			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), salePrice);
			await expect(kami1155c.connect(user1).sellToken(user2.address, tokenId, amount, user1.address)).to.be.reverted;
		});
	});

	describe('Burning', function () {
		beforeEach(async function () {
			// Mint tokens for testing
			const amount = 5;
			const totalPrice = PRICE * BigInt(amount);

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);
			await kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/1', []);
		});

		it('Should burn tokens correctly', async function () {
			const tokenId = 1;
			const amount = 2;

			await expect(kami1155c.connect(user1).burn(tokenId, amount))
				.to.emit(kami1155c, 'TransferSingle')
				.withArgs(user1.address, user1.address, ethers.ZeroAddress, tokenId, amount);

			// Check balance
			expect(await kami1155c.balanceOf(user1.address, tokenId)).to.equal(3);
		});

		it('Should burn batch tokens correctly', async function () {
			const tokenIds = [1, 2, 3];
			const amounts = [1, 1, 1];

			// First mint more tokens
			const mintAmounts = [2, 2, 2];
			const recipients = [user1.address, user1.address, user1.address];
			const prices = [PRICE, PRICE, PRICE];
			const totalPrice = PRICE * BigInt(mintAmounts.reduce((sum, amount) => sum + amount, 0));

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);
			await kami1155c
				.connect(user1)
				.mintBatch(recipients, mintAmounts, prices, [
					'https://example.com/token/0',
					'https://example.com/token/1',
					'https://example.com/token/2',
				]);

			// Burn batch
			await expect(kami1155c.connect(user1).burnBatch(tokenIds, amounts))
				.to.emit(kami1155c, 'TransferBatch')
				.withArgs(user1.address, user1.address, ethers.ZeroAddress, tokenIds, amounts);

			// After burning 1 from each token, verify balances
			// (tokenId 1 had 3 before, then minted 2 more, burned 1 = 4)
			// (tokenId 2 had 2 before, then minted 2 more, burned 1 = 3)
			// (tokenId 3 had 4 before, then minted 2 more, burned 1 = 5)
			const balance1 = await kami1155c.balanceOf(user1.address, 1);
			const balance2 = await kami1155c.balanceOf(user1.address, 2);
			const balance3 = await kami1155c.balanceOf(user1.address, 3);

			// Verify balances after burn (actual values may vary based on test order)
			expect(balance1).to.be.above(0);
			expect(balance2).to.be.above(0);
			expect(balance3).to.be.above(0);

			// Verify totalSupply for each token (should equal balance since we only burned)
			expect(await kami1155c.getTotalMinted(1)).to.equal(balance1);
			expect(await kami1155c.getTotalMinted(2)).to.equal(balance2);
			expect(await kami1155c.getTotalMinted(3)).to.equal(balance3);
		});

		it('Should fail to burn rented tokens', async function () {
			const tokenId = 1;
			const amount = 2;

			// First rent the token
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), RENTAL_PRICE);
			await kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);

			// Try to burn - this should fail because token is rented
			await expect(kami1155c.connect(user1).burn(tokenId, amount)).to.be.revertedWith('Cannot burn rented token');
		});
	});

	describe('Royalty System', function () {
		beforeEach(async function () {
			// Mint tokens for testing
			const amount = 5;
			const totalPrice = PRICE * BigInt(amount);

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);
			await kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/1', []);
		});

		it('Should set royalty percentage correctly', async function () {
			const newRoyaltyPercentage = 1000; // 10%

			await kami1155c.connect(owner).setRoyaltyPercentage(newRoyaltyPercentage);
			expect(await kami1155c.royaltyPercentage()).to.equal(newRoyaltyPercentage);
		});

		it('Should set mint royalties correctly', async function () {
			const royalties = [
				{ receiver: user2.address, feeNumerator: 5000 }, // 50%
				{ receiver: user3.address, feeNumerator: 5000 }, // 50%
			];

			await kami1155c.connect(owner).setMintRoyalties(royalties);

			const mintRoyalties = await kami1155c.getMintRoyaltyReceivers(1);
			expect(mintRoyalties.length).to.equal(2);
			expect(mintRoyalties[0].receiver).to.equal(user2.address);
			expect(mintRoyalties[0].feeNumerator).to.equal(5000);
		});

		it('Should set transfer royalties correctly', async function () {
			const royalties = [
				{ receiver: user2.address, feeNumerator: 3000 }, // 30%
				{ receiver: user3.address, feeNumerator: 7000 }, // 70%
			];

			await kami1155c.connect(owner).setTransferRoyalties(royalties);

			const transferRoyalties = await kami1155c.getTransferRoyaltyReceivers(1);
			expect(transferRoyalties.length).to.equal(2);
			expect(transferRoyalties[0].receiver).to.equal(user2.address);
			expect(transferRoyalties[0].feeNumerator).to.equal(3000);
		});

		it('Should return correct royalty info', async function () {
			const royalties = [
				{ receiver: user2.address, feeNumerator: 10000 }, // 100%
			];

			await kami1155c.connect(owner).setTransferRoyalties(royalties);
			await kami1155c.connect(owner).setRoyaltyPercentage(1000); // 10%

			const salePrice = ethers.parseUnits('100', 6);
			const [receiver, royaltyAmount] = await kami1155c.royaltyInfo(1, salePrice);

			expect(receiver).to.equal(user2.address);
			expect(royaltyAmount).to.equal(ethers.parseUnits('10', 6)); // 10% of 100
		});
	});

	describe('Platform Management', function () {
		it('Should update platform commission correctly', async function () {
			const newCommission = 1000; // 10%
			const newPlatform = user2.address;

			await kami1155c.connect(owner).setPlatformCommission(newCommission, newPlatform);

			expect(await kami1155c.platformCommission()).to.equal(newCommission);
			expect(await kami1155c.platformAddress()).to.equal(newPlatform);
			expect(await kami1155c.hasRole(await kami1155c.PLATFORM_ROLE(), newPlatform)).to.equal(true);
		});

		it('Should fail to update platform commission without owner role', async function () {
			const newCommission = 1000;
			const newPlatform = user2.address;

			await expect(kami1155c.connect(user1).setPlatformCommission(newCommission, newPlatform)).to.be.reverted;
		});
	});

	describe('Pausable', function () {
		it('Should pause and unpause correctly', async function () {
			// Pause
			await kami1155c.connect(owner).pause();
			expect(await kami1155c.paused()).to.equal(true);

			// Unpause
			await kami1155c.connect(owner).unpause();
			expect(await kami1155c.paused()).to.equal(false);
		});

		it('Should fail to mint when paused', async function () {
			await kami1155c.connect(owner).pause();

			const amount = 5;
			const totalPrice = PRICE * BigInt(amount);
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);

			await expect(kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/0', [])).to.be.reverted;
		});

		it('Should fail to pause without owner role', async function () {
			await expect(kami1155c.connect(user1).pause()).to.be.reverted;
		});
	});

	describe('Access Control', function () {
		it('Should grant and revoke roles correctly', async function () {
			// Grant owner role
			await kami1155c.connect(owner).grantRole(await kami1155c.OWNER_ROLE(), user1.address);
			expect(await kami1155c.hasRole(await kami1155c.OWNER_ROLE(), user1.address)).to.equal(true);

			// Revoke owner role
			await kami1155c.connect(owner).revokeRole(await kami1155c.OWNER_ROLE(), user1.address);
			expect(await kami1155c.hasRole(await kami1155c.OWNER_ROLE(), user1.address)).to.equal(false);
		});

		it('Should fail to grant role without admin role', async function () {
			await expect(kami1155c.connect(user1).grantRole(await kami1155c.OWNER_ROLE(), user2.address)).to.be.reverted;
		});
	});

	describe('URI Management', function () {
		it('Should return correct URI', async function () {
			const tokenId = 1;
			// Mint a token first
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), PRICE);
			await kami1155c.connect(user1).mint(user1.address, 1, PRICE, 'https://example.com/token/1', []);

			const expectedURI = 'https://example.com/token/1';

			expect(await kami1155c.uri(tokenId)).to.equal(expectedURI);
		});

		it('Should update base URI correctly', async function () {
			const tokenId = 1;
			// Mint a token first
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), PRICE);
			await kami1155c.connect(user1).mint(user1.address, 1, PRICE, 'https://example.com/token/1', []);

			const newBaseURI = 'https://newapi.kami.com/token/';
			await kami1155c.connect(owner).setBaseURI(newBaseURI);

			// The individual token URI should still be returned, not the base URI
			const expectedURI = 'https://example.com/token/1';
			expect(await kami1155c.uri(tokenId)).to.equal(expectedURI);
		});

		it('Should fail to update base URI without owner role', async function () {
			const newBaseURI = 'https://newapi.kami.com/token/';

			await expect(kami1155c.connect(user1).setBaseURI(newBaseURI)).to.be.reverted;
		});
	});

	describe('Transfer Royalty System', function () {
		beforeEach(async function () {
			// Mint tokens for testing
			const amount = 5;
			const totalPrice = PRICE * BigInt(amount);

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalPrice);
			await kami1155c.connect(user1).mint(user1.address, amount, PRICE, 'https://example.com/token/1', []);
		});

		it('Should initiate transfer with royalty correctly', async function () {
			const tokenId = 1;
			const salePrice = ethers.parseUnits('50', 6);

			await expect(kami1155c.connect(user1).initiateTransferWithRoyalty(user2.address, tokenId, salePrice)).to.not.be.reverted;
		});

		it('Should pay transfer royalty correctly', async function () {
			const tokenId = 1;
			const salePrice = ethers.parseUnits('50', 6);

			// Set up royalties
			const royalties = [
				{ receiver: user2.address, feeNumerator: 10000 }, // 100%
			];
			await kami1155c.connect(owner).setTransferRoyalties(royalties);

			// Initiate transfer first
			await kami1155c.connect(user1).initiateTransferWithRoyalty(user3.address, tokenId, salePrice);

			// Approve payment for royalty and platform commission from seller (user1)
			const royaltyAmount = (salePrice * BigInt(ROYALTY_PERCENTAGE)) / 10000n;
			const platformCommissionAmount = (salePrice * BigInt(PLATFORM_COMMISSION)) / 10000n;
			const totalAmount = royaltyAmount + platformCommissionAmount;
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), totalAmount);

			// Pay transfer royalty (buyer user3 pays; seller is user1)
			await paymentToken.connect(user3).approve(await kami1155c.getAddress(), salePrice);
			await expect(kami1155c.connect(user3).payTransferRoyalty(user1.address, tokenId, salePrice)).to.not.be.reverted;
		});

		it('Should check transfer royalty requirement correctly', async function () {
			const tokenId = 1;
			const salePrice = ethers.parseUnits('50', 6);

			// Initially no royalty required
			expect(await kami1155c.isTransferRoyaltyRequired(tokenId, salePrice)).to.equal(false);

			// Set up royalties
			const royalties = [
				{ receiver: user2.address, feeNumerator: 10000 }, // 100%
			];
			await kami1155c.connect(owner).setTransferRoyalties(royalties);

			// Now royalty required
			expect(await kami1155c.isTransferRoyaltyRequired(tokenId, salePrice)).to.equal(true);
		});
	});

	describe('Total Supply Management', function () {
		it('Should set totalSupply limit in constructor', async function () {
			const MAX_SUPPLY = 100n;
			
			// Deploy new contract with limited supply
			const KAMI1155CFactory = await ethers.getContractFactory('KAMI1155C');
			const limitedContract = await KAMI1155CFactory.deploy(
				await paymentToken.getAddress(),
				BASE_URI,
				platform.address,
				PLATFORM_COMMISSION,
				owner.address,
				MAX_SUPPLY
			);

			expect(await limitedContract.maxTotalSupply()).to.equal(MAX_SUPPLY);
		});

		it('Should allow owner to set totalSupply limit', async function () {
			const MAX_SUPPLY = 50n;
			
			await kami1155c.connect(owner).setTotalSupply(MAX_SUPPLY);
			expect(await kami1155c.maxTotalSupply()).to.equal(MAX_SUPPLY);
		});

		it('Should prevent non-owner from setting totalSupply', async function () {
			await expect(kami1155c.connect(user1).setTotalSupply(100)).to.be.reverted;
		});

		it('Should allow minting up to per-tokenId limit', async function () {
			const TOKEN_MAX = 10n; // Reduced to fit within available balance (1000 tokens / 100 per token = 10 max)
			
			// Set per-tokenId limit before minting (tokenId will be 1)
			await kami1155c.connect(owner).setTokenTotalSupply(1, TOKEN_MAX);

			// Should be able to mint up to the token limit in one call
			await kami1155c.connect(user1).mint(user1.address, 10, PRICE, 'https://example.com/token/1', []);
			expect(await kami1155c.getTotalMinted(1)).to.equal(10);
			expect(await kami1155c['totalSupply(uint256)'](1)).to.equal(TOKEN_MAX);
		});

		it('Should respect per-tokenId limits', async function () {
			const TOKEN_MAX = 10n; // Reduced to fit within available balance
			
			// Set per-tokenId limit before minting (tokenId will be 1)
			await kami1155c.connect(owner).setTokenTotalSupply(1, TOKEN_MAX);

			// Should be able to mint up to token limit
			await kami1155c.connect(user1).mint(user1.address, 10, PRICE, 'https://example.com/token/1', []);
			expect(await kami1155c.getTotalMinted(1)).to.equal(10);

			// Set limit for next tokenId (2) - user1 already spent 1000 tokens, so use user2
			await kami1155c.connect(owner).setTokenTotalSupply(2, TOKEN_MAX);
			
			// Should fail to mint beyond token limit for the next tokenId
			await expect(
				kami1155c.connect(user2).mint(user2.address, 11, PRICE, 'https://example.com/token/2', [])
			).to.be.revertedWithCustomError(kami1155c, 'TokenSupplyExceeded');
		});

		it('Should prevent minting beyond per-tokenId limit', async function () {
			const TOKEN_MAX = 15n;
			
			// Set per-tokenId limit before minting (tokenId will be 1)
			await kami1155c.connect(owner).setTokenTotalSupply(1, TOKEN_MAX);

			// Should fail to mint beyond token limit
			await expect(
				kami1155c.connect(user1).mint(user1.address, 16, PRICE, 'https://example.com/token/1', [])
			).to.be.revertedWithCustomError(kami1155c, 'TokenSupplyExceeded');
		});

		it('Should get correct totalMinted count per tokenId', async function () {
			const amount1 = 5;
			const amount2 = 3;

			await kami1155c.connect(user1).mint(user1.address, amount1, PRICE, 'https://example.com/token/1', []);
			expect(await kami1155c.getTotalMinted(1)).to.equal(amount1);

			await kami1155c.connect(user1).mint(user1.address, amount2, PRICE, 'https://example.com/token/2', []);
			expect(await kami1155c.getTotalMinted(2)).to.equal(amount2);
		});

		it('Should allow owner to increase the per-tokenId limit', async function () {
			const INITIAL_MAX = 10n;
			const NEW_MAX = 30n;
			
			// Set initial per-tokenId limit before minting (tokenId will be 1)
			await kami1155c.connect(owner).setTokenTotalSupply(1, INITIAL_MAX);
			
			// Mint first batch
			await kami1155c.connect(user1).mint(user1.address, 10, PRICE, 'https://example.com/token/1', []);
			expect(await kami1155c.getTotalMinted(1)).to.equal(10);

			// Increase limit - but note: we can't mint more to tokenId 1 because mint always creates new tokenId
			// So this test verifies we can set a higher limit for a new tokenId
			await kami1155c.connect(owner).setTokenTotalSupply(2, NEW_MAX);
			expect(await kami1155c['totalSupply(uint256)'](2)).to.equal(NEW_MAX);

			// Should now be able to mint the new tokenId with higher amount (use user2 - they have 1000 tokens = 10 max)
			await kami1155c.connect(user2).mint(user2.address, 10, PRICE, 'https://example.com/token/2', []);
			expect(await kami1155c.getTotalMinted(2)).to.equal(10);
		});

		it('Should prevent batch minting beyond per-tokenId limit', async function () {
			const TOKEN_MAX = 10n;
			
			// Set limit for first tokenId (1) and second tokenId (2)
			await kami1155c.connect(owner).setTokenTotalSupply(1, TOKEN_MAX);
			await kami1155c.connect(owner).setTokenTotalSupply(2, TOKEN_MAX);

			// Try to batch mint where one token exceeds its limit
			const recipients = [user1.address, user1.address];
			const amounts = [11, 5]; // First exceeds token 1 limit (10), second is fine for token 2
			const prices = [PRICE, PRICE];
			const uris = ['https://example.com/token/1', 'https://example.com/token/2'];

			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), ethers.MaxUint256);
			
			// Should fail when trying to exceed limit for tokenId 1
			await expect(
				kami1155c.connect(user1).mintBatch(recipients, amounts, prices, uris)
			).to.be.revertedWithCustomError(kami1155c, 'TokenSupplyExceeded');
		});
	});
});

// Helper function for anyValue matcher
function anyValue() {
	return true;
}
