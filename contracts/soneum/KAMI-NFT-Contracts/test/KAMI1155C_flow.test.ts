import { expect } from 'chai';
import { ethers } from 'hardhat';
import { KAMI1155C } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('KAMI1155C Royalty and Commission Distribution Flow', function () {
	let kami1155c: KAMI1155C;
	let paymentToken: any;
	let owner: SignerWithAddress;
	let platform: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let receiver1: SignerWithAddress;
	let receiver2: SignerWithAddress;

	const TOKEN_SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.com/token/';
	const MINT_PRICE = ethers.parseUnits('100', 6); // 100 tokens with 6 decimals
	const PLATFORM_COMMISSION = 2000; // 20%
	const ROYALTY_PERCENTAGE = 1000; // 10%
	const RENTAL_DURATION = 86400n; // 1 day
	const RENTAL_PRICE = ethers.parseUnits('100', 6); // 100 tokens

	beforeEach(async function () {
		[owner, platform, user1, user2, receiver1, receiver2] = await ethers.getSigners();

		// Deploy mock payment token
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

		// Mint payment tokens to users
		await paymentToken.mint(user1.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('10000', 6));

		// Approve max allowance
		await paymentToken.connect(user1).approve(await kami1155c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await kami1155c.getAddress(), ethers.MaxUint256);
	});

	describe('Mint Flow - Royalty and Commission Distribution', function () {
		beforeEach(async function () {
			// Set royalty percentage to 10%
			await kami1155c.setRoyaltyPercentage(ROYALTY_PERCENTAGE);

			// Set mint royalty receivers: 2 receivers with 50% each
			const mintRoyalties = [
				{ receiver: receiver1.address, feeNumerator: 5000 },
				{ receiver: receiver2.address, feeNumerator: 5000 },
			];
			await kami1155c.setMintRoyalties(mintRoyalties);
		});

		it('Should distribute funds correctly on mint', async function () {
			const amount = 1;
			const totalPrice = MINT_PRICE * BigInt(amount);

			// Track initial balances
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const initialReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const initialContractBalance = await paymentToken.balanceOf(await kami1155c.getAddress());

			// Mint token with price 100
			await kami1155c.connect(user1).mint(user1.address, amount, MINT_PRICE, 'https://example.com/token/1', []);

			// Verify final balances
			const finalPlatformBalance = await paymentToken.balanceOf(platform.address);
			const finalReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const finalReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const finalContractBalance = await paymentToken.balanceOf(await kami1155c.getAddress());

			// Expected distributions:
			// Platform commission: 100 * 20% = 20
			// Remaining: 100 - 20 = 80
			// Each receiver gets: 80 * 5000 / 10000 = 40

			const platformReceived = finalPlatformBalance - initialPlatformBalance;
			const receiver1Received = finalReceiver1Balance - initialReceiver1Balance;
			const receiver2Received = finalReceiver2Balance - initialReceiver2Balance;

			expect(platformReceived).to.equal(ethers.parseUnits('20', 6));
			expect(receiver1Received).to.equal(ethers.parseUnits('40', 6));
			expect(receiver2Received).to.equal(ethers.parseUnits('40', 6));

			// Contract balance should be 0 (all funds distributed)
			expect(finalContractBalance).to.equal(initialContractBalance);

			// Verify token was minted
			expect(await kami1155c.balanceOf(user1.address, 1)).to.equal(amount);
		});
	});

	describe('Sale Flow - Royalty and Commission Distribution', function () {
		beforeEach(async function () {
			// Set royalty percentage to 10%
			await kami1155c.setRoyaltyPercentage(ROYALTY_PERCENTAGE);

			// Set transfer royalty receivers: 2 receivers with 50% each
			const transferRoyalties = [
				{ receiver: receiver1.address, feeNumerator: 5000 },
				{ receiver: receiver2.address, feeNumerator: 5000 },
			];
			await kami1155c.setTransferRoyalties(transferRoyalties);

			// Mint token to user1 with price 100
			const amount = 1;
			await kami1155c.connect(user1).mint(user1.address, amount, MINT_PRICE, 'https://example.com/token/1', []);
		});

		it('Should distribute funds correctly on sale', async function () {
			const SALE_PRICE = ethers.parseUnits('100', 6);
			const tokenId = 1;
			const amount = 1;

			// Set the token price to sale price
			await kami1155c.setPrice(tokenId, SALE_PRICE);

			// Track initial balances
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const initialReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const initialSellerBalance = await paymentToken.balanceOf(user1.address);
			const initialBuyerBalance = await paymentToken.balanceOf(user2.address);

			// Sell token
			await kami1155c.connect(user1).sellToken(user2.address, tokenId, amount, user1.address);

			// Verify final balances
			const finalPlatformBalance = await paymentToken.balanceOf(platform.address);
			const finalReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const finalReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const finalSellerBalance = await paymentToken.balanceOf(user1.address);
			const finalBuyerBalance = await paymentToken.balanceOf(user2.address);

			// Expected distributions:
			// Platform commission: 100 * 20% = 20
			// Remaining: 100 - 20 = 80
			// Royalty: 80 * 10% = 8
			// Each receiver gets: 8 * 5000 / 10000 = 4
			// Seller gets: 80 - 8 = 72

			const platformReceived = finalPlatformBalance - initialPlatformBalance;
			const receiver1Received = finalReceiver1Balance - initialReceiver1Balance;
			const receiver2Received = finalReceiver2Balance - initialReceiver2Balance;
			const sellerReceived = finalSellerBalance - initialSellerBalance;
			const buyerPaid = initialBuyerBalance - finalBuyerBalance;

			expect(platformReceived).to.equal(ethers.parseUnits('20', 6));
			expect(receiver1Received).to.equal(ethers.parseUnits('4', 6));
			expect(receiver2Received).to.equal(ethers.parseUnits('4', 6));
			expect(sellerReceived).to.equal(ethers.parseUnits('72', 6));
			expect(buyerPaid).to.equal(ethers.parseUnits('100', 6));

			// Verify token ownership changed
			expect(await kami1155c.balanceOf(user1.address, tokenId)).to.equal(0);
			expect(await kami1155c.balanceOf(user2.address, tokenId)).to.equal(amount);
		});
	});

	describe('Rental Flow - Royalty and Commission Distribution', function () {
		beforeEach(async function () {
			// Set royalty percentage to 10%
			await kami1155c.setRoyaltyPercentage(ROYALTY_PERCENTAGE);

			// Set mint royalty receivers for rental: 2 receivers with 50% each
			const mintRoyalties = [
				{ receiver: receiver1.address, feeNumerator: 5000 },
				{ receiver: receiver2.address, feeNumerator: 5000 },
			];
			await kami1155c.setMintRoyalties(mintRoyalties);

			// Mint tokens to user1 with price 100
			const amount = 5;
			await kami1155c.connect(user1).mint(user1.address, amount, MINT_PRICE, 'https://example.com/token/1', []);
		});

		it('Should distribute funds correctly on rental', async function () {
			const tokenId = 1;

			// Track initial balances
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const initialReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const initialTokenOwnerBalance = await paymentToken.balanceOf(user1.address);

			// Rent token with price 100
			await kami1155c.connect(user2).rentToken(tokenId, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);

			// Verify final balances
			const finalPlatformBalance = await paymentToken.balanceOf(platform.address);
			const finalReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const finalReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const finalTokenOwnerBalance = await paymentToken.balanceOf(user1.address);

			// Expected distributions for rental (same as sale flow):
			// Platform commission: 100 * 20% = 20
			// Remaining: 100 - 20 = 80
			// Royalty: 80 * 10% = 8
			// Each receiver gets: 8 * 5000 / 10000 = 4
			// Token owner gets: 80 - 8 = 72

			const platformReceived = finalPlatformBalance - initialPlatformBalance;
			const receiver1Received = finalReceiver1Balance - initialReceiver1Balance;
			const receiver2Received = finalReceiver2Balance - initialReceiver2Balance;
			const tokenOwnerReceived = finalTokenOwnerBalance - initialTokenOwnerBalance;

			// Platform gets commission
			expect(platformReceived).to.equal(ethers.parseUnits('20', 6));
			// Receivers get their royalty share
			expect(receiver1Received).to.equal(ethers.parseUnits('4', 6));
			expect(receiver2Received).to.equal(ethers.parseUnits('4', 6));
			// Token owner gets the rest
			expect(tokenOwnerReceived).to.equal(ethers.parseUnits('72', 6));

			// Verify token is rented
			expect(await kami1155c.isRented(tokenId)).to.equal(true);
		});
	});
});
