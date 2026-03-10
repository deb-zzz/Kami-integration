import { ethers, ContractFactory, Signer, BigNumberish, Contract } from 'ethers';

// Import the wrapper class
import { KAMI721CWrapper } from '../contracts/KAMI721CWrapper';
// Import the standard implementation artifact
import KAMI721CArtifact from '../abis/KAMI721C.json';
// Import the upgradeable implementation artifact
import KAMI721CUpgradeableArtifact from '../abis/KAMI721CUpgradeable.json';
// Import shared types
import { SignerOrProvider } from '../types';

// --- Assume OpenZeppelin Artifacts are available ---
// You need to place these JSON files (with abi and bytecode) in the specified path
import ProxyAdminArtifact from '../abis/openzeppelin/ProxyAdmin.json';
import TransparentUpgradeableProxyArtifact from '../abis/openzeppelin/TransparentUpgradeableProxy.json';

/**
 * Arguments required for deploying the standard KAMI721C contract.
 */
export interface KAMI721CDeployArgs {
	paymentToken_: string; // Updated from usdcAddress
	name_: string; // Updated from name
	symbol_: string; // Updated from symbol
	baseTokenURI_: string; // Updated from baseURI
	initialMintPrice_: BigNumberish; // Updated from initialMintPrice
	platformAddress_: string; // Updated from platformAddress
	platformCommissionPercentage_: BigNumberish; // Updated from platformCommissionPercentage
}

/**
 * Arguments required for initializing the upgradeable KAMI721C contract.
 * Matches the DeployArgs for the standard version in this case.
 */
export type KAMI721CInitializeArgs = KAMI721CDeployArgs;

export class KAMI721CFactory {
	/**
	 * Attaches to an existing standard KAMI721C contract.
	 * @param address The address of the deployed KAMI721C contract.
	 * @param signerOrProvider A Signer (for transactions) or Provider (for read-only).
	 * @returns A KAMI721CWrapper instance using the standard ABI.
	 */
	static attach(address: string, signerOrProvider: SignerOrProvider): KAMI721CWrapper {
		// Call constructor without specific ABI to use the default (standard)
		return new KAMI721CWrapper(address, signerOrProvider);
	}

	/**
	 * Attaches to an existing upgradeable KAMI721C contract (proxy).
	 * @param proxyAddress The address of the deployed proxy contract.
	 * @param signerOrProvider A Signer (for transactions) or Provider (for read-only).
	 * @returns A KAMI721CWrapper instance using the upgradeable ABI.
	 */
	static attachUpgradeable(proxyAddress: string, signerOrProvider: SignerOrProvider): KAMI721CWrapper {
		// Pass the Upgradeable ABI explicitly to the constructor
		const upgradeableAbi = KAMI721CUpgradeableArtifact.abi;
		if (!upgradeableAbi) throw new Error('Upgradeable ABI not found');
		return new KAMI721CWrapper(proxyAddress, signerOrProvider, upgradeableAbi);
	}

	/**
	 * Deploys a new standard (non-upgradeable) KAMI721C contract.
	 * @param args The deployment arguments based on the contract constructor.
	 * @param signer The signer to use for deployment.
	 * @returns A Promise resolving to a KAMI721CWrapper instance of the deployed contract.
	 */
	static async deploy(args: KAMI721CDeployArgs, signer: Signer): Promise<KAMI721CWrapper> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}

		// Extract ABI and bytecode from the standard artifact
		const abi = KAMI721CArtifact.abi;
		const bytecode = KAMI721CArtifact.bytecode;

		if (!abi || abi.length === 0) {
			throw new Error('ABI not found in KAMI721C artifact.');
		}
		if (!bytecode || bytecode === '0x' || bytecode === '') {
			throw new Error('Bytecode not found or is invalid in KAMI721C artifact.');
		}

		const factory = new ContractFactory(abi as any, bytecode, signer);

		console.log('Deploying KAMI721C (standard) with arguments:', {
			paymentToken_: args.paymentToken_,
			name_: args.name_,
			symbol_: args.symbol_,
			baseTokenURI_: args.baseTokenURI_,
			initialMintPrice_: args.initialMintPrice_.toString(),
			platformAddress_: args.platformAddress_,
			platformCommissionPercentage_: args.platformCommissionPercentage_.toString(),
		});

		try {
			const contract = await factory.deploy(
				args.paymentToken_,
				args.name_,
				args.symbol_,
				args.baseTokenURI_,
				args.initialMintPrice_,
				args.platformAddress_,
				args.platformCommissionPercentage_
			);

			await contract.deployed();
			const deployedAddress = contract.address;
			console.log(`KAMI721C (standard) deployed to: ${deployedAddress}`);
			// Return wrapper using the standard ABI
			return new KAMI721CWrapper(deployedAddress, signer, KAMI721CArtifact.abi);
		} catch (error) {
			console.error('KAMI721C (standard) deployment failed:', error);
			if (error instanceof Error) {
				throw new Error(`KAMI721C (standard) deployment failed: ${error.message}`);
			}
			throw new Error('KAMI721C (standard) deployment failed with an unknown error.');
		}
	}

	/**
	 * Deploys a new upgradeable KAMI721C contract using the Transparent Proxy pattern.
	 * @param initArgs The arguments for the initializer function.
	 * @param signer The signer to use for deployment.
	 * @param proxyAdminOwner (Optional) The address that will own the ProxyAdmin. Defaults to the signer.
	 * @returns A Promise resolving to a KAMI721CWrapper instance attached to the proxy address.
	 */
	static async deployUpgradeable(initArgs: KAMI721CInitializeArgs, signer: Signer, proxyAdminOwner?: string): Promise<KAMI721CWrapper> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}
		const signerAddress = await signer.getAddress();
		const adminOwner = proxyAdminOwner ? proxyAdminOwner.toString() : signerAddress;

		// 1. Deploy Implementation Contract
		const implFactory = new ContractFactory(KAMI721CUpgradeableArtifact.abi as any, KAMI721CUpgradeableArtifact.bytecode, signer);
		console.log('Deploying KAMI721CUpgradeable implementation...');
		const implementation = await implFactory.deploy();
		await implementation.deployed();
		const implementationAddress = implementation.address;
		console.log(`Implementation deployed to: ${implementationAddress}`);

		// 2. Deploy ProxyAdmin Contract
		const proxyAdminFactory = new ContractFactory(ProxyAdminArtifact.abi as any, ProxyAdminArtifact.bytecode, signer);
		console.log(`Deploying ProxyAdmin (owner: ${adminOwner})...`);
		const proxyAdminContract = await proxyAdminFactory.deploy();
		await proxyAdminContract.deployed();
		const proxyAdminAddress = proxyAdminContract.address;

		// Ensure the contract instance is typed correctly for the transferOwnership call
		const proxyAdmin = new Contract(proxyAdminAddress, ProxyAdminArtifact.abi, signer);

		// Transfer ownership if a different owner was specified
		if (adminOwner.toLowerCase() !== signerAddress.toLowerCase()) {
			console.log(`Transferring ProxyAdmin ownership to ${adminOwner}...`);
			const tx = await proxyAdmin.transferOwnership(adminOwner);
			await tx.wait();
			console.log('ProxyAdmin ownership transferred.');
		}
		console.log(`ProxyAdmin deployed to: ${proxyAdminAddress}`);

		// 3. Encode Initializer Data
		const implementationInterface = new ethers.utils.Interface(KAMI721CUpgradeableArtifact.abi);
		const initializeData = implementationInterface.encodeFunctionData('initialize', [
			initArgs.paymentToken_,
			initArgs.name_,
			initArgs.symbol_,
			initArgs.baseTokenURI_,
			initArgs.initialMintPrice_,
			initArgs.platformAddress_,
			initArgs.platformCommissionPercentage_,
		]);
		console.log('Encoded initialize data:', initializeData);

		// 4. Deploy TransparentUpgradeableProxy Contract
		const proxyFactory = new ContractFactory(
			TransparentUpgradeableProxyArtifact.abi as any,
			TransparentUpgradeableProxyArtifact.bytecode,
			signer
		);
		console.log('Deploying TransparentUpgradeableProxy...');
		const proxy = await proxyFactory.deploy(implementationAddress, proxyAdminAddress, initializeData);
		await proxy.deployed();
		const proxyAddress = proxy.address;
		console.log(`TransparentUpgradeableProxy deployed to: ${proxyAddress}`);

		// 5. Return Wrapper attached to Proxy using Implementation ABI
		console.log('Attaching wrapper to proxy...');
		// Use the correct Upgradeable ABI for the wrapper when interacting via proxy
		return new KAMI721CWrapper(proxyAddress, signer, KAMI721CUpgradeableArtifact.abi);
	}

	/**
	 * Initiates an upgrade of a transparent proxy to a new implementation contract.
	 * This method deploys a new implementation contract but does not perform the upgrade itself.
	 * The actual upgrade must be performed through the ProxyAdmin contract.
	 * @param signer The signer to use for deployment.
	 * @returns A Promise resolving to the address of the new implementation contract.
	 */
	static async deployNewImplementation(signer: Signer): Promise<string> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}

		// Deploy new implementation
		const implFactory = new ContractFactory(KAMI721CUpgradeableArtifact.abi as any, KAMI721CUpgradeableArtifact.bytecode, signer);
		console.log('Deploying new KAMI721CUpgradeable implementation...');
		const implementation = await implFactory.deploy();
		await implementation.deployed();
		const implementationAddress = implementation.address;
		console.log(`New implementation deployed to: ${implementationAddress}`);

		return implementationAddress;
	}
}
