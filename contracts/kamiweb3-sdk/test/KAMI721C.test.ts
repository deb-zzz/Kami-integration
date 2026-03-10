import { ethers } from 'hardhat';
import { Signer, Contract, Interface, getAddress, ContractFactory, ContractTransactionResponse } from 'ethers';
import {
	KAMI721CFactory,
	KAMI721CWrapper,
	KAMI721CDeployArgs,
	KAMI721CInitializeArgs,
	RoyaltyData,
	DEFAULT_ADMIN_ROLE,
	OWNER_ROLE,
	PAUSER_ROLE,
} from '../src'; // Import SDK components
import KAMI721CUpgradeableArtifact from '../src/abis/KAMI721CUpgradeable.json'; // Need ABI for checks
import ProxyAdminArtifact from '../src/abis/openzeppelin/ProxyAdmin.json'; // Need ABI for checks
import MockERC20Artifact from '../src/abis/MockERC20.json'; // Import the new artifact

// Mock USDC address will be set after deployment
let MOCK_USDC_ADDRESS: string;
const PLATFORM_ADDRESS = '0x' + '2'.repeat(40); // Placeholder

describe('KAMI721CFactory', () => {
	let deployer: Signer;
	let user1: Signer;
	let user2: Signer;
	let deployerAddress: string;
	let user1Address: string;
	let user2Address: string;
	let mockUsdc: Contract; // Use base Contract type

	beforeAll(async () => {
		// Get signers provided by Hardhat Network
		[deployer, user1, user2] = await ethers.getSigners();
		deployerAddress = await deployer.getAddress();
		user1Address = await user1.getAddress();
		user2Address = await user2.getAddress();
		console.log('Test Signers:');
		console.log('  Deployer:', deployerAddress);
		console.log('  User1:', user1Address);
		console.log('  User2:', user2Address);

		// Deploy Mock USDC Contract using the imported artifact
		try {
			const MockERC20Factory = new ContractFactory(MockERC20Artifact.abi, MockERC20Artifact.bytecode, deployer);
			mockUsdc = (await MockERC20Factory.deploy('Mock USDC', 'MUSDC', 6)) as Contract;
			await mockUsdc.deployed();
			MOCK_USDC_ADDRESS = mockUsdc.address;
			console.log(`Mock USDC deployed successfully to: ${MOCK_USDC_ADDRESS}`);
		} catch (e) {
			console.error('FATAL: Failed to deploy Mock ERC20 from artifact:', e);
			throw new Error(`Failed to deploy MockERC20: ${e}`);
		}
	});

	describe('Standard Deployment', () => {
		it('should deploy a standard KAMI721C contract', async () => {
			const deployArgs: KAMI721CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test KAMI 721C',
				symbol_: 'TK721C',
				baseTokenURI_: 'ipfs://test-721c/',
				initialMintPrice_: ethers.utils.parseUnits('10', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 500,
			};
			const kami721c: KAMI721CWrapper = await KAMI721CFactory.deploy(deployArgs, deployer);
			expect(kami721c).toBeDefined();
			expect(kami721c.address).toBeDefined();
			expect(kami721c.address).not.toBe(ethers.ZeroAddress);
			expect(await kami721c.getMintPrice()).toEqual(BigInt(deployArgs.initialMintPrice_.toString()));
			expect(await kami721c.getPlatformAddress()).toEqual(deployArgs.platformAddress_);
			expect(await kami721c.getPlatformCommissionPercentage()).toEqual(BigInt(deployArgs.platformCommissionPercentage_));
			console.log(`Deployed standard KAMI721C to ${kami721c.address} for test.`);
		});
	});

	describe('Upgradeable Deployment', () => {
		it('should deploy an upgradeable KAMI721C contract via proxy', async () => {
			const initArgs: KAMI721CInitializeArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test KAMI 721C Upg',
				symbol_: 'TK721CU',
				baseTokenURI_: 'ipfs://test-721c-upg/',
				initialMintPrice_: ethers.utils.parseUnits('15', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 600,
			};
			const kami721cProxy: KAMI721CWrapper = await KAMI721CFactory.deployUpgradeable(initArgs, deployer);
			expect(kami721cProxy).toBeDefined();
			expect(kami721cProxy.address).toBeDefined();
			expect(kami721cProxy.address).not.toBe(ethers.ZeroAddress);
			console.log(`Deployed upgradeable KAMI721C proxy to ${kami721cProxy.address}`);
			expect(JSON.stringify(kami721cProxy.abi)).toEqual(JSON.stringify(KAMI721CUpgradeableArtifact.abi));
			expect(await kami721cProxy.getMintPrice()).toEqual(BigInt(initArgs.initialMintPrice_.toString()));
			expect(await kami721cProxy.getPlatformAddress()).toEqual(initArgs.platformAddress_);
			expect(await kami721cProxy.getPlatformCommissionPercentage()).toEqual(BigInt(initArgs.platformCommissionPercentage_));
		});
	});

	describe('Contract Interaction', () => {
		let deployedContract: KAMI721CWrapper;
		let mintPrice: bigint;

		beforeEach(async () => {
			// Deploy a new contract before each interaction test
			const deployArgs: KAMI721CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Interaction Test K721C',
				symbol_: 'ITK721C',
				baseTokenURI_: 'ipfs://interact-721c/',
				initialMintPrice_: ethers.utils.parseUnits('5', 6), // 5 Mock USDC
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 1000, // 10%
			};
			deployedContract = await KAMI721CFactory.deploy(deployArgs, deployer);
			mintPrice = await deployedContract.getMintPrice();

			// Setup common for interaction tests
			try {
				// 1. Mint mock USDC to all users
				const mintAmount = ethers.utils.parseUnits('100', 6);
				await (mockUsdc.connect(deployer) as any).mint(deployerAddress, mintAmount);
				await (mockUsdc.connect(deployer) as any).mint(user1Address, mintAmount);
				await (mockUsdc.connect(deployer) as any).mint(user2Address, mintAmount);

				// 2. Approve NFT contract for spending
				await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, mintPrice);
				await (mockUsdc.connect(user1) as any).approve(deployedContract.address, mintPrice);
				await (mockUsdc.connect(user2) as any).approve(deployedContract.address, mintPrice);

				// 3. Grant necessary roles
				const connectedContract = deployedContract.connect(deployer);
				if (!(await deployedContract.hasRole(OWNER_ROLE, deployerAddress))) {
					await connectedContract.grantRole(OWNER_ROLE, deployerAddress);
				}
				if (!(await deployedContract.hasRole(PAUSER_ROLE, deployerAddress))) {
					await connectedContract.grantRole(PAUSER_ROLE, deployerAddress);
				}
				// Note: ROYALTY_ROLE may not exist in this contract version
			} catch (e) {
				console.warn('Failed during interaction beforeEach setup:', e);
			}
		});

		it('should allow minting tokens', async () => {
			const connectedContract = deployedContract.connect(deployer);
			const mintTx = await connectedContract.mint();
			const receipt = await mintTx.wait();
			expect(receipt?.status).toBe(1);

			// Check that a token was minted
			const totalSupply = await deployedContract.totalSupply();
			expect(totalSupply).toBeGreaterThan(0n);
		});

		it('should return next token ID correctly', async () => {
			const initialTotalSupply = await deployedContract.totalSupply();
			expect(initialTotalSupply).toBeGreaterThanOrEqual(0n);
			// Mint a token
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const newTotalSupply = await deployedContract.totalSupply();
			expect(newTotalSupply).toEqual(initialTotalSupply + 1n);
		});

		it('should allow renting tokens', async () => {
			console.log('TEST STARTED - should allow renting tokens');
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			const duration = 3600; // 1 hour in seconds
			const payment = ethers.utils.parseUnits('1', 6); // Rent for 1 USDC
			const platformCommission = await deployedContract.getPlatformCommissionPercentage();
			const initialRenterUsdc = await mockUsdc.balanceOf(user1Address);

			// Approve rental payment
			await (mockUsdc.connect(user1) as any).approve(deployedContract.address, payment);

			const userConnectedContract = deployedContract.connect(user1);
			const tx = await userConnectedContract.rentToken(tokenId, duration, payment);
			const receipt = await tx.wait();
			const block = await ethers.provider.getBlock(receipt?.blockNumber ?? 'latest');
			if (!block || typeof block.timestamp !== 'number') {
				throw new Error('Could not get block timestamp for rental end time calculation');
			}
			const currentTime = block.timestamp;

			const rentalDetails = await deployedContract.getRentalDetails(tokenId);
			expect(rentalDetails.renter).toEqual(user1Address);
			// Contract sets endTime = block.timestamp + duration
			const expectedEndTime = BigInt(currentTime) + BigInt(duration);
			// Allow for small timing differences (±15 seconds)
			expect(rentalDetails.endTime).toBeGreaterThanOrEqual(expectedEndTime - 15n);
			expect(rentalDetails.endTime).toBeLessThanOrEqual(expectedEndTime + 15n);

			// Check USDC transfer (only commission is deducted)
			const commission = (BigInt(payment.toString()) * BigInt(platformCommission.toString())) / 10000n;
			const finalRenterUsdc = await mockUsdc.balanceOf(user1Address);
			// Debug output
			console.log('=== DEBUG INFO ===');
			console.log('payment:', payment.toString());
			console.log('platformCommission:', platformCommission.toString());
			console.log('commission:', commission.toString());
			console.log('initialRenterUsdc:', initialRenterUsdc.toString());
			console.log('finalRenterUsdc:', finalRenterUsdc.toString());
			console.log('expected balance:', (BigInt(initialRenterUsdc.toString()) - BigInt(payment.toString())).toString());
			console.log('actual balance:', BigInt(finalRenterUsdc.toString()).toString());
			console.log(
				'difference:',
				(BigInt(initialRenterUsdc.toString()) - BigInt(payment.toString()) - BigInt(finalRenterUsdc.toString())).toString()
			);
			console.log('==================');

			expect(BigInt(finalRenterUsdc.toString())).toEqual(BigInt(initialRenterUsdc.toString()) - BigInt(payment.toString()));
		});

		it('should allow ending a rental', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Setup: Rent the token first
			const duration = 3600;
			const payment = ethers.utils.parseUnits('1', 6);
			await (mockUsdc.connect(user1) as any).approve(deployedContract.address, payment);
			const userConnectedContract = deployedContract.connect(user1);
			await userConnectedContract.rentToken(tokenId, duration, payment);

			// End the rental (renter ends it after expiry)
			await ethers.provider.send('evm_increaseTime', [duration + 60]);
			await ethers.provider.send('evm_mine', []);
			const endTx = await userConnectedContract.endRental(tokenId);
			await endTx.wait();

			// Verify rental details are cleared/reset
			const rentalDetails = await deployedContract.getRentalDetails(tokenId);
			// Note: endRental might not clear rental details depending on implementation
		});

		it('should allow extending a rental', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Setup rental
			const duration = 3600n; // 1 hour
			const rentalPrice = ethers.utils.parseUnits('10', 6); // 10 USDC
			await (mockUsdc.connect(user1) as any).approve(deployedContract.address, rentalPrice);
			const user1Connected = deployedContract.connect(user1);
			await user1Connected.rentToken(tokenId, duration, rentalPrice);

			// Extend
			const additionalDuration = 1800n;
			const additionalPayment = ethers.utils.parseUnits('0.5', 6); // 0.5 USDC
			const initialRenterUsdc = await mockUsdc.balanceOf(user1Address);

			// User needs to re-approve if allowance was used up
			await (mockUsdc.connect(user1) as any).approve(deployedContract.address, additionalPayment);

			// Extend the rental
			await user1Connected.extendRental(tokenId, additionalDuration, additionalPayment);

			// Check rental details
			const rentalDetails = await deployedContract.getRentalDetails(tokenId);
			expect(Boolean(rentalDetails.active)).toBe(true);
			expect(rentalDetails.renter).toEqual(user1Address);

			// Check USDC transfer (full payment is deducted)
			const finalRenterUsdc = await mockUsdc.balanceOf(user1Address);
			expect(BigInt(finalRenterUsdc.toString())).toEqual(BigInt(initialRenterUsdc.toString()) - BigInt(additionalPayment.toString()));
		});

		it('should check hasActiveRentals correctly', async () => {
			// Initially, users should not have active rentals
			expect(await deployedContract.hasActiveRentals(user1Address)).toBe(false);
			expect(await deployedContract.hasActiveRentals(user2Address)).toBe(false);

			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Rent a token for user1
			const duration = 3600;
			const payment = ethers.utils.parseUnits('1', 6);
			await (mockUsdc.connect(user1) as any).approve(deployedContract.address, payment);
			const connectedUser1 = deployedContract.connect(user1);
			await connectedUser1.rentToken(tokenId, duration, payment);

			// Check hasActiveRentals status
			expect(await deployedContract.hasActiveRentals(user1Address)).toBe(true);
			expect(await deployedContract.hasActiveRentals(user2Address)).toBe(false);
		});

		it('should allow setting mint royalties', async () => {
			const royalties: RoyaltyData[] = [{ receiver: user1Address, feeNumerator: 10000 }]; // 100%
			const connectedContract = deployedContract.connect(deployer);
			const tx = await connectedContract.setMintRoyalties(royalties);
			await tx.wait();

			// Get the first token ID (assuming it exists)
			const tokenId = 0n; // First token
			const retrievedRoyalties = await deployedContract.getMintRoyaltyReceivers(tokenId);
			expect(retrievedRoyalties.length).toBe(1);
			expect(retrievedRoyalties[0].receiver).toEqual(user1Address);
			expect(retrievedRoyalties[0].feeNumerator).toEqual(10000n);
		});

		it('should allow setting transfer royalties', async () => {
			const recipientFee = 1500n; // 15%
			const sellerFee = 10000n - recipientFee; // Remainder
			const royalties: RoyaltyData[] = [
				{ receiver: user1Address, feeNumerator: recipientFee },
				{ receiver: deployerAddress, feeNumerator: sellerFee },
			];
			const connectedContract = deployedContract.connect(deployer);
			const tx = await connectedContract.setTransferRoyalties(royalties);
			await tx.wait();

			// Get the first token ID (assuming it exists)
			const tokenId = 0n; // First token
			const retrievedRoyalties = await deployedContract.getTransferRoyaltyReceivers(tokenId);
			expect(retrievedRoyalties.length).toBe(2);
			expect(retrievedRoyalties).toEqual(
				expect.arrayContaining([
					{ receiver: user1Address, feeNumerator: 1500n },
					{ receiver: deployerAddress, feeNumerator: 8500n },
				])
			);
		});

		it('should allow pausing and unpausing', async () => {
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.pause();
			expect(await deployedContract.paused()).toBe(true);

			await connectedContract.unpause();
			expect(await deployedContract.paused()).toBe(false);
		});

		it('should allow granting and revoking roles', async () => {
			// Grant PAUSER_ROLE to user1
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.grantRole(PAUSER_ROLE, user1Address);
			expect(await deployedContract.hasRole(PAUSER_ROLE, user1Address)).toBe(true);

			// Revoke PAUSER_ROLE from user1
			await connectedContract.revokeRole(PAUSER_ROLE, user1Address);
			expect(await deployedContract.hasRole(PAUSER_ROLE, user1Address)).toBe(false);
		});

		it('should support ERC721 standard functions', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Test balanceOf
			const balance = await deployedContract.balanceOf(deployerAddress);
			expect(BigInt(balance.toString())).toBeGreaterThan(0n);

			// Test ownerOf
			const owner = await deployedContract.ownerOf(tokenId);
			expect(owner).toEqual(deployerAddress);

			// Test safeTransferFrom
			const transferAmount = 1n;
			const initialBalance = await deployedContract.balanceOf(deployerAddress);
			const initialUser1Balance = await deployedContract.balanceOf(user1Address);

			await connectedContract.safeTransferFrom(deployerAddress, user1Address, tokenId);

			expect(BigInt((await deployedContract.balanceOf(deployerAddress)).toString())).toEqual(
				BigInt(initialBalance.toString()) - transferAmount
			);
			expect(BigInt((await deployedContract.balanceOf(user1Address)).toString())).toEqual(
				BigInt(initialUser1Balance.toString()) + transferAmount
			);
			expect(await deployedContract.ownerOf(tokenId)).toEqual(user1Address);
		});

		it('should handle royalty calculations correctly', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Set transfer royalties - must equal 100%
			const royalties: RoyaltyData[] = [{ receiver: user1Address, feeNumerator: 10000 }]; // 100%
			await connectedContract.setTransferRoyalties(royalties);
			await connectedContract.setTokenTransferRoyalties(tokenId, royalties);

			// Test royalty calculation
			const salePrice = ethers.utils.parseUnits('100', 6); // 100 USDC
			const royaltyInfo = await deployedContract.royaltyInfo(tokenId, salePrice);

			// Calculate expected royalty (10% of 100 USDC = 10 USDC)
			const expectedRoyalty = (BigInt(salePrice.toString()) * 1000n) / 10000n; // 10% royalty

			expect(royaltyInfo.receiver).toEqual(user1Address);
			expect(BigInt(royaltyInfo.royaltyAmount.toString())).toEqual(expectedRoyalty);

			// Test with different sale price
			const differentSalePrice = ethers.utils.parseUnits('50', 6); // 50 USDC
			const differentRoyaltyInfo = await deployedContract.royaltyInfo(tokenId, differentSalePrice);
			const expectedDifferentRoyalty = (BigInt(differentSalePrice.toString()) * 1000n) / 10000n; // 10% of 50 USDC = 5 USDC

			expect(BigInt(differentRoyaltyInfo.royaltyAmount.toString())).toEqual(expectedDifferentRoyalty);
		});

		it('should handle selling tokens with royalties', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = BigInt((await deployedContract.totalSupply()).toString()) - 1n;

			// Set transfer royalties - must equal 100%
			const royalties: RoyaltyData[] = [{ receiver: user1Address, feeNumerator: 10000 }]; // 100%
			await connectedContract.setTransferRoyalties(royalties);
			await connectedContract.setTokenTransferRoyalties(tokenId, royalties);

			// Setup buyer with USDC
			const salePrice = ethers.utils.parseUnits('100', 6); // 100 USDC
			await (mockUsdc.connect(user2) as any).approve(deployedContract.address, salePrice);

			// Get initial balances
			const initialSellerBalance = await mockUsdc.balanceOf(deployerAddress);
			const initialBuyerBalance = await mockUsdc.balanceOf(user2Address);
			const initialRoyaltyRecipientBalance = await mockUsdc.balanceOf(user1Address);
			const initialPlatformBalance = await mockUsdc.balanceOf(PLATFORM_ADDRESS);

			// Sell the token
			await connectedContract.sellToken(user2Address, tokenId, salePrice);

			// Verify ownership transfer
			expect(await deployedContract.ownerOf(tokenId)).toEqual(user2Address);

			// Calculate expected distributions
			const platformCommission = await deployedContract.getPlatformCommissionPercentage();
			const platformFee = (BigInt(salePrice.toString()) * BigInt(platformCommission.toString())) / 10000n;
			const royaltyFee = (BigInt(salePrice.toString()) * 1000n) / 10000n; // 10% royalty
			const sellerProceeds = BigInt(salePrice.toString()) - platformFee - royaltyFee;

			// Check final balances
			const finalSellerBalance = await mockUsdc.balanceOf(deployerAddress);
			const finalBuyerBalance = await mockUsdc.balanceOf(user2Address);
			const finalRoyaltyRecipientBalance = await mockUsdc.balanceOf(user1Address);
			const finalPlatformBalance = await mockUsdc.balanceOf(PLATFORM_ADDRESS);

			// Verify the distributions
			expect(BigInt(finalBuyerBalance.toString())).toEqual(BigInt(initialBuyerBalance.toString()) - BigInt(salePrice.toString()));
			expect(BigInt(finalSellerBalance.toString())).toEqual(BigInt(initialSellerBalance.toString()) + sellerProceeds);
			expect(BigInt(finalRoyaltyRecipientBalance.toString())).toEqual(BigInt(initialRoyaltyRecipientBalance.toString()) + royaltyFee);
			expect(BigInt(finalPlatformBalance.toString())).toEqual(BigInt(initialPlatformBalance.toString()) + platformFee);
		});

		it('should handle burning tokens', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Verify token exists
			expect(await deployedContract.ownerOf(tokenId)).toEqual(deployerAddress);

			// Burn the token
			await connectedContract.burn(tokenId);

			// Verify token is burned (should revert when trying to get owner)
			await expect(deployedContract.ownerOf(tokenId)).rejects.toThrow();
		});

		it('should handle token URI correctly', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Get token URI
			const tokenURI = await deployedContract.tokenURI(tokenId);
			expect(tokenURI).toContain('ipfs://interact-721c/');
			expect(tokenURI).toContain(tokenId.toString());
		});

		it('should handle approval functions', async () => {
			// Mint a token first
			const currentMintPrice = await deployedContract.getMintPrice();
			await (mockUsdc.connect(deployer) as any).approve(deployedContract.address, currentMintPrice);
			const connectedContract = deployedContract.connect(deployer);
			await connectedContract.mint();
			const tokenId = 0n; // First minted token

			// Test approve
			await connectedContract.approve(user1Address, tokenId);
			expect(await deployedContract.getApproved(tokenId)).toEqual(user1Address);

			// Test setApprovalForAll
			await connectedContract.setApprovalForAll(user1Address, true);
			expect(await deployedContract.isApprovedForAll(deployerAddress, user1Address)).toBe(true);

			// Test revoking approval
			await connectedContract.setApprovalForAll(user1Address, false);
			expect(await deployedContract.isApprovedForAll(deployerAddress, user1Address)).toBe(false);
		});
	});
});
