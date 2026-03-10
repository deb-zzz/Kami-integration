import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { MockERC20, KAMI1155CUpgradeable } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('KAMI1155CUpgradeable', function () {
	let kami1155C: KAMI1155CUpgradeable;
	let paymentToken: any; // Use any type for MockERC20 to avoid type conflicts
	let owner: SignerWithAddress;
	let buyer: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let platform: SignerWithAddress;
	let royaltyReceiver: SignerWithAddress;
	let testBuyer: SignerWithAddress;
	let royaltyReceiver1: HardhatEthersSigner;
	let royaltyReceiver2: HardhatEthersSigner;
	let royaltyReceiver3: HardhatEthersSigner;

	const NAME = 'KAMI1155C';
	const SYMBOL = 'KAMI1155C';
	const BASE_URI = 'https://api.kami.example/metadata/';
	const MINT_PRICE = ethers.parseUnits('100', 6); // 100 USDC
	const PLATFORM_COMMISSION = 500; // 5%
	const RENTAL_DURATION = 86400; // 1 day
	const RENTAL_PRICE = ethers.parseUnits('10', 6); // 10 tokens with 6 decimals

	describe('Initialization', function () {
		beforeEach(async function () {
			const signers = await ethers.getSigners();
			// Assign unique addresses for each role
			owner = signers[0];
			platform = signers[1];
			testBuyer = signers[2]; // Use 'buyer' as testBuyer
			royaltyReceiver1 = signers[4];
			royaltyReceiver2 = signers[5];
			royaltyReceiver3 = signers[6];

			// Deploy mock payment token
			const MockERC20Factory = await ethers.getContractFactory('MockERC20');
			paymentToken = await MockERC20Factory.deploy('Mock USDC', 'USDC', 6);

			// Deploy the contract with the correct platform address
			const KAMI1155CUpgradeable = await ethers.getContractFactory('KAMI1155CUpgradeable');
			kami1155C = await upgrades.deployProxy(KAMI1155CUpgradeable, [
				await paymentToken.getAddress(),
				'KAMI1155C',
				'K1155C',
				BASE_URI,
				MINT_PRICE,
				platform.address,
				PLATFORM_COMMISSION,
			]);

			// Log addresses for debugging
			// console.log('owner:', owner?.address);
			// console.log('testBuyer:', testBuyer?.address);
			// console.log('royaltyReceiver1:', royaltyReceiver1?.address);
			// console.log('royaltyReceiver2:', royaltyReceiver2?.address);
			// console.log('royaltyReceiver3:', royaltyReceiver3?.address);
			// console.log('platform:', platform?.address);
			// console.log('paymentToken:', paymentToken?.address);
			// console.log('kami1155C:', kami1155C?.address);

			// Set up basic royalty configuration
			await kami1155C.setRoyaltyPercentage(1000); // 10%

			// Mint payment tokens to royalty receivers for testing
			await paymentToken.mint(royaltyReceiver1.address, ethers.parseUnits('1000', 6));
			await paymentToken.mint(royaltyReceiver2.address, ethers.parseUnits('1000', 6));
			await paymentToken.mint(royaltyReceiver3.address, ethers.parseUnits('1000', 6));

			// Mint payment tokens to testBuyer for minting/transfer
			await paymentToken.mint(testBuyer.address, ethers.parseUnits('200000', 6));
			await paymentToken.connect(testBuyer).approve(await kami1155C.getAddress(), ethers.MaxUint256);
		});

		it('should initialize with correct values', async function () {
			expect(await kami1155C.mintPrice()).to.equal(MINT_PRICE);
			expect(await kami1155C.platformAddress()).to.equal(platform.address);
			expect(await kami1155C.platformCommissionPercentage()).to.equal(PLATFORM_COMMISSION);
			expect(await kami1155C.royaltyPercentage()).to.equal(1000); // Default 10%
		});

		it('should assign roles correctly', async function () {
			const OWNER_ROLE = await kami1155C.OWNER_ROLE();
			const PLATFORM_ROLE = await kami1155C.PLATFORM_ROLE();
			const UPGRADER_ROLE = await kami1155C.UPGRADER_ROLE();

			expect(await kami1155C.hasRole(OWNER_ROLE, owner.address)).to.be.true;
			expect(await kami1155C.hasRole(PLATFORM_ROLE, platform.address)).to.be.true;
			expect(await kami1155C.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
		});

		it('should not be able to initialize again', async function () {
			await expect(
				kami1155C.initialize(
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

		it('should verify platform address initialization', async function () {
			// console.log('=== PLATFORM ADDRESS VERIFICATION ===');
			// console.log('Platform address passed to initialize:', platform.address);
			// console.log('Platform address returned by contract:', await kami1155C.platformAddress());
			// console.log('Are they equal?', platform.address === (await kami1155C.platformAddress()));

			// This should pass if initialization worked correctly
			expect(await kami1155C.platformAddress()).to.equal(platform.address);
		});
	});

	describe('Basic Functionality', function () {
		beforeEach(async function () {
			const signers = await ethers.getSigners();
			// Assign unique addresses for each role
			owner = signers[0];
			platform = signers[1];
			buyer = signers[2];
			user1 = signers[3];
			user2 = signers[4];
			user3 = signers[5];
			royaltyReceiver = signers[6];

			// Deploy mock payment token
			const MockERC20Factory = await ethers.getContractFactory('MockERC20');
			paymentToken = await MockERC20Factory.deploy('Mock USDC', 'USDC', 6);

			// Deploy the contract using the hardhat-upgrades plugin
			const KAMI1155CUpgradeableFactory = await ethers.getContractFactory('KAMI1155CUpgradeable');
			const contractInstance = await upgrades.deployProxy(
				KAMI1155CUpgradeableFactory,
				[await paymentToken.getAddress(), NAME, SYMBOL, BASE_URI, MINT_PRICE, platform.address, PLATFORM_COMMISSION],
				{
					initializer: 'initialize',
					kind: 'transparent',
				}
			);
			kami1155C = contractInstance as unknown as KAMI1155CUpgradeable;

			// Set up basic royalty configuration
			await kami1155C.setRoyaltyPercentage(1000); // 10%

			// Mint payment tokens to royalty receivers for testing
			await paymentToken.mint(royaltyReceiver.address, ethers.parseUnits('1000', 6));

			// Mint payment tokens to buyer for minting/transfer
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(await kami1155C.getAddress(), ethers.parseUnits('1000', 6));

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

			await kami1155C.setMintRoyalties(mintRoyaltyData);
			await kami1155C.setTransferRoyalties(transferRoyaltyData);
		});

		it('should mint a token', async function () {
			const initialPaymentTokenBalance = await paymentToken.balanceOf(buyer.address);
			const contractPlatformAddress = await kami1155C.platformAddress();
			const initialPlatformBalance = await paymentToken.balanceOf(contractPlatformAddress);
			const initialRoyaltyReceiverBalance = await paymentToken.balanceOf(royaltyReceiver.address);

			// Debug: Print contract's payment token balance before and after mint
			const contractAddress = await kami1155C.getAddress();
			const contractBalanceBefore = await paymentToken.balanceOf(contractAddress);
			// console.log('Contract balance before mint:', contractBalanceBefore.toString());

			// Debug: Calculate expected platform commission
			const expectedPlatformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
			// console.log('Expected platform commission:', expectedPlatformCommission.toString());
			// console.log('MINT_PRICE:', MINT_PRICE.toString());
			// console.log('PLATFORM_COMMISSION:', PLATFORM_COMMISSION.toString());

			// Debug: Print initial balances
			const r1BalanceBefore = await paymentToken.balanceOf(royaltyReceiver1.address);
			const platformBalanceBefore = await paymentToken.balanceOf(contractPlatformAddress);
			// console.log('Initial royalty receiver balance:', r1BalanceBefore.toString());
			// console.log('Initial platform balance:', platformBalanceBefore.toString());

			// Mint a token
			await kami1155C.connect(buyer).mint(1);

			const contractBalanceAfter = await paymentToken.balanceOf(contractAddress);
			// console.log('Contract balance after mint:', contractBalanceAfter.toString());
			// console.log('Contract balance change:', (contractBalanceAfter - contractBalanceBefore).toString());

			// Check token ownership
			expect(await kami1155C.balanceOf(buyer.address, 0)).to.equal(1);
			expect(await kami1155C.totalSupply(0)).to.equal(1);

			// Check payment token balances
			const platformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / 10000n;
			const royaltyAmount = ((MINT_PRICE - platformCommission) * 10000n) / 10000n;

			expect(await paymentToken.balanceOf(buyer.address)).to.equal(initialPaymentTokenBalance - MINT_PRICE);
			expect(await paymentToken.balanceOf(contractPlatformAddress)).to.be.gte(initialPlatformBalance + platformCommission);
			expect(await paymentToken.balanceOf(royaltyReceiver.address)).to.be.gte(initialRoyaltyReceiverBalance + royaltyAmount);
		});

		it('should set and get mint price', async function () {
			const newMintPrice = ethers.parseUnits('150', 6);
			await kami1155C.setMintPrice(newMintPrice);
			expect(await kami1155C.mintPrice()).to.equal(newMintPrice);
		});

		it('should not allow non-owners to set mint price', async function () {
			const newMintPrice = ethers.parseUnits('150', 6);
			await expect(kami1155C.connect(buyer).setMintPrice(newMintPrice)).to.be.revertedWith('Caller is not an owner');
		});

		it('should set base URI', async function () {
			const newBaseURI = 'https://new.api.kami.example/metadata/';
			await kami1155C.setBaseURI(newBaseURI);

			// Mint a token to check URI
			await kami1155C.connect(buyer).mint(1);

			expect(await kami1155C.uri(0)).to.equal(newBaseURI + '0');
		});
	});

	describe('Royalties', function () {
		beforeEach(async function () {
			const signers = await ethers.getSigners();
			// Assign unique addresses for each role
			owner = signers[0];
			platform = signers[1];
			buyer = signers[2];
			user1 = signers[3];
			user2 = signers[4];
			user3 = signers[5];
			royaltyReceiver = signers[6];

			// Deploy mock payment token
			const MockERC20Factory = await ethers.getContractFactory('MockERC20');
			paymentToken = await MockERC20Factory.deploy('Mock USDC', 'USDC', 6);

			// Deploy the contract using the hardhat-upgrades plugin
			const KAMI1155CUpgradeableFactory = await ethers.getContractFactory('KAMI1155CUpgradeable');
			const contractInstance = await upgrades.deployProxy(
				KAMI1155CUpgradeableFactory,
				[await paymentToken.getAddress(), NAME, SYMBOL, BASE_URI, MINT_PRICE, platform.address, PLATFORM_COMMISSION],
				{
					initializer: 'initialize',
					kind: 'transparent',
				}
			);
			kami1155C = contractInstance as unknown as KAMI1155CUpgradeable;

			// Set up basic royalty configuration
			await kami1155C.setRoyaltyPercentage(1000); // 10%

			// Mint payment tokens to royalty receivers for testing
			await paymentToken.mint(royaltyReceiver.address, ethers.parseUnits('1000', 6));

			// Mint payment tokens to buyer for minting/transfer
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(await kami1155C.getAddress(), ethers.parseUnits('1000', 6));
		});

		it('should set and get royalty percentage', async function () {
			const newRoyaltyPercentage = 1500; // 15%
			await kami1155C.setRoyaltyPercentage(newRoyaltyPercentage);
			expect(await kami1155C.royaltyPercentage()).to.equal(newRoyaltyPercentage);
		});

		it('should set and get mint royalties', async function () {
			// Note: feeNumerator values must total 100%
			const royaltyData = [
				{
					receiver: royaltyReceiver.address,
					feeNumerator: 10000, // 100% of royalties
				},
			];

			await kami1155C.setMintRoyalties(royaltyData);

			const mintRoyaltyReceivers = await kami1155C.getMintRoyaltyReceivers(0);
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

			await kami1155C.setTransferRoyalties(royaltyData);

			const transferRoyaltyReceivers = await kami1155C.getTransferRoyaltyReceivers(0);
			expect(transferRoyaltyReceivers.length).to.equal(1);
			expect(transferRoyaltyReceivers[0].receiver).to.equal(royaltyReceiver.address);
			expect(transferRoyaltyReceivers[0].feeNumerator).to.equal(10000);
		});
	});

	describe('Royalty Calculation Tests', function () {
		let testBuyer: SignerWithAddress;
		let royaltyReceiver1: SignerWithAddress;
		let royaltyReceiver2: SignerWithAddress;
		let royaltyReceiver3: SignerWithAddress;
		let platform: SignerWithAddress;
		let owner: SignerWithAddress;
		let localPaymentToken: any;
		let localKami1155C: any;

		beforeEach(async function () {
			try {
				[owner, testBuyer, royaltyReceiver1, royaltyReceiver2, royaltyReceiver3, platform] = await ethers.getSigners();

				// console.log('Deploying MockERC20...');
				const MockERC20Factory = await ethers.getContractFactory('MockERC20');
				localPaymentToken = await MockERC20Factory.deploy('Mock USDC', 'USDC', 6);
				await localPaymentToken.waitForDeployment();
				// console.log('MockERC20 deployed at:', await localPaymentToken.getAddress());

				// console.log('Deploying KAMI1155CUpgradeable...');
				const KAMI1155CUpgradeable = await ethers.getContractFactory('KAMI1155CUpgradeable');
				localKami1155C = await upgrades.deployProxy(KAMI1155CUpgradeable, [
					await localPaymentToken.getAddress(),
					'KAMI1155C',
					'K1155C',
					BASE_URI,
					MINT_PRICE,
					platform.address,
					PLATFORM_COMMISSION,
				]);
				await localKami1155C.waitForDeployment();
				// console.log('KAMI1155CUpgradeable deployed at:', await localKami1155C.getAddress());

				// Log addresses for debugging
				// console.log('owner:', owner?.address);
				// console.log('testBuyer:', testBuyer?.address);
				// console.log('royaltyReceiver1:', royaltyReceiver1?.address);
				// console.log('royaltyReceiver2:', royaltyReceiver2?.address);
				// console.log('royaltyReceiver3:', royaltyReceiver3?.address);
				// console.log('platform:', platform?.address);
				// console.log('localPaymentToken:', await localPaymentToken?.getAddress());
				// console.log('localKami1155C:', await localKami1155C?.getAddress());

				await localKami1155C.setRoyaltyPercentage(1000); // 10%

				await localPaymentToken.mint(royaltyReceiver1.address, ethers.parseUnits('1000', 6));
				await localPaymentToken.mint(royaltyReceiver2.address, ethers.parseUnits('1000', 6));
				await localPaymentToken.mint(royaltyReceiver3.address, ethers.parseUnits('1000', 6));

				await localPaymentToken.mint(testBuyer.address, ethers.parseUnits('200000', 6));
				await localPaymentToken.connect(testBuyer).approve(await localKami1155C.getAddress(), ethers.MaxUint256);

				await localKami1155C.connect(testBuyer).mint(1000);
				await localKami1155C.connect(testBuyer).mint(500);

				await localKami1155C.connect(testBuyer).setApprovalForAll(await localKami1155C.getAddress(), true);
			} catch (error) {
				console.error('Error in beforeEach:', error);
				throw error;
			}
		});

		const createRoyaltyInfo = (address: string, feeNumerator: number) => {
			return {
				receiver: address,
				feeNumerator: feeNumerator,
			};
		};

		describe('Mint Royalty Calculations', function () {
			it('should calculate mint royalties correctly with single receiver', async function () {
				// Set mint royalties to 100% to one receiver (platform commission is handled separately)
				const mintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await localKami1155C.setMintRoyalties(mintRoyalties);

				// Record initial balances
				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// Mint a token
				await localKami1155C.connect(testBuyer).mint(1);

				const r1BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const platformBalanceAfter = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// Calculate expected changes
				const platformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
				const remainingForRoyalties = MINT_PRICE - platformCommission;

				// Assert on balance changes
				expect(r1BalanceAfter - r1BalanceBefore).to.equal(remainingForRoyalties);
				expect(platformBalanceAfter - platformBalanceBefore).to.equal(platformCommission);
			});

			it('should handle token-specific mint royalties correctly', async function () {
				// console.log('=== TOKEN-SPECIFIC MINT ROYALTIES DEBUG ===');

				// Check current token ID counter before minting
				try {
					const currentTokenId = await localKami1155C.nextTokenId();
					// console.log('Current token ID counter:', currentTokenId.toString());
				} catch (error) {
					// console.log('Error getting token ID counter:', error.message);
				}

				// Determine the next tokenId to be minted
				const nextTokenId = await localKami1155C.nextTokenId();
				// Set token-specific royalties for the next tokenId
				const tokenSpecificMintRoyalties = [
					createRoyaltyInfo(royaltyReceiver2.address, 10000), // 100%
				];
				await localKami1155C.setTokenMintRoyalties(nextTokenId, tokenSpecificMintRoyalties);

				// Debug: Check if the royalties were set correctly
				try {
					const tokenMintRoyalties = await localKami1155C.getMintRoyaltyReceivers(nextTokenId);
					// console.log('Token mint royalties after setting:', tokenMintRoyalties);
				} catch (error) {
					// console.log('Error getting token mint royalties:', error.message);
				}

				// Debug: Check global mint royalties
				try {
					const globalMintRoyalties = await localKami1155C.getMintRoyaltyReceivers(nextTokenId);
					// console.log('Global mint royalties for token:', globalMintRoyalties);
				} catch (error) {
					// console.log('Error getting global mint royalties:', error.message);
				}

				const r2BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// console.log('Balance before mint:');
				// console.log('  Royalty receiver 2:', r2BalanceBefore.toString());
				// console.log('  Platform:', platformBalanceBefore.toString());

				// Mint token 0
				await localPaymentToken.connect(testBuyer).approve(localKami1155C.getAddress(), MINT_PRICE);
				const mintTx = await localKami1155C.connect(testBuyer).mint(1);
				const mintReceipt = await mintTx.wait();

				// Fetch and print DebugMintRoyalties and DebugRoyaltyDistributed events
				const debugMintEvents = mintReceipt.logs
					.map((log) => {
						try {
							return localKami1155C.interface.parseLog(log);
						} catch {
							return null;
						}
					})
					.filter((e) => e && (e.name === 'DebugMintRoyalties' || e.name === 'DebugRoyaltyDistributed'));
				// console.log('--- DebugMintRoyalties/DebugRoyaltyDistributed events ---');
				// for (const e of debugMintEvents) {
				// 	console.log(e.name, e.args);
				// }

				const r2BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceAfter = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// console.log('Balance after mint:');
				// console.log('  Royalty receiver 2:', r2BalanceAfter.toString());
				// console.log('  Platform:', platformBalanceAfter.toString());
				// console.log('  Royalty receiver 2 change:', (r2BalanceAfter - r2BalanceBefore).toString());
				// console.log('  Platform change:', (platformBalanceAfter - platformBalanceBefore).toString());

				const platformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
				const remainingForRoyalties = MINT_PRICE - platformCommission;
				const royaltyAmount = remainingForRoyalties;

				// console.log('Expected amounts:');
				// console.log('  Platform commission:', platformCommission.toString());
				// console.log('  Remaining for royalties:', remainingForRoyalties.toString());
				// console.log('  Expected royalty amount:', royaltyAmount.toString());

				expect(r2BalanceAfter - r2BalanceBefore).to.equal(royaltyAmount);
				expect(platformBalanceAfter - platformBalanceBefore).to.equal(platformCommission);
			});

			it('should calculate mint royalties correctly with multiple receivers', async function () {
				const mintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 6000), // 60%
					createRoyaltyInfo(royaltyReceiver2.address, 4000), // 40%
				];
				await localKami1155C.setMintRoyalties(mintRoyalties);

				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				await localKami1155C.connect(testBuyer).mint(1);

				const r1BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceAfter = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				const platformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
				const remainingForRoyalties = MINT_PRICE - platformCommission;
				const r1Amount = (remainingForRoyalties * 6000n) / 10000n;
				const r2Amount = (remainingForRoyalties * 4000n) / 10000n;
				const totalDistributed = r1Amount + r2Amount;
				const dust = remainingForRoyalties - totalDistributed;

				expect(r1BalanceAfter - r1BalanceBefore).to.equal(r1Amount + dust);
				expect(r2BalanceAfter - r2BalanceBefore).to.equal(r2Amount);
				expect(platformBalanceAfter - platformBalanceBefore).to.equal(platformCommission);
			});

			it('should handle edge case with very small amounts', async function () {
				// Set up transfer royalties for the specific token
				const transferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 7000), // 70%
					createRoyaltyInfo(royaltyReceiver2.address, 3000), // 30%
				];
				await localKami1155C.setTransferRoyalties(transferRoyalties);

				const smallSalePrice = ethers.parseUnits('0.1', 6); // 0.1 payment tokens (larger than 0.001)
				const totalRoyaltyAmount = (smallSalePrice * BigInt(1000)) / BigInt(10000); // 10% = 0.01 payment tokens
				const platformCommission = (smallSalePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5% = 0.005 payment tokens
				const totalRequired = totalRoyaltyAmount + platformCommission; // 0.015 payment tokens total

				// Mint and approve the full sale price to the buyer (royaltyReceiver3)
				await localPaymentToken.mint(royaltyReceiver3.address, smallSalePrice);
				await localPaymentToken.connect(royaltyReceiver3).approve(await localKami1155C.getAddress(), smallSalePrice);

				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// Use the correct transfer flow
				await localKami1155C.connect(testBuyer).initiateTransferWithRoyalty(royaltyReceiver3.address, 0, smallSalePrice);
				await localKami1155C
					.connect(royaltyReceiver3)
					.payTransferRoyalty(testBuyer.address, royaltyReceiver3.address, 0, smallSalePrice);
				await localKami1155C.connect(testBuyer).safeTransferFrom(testBuyer.address, royaltyReceiver3.address, 0, 1, '0x');

				// Calculate expected amounts
				const r1Amount = (totalRoyaltyAmount * BigInt(7000)) / BigInt(10000);
				const r2Amount = (totalRoyaltyAmount * BigInt(3000)) / BigInt(10000);
				const totalDistributed = r1Amount + r2Amount;
				const dust = totalRoyaltyAmount - totalDistributed;

				const r1BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceAfter = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// console.log('=== EDGE CASE DEBUG ===');
				// console.log('Small sale price:', smallSalePrice.toString());
				// console.log('Total royalty amount:', totalRoyaltyAmount.toString());
				// console.log('Platform commission:', platformCommission.toString());
				// console.log('R1 amount:', r1Amount.toString());
				// console.log('R2 amount:', r2Amount.toString());
				// console.log('Dust:', dust.toString());
				// console.log('R1 balance before:', r1BalanceBefore.toString());
				// console.log('R1 balance after:', r1BalanceAfter.toString());
				// console.log('R1 balance change:', (r1BalanceAfter - r1BalanceBefore).toString());
				// console.log('Expected R1 change:', (r1Amount + dust).toString());

				expect(await localPaymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + r1Amount + dust);
				expect(await localPaymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + r2Amount);
				expect(await localPaymentToken.balanceOf(await localKami1155C.platformAddress())).to.equal(
					platformBalanceBefore + platformCommission
				);
			});

			it('should debug mint process step by step', async function () {
				// Set mint royalties to 100% to one receiver
				const mintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await localKami1155C.setMintRoyalties(mintRoyalties);

				const contractAddress = await localKami1155C.getAddress();
				const buyerAddress = testBuyer.address;
				const platformAddress = platform.address;

				// console.log('=== STEP-BY-STEP DEBUG ===');
				// console.log('Contract address:', contractAddress);
				// console.log('Buyer address:', buyerAddress);
				// console.log('Platform address:', platformAddress);
				// console.log('Royalty receiver address:', royaltyReceiver1.address);

				// Check initial balances
				const buyerBalanceBefore = await localPaymentToken.balanceOf(buyerAddress);
				const contractBalanceBefore = await localPaymentToken.balanceOf(contractAddress);
				const platformBalanceBefore = await localPaymentToken.balanceOf(platformAddress);
				const royaltyBalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);

				// console.log('Initial balances:');
				// console.log('  Buyer:', buyerBalanceBefore.toString());
				// console.log('  Contract:', contractBalanceBefore.toString());
				// console.log('  Platform:', platformBalanceBefore.toString());
				// console.log('  Royalty Receiver:', royaltyBalanceBefore.toString());

				// Simulate the safeTransferFrom call
				// console.log('\nSimulating safeTransferFrom...');
				await localPaymentToken.connect(testBuyer).approve(contractAddress, MINT_PRICE);
				await localPaymentToken.connect(testBuyer).transfer(contractAddress, MINT_PRICE);

				const buyerBalanceAfterTransfer = await localPaymentToken.balanceOf(buyerAddress);
				const contractBalanceAfterTransfer = await localPaymentToken.balanceOf(contractAddress);

				// console.log('After transfer:');
				// console.log('  Buyer:', buyerBalanceAfterTransfer.toString());
				// console.log('  Contract:', contractBalanceAfterTransfer.toString());
				// console.log('  Contract should have:', MINT_PRICE.toString());

				// Now simulate the distributeMintRoyalties call
				// console.log('\nSimulating distributeMintRoyalties...');
				await localKami1155C.connect(testBuyer).mint(1);

				const buyerBalanceFinal = await localPaymentToken.balanceOf(buyerAddress);
				const contractBalanceFinal = await localPaymentToken.balanceOf(contractAddress);
				const platformBalanceFinal = await localPaymentToken.balanceOf(platformAddress);
				const royaltyBalanceFinal = await localPaymentToken.balanceOf(royaltyReceiver1.address);

				// console.log('Final balances:');
				// console.log('  Buyer:', buyerBalanceFinal.toString());
				// console.log('  Contract:', contractBalanceFinal.toString());
				// console.log('  Platform:', platformBalanceFinal.toString());
				// console.log('  Royalty Receiver:', royaltyBalanceFinal.toString());

				// console.log('Balance changes:');
				// console.log('  Buyer change:', (buyerBalanceFinal - buyerBalanceBefore).toString());
				// console.log('  Contract change:', (contractBalanceFinal - contractBalanceBefore).toString());
				// console.log('  Platform change:', (platformBalanceFinal - platformBalanceBefore).toString());
				// console.log('  Royalty Receiver change:', (royaltyBalanceFinal - royaltyBalanceBefore).toString());

				// Calculate expected amounts
				const platformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
				const remainingForRoyalties = MINT_PRICE - platformCommission;
				const royaltyAmount = remainingForRoyalties;

				// console.log('Expected amounts:');
				// console.log('  Platform commission:', platformCommission.toString());
				// console.log('  Remaining for royalties:', remainingForRoyalties.toString());
				// console.log('  Royalty amount:', royaltyAmount.toString());

				// Verify the contract received the full amount
				expect(contractBalanceAfterTransfer).to.equal(MINT_PRICE);
			});

			it('should verify platform commission transfer', async function () {
				// Set mint royalties to 100% to one receiver
				const mintRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await localKami1155C.setMintRoyalties(mintRoyalties);

				const contractAddress = await localKami1155C.getAddress();
				const contractPlatformAddress = await localKami1155C.platformAddress();

				// console.log('=== PLATFORM COMMISSION DEBUG ===');
				// console.log('Platform address from contract:', contractPlatformAddress);
				// console.log('Platform address from test:', platform.address);
				// console.log('Are they equal?', contractPlatformAddress === platform.address);

				// Check initial balances
				const contractBalanceBefore = await localPaymentToken.balanceOf(contractAddress);
				const platformBalanceBefore = await localPaymentToken.balanceOf(contractPlatformAddress);

				// console.log('Initial balances:');
				// console.log('  Contract:', contractBalanceBefore.toString());
				// console.log('  Platform:', platformBalanceBefore.toString());

				// Mint a token
				await localKami1155C.connect(testBuyer).mint(1);

				// Check final balances
				const contractBalanceAfter = await localPaymentToken.balanceOf(contractAddress);
				const platformBalanceAfter = await localPaymentToken.balanceOf(contractPlatformAddress);

				// console.log('Final balances:');
				// console.log('  Contract:', contractBalanceAfter.toString());
				// console.log('  Platform:', platformBalanceAfter.toString());

				// console.log('Balance changes:');
				// console.log('  Contract change:', (contractBalanceAfter - contractBalanceBefore).toString());
				// console.log('  Platform change:', (platformBalanceAfter - platformBalanceBefore).toString());

				// Calculate expected platform commission
				const expectedPlatformCommission = (MINT_PRICE * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
				// console.log('Expected platform commission:', expectedPlatformCommission.toString());

				// The contract should not retain the platform commission
				expect(platformBalanceAfter).to.equal(platformBalanceBefore + expectedPlatformCommission);
				// The contract balance should be zero
				expect(contractBalanceAfter).to.equal(0);
			});
		});

		describe('Transfer Royalty Calculations', function () {
			beforeEach(async function () {
				// Set up transfer royalties
				const transferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 7000), // 70%
					createRoyaltyInfo(royaltyReceiver2.address, 3000), // 30%
				];
				await localKami1155C.setTransferRoyalties(transferRoyalties);

				// Mint a token for testing - ensure testBuyer owns the token
				await localPaymentToken.mint(testBuyer.address, MINT_PRICE);
				await localPaymentToken.connect(testBuyer).approve(await localKami1155C.getAddress(), MINT_PRICE);
				await localKami1155C.connect(testBuyer).mint(1);
			});

			it('should calculate transfer royalties correctly with single receiver', async function () {
				const singleTransferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await localKami1155C.setTransferRoyalties(singleTransferRoyalties);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const totalRoyaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 10 payment tokens
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5% = 5 payment tokens
				const totalRequired = totalRoyaltyAmount + platformCommission; // 15 payment tokens total

				// Mint and approve the full sale price to the buyer (royaltyReceiver3)
				await localPaymentToken.mint(royaltyReceiver3.address, salePrice);
				await localPaymentToken.connect(royaltyReceiver3).approve(await localKami1155C.getAddress(), salePrice);

				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				await localKami1155C.connect(testBuyer).initiateTransferWithRoyalty(royaltyReceiver3.address, 0, salePrice);
				await localKami1155C
					.connect(royaltyReceiver3)
					.payTransferRoyalty(testBuyer.address, royaltyReceiver3.address, 0, salePrice);
				await localKami1155C.connect(testBuyer).safeTransferFrom(testBuyer.address, royaltyReceiver3.address, 0, 1, '0x');

				const r1BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const platformBalanceAfter = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				expect(r1BalanceAfter - r1BalanceBefore).to.equal(totalRoyaltyAmount);
				expect(platformBalanceAfter - platformBalanceBefore).to.equal(platformCommission);
			});

			it('should calculate transfer royalties correctly with multiple receivers', async function () {
				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const totalRoyaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 10 payment tokens
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5% = 5 payment tokens
				const totalRequired = totalRoyaltyAmount + platformCommission; // 15 payment tokens total

				// Mint and approve the full sale price to the buyer (royaltyReceiver3)
				await localPaymentToken.mint(royaltyReceiver3.address, salePrice);
				await localPaymentToken.connect(royaltyReceiver3).approve(await localKami1155C.getAddress(), salePrice);

				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				await localKami1155C.connect(testBuyer).initiateTransferWithRoyalty(royaltyReceiver3.address, 0, salePrice);
				await localKami1155C
					.connect(royaltyReceiver3)
					.payTransferRoyalty(testBuyer.address, royaltyReceiver3.address, 0, salePrice);
				await localKami1155C.connect(testBuyer).safeTransferFrom(testBuyer.address, royaltyReceiver3.address, 0, 1, '0x');

				const r1BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceAfter = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceAfter = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				const r1Amount = (totalRoyaltyAmount * BigInt(7000)) / BigInt(10000);
				const r2Amount = (totalRoyaltyAmount * BigInt(3000)) / BigInt(10000);
				const totalDistributed = r1Amount + r2Amount;
				const dust = totalRoyaltyAmount - totalDistributed;

				expect(r1BalanceAfter - r1BalanceBefore).to.equal(r1Amount + dust);
				expect(r2BalanceAfter - r2BalanceBefore).to.equal(r2Amount);
				expect(platformBalanceAfter - platformBalanceBefore).to.equal(platformCommission);
			});

			it('should handle token-specific transfer royalties correctly', async function () {
				// Set token-specific transfer royalties for token 0
				const tokenSpecificTransferRoyalties = [
					createRoyaltyInfo(royaltyReceiver2.address, 8000), // 80%
					createRoyaltyInfo(royaltyReceiver3.address, 2000), // 20%
				];
				await localKami1155C.setTokenTransferRoyalties(0, tokenSpecificTransferRoyalties);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const totalRoyaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 10 payment tokens
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5% = 5 payment tokens
				const totalRequired = totalRoyaltyAmount + platformCommission; // 15 payment tokens total

				// Mint and approve the full sale price to the buyer (use a different address for buyer)
				const buyer = (await ethers.getSigners())[7]; // Use a different signer for buyer
				await localPaymentToken.mint(buyer.address, salePrice);
				await localPaymentToken.connect(buyer).approve(await localKami1155C.getAddress(), salePrice);

				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const r3BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver3.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// Use the correct transfer flow
				await localKami1155C.connect(testBuyer).initiateTransferWithRoyalty(buyer.address, 0, salePrice);
				await localKami1155C.connect(buyer).payTransferRoyalty(testBuyer.address, buyer.address, 0, salePrice);
				await localKami1155C.connect(testBuyer).safeTransferFrom(testBuyer.address, buyer.address, 0, 1, '0x');

				// Calculate expected amounts with new logic
				const royalty2Amount = (totalRoyaltyAmount * BigInt(8000)) / BigInt(10000); // 80% = 8 payment tokens
				const royalty3Amount = (totalRoyaltyAmount * BigInt(2000)) / BigInt(10000); // 20% = 2 payment tokens
				const totalDistributed = royalty2Amount + royalty3Amount;
				const dust = totalRoyaltyAmount - totalDistributed; // Any rounding dust
				// Dust goes to the first royalty receiver (royaltyReceiver2 in this case)

				// Verify token-specific royalties were used - royalty receivers get the full royalty amount
				expect(await localPaymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore); // Unchanged
				expect(await localPaymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + royalty2Amount + dust);
				expect(await localPaymentToken.balanceOf(royaltyReceiver3.address)).to.equal(r3BalanceBefore + royalty3Amount);
				expect(await localPaymentToken.balanceOf(await localKami1155C.platformAddress())).to.equal(
					platformBalanceBefore + platformCommission
				);
			});

			it('should handle different royalty percentages correctly', async function () {
				// Change royalty percentage to 15%
				await localKami1155C.setRoyaltyPercentage(1500); // 15%

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const totalRoyaltyAmount = (salePrice * BigInt(1500)) / BigInt(10000); // 15% = 15 payment tokens
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5% = 5 payment tokens
				const totalRequired = totalRoyaltyAmount + platformCommission; // 20 payment tokens total

				// Mint and approve the full sale price to the buyer (royaltyReceiver3)
				await localPaymentToken.mint(royaltyReceiver3.address, salePrice);
				await localPaymentToken.connect(royaltyReceiver3).approve(await localKami1155C.getAddress(), salePrice);

				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// Use the correct transfer flow
				await localKami1155C.connect(testBuyer).initiateTransferWithRoyalty(royaltyReceiver3.address, 0, salePrice);
				await localKami1155C
					.connect(royaltyReceiver3)
					.payTransferRoyalty(testBuyer.address, royaltyReceiver3.address, 0, salePrice);
				await localKami1155C.connect(testBuyer).safeTransferFrom(testBuyer.address, royaltyReceiver3.address, 0, 1, '0x');

				// Calculate expected amounts with 15% royalty
				const r1Amount = (totalRoyaltyAmount * BigInt(7000)) / BigInt(10000); // 70% = 10.5 payment tokens
				const r2Amount = (totalRoyaltyAmount * BigInt(3000)) / BigInt(10000); // 30% = 4.5 payment tokens
				const totalDistributed = r1Amount + r2Amount;
				const dust = totalRoyaltyAmount - totalDistributed; // Any rounding dust

				expect(await localPaymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore + r1Amount + dust);
				expect(await localPaymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore + r2Amount);
				expect(await localPaymentToken.balanceOf(await localKami1155C.platformAddress())).to.equal(
					platformBalanceBefore + platformCommission
				);
			});

			it('should handle zero royalty percentage correctly', async function () {
				// Set royalty percentage to 0%
				await localKami1155C.setRoyaltyPercentage(0);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const totalRoyaltyAmount = (salePrice * BigInt(0)) / BigInt(10000); // 0% = 0 payment tokens
				const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5% = 5 payment tokens
				const totalRequired = totalRoyaltyAmount + platformCommission; // 5 payment tokens total

				// Mint and approve the full sale price to the buyer (royaltyReceiver3)
				await localPaymentToken.mint(royaltyReceiver3.address, salePrice);
				await localPaymentToken.connect(royaltyReceiver3).approve(await localKami1155C.getAddress(), salePrice);

				const r1BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver1.address);
				const r2BalanceBefore = await localPaymentToken.balanceOf(royaltyReceiver2.address);
				const platformBalanceBefore = await localPaymentToken.balanceOf(await localKami1155C.platformAddress());

				// Use the correct transfer flow
				await localKami1155C.connect(testBuyer).initiateTransferWithRoyalty(royaltyReceiver3.address, 0, salePrice);
				await localKami1155C
					.connect(royaltyReceiver3)
					.payTransferRoyalty(testBuyer.address, royaltyReceiver3.address, 0, salePrice);
				await localKami1155C.connect(testBuyer).safeTransferFrom(testBuyer.address, royaltyReceiver3.address, 0, 1, '0x');

				// With 0% royalty, no royalties should be distributed
				expect(await localPaymentToken.balanceOf(royaltyReceiver1.address)).to.equal(r1BalanceBefore);
				expect(await localPaymentToken.balanceOf(royaltyReceiver2.address)).to.equal(r2BalanceBefore);
				expect(await localPaymentToken.balanceOf(await localKami1155C.platformAddress())).to.equal(
					platformBalanceBefore + platformCommission
				);
			});

			it('should verify transfer royalty receiver configuration', async function () {
				const transferRoyaltyReceivers = await localKami1155C.getTransferRoyaltyReceivers(0);
				expect(transferRoyaltyReceivers.length).to.equal(2);
				expect(transferRoyaltyReceivers[0].receiver).to.equal(royaltyReceiver1.address);
				expect(transferRoyaltyReceivers[0].feeNumerator).to.equal(7000);
				expect(transferRoyaltyReceivers[1].receiver).to.equal(royaltyReceiver2.address);
				expect(transferRoyaltyReceivers[1].feeNumerator).to.equal(3000);
			});
		});

		describe('Royalty Info Retrieval', function () {
			it('should return correct royalty info for ERC2981', async function () {
				// Set transfer royalties
				const transferRoyalties = [
					createRoyaltyInfo(royaltyReceiver1.address, 10000), // 100%
				];
				await localKami1155C.setTransferRoyalties(transferRoyalties);

				// Mint a token
				await localKami1155C.connect(testBuyer).mint(1);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const [receiver, royaltyAmount] = await localKami1155C.royaltyInfo(0, salePrice);

				// Calculate expected royalty amount
				const expectedRoyaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 10 payment tokens

				expect(receiver).to.equal(royaltyReceiver1.address);
				expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
			});

			it('should return zero royalty for non-existent tokens', async function () {
				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const [receiver, royaltyAmount] = await localKami1155C.royaltyInfo(999, salePrice);

				expect(receiver).to.equal(ethers.ZeroAddress);
				expect(royaltyAmount).to.equal(0);
			});

			it('should return correct royalty info with token-specific receivers', async function () {
				// Mint a token first
				await localKami1155C.connect(testBuyer).mint(1);

				// Set token-specific transfer royalties
				const tokenSpecificTransferRoyalties = [
					createRoyaltyInfo(royaltyReceiver2.address, 10000), // 100%
				];
				await localKami1155C.setTokenTransferRoyalties(0, tokenSpecificTransferRoyalties);

				const salePrice = ethers.parseUnits('100', 6); // 100 payment tokens
				const [receiver, royaltyAmount] = await localKami1155C.royaltyInfo(0, salePrice);

				// Calculate expected royalty amount
				const expectedRoyaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 10 payment tokens

				expect(receiver).to.equal(royaltyReceiver2.address);
				expect(royaltyAmount).to.equal(expectedRoyaltyAmount);
			});
		});
	});

	describe('Selling & Transfers', function () {
		beforeEach(async function () {
			const signers = await ethers.getSigners();
			// Assign unique addresses for each role
			owner = signers[0];
			platform = signers[1];
			buyer = signers[2];
			user1 = signers[3];
			user2 = signers[4];
			user3 = signers[5];
			royaltyReceiver = signers[6];

			// Deploy mock payment token
			const MockERC20Factory = await ethers.getContractFactory('MockERC20');
			paymentToken = await MockERC20Factory.deploy('Mock USDC', 'USDC', 6);

			// Deploy the contract using the hardhat-upgrades plugin
			const KAMI1155CUpgradeableFactory = await ethers.getContractFactory('KAMI1155CUpgradeable');
			const contractInstance = await upgrades.deployProxy(
				KAMI1155CUpgradeableFactory,
				[await paymentToken.getAddress(), NAME, SYMBOL, BASE_URI, MINT_PRICE, platform.address, PLATFORM_COMMISSION],
				{
					initializer: 'initialize',
					kind: 'transparent',
				}
			);
			kami1155C = contractInstance as unknown as KAMI1155CUpgradeable;

			// Set up basic royalty configuration
			await kami1155C.setRoyaltyPercentage(1000); // 10%

			// Mint payment tokens to royalty receivers for testing
			await paymentToken.mint(royaltyReceiver.address, ethers.parseUnits('1000', 6));

			// Mint payment tokens to buyer for minting/transfer
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(await kami1155C.getAddress(), ethers.parseUnits('1000', 6));

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

			await kami1155C.setMintRoyalties(mintRoyaltyData);
			await kami1155C.setTransferRoyalties(transferRoyaltyData);

			// Mint a token for the owner
			await paymentToken.mint(owner.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(owner).approve(await kami1155C.getAddress(), ethers.parseUnits('1000', 6));
			await kami1155C.connect(owner).mint(1);
		});

		it('should sell a token with royalties', async function () {
			const tokenId = 0;
			const salePrice = ethers.parseUnits('200', 6);

			const initialOwnerBalance = await paymentToken.balanceOf(owner.address);
			const initialBuyerBalance = await paymentToken.balanceOf(buyer.address);
			const contractPlatformAddress = await kami1155C.platformAddress();
			const initialPlatformBalance = await paymentToken.balanceOf(contractPlatformAddress);
			const initialRoyaltyReceiverBalance = await paymentToken.balanceOf(royaltyReceiver.address);

			// Approve the contract to transfer the token (ERC1155 uses setApprovalForAll)
			await kami1155C.connect(owner).setApprovalForAll(await kami1155C.getAddress(), true);

			// Sell the token
			await kami1155C.connect(owner).sellToken(buyer.address, tokenId, 1, salePrice);

			// Check token ownership
			expect(await kami1155C.balanceOf(buyer.address, tokenId)).to.equal(1);

			// Calculate expected distribution with new logic
			const royaltyAmount = (salePrice * BigInt(1000)) / BigInt(10000); // 10% = 20 USDC
			const platformCommission = (salePrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000); // 5% = 10 USDC
			const sellerProceeds = salePrice - royaltyAmount - platformCommission; // 200 - 20 - 10 = 170 USDC

			// Check payment token balances
			expect(await paymentToken.balanceOf(buyer.address)).to.equal(initialBuyerBalance - salePrice);
			expect(await paymentToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + sellerProceeds);
			expect(await paymentToken.balanceOf(contractPlatformAddress)).to.equal(initialPlatformBalance + platformCommission);
			expect(await paymentToken.balanceOf(royaltyReceiver.address)).to.equal(initialRoyaltyReceiverBalance + royaltyAmount);
		});

		it('should allow users to rent their own tokens (ERC1155)', async function () {
			// Mint a token to user1 directly (this will be tokenId 1 since 0 was already used)
			await paymentToken.mint(user1.address, MINT_PRICE);
			await paymentToken.connect(user1).approve(await kami1155C.getAddress(), MINT_PRICE);
			await kami1155C.connect(user1).mint(1);

			// Record initial balances
			const contractPlatformAddress = await kami1155C.platformAddress();
			const platformBalanceBefore = await paymentToken.balanceOf(contractPlatformAddress);

			// User1 rents their own token (should work for ERC1155)
			const rentalPrice = ethers.parseUnits('10', 6);
			const rentalDuration = 86400; // 1 day

			// Ensure user1 has enough tokens for rental and approve spending
			await paymentToken.mint(user1.address, rentalPrice);
			await paymentToken.connect(user1).approve(await kami1155C.getAddress(), rentalPrice);

			// Record balance after minting and before rental
			const initialUserBalance = await paymentToken.balanceOf(user1.address);

			// Perform the rental
			await kami1155C.connect(user1).rentToken(1, rentalDuration, rentalPrice); // Use tokenId 1

			// Check rental status
			expect(await kami1155C.isRented(1)).to.be.true;

			// Calculate expected platform commission
			const platformCommission = (rentalPrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
			const expectedUserBalanceChange = -platformCommission; // User pays only the commission

			// Check balances
			expect(await paymentToken.balanceOf(user1.address)).to.equal(initialUserBalance - platformCommission);
			expect(await paymentToken.balanceOf(contractPlatformAddress)).to.equal(platformBalanceBefore + platformCommission);
		});
	});

	describe('Rental Functionality', function () {
		let tokenId = 0;
		const rentalPrice = ethers.parseUnits('50', 6);
		const rentalDuration = 86400; // 1 day in seconds

		beforeEach(async function () {
			const signers = await ethers.getSigners();
			// Assign unique addresses for each role
			owner = signers[0];
			platform = signers[1];
			buyer = signers[2];
			user1 = signers[3];
			user2 = signers[4];
			user3 = signers[5];
			royaltyReceiver = signers[6];

			// Deploy mock payment token
			const MockERC20Factory = await ethers.getContractFactory('MockERC20');
			paymentToken = await MockERC20Factory.deploy('Mock USDC', 'USDC', 6);

			// Deploy the contract using the hardhat-upgrades plugin
			const KAMI1155CUpgradeableFactory = await ethers.getContractFactory('KAMI1155CUpgradeable');
			const contractInstance = await upgrades.deployProxy(
				KAMI1155CUpgradeableFactory,
				[await paymentToken.getAddress(), NAME, SYMBOL, BASE_URI, MINT_PRICE, platform.address, PLATFORM_COMMISSION],
				{
					initializer: 'initialize',
					kind: 'transparent',
				}
			);
			kami1155C = contractInstance as unknown as KAMI1155CUpgradeable;

			// Set up basic royalty configuration
			await kami1155C.setRoyaltyPercentage(1000); // 10%

			// Mint payment tokens to royalty receivers for testing
			await paymentToken.mint(royaltyReceiver.address, ethers.parseUnits('1000', 6));

			// Mint payment tokens to buyer for minting/transfer
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(await kami1155C.getAddress(), ethers.parseUnits('1000', 6));

			// Mint a token for the owner
			await paymentToken.mint(owner.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(owner).approve(await kami1155C.getAddress(), ethers.parseUnits('1000', 6));
			await kami1155C.connect(owner).mint(1);
			tokenId = 0;
		});

		it('should rent a token', async function () {
			// Transfer the token from owner to user1 so user1 can rent it
			await kami1155C.connect(owner).safeTransferFrom(owner.address, user1.address, tokenId, 1, '0x');

			const rentalDuration = 86400; // 1 day
			const rentalPrice = ethers.parseUnits('10', 6);

			// Ensure user1 has enough tokens for rental and approve spending
			await paymentToken.mint(user1.address, rentalPrice);
			await paymentToken.connect(user1).approve(await kami1155C.getAddress(), rentalPrice);

			const initialRenterBalance = await paymentToken.balanceOf(user1.address);
			const contractPlatformAddress = await kami1155C.platformAddress();
			const initialPlatformBalance = await paymentToken.balanceOf(contractPlatformAddress);

			// Rent the token
			await kami1155C.connect(user1).rentToken(tokenId, rentalDuration, rentalPrice);

			// Check rental status
			expect(await kami1155C.isRented(tokenId)).to.be.true;

			// Calculate expected platform commission
			const platformCommission = (rentalPrice * BigInt(PLATFORM_COMMISSION)) / BigInt(10000);
			const expectedUserBalanceChange = -platformCommission; // User pays only the commission

			// Check balances
			expect(await paymentToken.balanceOf(user1.address)).to.equal(initialRenterBalance + expectedUserBalanceChange);
			expect(await paymentToken.balanceOf(contractPlatformAddress)).to.equal(initialPlatformBalance + platformCommission);
		});

		it('should end rental', async function () {
			// Rent the token (owner renting their own token)
			await kami1155C.connect(owner).rentToken(tokenId, rentalDuration, rentalPrice);

			// End the rental (renter can end their own rental)
			await kami1155C.connect(owner).endRental(tokenId);

			// Check rental status
			const rentalInfo = await kami1155C.getRentalInfo(tokenId);
			expect(rentalInfo.active).to.be.false;
		});

		it('should extend rental', async function () {
			// Rent the token (owner renting their own token)
			await kami1155C.connect(owner).rentToken(tokenId, rentalDuration, rentalPrice);

			const rentalInfo = await kami1155C.getRentalInfo(tokenId);
			const originalEndTime = rentalInfo.endTime;

			// Extend the rental
			const additionalDuration = 43200; // 12 hours
			const additionalPayment = ethers.parseUnits('25', 6);
			await kami1155C.connect(owner).extendRental(tokenId, additionalDuration, additionalPayment);

			// Check rental status
			const updatedRentalInfo = await kami1155C.getRentalInfo(tokenId);
			expect(updatedRentalInfo.endTime).to.equal(originalEndTime + BigInt(additionalDuration));
			expect(updatedRentalInfo.rentalPrice).to.equal(rentalPrice + additionalPayment);
		});

		it('should fail if user tries to rent token they do not own', async function () {
			await expect(kami1155C.connect(buyer).rentToken(tokenId, rentalDuration, rentalPrice)).to.be.revertedWith(
				'Must own tokens to rent'
			);
		});
	});

	describe('Upgradeability', function () {
		beforeEach(async function () {
			const signers = await ethers.getSigners();
			// Assign unique addresses for each role
			owner = signers[0];
			platform = signers[1];
			buyer = signers[2];
			user1 = signers[3];
			user2 = signers[4];
			user3 = signers[5];
			royaltyReceiver = signers[6];

			// Deploy mock payment token
			const MockERC20Factory = await ethers.getContractFactory('MockERC20');
			paymentToken = await MockERC20Factory.deploy('Mock USDC', 'USDC', 6);

			// Deploy the contract using the hardhat-upgrades plugin
			const KAMI1155CUpgradeableFactory = await ethers.getContractFactory('KAMI1155CUpgradeable');
			const contractInstance = await upgrades.deployProxy(
				KAMI1155CUpgradeableFactory,
				[await paymentToken.getAddress(), NAME, SYMBOL, BASE_URI, MINT_PRICE, platform.address, PLATFORM_COMMISSION],
				{
					initializer: 'initialize',
					kind: 'transparent',
				}
			);
			kami1155C = contractInstance as unknown as KAMI1155CUpgradeable;

			// Set up basic royalty configuration
			await kami1155C.setRoyaltyPercentage(1000); // 10%

			// Mint payment tokens to royalty receivers for testing
			await paymentToken.mint(royaltyReceiver.address, ethers.parseUnits('1000', 6));

			// Mint payment tokens to buyer for minting/transfer
			await paymentToken.mint(buyer.address, ethers.parseUnits('1000', 6));
			await paymentToken.connect(buyer).approve(await kami1155C.getAddress(), ethers.parseUnits('1000', 6));
		});

		it('should be managed by ProxyAdmin', async function () {
			// Get the deployed proxy admin
			const proxyAddress = await kami1155C.getAddress();
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
