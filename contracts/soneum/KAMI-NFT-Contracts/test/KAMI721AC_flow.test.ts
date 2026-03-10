import { expect } from 'chai';
import { ethers } from 'hardhat';
import { KAMI721AC } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('KAMI721AC Royalty and Commission Distribution Flow', function () {
	let kami721ac: KAMI721AC;
	let paymentToken: any;
	let owner: SignerWithAddress;
	let platform: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let receiver1: SignerWithAddress;
	let receiver2: SignerWithAddress;

	const TOKEN_NAME = 'KAMI721AC';
	const TOKEN_SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.com/token/';
	const CLAIM_PRICE = ethers.parseUnits('100', 6); // 100 tokens with 6 decimals
	const PLATFORM_COMMISSION = 2000; // 20%
	const ROYALTY_PERCENTAGE = 1000; // 10%
	const RENTAL_DURATION = 86400n; // 1 day
	const RENTAL_PRICE = ethers.parseUnits('100', 6); // 100 tokens

	beforeEach(async function () {
		[owner, platform, user1, user2, receiver1, receiver2] = await ethers.getSigners();

		// Deploy mock payment token
		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);

		// Deploy KAMI721AC
		const KAMI721ACFactory = await ethers.getContractFactory('KAMI721AC');
		kami721ac = await KAMI721ACFactory.deploy(
			await paymentToken.getAddress(),
			TOKEN_NAME,
			TOKEN_SYMBOL,
			BASE_URI,
			platform.address,
			PLATFORM_COMMISSION,
			owner.address,
			0, // totalSupply: 0 means unlimited
			CLAIM_PRICE // mintPrice: initial mint/claim price
		);

		// Mint payment tokens to users and owner
		await paymentToken.mint(owner.address, ethers.parseUnits('100000', 6)); // Owner needs tokens for minting
		await paymentToken.mint(user1.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('10000', 6));

		// Approve max allowance
		await paymentToken.connect(user1).approve(await kami721ac.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await kami721ac.getAddress(), ethers.MaxUint256);
	});

	describe('Claim Flow - Royalty and Commission Distribution', function () {
		beforeEach(async function () {
			// Set mint royalty receivers (claim uses mint royalties, like mint)
			const mintRoyalties = [
				{ receiver: receiver1.address, feeNumerator: 5000 },
				{ receiver: receiver2.address, feeNumerator: 5000 },
			];
			await kami721ac.setMintRoyalties(mintRoyalties);
		});

		it('Should distribute funds correctly on claim (follows mint logic)', async function () {
			// Track initial balances
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const initialReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const initialContractBalance = await paymentToken.balanceOf(await kami721ac.getAddress());

			// Claim token (uses global mintPrice set in constructor)
			await kami721ac.connect(user1).claim('https://example.com/token/1', []);

			// Verify final balances
			const finalPlatformBalance = await paymentToken.balanceOf(platform.address);
			const finalReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const finalReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const finalContractBalance = await paymentToken.balanceOf(await kami721ac.getAddress());

			// Expected distributions (claim follows mint logic):
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

			// Verify token was claimed
			expect(await kami721ac.ownerOf(1)).to.equal(user1.address);
			expect(await kami721ac.hasClaimed(user1.address)).to.equal(true);

			// Verify totalSupply is 1 after claim
			expect(await kami721ac.totalSupply()).to.equal(1);
		});
	});

	describe('Sale Flow - Royalty and Commission Distribution', function () {
		beforeEach(async function () {
			// Set royalty percentage to 10%
			await kami721ac.setRoyaltyPercentage(ROYALTY_PERCENTAGE);

			// Set transfer royalty receivers: 2 receivers with 50% each
			const transferRoyalties = [
				{ receiver: receiver1.address, feeNumerator: 5000 },
				{ receiver: receiver2.address, feeNumerator: 5000 },
			];
			await kami721ac.setTransferRoyalties(transferRoyalties);

			// Claim token for user1 (uses global mintPrice set in constructor)
			await kami721ac.connect(user1).claim('https://example.com/token/1', []);
			
			// Set sale price for the token (owner can set their own sale price)
			await kami721ac.connect(user1).setSalePrice(1, CLAIM_PRICE);
		});

		it('Should distribute funds correctly on sale', async function () {
			// Track initial balances (sale price is set in beforeEach via setSalePrice)
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const initialReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const initialSellerBalance = await paymentToken.balanceOf(user1.address);
			const initialBuyerBalance = await paymentToken.balanceOf(user2.address);

			// Sell token
			await kami721ac.connect(user1).sellToken(user2.address, 1, user1.address);

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
			expect(await kami721ac.ownerOf(1)).to.equal(user2.address);

			// Verify totalSupply is still 1 (token transferred but not destroyed)
			expect(await kami721ac.totalSupply()).to.equal(1);
		});
	});

	describe('Rental Flow - Royalty and Commission Distribution', function () {
		beforeEach(async function () {
			// Set royalty percentage to 10%
			await kami721ac.setRoyaltyPercentage(ROYALTY_PERCENTAGE);

			// Set mint royalty receivers for rental: 2 receivers with 50% each
			const mintRoyalties = [
				{ receiver: receiver1.address, feeNumerator: 5000 },
				{ receiver: receiver2.address, feeNumerator: 5000 },
			];
			await kami721ac.setMintRoyalties(mintRoyalties);

			// Claim token for user1 (uses global mintPrice set in constructor)
			await kami721ac.connect(user1).claim('https://example.com/token/1', []);
		});

		it('Should distribute funds correctly on rental', async function () {
			// Track initial balances
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialReceiver1Balance = await paymentToken.balanceOf(receiver1.address);
			const initialReceiver2Balance = await paymentToken.balanceOf(receiver2.address);
			const initialTokenOwnerBalance = await paymentToken.balanceOf(user1.address);

			// Rent token with price 100
			await kami721ac.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address);

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
			expect(await kami721ac.isRented(1)).to.equal(true);
		});
	});

	describe('Total Supply Management', function () {
		it('Should allow minting when totalSupply is unlimited (0)', async function () {
			// Deploy new contract with unlimited supply
			const KAMI721ACFactory = await ethers.getContractFactory('KAMI721AC');
			const unlimitedContract = await KAMI721ACFactory.deploy(
				await paymentToken.getAddress(),
				TOKEN_NAME,
				TOKEN_SYMBOL,
				BASE_URI,
				platform.address,
				PLATFORM_COMMISSION,
				owner.address,
				0, // Unlimited
				CLAIM_PRICE // mintPrice
			);

			// Setup payment tokens for new contract
			const [, , , newUser1] = await ethers.getSigners();
			await paymentToken.mint(newUser1.address, ethers.parseUnits('10000', 6));
			await paymentToken.connect(newUser1).approve(await unlimitedContract.getAddress(), ethers.MaxUint256);

			// Should be able to claim (uses global mintPrice)
			await unlimitedContract.connect(newUser1).claim('https://example.com/token/1', []);
			expect(await unlimitedContract.totalSupply()).to.equal(1);
			expect(await unlimitedContract.maxTotalSupply()).to.equal(0);
			expect(await unlimitedContract.getTotalMinted()).to.equal(1);
		});

		it('Should set totalSupply limit in constructor', async function () {
			const MAX_SUPPLY = 5n;
			
			// Deploy new contract with limited supply
			const KAMI721ACFactory = await ethers.getContractFactory('KAMI721AC');
			const limitedContract = await KAMI721ACFactory.deploy(
				await paymentToken.getAddress(),
				TOKEN_NAME,
				TOKEN_SYMBOL,
				BASE_URI,
				platform.address,
				PLATFORM_COMMISSION,
				owner.address,
				MAX_SUPPLY,
				CLAIM_PRICE // mintPrice
			);

			expect(await limitedContract.maxTotalSupply()).to.equal(MAX_SUPPLY);
		});

		it('Should allow owner to set totalSupply limit', async function () {
			const MAX_SUPPLY = 10n;
			
			await kami721ac.connect(owner).setTotalSupply(MAX_SUPPLY);
			expect(await kami721ac.maxTotalSupply()).to.equal(MAX_SUPPLY);
		});

		it('Should prevent non-owner from setting totalSupply', async function () {
			await expect(kami721ac.connect(user1).setTotalSupply(100)).to.be.reverted;
		});

		it('Should allow minting up to the limit', async function () {
			const MAX_SUPPLY = 3n;
			
			// Set limit
			await kami721ac.connect(owner).setTotalSupply(MAX_SUPPLY);

			// Use mint() instead of claim() to avoid AlreadyClaimed issues
			// Get fresh users who haven't claimed
			const signers = await ethers.getSigners();
			const newUser1 = signers[10];
			const newUser2 = signers[11];
			const newUser3 = signers[12];
			
			await paymentToken.mint(newUser1.address, ethers.parseUnits('10000', 6));
			await paymentToken.mint(newUser2.address, ethers.parseUnits('10000', 6));
			await paymentToken.mint(newUser3.address, ethers.parseUnits('10000', 6));
			await paymentToken.connect(newUser1).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await paymentToken.connect(newUser2).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await paymentToken.connect(newUser3).approve(await kami721ac.getAddress(), ethers.MaxUint256);

			// Should be able to mint up to the limit (mint transfers payment from caller, not recipient)
			// Uses global mintPrice set in constructor
			await paymentToken.connect(owner).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await kami721ac.connect(owner).mint(newUser1.address, 'https://example.com/token/0', []);
			expect(await kami721ac.getTotalMinted()).to.equal(await kami721ac.totalSupply());

			await kami721ac.connect(owner).mint(newUser2.address, 'https://example.com/token/1', []);
			expect(await kami721ac.getTotalMinted()).to.equal(await kami721ac.totalSupply());

			await kami721ac.connect(owner).mint(newUser3.address, 'https://example.com/token/2', []);
			expect(await kami721ac.getTotalMinted()).to.equal(3);
		});

		it('Should prevent minting beyond the limit', async function () {
			const MAX_SUPPLY = 2n;
			
			// Set limit
			await kami721ac.connect(owner).setTotalSupply(MAX_SUPPLY);

			// Get fresh users
			const signers = await ethers.getSigners();
			const newUser1 = signers[10];
			const newUser2 = signers[11];
			const newUser3 = signers[12];
			
			await paymentToken.mint(newUser1.address, ethers.parseUnits('10000', 6));
			await paymentToken.mint(newUser2.address, ethers.parseUnits('10000', 6));
			await paymentToken.mint(newUser3.address, ethers.parseUnits('10000', 6));
			await paymentToken.connect(newUser1).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await paymentToken.connect(newUser2).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await paymentToken.connect(newUser3).approve(await kami721ac.getAddress(), ethers.MaxUint256);

			// Mint up to limit (owner pays for all, uses global mintPrice)
			await paymentToken.connect(owner).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await kami721ac.connect(owner).mint(newUser1.address, 'https://example.com/token/0', []);
			await kami721ac.connect(owner).mint(newUser2.address, 'https://example.com/token/1', []);

			// Should not be able to mint beyond limit
			await expect(
				kami721ac.connect(owner).mint(newUser3.address, 'https://example.com/token/2', [])
			).to.be.revertedWithCustomError(kami721ac, 'TokenSupplyExceeded');
		});

		it('Should allow owner to increase the limit', async function () {
			const INITIAL_MAX = 2n;
			const NEW_MAX = 5n;
			
			// Set initial limit
			await kami721ac.connect(owner).setTotalSupply(INITIAL_MAX);

			// Get fresh users
			const signers = await ethers.getSigners();
			const newUser1 = signers[10];
			const newUser2 = signers[11];
			const newUser3 = signers[12];
			
			await paymentToken.mint(newUser1.address, ethers.parseUnits('10000', 6));
			await paymentToken.mint(newUser2.address, ethers.parseUnits('10000', 6));
			await paymentToken.mint(newUser3.address, ethers.parseUnits('10000', 6));
			await paymentToken.connect(newUser1).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await paymentToken.connect(newUser2).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await paymentToken.connect(newUser3).approve(await kami721ac.getAddress(), ethers.MaxUint256);

			// Mint up to initial limit (owner pays for all, uses global mintPrice)
			await paymentToken.connect(owner).approve(await kami721ac.getAddress(), ethers.MaxUint256);
			await kami721ac.connect(owner).mint(newUser1.address, 'https://example.com/token/0', []);
			await kami721ac.connect(owner).mint(newUser2.address, 'https://example.com/token/1', []);

			// Increase limit
			await kami721ac.connect(owner).setTotalSupply(NEW_MAX);
			expect(await kami721ac.maxTotalSupply()).to.equal(NEW_MAX);

			// Should now be able to mint more
			await kami721ac.connect(owner).mint(newUser3.address, 'https://example.com/token/2', []);
			expect(await kami721ac.getTotalMinted()).to.equal(3);
		});

		it('Should get correct totalMinted count', async function () {
			// Get fresh users
			const signers = await ethers.getSigners();
			const newUser1 = signers[10];
			const newUser2 = signers[11];
			
			// Owner pays for minting (uses global mintPrice)
			await paymentToken.connect(owner).approve(await kami721ac.getAddress(), ethers.MaxUint256);

			await kami721ac.connect(owner).mint(newUser1.address, 'https://example.com/token/0', []);
			expect(await kami721ac.getTotalMinted()).to.equal(await kami721ac.totalSupply());

			await kami721ac.connect(owner).mint(newUser2.address, 'https://example.com/token/1', []);
			expect(await kami721ac.getTotalMinted()).to.equal(await kami721ac.totalSupply());
		});

		it('Should prevent batch claiming beyond limit', async function () {
			const MAX_SUPPLY = 2n;
			
			await kami721ac.connect(owner).setTotalSupply(MAX_SUPPLY);

			// Get fresh users who haven't claimed
			const signers = await ethers.getSigners();
			const newUser1 = signers[10];
			const newUser2 = signers[11];
			const newUser3 = signers[12];

			// batchClaimFor transfers payment from caller (owner), not recipients
			// Uses global mintPrice for all claims
			const totalCost = CLAIM_PRICE * 3n;
			await paymentToken.mint(owner.address, totalCost);
			await paymentToken.connect(owner).approve(await kami721ac.getAddress(), ethers.MaxUint256);

			// Try to batch claim more than the limit
			const recipients = [newUser1.address, newUser2.address, newUser3.address];
			const uris = ['https://example.com/token/0', 'https://example.com/token/1', 'https://example.com/token/2'];

			// Should fail when trying to exceed limit (first two should succeed, third should fail)
			await expect(
				kami721ac.connect(owner).batchClaimFor(recipients, uris, [])
			).to.be.revertedWithCustomError(kami721ac, 'TokenSupplyExceeded');
		});
	});
});
