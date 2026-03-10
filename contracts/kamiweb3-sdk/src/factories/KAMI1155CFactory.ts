import { ethers, ContractFactory, Signer, BigNumberish, Contract } from 'ethers';

import { KAMI1155CWrapper } from '../contracts/KAMI1155CWrapper';
import KAMI1155CArtifact from '../abis/KAMI1155C.json';
import KAMI1155CUpgradeableArtifact from '../abis/KAMI1155CUpgradeable.json'; // Import Upgradeable Artifact
import { SignerOrProvider } from '../types';
// Import OpenZeppelin Artifacts
import ProxyAdminArtifact from '../abis/openzeppelin/ProxyAdmin.json';
import TransparentUpgradeableProxyArtifact from '../abis/openzeppelin/TransparentUpgradeableProxy.json';

/**
 * Arguments required for deploying a standard KAMI1155C contract.
 */
export interface KAMI1155CDeployArgs {
	paymentToken_: string; // Updated from usdcAddress
	name_: string; // Updated from name
	symbol_: string; // Updated from symbol
	baseTokenURI_: string; // Updated from baseURI
	initialMintPrice_: BigNumberish; // Updated from initialMintPrice
	platformAddress_: string; // Updated from platformAddress
	platformCommissionPercentage_: BigNumberish; // Updated from platformCommissionPercentage
}

/**
 * Arguments required for initializing the upgradeable KAMI1155C contract.
 * Matches the DeployArgs for the standard version in this case.
 */
export type KAMI1155CInitializeArgs = KAMI1155CDeployArgs;

export class KAMI1155CFactory {
	/**
	 * Attaches to an existing standard KAMI1155C contract.
	 */
	static attach(address: string, signerOrProvider: SignerOrProvider): KAMI1155CWrapper {
		// Use default ABI (standard) in wrapper constructor
		return new KAMI1155CWrapper(address, signerOrProvider);
	}

	/**
	 * Attaches to an existing upgradeable KAMI1155C contract (proxy).
	 * Uses the KAMI1155CUpgradeable ABI.
	 */
	static attachUpgradeable(proxyAddress: string, signerOrProvider: SignerOrProvider): KAMI1155CWrapper {
		const upgradeableAbi = KAMI1155CUpgradeableArtifact.abi;
		if (!upgradeableAbi) throw new Error('KAMI1155CUpgradeable ABI not found');
		// Pass the upgradeable ABI explicitly
		return new KAMI1155CWrapper(proxyAddress, signerOrProvider, upgradeableAbi);
	}

	/**
	 * Deploys a new standard KAMI1155C contract.
	 */
	static async deploy(args: KAMI1155CDeployArgs, signer: Signer): Promise<KAMI1155CWrapper> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}

		const abi = KAMI1155CArtifact.abi;
		const bytecode = KAMI1155CArtifact.bytecode;

		if (!abi || abi.length === 0) {
			throw new Error('ABI not found in KAMI1155C artifact.');
		}
		if (!bytecode || bytecode === '0x' || bytecode === '') {
			throw new Error('Bytecode not found or is invalid in KAMI1155C artifact.');
		}

		const factory = new ContractFactory(abi as any, bytecode, signer);

		console.log('Deploying KAMI1155C (standard) with arguments:', {
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

			console.log(`KAMI1155C (standard) deployed to: ${deployedAddress}`);
			return KAMI1155CFactory.attach(deployedAddress, signer);
		} catch (error) {
			console.error('KAMI1155C (standard) deployment failed:', error);
			if (error instanceof Error) {
				throw new Error(`KAMI1155C (standard) deployment failed: ${error.message}`);
			}
			throw new Error('KAMI1155C (standard) deployment failed with an unknown error.');
		}
	}

	/**
	 * Deploys a new upgradeable KAMI1155C contract using the Transparent Proxy pattern.
	 * @param initArgs The arguments for the initializer function.
	 * @param signer The signer to use for deployment.
	 * @param proxyAdminOwner (Optional) The address that will own the ProxyAdmin. Defaults to the signer.
	 * @returns A Promise resolving to a KAMI1155CWrapper instance attached to the proxy address.
	 */
	static async deployUpgradeable(initArgs: KAMI1155CInitializeArgs, signer: Signer, proxyAdminOwner?: string): Promise<KAMI1155CWrapper> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}
		const signerAddress = await signer.getAddress();
		const adminOwner = proxyAdminOwner ? proxyAdminOwner.toString() : signerAddress;

		// 1. Deploy Implementation
		const implFactory = new ContractFactory(KAMI1155CUpgradeableArtifact.abi as any, KAMI1155CUpgradeableArtifact.bytecode, signer);
		console.log('Deploying KAMI1155CUpgradeable implementation...');
		const implementation = await implFactory.deploy();
		await implementation.deployed();
		const implementationAddress = implementation.address;
		console.log(`Implementation deployed to: ${implementationAddress}`);

		// 2. Deploy ProxyAdmin
		const proxyAdminFactory = new ContractFactory(ProxyAdminArtifact.abi as any, ProxyAdminArtifact.bytecode, signer);
		console.log(`Deploying ProxyAdmin (owner: ${adminOwner})...`);
		const proxyAdminContract = await proxyAdminFactory.deploy();
		await proxyAdminContract.deployed();
		const proxyAdminAddress = proxyAdminContract.address;
		const proxyAdmin = new Contract(proxyAdminAddress, ProxyAdminArtifact.abi, signer);
		if (adminOwner.toLowerCase() !== signerAddress.toLowerCase()) {
			console.log(`Transferring ProxyAdmin ownership to ${adminOwner}...`);
			const tx = await proxyAdmin.transferOwnership(adminOwner);
			await tx.wait();
			console.log('ProxyAdmin ownership transferred.');
		}
		console.log(`ProxyAdmin deployed to: ${proxyAdminAddress}`);

		// 3. Encode Initializer Data
		const implementationInterface = new ethers.utils.Interface(KAMI1155CUpgradeableArtifact.abi);
		// Use the 7 arguments for KAMI1155C's initializer
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

		// 4. Deploy TransparentUpgradeableProxy
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
		return KAMI1155CFactory.attachUpgradeable(proxyAddress, signer);
	}

	/**
	 * Initiates an upgrade of a KAMI1155C transparent proxy.
	 * Deploys the new KAMI1155CUpgradeable implementation.
	 * @param signer The signer for deployment.
	 * @returns The address of the newly deployed implementation contract.
	 */
	static async deployNewImplementation(signer: Signer): Promise<string> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}
		const implFactory = new ContractFactory(KAMI1155CUpgradeableArtifact.abi as any, KAMI1155CUpgradeableArtifact.bytecode, signer);
		console.log('Deploying new KAMI1155CUpgradeable implementation...');
		const newImplementation = await implFactory.deploy();
		await newImplementation.deployed();
		const newImplementationAddress = newImplementation.address;
		console.log(`New implementation deployed to: ${newImplementationAddress}`);

		return newImplementationAddress;
	}
}
