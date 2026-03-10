import { ethers, ContractFactory, Signer, BigNumberish, Contract } from 'ethers';
``
import { KAMI721ACWrapper } from '../contracts/KAMI721ACWrapper';
import KAMI721ACArtifact from '../abis/KAMI721AC.json';
import KAMI721ACUpgradeableArtifact from '../abis/KAMI721ACUpgradable.json'; // Import Upgradeable Artifact
import { SignerOrProvider } from '../types';
// Import OpenZeppelin Artifacts
import ProxyAdminArtifact from '../abis/openzeppelin/ProxyAdmin.json';
import TransparentUpgradeableProxyArtifact from '../abis/openzeppelin/TransparentUpgradeableProxy.json';

/**
 * Arguments required for deploying a standard KAMI721AC contract.
 */
export interface KAMI721ACDeployArgs {
	paymentToken_: string; // Updated from usdcAddress
	name_: string; // Updated from name
	symbol_: string; // Updated from symbol
	baseTokenURI_: string; // Updated from baseURI
	initialMintPrice_: BigNumberish; // Updated from initialMintPrice
	platformAddress_: string; // Updated from platformAddress
	platformCommissionPercentage_: BigNumberish; // Updated from platformCommissionPercentage
}

/**
 * Arguments required for initializing the upgradeable KAMI721AC contract.
 * Matches the DeployArgs for the standard version in this case.
 */
export type KAMI721ACInitializeArgs = KAMI721ACDeployArgs;

export class KAMI721ACFactory {
	/**
	 * Attaches to an existing standard KAMI721AC contract.
	 */
	static attach(address: string, signerOrProvider: SignerOrProvider): KAMI721ACWrapper {
		// Use default ABI (standard) in wrapper constructor
		return new KAMI721ACWrapper(address, signerOrProvider);
	}

	/**
	 * Attaches to an existing upgradeable KAMI721AC contract (proxy).
	 * Uses the KAMI721ACUpgradeable ABI.
	 */
	static attachUpgradeable(proxyAddress: string, signerOrProvider: SignerOrProvider): KAMI721ACWrapper {
		const upgradeableAbi = KAMI721ACUpgradeableArtifact.abi;
		if (!upgradeableAbi) throw new Error('KAMI721ACUpgradeable ABI not found');
		// Pass the upgradeable ABI explicitly
		return new KAMI721ACWrapper(proxyAddress, signerOrProvider, upgradeableAbi);
	}

	/**
	 * Deploys a new standard KAMI721AC contract.
	 */
	static async deploy(args: KAMI721ACDeployArgs, signer: Signer): Promise<KAMI721ACWrapper> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}

		const abi = KAMI721ACArtifact.abi;
		const bytecode = KAMI721ACArtifact.bytecode;

		if (!abi || abi.length === 0) {
			throw new Error('ABI not found in KAMI721AC artifact.');
		}
		if (!bytecode || bytecode === '0x' || bytecode === '') {
			throw new Error('Bytecode not found or is invalid in KAMI721AC artifact.');
		}

		const factory = new ContractFactory(abi as any, bytecode, signer);

		console.log('Deploying KAMI721AC (standard) with arguments:', {
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

			console.log(`KAMI721AC (standard) deployed to: ${deployedAddress}`);
			// Use the standard attach method
			return KAMI721ACFactory.attach(deployedAddress, signer);
		} catch (error) {
			console.error('KAMI721AC (standard) deployment failed:', error);
			if (error instanceof Error) {
				throw new Error(`KAMI721AC (standard) deployment failed: ${error.message}`);
			}
			throw new Error('KAMI721AC (standard) deployment failed with an unknown error.');
		}
	}

	/**
	 * Deploys a new upgradeable KAMI721AC contract using the Transparent Proxy pattern.
	 * @param initArgs The arguments for the initializer function.
	 * @param signer The signer to use for deployment.
	 * @param proxyAdminOwner (Optional) The address that will own the ProxyAdmin. Defaults to the signer.
	 * @returns A Promise resolving to a KAMI721ACWrapper instance attached to the proxy address.
	 */
	static async deployUpgradeable(initArgs: KAMI721ACInitializeArgs, signer: Signer, proxyAdminOwner?: string): Promise<KAMI721ACWrapper> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}
		const signerAddress = await signer.getAddress();
		const adminOwner = proxyAdminOwner ? proxyAdminOwner.toString() : signerAddress;

		// 1. Deploy Implementation
		const implFactory = new ContractFactory(KAMI721ACUpgradeableArtifact.abi as any, KAMI721ACUpgradeableArtifact.bytecode, signer);
		console.log('Deploying KAMI721ACUpgradeable implementation...');
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
		const implementationInterface = new ethers.utils.Interface(KAMI721ACUpgradeableArtifact.abi);
		// Use the same 7 args as KAMI721C's initializer
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
		return KAMI721ACFactory.attachUpgradeable(proxyAddress, signer);
	}

	/**
	 * Initiates an upgrade of a KAMI721AC transparent proxy.
	 * Deploys the new KAMI721ACUpgradeable implementation.
	 * @param signer The signer for deployment.
	 * @returns The address of the newly deployed implementation contract.
	 */
	static async deployNewImplementation(signer: Signer): Promise<string> {
		if (!signer) {
			throw new Error('Signer is required for deployment.');
		}
		const implFactory = new ContractFactory(KAMI721ACUpgradeableArtifact.abi as any, KAMI721ACUpgradeableArtifact.bytecode, signer);
		console.log('Deploying new KAMI721ACUpgradeable implementation...');
		const newImplementation = await implFactory.deploy();
		await newImplementation.deployed();
		const newImplementationAddress = newImplementation.address;
		console.log(`New implementation deployed to: ${newImplementationAddress}`);

		return newImplementationAddress;
	}
}
