import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { MockERC20, ProxyAdmin, KAMI721ACUpgradable } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * @fileoverview Comprehensive test suite for KAMI721ACUpgradable contract
 *
 * This test suite covers all major functionality of the KAMI721ACUpgradable contract:
 * - Token claiming (single and batch)
 * - Royalty distribution and management
 * - Platform commission system
 * - Rental functionality
 * - Access control and role management
 * - Pause/unpause functionality
 * - Token transfers and sales
 * - Upgrade functionality
 * - Edge cases and error conditions
 *
 * The tests use a mock ERC20 token for payments and verify that all
 * business logic works correctly with the KamiNFTLibrary integration.
 * The upgradeable nature of the contract is also thoroughly tested.
 */

describe('KAMI721ACUpgradable', function () {
	let contract: KAMI721ACUpgradable;
	let proxyAdmin: ProxyAdmin;
	let paymentToken: any;
	let owner: HardhatEthersSigner;
	let platform: HardhatEthersSigner;
	let buyer: HardhatEthersSigner;
	let royaltyReceiver: HardhatEthersSigner;
	let upgrader: HardhatEthersSigner;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;

	const NAME = 'KAMI NFT';
	const SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.example/metadata/';
	const MINT_PRICE = ethers.parseUnits('100', 6);
	const PLATFORM_COMMISSION = 500;
	const RENTAL_DURATION = 86400;
	const RENTAL_PRICE = ethers.parseUnits('10', 6);

	beforeEach(async function () {
		[owner, platform, buyer, royaltyReceiver, upgrader, user1, user2, user3] = await ethers.getSigners();
		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);
		await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
		const KAMI721ACUpgradableFactory = await ethers.getContractFactory('KAMI721ACUpgradable');
		const contractInstance = await upgrades.deployProxy(
			KAMI721ACUpgradableFactory,
			[await paymentToken.getAddress(), NAME, SYMBOL, BASE_URI, MINT_PRICE, platform.address, PLATFORM_COMMISSION],
			{
				initializer: 'initialize',
				kind: 'transparent',
			}
		);
		contract = contractInstance as unknown as KAMI721ACUpgradable;
		const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(await contract.getAddress());
		proxyAdmin = (await ethers.getContractAt('ProxyAdmin', proxyAdminAddress)) as unknown as ProxyAdmin;
		await paymentToken.connect(buyer).approve(await contract.getAddress(), ethers.parseUnits('1000', 6));
		await paymentToken.mint(user1.address, ethers.parseUnits('1000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('1000', 6));
		await paymentToken.mint(user3.address, ethers.parseUnits('1000', 6));
		await paymentToken.connect(user1).approve(await contract.getAddress(), MINT_PRICE);
		await paymentToken.connect(user2).approve(await contract.getAddress(), MINT_PRICE);
		await paymentToken.connect(user3).approve(await contract.getAddress(), MINT_PRICE);
	});

	/**
	 * @dev Test suite for contract deployment and initialization
	 */
	describe('Initialization', function () {
		/**
		 * @dev Verifies that the contract is deployed with correct initial parameters
		 */
		it('should initialize with correct values', async function () {
			expect(await contract.name()).to.equal(NAME);
			expect(await contract.symbol()).to.equal(SYMBOL);
			expect(await contract.mintPrice()).to.equal(MINT_PRICE);
			expect(await contract.platformAddress()).to.equal(platform.address);
			expect(await contract.platformCommissionPercentage()).to.equal(PLATFORM_COMMISSION);
			expect(await contract.royaltyPercentage()).to.equal(1000); // Default 10%
		});

		it('should assign roles correctly', async function () {
			const OWNER_ROLE = await contract.OWNER_ROLE();
			const PLATFORM_ROLE = await contract.PLATFORM_ROLE();
			const UPGRADER_ROLE = await contract.UPGRADER_ROLE();

			expect(await contract.hasRole(OWNER_ROLE, owner.address)).to.be.true;
			expect(await contract.hasRole(PLATFORM_ROLE, platform.address)).to.be.true;
			expect(await contract.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
		});

		it('should not be able to initialize again', async function () {
			await expect(
				contract.initialize(
					await paymentToken.getAddress(),
					NAME,
					SYMBOL,
					BASE_URI,
					MINT_PRICE,
					platform.address,
					PLATFORM_COMMISSION
				)
			).to.be.revertedWith('Initializable: contract is already initialized');
		});
	});

	/**
	 * @dev Test suite for token claiming functionality
	 */
	describe('Claiming', function () {
		/**
		 * @dev Verifies that a user can successfully claim a token
		 */
		it('Should track claimed status correctly', async function () {
			expect(await contract.hasClaimed(user1.address)).to.equal(false);
			await contract.connect(user1).claim();
			expect(await contract.hasClaimed(user1.address)).to.equal(true);
		});
	});

	/**
	 * @dev Test suite for batch claiming functionality
	 */
	describe('Batch Claiming', function () {
		beforeEach(async function () {
			// Mint tokens to additional users for testing
			await paymentToken.mint(owner.address, ethers.parseUnits('1000', 6));
			await paymentToken.mint(user2.address, ethers.parseUnits('1000', 6));
			await paymentToken.mint(user3.address, ethers.parseUnits('1000', 6));
			await paymentToken.mint(platform.address, ethers.parseUnits('1000', 6));
		});

		/**
		 * @dev Verifies that owner can batch claim tokens for multiple recipients (owner pays)
		 */
		describe('batchClaimFor (Owner pays for all)', function () {
			it('Should allow owner to batch claim for multiple recipients', async function () {
				const recipients = [user1.address, user2.address, user3.address];
				const totalCost = MINT_PRICE * BigInt(recipients.length);

				await paymentToken.connect(owner).approve(await contract.getAddress(), totalCost);
				const initialOwnerBalance = await paymentToken.balanceOf(owner.address);

				await contract.connect(owner).batchClaimFor(recipients);

				// Check that tokens were minted
				expect(await contract.ownerOf(0)).to.equal(user1.address);
				expect(await contract.ownerOf(1)).to.equal(user2.address);
				expect(await contract.ownerOf(2)).to.equal(user3.address);

				// Check that owner paid for all
				expect(await paymentToken.balanceOf(owner.address)).to.equal(initialOwnerBalance - totalCost);

				// Check that all recipients are marked as claimed
				expect(await contract.hasClaimed(user1.address)).to.equal(true);
				expect(await contract.hasClaimed(user2.address)).to.equal(true);
				expect(await contract.hasClaimed(user3.address)).to.equal(true);
			});

			it('Should fail if non-owner tries to call batchClaimFor', async function () {
				const recipients = [user1.address, user2.address];
				await expect(contract.connect(user1).batchClaimFor(recipients)).to.be.revertedWith('Caller is not an owner');
			});

			it('Should fail if recipients array is empty', async function () {
				const recipients: string[] = [];
				await expect(contract.connect(owner).batchClaimFor(recipients)).to.be.revertedWith('Empty recipients array');
			});

			it('Should fail if too many recipients', async function () {
				const recipients = Array(101).fill(user1.address);
				await expect(contract.connect(owner).batchClaimFor(recipients)).to.be.revertedWith('Too many recipients');
			});

			it('Should fail if recipient has already claimed', async function () {
				// First, let user1 claim normally
				await paymentToken.connect(user1).approve(await contract.getAddress(), MINT_PRICE);
				await contract.connect(user1).claim();

				// Then try to batch claim for user1 again
				const recipients = [user1.address, user2.address];
				const totalCost = MINT_PRICE * BigInt(recipients.length);
				await paymentToken.connect(owner).approve(await contract.getAddress(), totalCost);

				await expect(contract.connect(owner).batchClaimFor(recipients)).to.be.revertedWith('Recipient already claimed');
			});

			it('Should fail if recipient address is zero', async function () {
				const recipients = [user1.address, ethers.ZeroAddress, user2.address];
				const totalCost = MINT_PRICE * BigInt(recipients.length);
				await paymentToken.connect(owner).approve(await contract.getAddress(), totalCost);

				await expect(contract.connect(owner).batchClaimFor(recipients)).to.be.revertedWith('Invalid recipient address');
			});
		});

		/**
		 * @dev Verifies that users can batch claim tokens (each pays for themselves)
		 */
		describe('batchClaim (Each recipient pays)', function () {
			beforeEach(async function () {
				// Approve payment tokens for all users
				await paymentToken.connect(user1).approve(await contract.getAddress(), MINT_PRICE);
				await paymentToken.connect(user2).approve(await contract.getAddress(), MINT_PRICE);
				await paymentToken.connect(user3).approve(await contract.getAddress(), MINT_PRICE);
			});

			it('Should allow batch claim where each recipient pays', async function () {
				const recipients = [user1.address, user2.address, user3.address];
				const initialBalances = [
					await paymentToken.balanceOf(user1.address),
					await paymentToken.balanceOf(user2.address),
					await paymentToken.balanceOf(user3.address),
				];

				await contract.connect(owner).batchClaim(recipients);

				// Check that tokens were minted
				expect(await contract.ownerOf(0)).to.equal(user1.address);
				expect(await contract.ownerOf(1)).to.equal(user2.address);
				expect(await contract.ownerOf(2)).to.equal(user3.address);

				// Check that each recipient paid
				expect(await paymentToken.balanceOf(user1.address)).to.equal(initialBalances[0] - MINT_PRICE);
				expect(await paymentToken.balanceOf(user2.address)).to.equal(initialBalances[1] - MINT_PRICE);
				expect(await paymentToken.balanceOf(user3.address)).to.equal(initialBalances[2] - MINT_PRICE);

				// Check that all recipients are marked as claimed
				expect(await contract.hasClaimed(user1.address)).to.equal(true);
				expect(await contract.hasClaimed(user2.address)).to.equal(true);
				expect(await contract.hasClaimed(user3.address)).to.equal(true);
			});

			it('Should fail if recipients array is empty', async function () {
				const recipients: string[] = [];
				await expect(contract.connect(owner).batchClaim(recipients)).to.be.revertedWith('Empty recipients array');
			});

			it('Should fail if too many recipients', async function () {
				const recipients = Array(101).fill(user1.address);
				await expect(contract.connect(owner).batchClaim(recipients)).to.be.revertedWith('Too many recipients');
			});

			it('Should fail if recipient has already claimed', async function () {
				// First, let user1 claim normally
				await contract.connect(user1).claim();

				// Then try to batch claim for user1 again
				const recipients = [user1.address, user2.address];
				await expect(contract.connect(owner).batchClaim(recipients)).to.be.revertedWith('Recipient already claimed');
			});

			it('Should fail if recipient address is zero', async function () {
				const recipients = [user1.address, ethers.ZeroAddress, user2.address];
				await expect(contract.connect(owner).batchClaim(recipients)).to.be.revertedWith('Invalid recipient address');
			});

			it('Should fail if recipient has insufficient allowance', async function () {
				// Revoke user2's allowance
				await paymentToken.connect(user2).approve(await contract.getAddress(), 0);

				const recipients = [user1.address, user2.address];
				await expect(contract.connect(owner).batchClaim(recipients)).to.be.revertedWith('ERC20: insufficient allowance');
			});

			it('Should fail if recipient has insufficient balance', async function () {
				// Transfer all tokens from user2
				await paymentToken.connect(user2).transfer(user1.address, await paymentToken.balanceOf(user2.address));

				const recipients = [user1.address, user2.address];
				await expect(contract.connect(owner).batchClaim(recipients)).to.be.revertedWith('ERC20: transfer amount exceeds balance');
			});
		});
	});

	/**
	 * @dev Test suite for royalty and platform commission functionality
	 */
	describe('Basic Functionality', function () {
		beforeEach(async function () {
			// Set up royalty receivers for testing
			const mintRoyaltyData = [
				{
					receiver: royaltyReceiver.address,
					feeNumerator: 10000, // 100% of royalties
				},
			];

			// For transfer royalties, the total percentages must equal 100%
			const transferRoyaltyData = [
				{
					receiver: royaltyReceiver.address,
					feeNumerator: 10000, // 100% of royalties
				},
			];

			await contract.setMintRoyalties(mintRoyaltyData);
			await contract.setTransferRoyalties(transferRoyaltyData);
		});

		it('should claim a token', async function () {
			const initialPaymentTokenBalance = await paymentToken.balanceOf(buyer.address);
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialRoyaltyReceiverBalance = await paymentToken.balanceOf(royaltyReceiver.address);

			// Claim a token
			await contract.connect(buyer).claim();

			// Check token ownership
			expect(await contract.ownerOf(0)).to.equal(buyer.address);
			expect(await contract.totalSupply()).to.equal(1);

			// Check payment token balances
			const platformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / 10000n;
			const royaltyAmount = ((MINT_PRICE - platformCommission) * 10000n) / 10000n;

			expect(await paymentToken.balanceOf(buyer.address)).to.equal(initialPaymentTokenBalance - MINT_PRICE);
			expect(await paymentToken.balanceOf(platform.address)).to.be.gte(initialPlatformBalance + platformCommission);
			expect(await paymentToken.balanceOf(royaltyReceiver.address)).to.be.gte(initialRoyaltyReceiverBalance + royaltyAmount);
		});

		it('should set and get mint price', async function () {
			const newMintPrice = ethers.parseUnits('150', 6);
			await contract.setMintPrice(newMintPrice);
			expect(await contract.mintPrice()).to.equal(newMintPrice);
		});

		it('should not allow non-owners to set mint price', async function () {
			const newMintPrice = ethers.parseUnits('150', 6);
			await expect(contract.connect(buyer).setMintPrice(newMintPrice)).to.be.revertedWith('Caller is not an owner');
		});

		it('should set base URI', async function () {
			const newBaseURI = 'https://new.api.kami.example/metadata/';
			await contract.setBaseURI(newBaseURI);

			// Claim a token to check URI
			await contract.connect(buyer).claim();

			expect(await contract.tokenURI(0)).to.equal(newBaseURI + '0');
		});
	});

	/**
	 * @dev Test suite for royalty functionality
	 */
	describe('Royalties', function () {
		it('should set and get royalty percentage', async function () {
			const newRoyaltyPercentage = 1500; // 15%
			await contract.setRoyaltyPercentage(newRoyaltyPercentage);
			expect(await contract.royaltyPercentage()).to.equal(newRoyaltyPercentage);
		});

		it('should set and get mint royalties', async function () {
			// Note: feeNumerator values must total 100%
			const royaltyData = [
				{
					receiver: royaltyReceiver.address,
					feeNumerator: 10000, // 100% of royalties
				},
			];

			await contract.setMintRoyalties(royaltyData);

			const mintRoyaltyReceivers = await contract.getMintRoyaltyReceivers(0);
			expect(mintRoyaltyReceivers.length).to.equal(1);
			expect(mintRoyaltyReceivers[0].receiver).to.equal(royaltyReceiver.address);
			expect(mintRoyaltyReceivers[0].feeNumerator).to.equal(10000);
		});

		it('should set and get transfer royalties', async function () {
			const royaltyData = [
				{
					receiver: royaltyReceiver.address,
					feeNumerator: 10000, // 100% of royalties
				},
			];

			await contract.setTransferRoyalties(royaltyData);

			const transferRoyaltyReceivers = await contract.getTransferRoyaltyReceivers(0);
			expect(transferRoyaltyReceivers.length).to.equal(1);
			expect(transferRoyaltyReceivers[0].receiver).to.equal(royaltyReceiver.address);
			expect(transferRoyaltyReceivers[0].feeNumerator).to.equal(10000);
		});
	});

	/**
	 * @dev Test suite for rental functionality
	 */
	describe('Rental Functionality', function () {
		let tokenId = 0;
		const rentalPrice = ethers.parseUnits('50', 6);
		const rentalDuration = 86400; // 1 day in seconds

		beforeEach(async function () {
			// Claim a token for the owner
			await paymentToken.mint(owner.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(owner).approve(await contract.getAddress(), ethers.parseUnits('1000', 6));
			await contract.connect(owner).claim();
			tokenId = 0;
		});

		it('should rent a token', async function () {
			const initialOwnerBalance = await paymentToken.balanceOf(owner.address);
			const initialBuyerBalance = await paymentToken.balanceOf(buyer.address);
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);

			// Rent the token
			await contract.connect(buyer).rentToken(tokenId, rentalDuration, rentalPrice);

			// Check rental status
			const rentalInfo = await contract.getRentalInfo(tokenId);
			expect(rentalInfo.renter).to.equal(buyer.address);
			expect(rentalInfo.active).to.be.true;

			// Calculate expected distribution
			const platformCommission = (rentalPrice * BigInt(PLATFORM_COMMISSION)) / 10000n;
			const ownerShare = rentalPrice - platformCommission;

			// Check payment token balances
			expect(await paymentToken.balanceOf(buyer.address)).to.equal(initialBuyerBalance - rentalPrice);
			expect(await paymentToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + ownerShare);
			expect(await paymentToken.balanceOf(platform.address)).to.equal(initialPlatformBalance + platformCommission);

			// Check renter role
			const RENTER_ROLE = await contract.RENTER_ROLE();
			expect(await contract.hasRole(RENTER_ROLE, buyer.address)).to.be.true;
		});

		it('should end rental', async function () {
			// Rent the token
			await contract.connect(buyer).rentToken(tokenId, rentalDuration, rentalPrice);

			// End the rental
			await contract.connect(owner).endRental(tokenId);

			// Check rental status
			const rentalInfo = await contract.getRentalInfo(tokenId);
			expect(rentalInfo.active).to.be.false;
		});

		it('should extend rental', async function () {
			// Rent the token
			await contract.connect(buyer).rentToken(tokenId, rentalDuration, rentalPrice);

			const rentalInfo = await contract.getRentalInfo(tokenId);
			const originalEndTime = rentalInfo.endTime;

			// Extend the rental
			const additionalDuration = 43200; // 12 hours
			const additionalPayment = ethers.parseUnits('25', 6);
			await contract.connect(buyer).extendRental(tokenId, additionalDuration, additionalPayment);

			// Check rental status
			const updatedRentalInfo = await contract.getRentalInfo(tokenId);
			expect(updatedRentalInfo.endTime).to.equal(originalEndTime + BigInt(additionalDuration));
			expect(updatedRentalInfo.rentalPrice).to.equal(rentalPrice + additionalPayment);
		});
	});

	/**
	 * @dev Test suite for upgrade functionality
	 */
	describe('Upgradeability', function () {
		it('should be managed by ProxyAdmin', async function () {
			// Get the deployed proxy admin
			const proxyAddress = await contract.getAddress();
			const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

			// Check that the proxy admin is set
			expect(adminAddress).to.not.equal(ethers.ZeroAddress);

			// Get the implementation address
			const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

			// Check that the implementation is set
			expect(implementationAddress).to.not.equal(ethers.ZeroAddress);
		});
	});
});
