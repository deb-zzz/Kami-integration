import { ethers } from 'hardhat';
import { Signer, Contract, Interface, getAddress, ContractFactory, ContractTransactionResponse } from 'ethers';
import {
	KAMI721CFactory,
	KAMI721CWrapper,
	KAMI721CDeployArgs,
	KAMI721ACFactory,
	KAMI721ACWrapper,
	KAMI721ACDeployArgs,
	KAMI1155CFactory,
	KAMI1155CWrapper,
	KAMI1155CDeployArgs,
	RoyaltyData,
	DEFAULT_ADMIN_ROLE,
	OWNER_ROLE,
	PAUSER_ROLE,
} from '../src'; // Import SDK components
import MockERC20Artifact from '../src/abis/MockERC20.json'; // Import the new artifact

// Mock USDC address will be set after deployment
let MOCK_USDC_ADDRESS: string;
const PLATFORM_ADDRESS = '0x' + '2'.repeat(40); // Placeholder

describe('Factory Attach Methods', () => {
	let deployer: Signer;
	let user1: Signer;
	let deployerAddress: string;
	let user1Address: string;
	let mockUsdc: Contract;

	beforeAll(async () => {
		[deployer, user1] = await ethers.getSigners();
		deployerAddress = await deployer.getAddress();
		user1Address = await user1.getAddress();

		// Deploy Mock USDC Contract
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

	describe('KAMI721C Factory Attach', () => {
		it('should attach to standard KAMI721C contract', async () => {
			// Deploy a standard contract first
			const deployArgs: KAMI721CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test Attach K721C',
				symbol_: 'TAK721C',
				baseTokenURI_: 'ipfs://test-attach-721c/',
				initialMintPrice_: ethers.utils.parseUnits('10', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 500,
			};
			const deployedContract = await KAMI721CFactory.deploy(deployArgs, deployer);
			const contractAddress = deployedContract.address;

			// Test attach method
			const attachedContract = KAMI721CFactory.attach(contractAddress, deployer);
			expect(attachedContract).toBeDefined();
			expect(attachedContract.address).toEqual(contractAddress);
			expect(await attachedContract.name()).toEqual(deployArgs.name_);
			expect(await attachedContract.symbol()).toEqual(deployArgs.symbol_);
		});

		it('should attach to upgradeable KAMI721C contract', async () => {
			// Deploy an upgradeable contract first
			const initArgs: KAMI721CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test Attach K721C Upg',
				symbol_: 'TAK721CU',
				baseTokenURI_: 'ipfs://test-attach-721c-upg/',
				initialMintPrice_: ethers.utils.parseUnits('15', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 600,
			};
			const deployedContract = await KAMI721CFactory.deployUpgradeable(initArgs, deployer);
			const contractAddress = deployedContract.address;

			// Test attachUpgradeable method
			const attachedContract = KAMI721CFactory.attachUpgradeable(contractAddress, deployer);
			expect(attachedContract).toBeDefined();
			expect(attachedContract.address).toEqual(contractAddress);
			expect(await attachedContract.name()).toEqual(initArgs.name_);
			expect(await attachedContract.symbol()).toEqual(initArgs.symbol_);
		});

		it('should handle invalid address in attach', () => {
			const invalidAddress = '0x0000000000000000000000000000000000000000';
			expect(() => {
				KAMI721CFactory.attach(invalidAddress, deployer);
			}).not.toThrow(); // Should not throw, but contract calls will fail
		});
	});

	describe('KAMI721AC Factory Attach', () => {
		it('should attach to standard KAMI721AC contract', async () => {
			// Deploy a standard contract first
			const deployArgs: KAMI721ACDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test Attach K721AC',
				symbol_: 'TAK721AC',
				baseTokenURI_: 'ipfs://test-attach-721ac/',
				initialMintPrice_: ethers.utils.parseUnits('10', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 500,
			};
			const deployedContract = await KAMI721ACFactory.deploy(deployArgs, deployer);
			const contractAddress = deployedContract.address;

			// Test attach method
			const attachedContract = KAMI721ACFactory.attach(contractAddress, deployer);
			expect(attachedContract).toBeDefined();
			expect(attachedContract.address).toEqual(contractAddress);
			expect(await attachedContract.name()).toEqual(deployArgs.name_);
			expect(await attachedContract.symbol()).toEqual(deployArgs.symbol_);
		});

		it('should attach to upgradeable KAMI721AC contract', async () => {
			// Deploy an upgradeable contract first
			const initArgs: KAMI721ACDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test Attach K721AC Upg',
				symbol_: 'TAK721ACU',
				baseTokenURI_: 'ipfs://test-attach-721ac-upg/',
				initialMintPrice_: ethers.utils.parseUnits('15', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 600,
			};
			const deployedContract = await KAMI721ACFactory.deployUpgradeable(initArgs, deployer);
			const contractAddress = deployedContract.address;

			// Test attachUpgradeable method
			const attachedContract = KAMI721ACFactory.attachUpgradeable(contractAddress, deployer);
			expect(attachedContract).toBeDefined();
			expect(attachedContract.address).toEqual(contractAddress);
			expect(await attachedContract.name()).toEqual(initArgs.name_);
			expect(await attachedContract.symbol()).toEqual(initArgs.symbol_);
		});
	});

	describe('KAMI1155C Factory Attach', () => {
		it('should attach to standard KAMI1155C contract', async () => {
			// Deploy a standard contract first
			const deployArgs: KAMI1155CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test Attach K1155C',
				symbol_: 'TAK1155C',
				baseTokenURI_: 'ipfs://test-attach-1155c/',
				initialMintPrice_: ethers.utils.parseUnits('10', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 500,
			};
			const deployedContract = await KAMI1155CFactory.deploy(deployArgs, deployer);
			const contractAddress = deployedContract.address;

			// Test attach method
			const attachedContract = KAMI1155CFactory.attach(contractAddress, deployer);
			expect(attachedContract).toBeDefined();
			expect(attachedContract.address).toEqual(contractAddress);
			expect(await attachedContract.getMintPrice()).toEqual(BigInt(deployArgs.initialMintPrice_.toString()));
			expect(await attachedContract.getPlatformAddress()).toEqual(deployArgs.platformAddress_);
		});

		it('should attach to upgradeable KAMI1155C contract', async () => {
			// Deploy an upgradeable contract first
			const initArgs: KAMI1155CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test Attach K1155C Upg',
				symbol_: 'TAK1155CU',
				baseTokenURI_: 'ipfs://test-attach-1155c-upg/',
				initialMintPrice_: ethers.utils.parseUnits('15', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 600,
			};
			const deployedContract = await KAMI1155CFactory.deployUpgradeable(initArgs, deployer);
			const contractAddress = deployedContract.address;

			// Test attachUpgradeable method
			const attachedContract = KAMI1155CFactory.attachUpgradeable(contractAddress, deployer);
			expect(attachedContract).toBeDefined();
			expect(attachedContract.address).toEqual(contractAddress);
			expect(await attachedContract.getMintPrice()).toEqual(BigInt(initArgs.initialMintPrice_.toString()));
			expect(await attachedContract.getPlatformAddress()).toEqual(initArgs.platformAddress_);
		});
	});

	describe('Error Handling', () => {
		it('should handle deployment with invalid parameters', async () => {
			const invalidDeployArgs: KAMI721CDeployArgs = {
				paymentToken_: '0x0000000000000000000000000000000000000000', // Zero address
				name_: 'Test Invalid',
				symbol_: 'TI',
				baseTokenURI_: 'ipfs://test-invalid/',
				initialMintPrice_: ethers.utils.parseUnits('10', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 500,
			};

			// This should fail due to zero address payment token
			await expect(KAMI721CFactory.deploy(invalidDeployArgs, deployer)).rejects.toThrow();
		});

		it('should handle deployment without signer', async () => {
			const deployArgs: KAMI721CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test No Signer',
				symbol_: 'TNS',
				baseTokenURI_: 'ipfs://test-no-signer/',
				initialMintPrice_: ethers.utils.parseUnits('10', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 500,
			};

			// This should fail due to no signer
			await expect(KAMI721CFactory.deploy(deployArgs, null as any)).rejects.toThrow('Signer is required for deployment');
		});

		it('should handle upgradeable deployment without signer', async () => {
			const initArgs: KAMI721CDeployArgs = {
				paymentToken_: MOCK_USDC_ADDRESS,
				name_: 'Test No Signer Upg',
				symbol_: 'TNSU',
				baseTokenURI_: 'ipfs://test-no-signer-upg/',
				initialMintPrice_: ethers.utils.parseUnits('10', 6),
				platformAddress_: PLATFORM_ADDRESS,
				platformCommissionPercentage_: 500,
			};

			// This should fail due to no signer
			await expect(KAMI721CFactory.deployUpgradeable(initArgs, null as any)).rejects.toThrow('Signer is required for deployment');
		});
	});

	describe('New Implementation Deployment', () => {
		it('should deploy new KAMI721C implementation', async () => {
			const newImplAddress = await KAMI721CFactory.deployNewImplementation(deployer);
			expect(newImplAddress).toBeDefined();
			expect(newImplAddress).not.toBe(ethers.ZeroAddress);
			console.log(`New KAMI721C implementation deployed to: ${newImplAddress}`);
		});

		it('should deploy new KAMI721AC implementation', async () => {
			const newImplAddress = await KAMI721ACFactory.deployNewImplementation(deployer);
			expect(newImplAddress).toBeDefined();
			expect(newImplAddress).not.toBe(ethers.ZeroAddress);
			console.log(`New KAMI721AC implementation deployed to: ${newImplAddress}`);
		});

		it('should deploy new KAMI1155C implementation', async () => {
			const newImplAddress = await KAMI1155CFactory.deployNewImplementation(deployer);
			expect(newImplAddress).toBeDefined();
			expect(newImplAddress).not.toBe(ethers.ZeroAddress);
			console.log(`New KAMI1155C implementation deployed to: ${newImplAddress}`);
		});
	});
});
