import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { MockERC20, ProxyAdmin, KAMI721CUpgradeable } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('KAMI721CUpgradeable', function () {
	let contract: KAMI721CUpgradeable;
	let proxyAdmin: ProxyAdmin;
	let paymentToken: any; // Use any type for MockERC20 to avoid type conflicts
	let owner: HardhatEthersSigner;
	let platform: HardhatEthersSigner;
	let buyer: HardhatEthersSigner;
	let royaltyReceiver: HardhatEthersSigner;
	let upgrader: HardhatEthersSigner;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let nextTokenId: bigint = 1n;
	let currentTokenId: bigint;
	let mintTokenId: bigint;

	const NAME = 'KAMI NFT';
	const SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.example/metadata/';
	const PRICE = ethers.parseUnits('100', 6); // 100 tokens with 6 decimals
	const PLATFORM_COMMISSION = 2000; // 20%
	const RENTAL_DURATION = 86400; // 1 day
	const RENTAL_PRICE = ethers.parseUnits('100', 6); // 100 tokens with 6 decimals (matching flow tests)

	beforeEach(async function () {
		[owner, platform, buyer, royaltyReceiver, upgrader, user1, user2, user3] = await ethers.getSigners();

		// Deploy mock payment token with 6 decimals
		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);
		await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));

		// Deploy the contract using the hardhat-upgrades plugin
		const KAMI721CUpgradeableFactory = await ethers.getContractFactory('KAMI721CUpgradeable');

		const contractInstance = await upgrades.deployProxy(
			KAMI721CUpgradeableFactory,
			[await paymentToken.getAddress(), NAME, SYMBOL, BASE_URI, platform.address, PLATFORM_COMMISSION, owner.address],
			{
				initializer: 'initialize',
				kind: 'transparent',
			}
		);

		contract = contractInstance as unknown as KAMI721CUpgradeable;

		// Save the proxy admin address for later testing
		const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(await contract.getAddress());
		proxyAdmin = (await ethers.getContractAt('ProxyAdmin', proxyAdminAddress)) as unknown as ProxyAdmin;

		// Approve the contract to spend buyer's payment tokens
		await paymentToken.connect(buyer).approve(await contract.getAddress(), ethers.parseUnits('1000', 6));

		// Mint some payment tokens to users for testing
		await paymentToken.mint(owner.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user1.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user3.address, ethers.parseUnits('10000', 6));

		// Approve the contract to spend payment tokens from all relevant accounts
		await paymentToken.connect(owner).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(platform).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(buyer).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(royaltyReceiver).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(upgrader).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user1).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user3).approve(await contract.getAddress(), ethers.MaxUint256);
	});

	describe('Initialization', function () {
		it('should initialize with correct values', async function () {
			expect(await contract.name()).to.equal(NAME);
			expect(await contract.symbol()).to.equal(SYMBOL);
			// Since we now use per-token pricing, we'll test by minting a token and checking its price
			await contract.connect(owner).mint(owner.address, PRICE, 'https://example.com/token/1', []);
			expect(await contract.tokenPrices(1)).to.equal(PRICE);
			expect(await contract.platformAddress()).to.equal(platform.address);
			expect(await contract.platformCommission()).to.equal(PLATFORM_COMMISSION);
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
					platform.address,
					PLATFORM_COMMISSION,
					owner.address
				)
			).to.be.reverted;
		});
	});

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

			// Mint a token for a unique tokenId (required before setting token-specific royalties)
			const tx = await contract.connect(owner).mint(owner.address, PRICE, 'https://example.com/token/0', []);
			const receipt = await tx.wait();
			const event = receipt.logs.find((log) => {
				try {
					const parsed = contract.interface.parseLog(log);
					return parsed && parsed.name === 'Transfer';
				} catch {
					return false;
				}
			});
			currentTokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId;
			nextTokenId++;

			await contract.setMintRoyalties(mintRoyaltyData);
			await contract.setTransferRoyalties(transferRoyaltyData);
		});

		it('should mint a token', async function () {
			const initialPaymentTokenBalance = await paymentToken.balanceOf(buyer.address);
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialRoyaltyReceiverBalance = await paymentToken.balanceOf(royaltyReceiver.address);

			// Mint a token
			const tx = await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);
			const receipt = await tx.wait();
			const event = receipt.logs.find((log) => {
				try {
					const parsed = contract.interface.parseLog(log);
					return parsed && parsed.name === 'Transfer';
				} catch {
					return false;
				}
			});
			const tokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId - 1n;

			// Check token ownership
			expect(await contract.ownerOf(tokenId)).to.equal(buyer.address);
			// The total supply should be 2 because the beforeEach hook already minted one token
			expect(await contract.totalSupply()).to.equal(2);

			// Check payment token balances
			const platformCommission = (PRICE * BigInt(PLATFORM_COMMISSION)) / 10000n;
			const remainingAmount = PRICE - platformCommission;
			const royaltyAmount = remainingAmount; // 100% of remaining amount goes to royalty receiver

			expect(await paymentToken.balanceOf(buyer.address)).to.equal(initialPaymentTokenBalance - PRICE);
			expect(await paymentToken.balanceOf(platform.address)).to.be.gte(initialPlatformBalance + platformCommission);
			expect(await paymentToken.balanceOf(royaltyReceiver.address)).to.be.gte(initialRoyaltyReceiverBalance + royaltyAmount);
		});

		it('should set and get mint price', async function () {
			const newMintPrice = ethers.parseUnits('150', 6);
			await contract.setPrice(currentTokenId, newMintPrice);
			expect(await contract.tokenPrices(currentTokenId)).to.equal(newMintPrice);
		});

		it('should not allow non-owners to set mint price', async function () {
			const newMintPrice = ethers.parseUnits('150', 6);
			await expect(contract.connect(buyer).setPrice(currentTokenId, newMintPrice)).to.be.reverted;
		});

		it('should set base URI', async function () {
			const newBaseURI = 'https://new.api.kami.example/metadata/';
			await contract.setBaseURI(newBaseURI);

			// Mint a token to check URI
			const individualURI = 'https://example.com/token/0';
			const tx = await contract.connect(buyer).mint(buyer.address, PRICE, individualURI, []);
			const receipt = await tx.wait();
			const event = receipt.logs.find((log) => {
				try {
					const parsed = contract.interface.parseLog(log);
					return parsed && parsed.name === 'Transfer';
				} catch {
					return false;
				}
			});
			const tokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId - 1n;

			expect(await contract.tokenURI(tokenId)).to.equal(individualURI);
		});
	});

	describe('Royalties', function () {
		beforeEach(async function () {
			// Mint a token to get a valid tokenId for royalty tests
			const tx = await contract.connect(owner).mint(owner.address, PRICE, 'https://example.com/token/0', []);
			const receipt = await tx.wait();
			const event = receipt.logs.find((log) => {
				try {
					const parsed = contract.interface.parseLog(log);
					return parsed && parsed.name === 'Transfer';
				} catch {
					return false;
				}
			});
			currentTokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId;
			nextTokenId++;
		});

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

			await contract.setTokenMintRoyalties(currentTokenId, royaltyData);

			const mintRoyaltyReceivers = await contract.getMintRoyaltyReceivers(currentTokenId);
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

			await contract.setTokenTransferRoyalties(currentTokenId, royaltyData);

			const transferRoyaltyReceivers = await contract.getTransferRoyaltyReceivers(currentTokenId);
			expect(transferRoyaltyReceivers.length).to.equal(1);
			expect(transferRoyaltyReceivers[0].receiver).to.equal(royaltyReceiver.address);
			expect(transferRoyaltyReceivers[0].feeNumerator).to.equal(10000);
		});
	});

	describe('Royalty Calculation Tests', function () {
		let royaltyReceiver1: HardhatEthersSigner;
		let royaltyReceiver2: HardhatEthersSigner;
		let royaltyReceiver3: HardhatEthersSigner;

		beforeEach(async function () {
			[owner, platform, buyer, royaltyReceiver, upgrader, royaltyReceiver1, royaltyReceiver2, royaltyReceiver3] =
				await ethers.getSigners();

			// Set up basic royalty configuration
			await contract.setRoyaltyPercentage(1000); // 10%

			// Mint a token for a unique tokenId by the buyer
			await paymentToken.mint(buyer.address, PRICE);
			await paymentToken.connect(buyer).approve(await contract.getAddress(), ethers.parseUnits('1000', 6)); // Ensure sufficient allowance for minting
			const tx = await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);
			const receipt = await tx.wait();
			const event = receipt.logs.find((log) => {
				try {
					const parsed = contract.interface.parseLog(log);
					return parsed && parsed.name === 'Transfer';
				} catch {
					return false;
				}
			});
			currentTokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId;
			nextTokenId++;

			// Mint payment tokens to additional users for testing
			await paymentToken.mint(royaltyReceiver1.address, ethers.parseUnits('1000', 6));
			await paymentToken.mint(royaltyReceiver2.address, ethers.parseUnits('1000', 6));
			await paymentToken.mint(royaltyReceiver3.address, ethers.parseUnits('1000', 6));
		});

		const createRoyaltyInfo = (address: string, feeNumerator: number) => {
			return {
				receiver: address,
				feeNumerator: feeNumerator,
			};
		};

		describe('Mint Royalty Calculations', function () {
			it('should calculate mint royalties correctly with single receiver', async function () {
				// Set mint royalties to 100% to one receiver
				const mintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await contract.setMintRoyalties(mintRoyalties);

				// Record initial balances
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const platformBalanceBefore = await paymentToken.balanceOf(platform.address);

				// Mint a new token
				await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);

				// Calculate expected amounts
				// The contract calculates royalties on the remaining amount after platform commission
				const platformCommission = (PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 10% = 10 payment tokens
				const remainingAmount = PRICE - platformCommission; // 90 payment tokens
				const royaltyAmount = remainingAmount; // 100% of remaining amount = 90 payment tokens

				// Verify calculations
				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + royaltyAmount);
				expect(await paymentToken.balanceOf(platform.address)).to.equal(platformBalanceBefore + platformCommission);
			});

			it('should handle token-specific mint royalties correctly', async function () {
				// Set default mint royalties (100%) for receiver1
				const defaultMintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await contract.setMintRoyalties(defaultMintRoyalties);

				// Record balances before minting
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Mint first token with default royalties
				await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);
				nextTokenId++;

				// Calculate expected amounts for first token
				const platformCommission = (PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
				const remainingForRoyalties = PRICE - platformCommission;
				const royaltyAmount = remainingForRoyalties; // 100% of remaining

				// Verify receiver1 got the royalties from first mint
				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + royaltyAmount);
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore); // Unchanged

				// Set token-specific mint royalties for the next token
				const tokenSpecificMintRoyalties = [
					createRoyaltyInfo(royaltyReceiver2.address, 10000), // 100%
				];

				// Record balances before second mint
				const r1BalanceBefore2 = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore2 = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Mint second token with token-specific royalties passed directly
				await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/1', tokenSpecificMintRoyalties);
				nextTokenId++;

				// Verify receiver2 got the royalties from second mint (token-specific)
				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore2); // Unchanged
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore2 + royaltyAmount);
			});

			it('should calculate mint royalties correctly with multiple receivers', async function () {
				// Set mint royalties to multiple receivers (total 100%)
				const mintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 6000), // 60%
					createRoyaltyInfo(royaltyReceiver2.address, 4000), // 40%
				];
				await contract.setMintRoyalties(mintRoyalties);

				// Record initial balances
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Mint a new token (will use currentTokenId)
				await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);

				// Calculate expected amounts
				const platformCommission = (PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5 payment tokens
				const remainingForRoyalties = PRICE - platformCommission; // 95 payment tokens
				const royalty1Amount = (remainingForRoyalties * BigInt(6000)) / BigInt(10000); // 60% = 57 payment tokens
				const royalty2Amount = (remainingForRoyalties * BigInt(4000)) / BigInt(10000); // 40% = 38 payment tokens

				// Verify calculations (accounting for rounding)
				// The contract does not explicitly distribute undistributed amounts to the first receiver,
				// so we verify that each receiver gets their calculated share.
				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + royalty1Amount);
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + royalty2Amount);

				// Verify the total amount transferred out equals the sum of distributed royalties
				expect(royalty1Amount + royalty2Amount).to.equal(remainingForRoyalties);
			});

			it('should handle edge case with very small amounts', async function () {
				// Set a very small mint price
				const smallMintPrice = ethers.parseUnits('0.001', 6); // 0.001 payment tokens

				// Set mint royalties (100% total)
				const mintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 5000), // 50%
					createRoyaltyInfo(royaltyReceiver2.address, 5000), // 50%
				];
				await contract.setMintRoyalties(mintRoyalties);

				// Record initial balances
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Mint with small amount (use smallMintPrice directly)
				await contract.connect(buyer).mint(buyer.address, smallMintPrice, 'https://example.com/token/0', []);

				// Calculate expected amounts with new commission (20%)
				const platformCommission = (smallMintPrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
				const remainingForRoyalties = smallMintPrice - platformCommission;

				// Verify at least one receiver gets the royalties (handling rounding)
				const r1BalanceAfter = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceAfter = await paymentToken.balanceOf(royaltyReceiver2.address);
				const totalReceived = r1BalanceAfter - r1BalanceBefore + (r2BalanceAfter - r2BalanceBefore);

				expect(totalReceived).to.equal(remainingForRoyalties);
			});
		});

		describe('Transfer Royalty Calculations', function () {
			beforeEach(async function () {
				// Mint a token for testing first
				const tx = await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);
				const receipt = await tx.wait();
				const event = receipt.logs.find((log) => {
					try {
						const parsed = contract.interface.parseLog(log);
						return parsed && parsed.name === 'Transfer';
					} catch {
						return false;
					}
				});
				mintTokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId;
				nextTokenId++;

				// Set up transfer royalties for the minted token
				const transferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 7000), // 70%
					createRoyaltyInfo(royaltyReceiver2.address, 3000), // 30%
				];
				await contract.setTokenTransferRoyalties(mintTokenId, transferRoyalties);
			});

			it('should calculate transfer royalties correctly with single receiver', async function () {
				// Set transfer royalties to single receiver
				const singleTransferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await contract.setTokenTransferRoyalties(mintTokenId, singleTransferRoyalties);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				await paymentToken.connect(royaltyReceiver3).mint(buyer.address, salePrice);
				await paymentToken.connect(royaltyReceiver3).approve(await contract.getAddress(), salePrice);
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Use the correct transfer flow: initiate and pay royalty, then transfer
				await contract.connect(buyer).initiateTransferWithRoyalty(royaltyReceiver3.address, mintTokenId, salePrice);
				await contract.connect(royaltyReceiver3).payTransferRoyalty(buyer.address, mintTokenId, salePrice);
				await contract.connect(buyer).transferFrom(buyer.address, royaltyReceiver3.address, mintTokenId);

				// Calculate expected amounts
				// Platform commission: 10% of sale price
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 10 tokens
				const remainingAmount = salePrice - platformCommission; // 90 tokens
				// Royalty: 10% of remaining amount
				const totalRoyaltyAmount = (remainingAmount * BigInt(1000)) / BigInt(10000); // 9 tokens
				const royalty1Amount = (totalRoyaltyAmount * BigInt(10000)) / BigInt(10000); // 100% = 9 tokens

				// Verify calculations
				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + royalty1Amount);
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore); // Unchanged
			});

			it('should calculate transfer royalties correctly with multiple receivers', async function () {
				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				await paymentToken.connect(royaltyReceiver3).mint(buyer.address, salePrice);
				await paymentToken.connect(royaltyReceiver3).approve(await contract.getAddress(), salePrice);
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Use the correct transfer flow
				await contract.connect(buyer).initiateTransferWithRoyalty(royaltyReceiver3.address, mintTokenId, salePrice);
				await contract.connect(royaltyReceiver3).payTransferRoyalty(buyer.address, mintTokenId, salePrice);
				await contract.connect(buyer).transferFrom(buyer.address, royaltyReceiver3.address, mintTokenId);

				// Calculate expected amounts
				// Platform commission: 10% of sale price
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 10 tokens
				const remainingAmount = salePrice - platformCommission; // 90 tokens
				// Royalty: 10% of remaining amount
				const totalRoyaltyAmount = (remainingAmount * BigInt(1000)) / BigInt(10000); // 9 tokens
				const royalty1Amount = (totalRoyaltyAmount * BigInt(7000)) / BigInt(10000); // 70% = 6.3 tokens
				const royalty2Amount = (totalRoyaltyAmount * BigInt(3000)) / BigInt(10000); // 30% = 2.7 tokens

				// Verify calculations (accounting for rounding)
				const totalDistributed = royalty1Amount + royalty2Amount;
				const undistributed = totalRoyaltyAmount - totalDistributed;

				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + royalty1Amount + undistributed);
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + royalty2Amount);
			});

			it('should handle token-specific transfer royalties correctly', async function () {
				// Set token-specific transfer royalties
				const tokenSpecificTransferRoyalties = [
					createRoyaltyInfo(royaltyReceiver2.address, 8000), // 80%
					createRoyaltyInfo(royaltyReceiver3.address, 2000), // 20%
				];
				await contract.setTokenTransferRoyalties(mintTokenId, tokenSpecificTransferRoyalties);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				await paymentToken.connect(royaltyReceiver3).mint(buyer.address, salePrice);
				await paymentToken.connect(royaltyReceiver3).approve(await contract.getAddress(), salePrice);
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);
				const r3BalanceBefore = await paymentToken.balanceOf(royaltyReceiver3.address);

				// Use the correct transfer flow
				await contract.connect(buyer).initiateTransferWithRoyalty(royaltyReceiver3.address, mintTokenId, salePrice);
				await contract.connect(royaltyReceiver3).payTransferRoyalty(buyer.address, mintTokenId, salePrice);
				await contract.connect(buyer).transferFrom(buyer.address, royaltyReceiver3.address, mintTokenId);

				// Calculate expected amounts
				// Platform commission: 20% of sale price
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 20 tokens
				const remainingAmount = salePrice - platformCommission; // 80 tokens
				// Royalty: 10% of remaining amount
				const totalRoyaltyAmount = (remainingAmount * BigInt(1000)) / BigInt(10000); // 8 tokens
				const royalty2Amount = (totalRoyaltyAmount * BigInt(8000)) / BigInt(10000); // 80% = 6.4 tokens
				const royalty3Amount = (totalRoyaltyAmount * BigInt(2000)) / BigInt(10000); // 20% = 1.6 tokens

				// Verify token-specific royalties were used
				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore); // Unchanged
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + royalty2Amount);
				// royaltyReceiver3 pays sale price but receives their share of royalty back
				expect(await paymentToken.balanceOf(royaltyReceiver3.address)).to.equal(r3BalanceBefore - salePrice + royalty3Amount);
			});

			it('should handle different royalty percentages correctly', async function () {
				// Change royalty percentage to 15%
				await contract.setRoyaltyPercentage(1500); // 15%

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				await paymentToken.connect(royaltyReceiver3).mint(buyer.address, salePrice);
				await paymentToken.connect(royaltyReceiver3).approve(await contract.getAddress(), salePrice);
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Use the correct transfer flow
				await contract.connect(buyer).initiateTransferWithRoyalty(royaltyReceiver3.address, mintTokenId, salePrice);
				await contract.connect(royaltyReceiver3).payTransferRoyalty(buyer.address, mintTokenId, salePrice);
				await contract.connect(buyer).transferFrom(buyer.address, royaltyReceiver3.address, mintTokenId);

				// Calculate expected amounts with 15% royalty
				// Platform commission: 10% of sale price
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 10 tokens
				const remainingAmount = salePrice - platformCommission; // 90 tokens
				// Royalty: 15% of remaining amount
				const totalRoyaltyAmount = (remainingAmount * BigInt(1500)) / BigInt(10000); // 13.5 tokens
				const royalty1Amount = (totalRoyaltyAmount * BigInt(7000)) / BigInt(10000); // 70% = 9.45 tokens
				const royalty2Amount = (totalRoyaltyAmount * BigInt(3000)) / BigInt(10000); // 30% = 4.05 tokens

				// Verify calculations (accounting for rounding)
				const totalDistributed = royalty1Amount + royalty2Amount;
				const undistributed = totalRoyaltyAmount - totalDistributed;

				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + royalty1Amount + undistributed);
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + royalty2Amount);
			});

			it('should handle edge case with very small sale prices', async function () {
				// Set up transfer royalties
				const transferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await contract.setTokenTransferRoyalties(mintTokenId, transferRoyalties);
				await contract.setRoyaltyPercentage(1000); // 10%

				// Mint a token for buyer
				await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);

				// Set a very small sale price
				const smallSalePrice = ethers.parseUnits('0.001', 6); // 0.001 payment tokens
				await paymentToken.connect(royaltyReceiver3).mint(buyer.address, smallSalePrice);
				await paymentToken.connect(royaltyReceiver3).approve(await contract.getAddress(), smallSalePrice);

				// Use the correct transfer flow: initiate, pay, then transfer
				await contract.connect(buyer).initiateTransferWithRoyalty(royaltyReceiver3.address, mintTokenId, smallSalePrice);
				await contract.connect(royaltyReceiver3).payTransferRoyalty(buyer.address, mintTokenId, smallSalePrice);
				await contract.connect(buyer).transferFrom(buyer.address, royaltyReceiver3.address, mintTokenId);

				// Check balances
				const royaltyAmount = (smallSalePrice * 1000n) / 10000n;
				const r1Balance = await paymentToken.balanceOf(royaltyReceiver1.address);
				expect(r1Balance).to.be.gte(royaltyAmount);
			});

			it('should handle zero royalty percentage correctly', async function () {
				// Set royalty percentage to 0%
				await contract.setRoyaltyPercentage(0);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				await paymentToken.connect(royaltyReceiver3).mint(buyer.address, salePrice);
				await paymentToken.connect(royaltyReceiver3).approve(await contract.getAddress(), salePrice);
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Use the correct transfer flow
				await contract.connect(buyer).initiateTransferWithRoyalty(royaltyReceiver3.address, mintTokenId, salePrice);
				await contract.connect(royaltyReceiver3).payTransferRoyalty(buyer.address, mintTokenId, salePrice);
				await contract.connect(buyer).transferFrom(buyer.address, royaltyReceiver3.address, mintTokenId);

				// Verify no royalties are distributed
				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore);
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore);
			});

			it('should handle maximum royalty percentage correctly', async function () {
				// Set royalty percentage to maximum (30%)
				await contract.setRoyaltyPercentage(3000); // 30%

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				await paymentToken.connect(royaltyReceiver3).mint(buyer.address, salePrice);
				await paymentToken.connect(royaltyReceiver3).approve(await contract.getAddress(), salePrice);
				const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await paymentToken.balanceOf(royaltyReceiver2.address);

				// Use the correct transfer flow
				await contract.connect(buyer).initiateTransferWithRoyalty(royaltyReceiver3.address, mintTokenId, salePrice);
				await contract.connect(royaltyReceiver3).payTransferRoyalty(buyer.address, mintTokenId, salePrice);
				await contract.connect(buyer).transferFrom(buyer.address, royaltyReceiver3.address, mintTokenId);

				// Calculate expected amounts with 30% royalty
				// Platform commission: 10% of sale price
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 10 tokens
				const remainingAmount = salePrice - platformCommission; // 90 tokens
				// Royalty: 30% of remaining amount
				const totalRoyaltyAmount = (remainingAmount * BigInt(3000)) / BigInt(10000); // 27 tokens
				const royalty1Amount = (totalRoyaltyAmount * BigInt(7000)) / BigInt(10000); // 70% = 18.9 tokens
				const royalty2Amount = (totalRoyaltyAmount * BigInt(3000)) / BigInt(10000); // 30% = 8.1 tokens

				// Verify calculations (accounting for rounding)
				const totalDistributed = royalty1Amount + royalty2Amount;
				const undistributed = totalRoyaltyAmount - totalDistributed;

				expect(await paymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + royalty1Amount + undistributed);
				expect(await paymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + royalty2Amount);
			});
		});

		describe('Royalty Info Retrieval', function () {
			it('should return correct royalty info for ERC2981', async function () {
				// Mint a token first
				const tx = await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);
				const receipt = await tx.wait();
				const event = receipt.logs.find((log) => {
					try {
						const parsed = contract.interface.parseLog(log);
						return parsed && parsed.name === 'Transfer';
					} catch {
						return false;
					}
				});
				const tokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId;
				nextTokenId++;

				// Set transfer royalties for the minted token
				const transferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await contract.setTokenTransferRoyalties(tokenId, transferRoyalties);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const [receiver, royaltyAmount] = await contract.royaltyInfo(tokenId, salePrice);

				// Calculate expected royalty amount
				const expectedRoyaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 10 payment tokens

				expect(receiver).to.equal(royaltyReceiver1.address);
				expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
			});

			it('should return zero royalty for non-existent tokens', async function () {
				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const [receiver, royaltyAmount] = await contract.royaltyInfo(999, salePrice);

				expect(receiver).to.equal(ethers.ZeroAddress);
				expect(royaltyAmount).to.equal(0);
			});

			it('should return correct royalty info with token-specific receivers', async function () {
				// Mint a token first
				const tx = await contract.connect(buyer).mint(buyer.address, PRICE, 'https://example.com/token/0', []);
				const receipt = await tx.wait();
				const event = receipt.logs.find((log) => {
					try {
						const parsed = contract.interface.parseLog(log);
						return parsed && parsed.name === 'Transfer';
					} catch {
						return false;
					}
				});
				const tokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId;
				nextTokenId++;

				// Set token-specific transfer royalties
				const tokenSpecificTransferRoyalties = [
					createRoyaltyInfo(royaltyReceiver2.address, 10000), // 100%
				];
				await contract.setTokenTransferRoyalties(tokenId, tokenSpecificTransferRoyalties);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const [receiver, royaltyAmount] = await contract.royaltyInfo(tokenId, salePrice);

				// Calculate expected royalty amount
				const expectedRoyaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 10 payment tokens

				expect(receiver).to.equal(royaltyReceiver2.address);
				expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
			});
		});
	});

	describe('Selling & Transfers', function () {
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

			// Mint a token for the owner first
			await paymentToken.mint(owner.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(owner).approve(await contract.getAddress(), ethers.parseUnits('1000', 6));
			const tx = await contract.connect(owner).mint(owner.address, PRICE, 'https://example.com/token/0', []);
			const receipt = await tx.wait();
			const event = receipt.logs.find((log) => {
				try {
					const parsed = contract.interface.parseLog(log);
					return parsed && parsed.name === 'Transfer';
				} catch {
					return false;
				}
			});
			currentTokenId = event ? BigInt(contract.interface.parseLog(event).args.tokenId) : nextTokenId;
			nextTokenId++;

			// Set royalty percentage to 10%
			await contract.setRoyaltyPercentage(1000);

			// Set royalties for the minted token
			await contract.setTokenMintRoyalties(currentTokenId, mintRoyaltyData);
			await contract.setTokenTransferRoyalties(currentTokenId, transferRoyaltyData);
		});

		it('should sell a token with royalties', async function () {
			const tokenId = currentTokenId;
			const salePrice = ethers.parseUnits('200', 6);

			const initialOwnerBalance = await paymentToken.balanceOf(owner.address);
			const initialBuyerBalance = await paymentToken.balanceOf(buyer.address);
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);
			const initialRoyaltyReceiverBalance = await paymentToken.balanceOf(royaltyReceiver.address);

			// Approve the contract to transfer the token
			await contract.connect(owner).approve(await contract.getAddress(), tokenId);

			// Approve contract to spend buyer's payment tokens
			await paymentToken.connect(buyer).approve(await contract.getAddress(), salePrice);

			// Sell the token using transfer royalty flow
			await contract.connect(owner).initiateTransferWithRoyalty(buyer.address, tokenId, salePrice);
			await contract.connect(buyer).payTransferRoyalty(owner.address, tokenId, salePrice);
			await contract.connect(owner).transferFrom(owner.address, buyer.address, tokenId);

			// Check token ownership
			expect(await contract.ownerOf(tokenId)).to.equal(buyer.address);

			// Calculate expected distribution (using new logic)
			const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / 10000n; // 20% of sale price
			const remainingAfterCommission = salePrice - platformCommission;
			const royaltyAmount = (remainingAfterCommission * BigInt(await contract.royaltyPercentage())) / 10000n; // 10% of remaining
			const sellerProceeds = remainingAfterCommission - royaltyAmount;

			// Check payment token balances
			expect(await paymentToken.balanceOf(buyer.address)).to.equal(initialBuyerBalance - salePrice);
			expect(await paymentToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + sellerProceeds);
			expect(await paymentToken.balanceOf(platform.address)).to.be.gte(initialPlatformBalance + platformCommission);
			expect(await paymentToken.balanceOf(royaltyReceiver.address)).to.be.gte(initialRoyaltyReceiverBalance + royaltyAmount);
		});
	});

	describe('Rental Functionality', function () {
		let tokenId = 1;
		const rentalPrice = ethers.parseUnits('50', 6);
		const rentalDuration = 86400; // 1 day in seconds

		beforeEach(async function () {
			// Mint a token for the owner
			await paymentToken.mint(owner.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(owner).approve(await contract.getAddress(), ethers.parseUnits('1000', 6));
			const tx = await contract.connect(owner).mint(owner.address, PRICE, 'https://example.com/token/0', []);
			const receipt = await tx.wait();
			const event = receipt.logs.find((log) => {
				try {
					const parsed = contract.interface.parseLog(log);
					return parsed && parsed.name === 'Transfer';
				} catch {
					return false;
				}
			});
			tokenId = event ? Number(contract.interface.parseLog(event).args.tokenId) : 1;

			// Owner approves the contract to spend platform commission
			await paymentToken.connect(owner).approve(await contract.getAddress(), rentalPrice);

			// Mint and approve payment tokens for buyer
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(await contract.getAddress(), ethers.parseUnits('1000', 6));
		});

		it('should rent a token', async function () {
			const initialOwnerBalance = await paymentToken.balanceOf(owner.address);
			const initialBuyerBalance = await paymentToken.balanceOf(buyer.address);
			const initialPlatformBalance = await paymentToken.balanceOf(platform.address);

			// Rent the token
			await contract.connect(buyer).rentToken(tokenId, rentalDuration, rentalPrice, buyer.address);

			// Check rental status
			const rentalInfo = await contract.getRentalInfo(tokenId);
			expect(rentalInfo.renter).to.equal(buyer.address);
			expect(rentalInfo.active).to.be.true;

			// Calculate expected distribution
			// Platform commission: 100 * 20% = 20
			const platformCommission = (rentalPrice * BigInt(PLATFORM_COMMISSION)) / 10000n;
			// Remaining: 100 - 20 = 80
			const remainingAfterCommission = rentalPrice - platformCommission;
			// Royalty: 80 * 10% = 8 (if no receivers, this is calculated but not distributed)
			const royaltyAmount = (remainingAfterCommission * BigInt(1000)) / 10000n; // 10% royalty percentage
			// Owner gets: 80 - 8 = 72 (since no royalty receivers are set, they get the full remaining after royalty calculation)
			const ownerProceeds = remainingAfterCommission - royaltyAmount;

			// Check payment token balances
			expect(await paymentToken.balanceOf(buyer.address)).to.equal(initialBuyerBalance - rentalPrice);
			expect(await paymentToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + ownerProceeds);
			expect(await paymentToken.balanceOf(platform.address)).to.equal(initialPlatformBalance + platformCommission);

			// Check renter role
			const RENTER_ROLE = await contract.RENTER_ROLE();
			expect(await contract.hasRole(RENTER_ROLE, buyer.address)).to.be.true;
		});

		it('should end rental', async function () {
			// Rent the token
			await contract.connect(buyer).rentToken(tokenId, rentalDuration, rentalPrice, buyer.address);

			// End the rental
			await contract.connect(owner).endRental(tokenId);

			// Check rental status
			const rentalInfo = await contract.getRentalInfo(tokenId);
			expect(rentalInfo.active).to.be.false;
		});

		it('should extend rental', async function () {
			// Rent the token
			await contract.connect(buyer).rentToken(tokenId, rentalDuration, rentalPrice, buyer.address);

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
