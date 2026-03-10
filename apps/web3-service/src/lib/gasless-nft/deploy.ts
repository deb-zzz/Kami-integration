import {
	KamiSponsoredDeployment,
	SponsoredDeploymentConfig,
	SponsoredDeploymentParams,
	createUserSignatureData,
	ENTRY_POINT_V07_ADDRESS,
} from '@paulstinchcombe/gasless-nft-tx';
import { ChargeLocation, Web3TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { getPrivateKeyByChainId } from '@/app/utils/secrets';
import { prisma } from '@/lib/db';
import {
	getBlockchainInfo,
	getChainIdWithDefault,
	getDefaultPaymentToken,
	getHexChainId,
	getPlatformInfo,
	validateChainId,
	validatePaymentTokens,
} from './config';
import { grantOwnerRoleToSimpleAccount, grantOwnerRoleViaDeployerSimpleAccount, setMaxQuantity, setMintPrice } from './operations';
import { generateUserSignature, normalizePrivateKey } from './signatures';
import { createTransaction } from './transaction';
import { getPaymentTokenDecimals, toTokenUnits } from './tokens';
import type { DeployKami721ACParams, DeployKami721CParams, DeployKami1155Params, DeployContractParams, DeployResponse } from './types';
import { getOwnerPrivateKey } from './wallet';

/** Build a detailed error message when deployment tx reverted (package returns "Deployment transaction failed"). */
function deploymentRevertedMessage(contractType: string, chainId: string, blockchainInfo?: { explorerUrl?: string | null } | null): string {
	const numChainId = Number(chainId.startsWith('0x') ? parseInt(chainId, 16) : chainId);
	const explorerBase =
		blockchainInfo?.explorerUrl ??
		(numChainId === 84532 ? 'https://sepolia.basescan.org' : numChainId === 8453 ? 'https://basescan.org' : null);
	const explorerHint = explorerBase
		? ` Check the logs above for the transaction hash (look for "Transaction: 0x...") and inspect it at ${explorerBase}/tx/<hash> to see the exact revert reason.`
		: ' Check the logs above for the transaction hash and inspect it on the block explorer for this chain.';
	const base =
		`Failed to deploy ${contractType} contract: Deployment transaction failed. ` +
		`The transaction was sent but reverted on-chain. ` +
		`A common revert reason is "ContractDeployer: deployment failed", which usually means the contract constructor reverted (e.g. zero address for payment token, platform, or admin; or invalid platform commission).`;
	const kami721acHint =
		contractType === 'KAMI721-AC'
			? ` When the block explorer shows "ContractDeployer: deployment failed", the KAMI721AC constructor reverted during CREATE. Ensure: (1) platform row has a non-zero platformAddress; (2) payment token is set for the chain; (3) platformCommissionPercentage ≤ 2000 (20% max); (4) voucher.maxQuantity > 0 if the contract requires a supply cap; (5) product price set so mintPrice_ > 0 if required. If all look correct, the cause may be in the gasless-nft-tx library or chain-specific KAMI721AC bytecode (e.g. libraries).`
			: '';
	return base + kami721acHint + explorerHint;
}
import { validateWalletAccess } from './wallet';

export async function deployKami721CContract(params: DeployKami721CParams): Promise<DeployResponse> {
	try {
		console.log(`Deploying sponsored KAMI721-C contract: ${params.name} (${params.symbol})`);

		const chainId = getHexChainId(params.chainId);

		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(chainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${chainId}`);
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		// Deploy uses direct path (platform EOA is SimpleAccount owner). EntryPoint not used for deploy.
		const deploymentConfig: SponsoredDeploymentConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			contractDeployerAddress: platformInfo.contractDeployerAddress as `0x${string}`,
			platformAddress: platformInfo.platformAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			useEntryPointForExecute: false,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
		};

		const deployer = new KamiSponsoredDeployment(deploymentConfig);

		const userSignature = await generateUserSignature(
			platformPrivateKey,
			params.name,
			params.symbol,
			params.baseURI,
			params.initialMintPrice,
			params.platformCommissionPercentage,
			blockchainInfo.rpcUrl
		);

		const userSignatureData = createUserSignatureData(
			params.ownerAddress as `0x${string}`,
			params.name,
			params.symbol,
			params.baseURI,
			params.initialMintPrice,
			params.platformCommissionPercentage,
			userSignature
		);

		console.log('🚀 Deploying KAMI721C with sponsored gas...');
		console.log(`   Name: ${params.name}`);
		console.log(`   Symbol: ${params.symbol}`);
		console.log(`   Mint Price: 0 ETH`);
		console.log('💰 Platform pays ALL gas fees...');

		const deploymentParams: SponsoredDeploymentParams = {
			contractName: params.name,
			contractSymbol: params.symbol,
			baseTokenURI: params.baseURI,
			initialMintPrice: params.initialMintPrice,
			platformCommissionPercentage: params.platformCommissionPercentage,
			userSignature: userSignatureData,
		};

		const deployment = await deployer.deployKAMI721C(deploymentParams);

		console.log('Deployment result:', {
			success: deployment.success,
			contractAddress: deployment.contractAddress,
			transactionHash: deployment.transactionHash,
			error: deployment.error,
		});

		if (!deployment.success || !deployment.contractAddress) {
			console.error('Error deploying sponsored KAMI721-C contract:', deployment.error);
			const message =
				deployment.error === 'Deployment transaction failed'
					? deploymentRevertedMessage('KAMI721-C', chainId, blockchainInfo)
					: `Failed to deploy KAMI721-C contract: ${deployment.error || 'Unknown error'}`;
			throw new Error(message);
		}

		if (deployment.transactionHash) {
			await createTransaction(
				Web3TransactionType.Deploy721C,
				deployment.transactionHash,
				blockchainInfo,
				params.ownerAddress,
				params.checkoutId
			);
		}

		console.log(`KAMI721-C contract deployed successfully at: ${deployment.contractAddress}`);

		try {
			console.log(`🔐 Granting OWNER_ROLE to simple account for KAMI721C contract...`);
			let grantSucceeded = await grantOwnerRoleViaDeployerSimpleAccount(
				chainId,
				deployment.contractAddress as `0x${string}`,
				'ERC721C',
				platformInfo.simpleAccountAddress as `0x${string}`
			);
			if (grantSucceeded) {
				console.log(`✅ OWNER_ROLE granted successfully to simple account`);
			} else {
				console.warn(`⚠️  Deployer-based grant failed, trying owner-signed grant...`);
				const ownerPrivateKey = await getOwnerPrivateKey(params.ownerAddress);
				if (ownerPrivateKey) {
					grantSucceeded = await grantOwnerRoleToSimpleAccount(
						chainId,
						deployment.contractAddress as `0x${string}`,
						'ERC721C',
						ownerPrivateKey,
						platformInfo.simpleAccountAddress as `0x${string}`
					);
					if (grantSucceeded) {
						console.log(`✅ OWNER_ROLE granted via owner signature`);
					}
				}
				if (!grantSucceeded) {
					console.warn(`   Please grant OWNER_ROLE manually to ${platformInfo.simpleAccountAddress}`);
				}
			}
		} catch (error) {
			console.warn(`⚠️  Error granting OWNER_ROLE: ${error instanceof Error ? error.message : 'Unknown error'}`);
			console.warn(`   The contract was deployed successfully, but OWNER_ROLE was not granted.`);
			console.warn(`   Operations like setTokenURI may fail until OWNER_ROLE is granted to ${platformInfo.simpleAccountAddress}`);
		}

		// KAMI721C uses per-token pricing; we do not set mint price after deploy (unlike KAMI721AC).
		return {
			contractAddress: deployment.contractAddress,
			transactionHash: deployment.transactionHash || '',
			blockNumber: 0,
			gasUsed: '0',
			checkoutId: params.checkoutId,
		};
	} catch (error) {
		console.error('Error deploying sponsored KAMI721-C contract:', error);
		throw new Error(`Failed to deploy KAMI721-C contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export async function deployKami721ACContract(params: DeployKami721ACParams): Promise<DeployResponse> {
	try {
		console.log(`Deploying sponsored KAMI721-AC contract: ${params.name} (${params.symbol})`);

		const chainId = getHexChainId(params.chainId);

		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(chainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${chainId}`);
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		// Deploy uses direct path (platform EOA is SimpleAccount owner). EntryPoint not used for deploy.
		const deploymentConfig: SponsoredDeploymentConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			contractDeployerAddress: platformInfo.contractDeployerAddress as `0x${string}`,
			platformAddress: platformInfo.platformAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			useEntryPointForExecute: false,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
		};

		const deployer = new KamiSponsoredDeployment(deploymentConfig);

		// Resolve initial mint price in payment-token units (bigint) for constructor and user signature
		let initialMintPriceBigInt: bigint = BigInt(0);
		if (params.initialMintPrice !== undefined && params.initialMintPrice !== null) {
			const decimals = await getPaymentTokenDecimals(
				paymentToken.contractAddress as `0x${string}`,
				blockchainInfo.rpcUrl ?? undefined
			);
			initialMintPriceBigInt = toTokenUnits(
				typeof params.initialMintPrice === 'bigint' ? params.initialMintPrice.toString() : String(params.initialMintPrice),
				decimals
			);
			console.log(`   Initial mint price: ${params.initialMintPrice} (${initialMintPriceBigInt.toString()} token units)`);
		}

		const userSignature = await generateUserSignature(
			platformPrivateKey,
			params.name,
			params.symbol,
			params.baseURI,
			initialMintPriceBigInt,
			params.platformCommissionPercentage,
			blockchainInfo.rpcUrl
		);

		const userSignatureData = createUserSignatureData(
			params.ownerAddress as `0x${string}`,
			params.name,
			params.symbol,
			params.baseURI,
			initialMintPriceBigInt,
			params.platformCommissionPercentage,
			userSignature
		);

		// KAMI721AC constructor reverts if platformCommissionPercentage > 2000 (20% max). Clamp again here as safeguard.
		const KAMI721AC_MAX_COMMISSION_BP = 2000;
		const commissionForContract =
			params.platformCommissionPercentage > KAMI721AC_MAX_COMMISSION_BP
				? KAMI721AC_MAX_COMMISSION_BP
				: params.platformCommissionPercentage;
		if (commissionForContract !== params.platformCommissionPercentage) {
			console.warn(
				`[deployKami721ACContract] Clamping platformCommissionPercentage ${params.platformCommissionPercentage} to ${commissionForContract} (contract max ${KAMI721AC_MAX_COMMISSION_BP}).`
			);
		}

		console.log('🚀 Deploying KAMI721AC with sponsored gas...');
		console.log(`   Name: ${params.name}`);
		console.log(`   Symbol: ${params.symbol}`);
		console.log(`   Mint Price: ${initialMintPriceBigInt === BigInt(0) ? '0' : params.initialMintPrice}`);
		console.log(
			`   Constructor: platformCommission=${commissionForContract} (bp), platformAddress=${
				platformInfo.platformAddress
			}, paymentToken=${paymentToken.contractAddress}, adminAddress=${platformInfo.simpleAccountAddress}, totalSupply=${
				params.maxQuantity ?? 0
			}`
		);
		console.log('💰 Platform pays ALL gas fees...');

		const deploymentParams: SponsoredDeploymentParams = {
			contractName: params.name,
			contractSymbol: params.symbol,
			baseTokenURI: params.baseURI,
			initialMintPrice: initialMintPriceBigInt,
			platformCommissionPercentage: commissionForContract,
			userSignature: userSignatureData,
			// totalSupply_ in constructor: 0 = unlimited; pass maxQuantity when set so contract is deployed with correct cap
			...(params.maxQuantity !== undefined && params.maxQuantity !== null && { totalSupply: BigInt(params.maxQuantity) }),
		};

		// Log exact call to gasless-nft-tx: deployKAMI721AC(params). Library maps this to constructor:
		// (paymentToken_, name_, symbol_, baseTokenURI_, platformAddress_, platformCommissionPercentage_, adminAddress_, totalSupply_, mintPrice_)
		console.log(
			'📤 gasless-nft-tx call: deployKAMI721AC({',
			{
				contractName: deploymentParams.contractName,
				contractSymbol: deploymentParams.contractSymbol,
				baseTokenURI: deploymentParams.baseTokenURI,
				initialMintPrice: deploymentParams.initialMintPrice.toString(),
				platformCommissionPercentage: deploymentParams.platformCommissionPercentage,
				totalSupply: deploymentParams.totalSupply?.toString() ?? '0n (unlimited)',
				userSignature: {
					userAddress: deploymentParams.userSignature.userAddress,
					contractName: deploymentParams.userSignature.contractName,
					contractSymbol: deploymentParams.userSignature.contractSymbol,
					baseTokenURI: deploymentParams.userSignature.baseTokenURI,
					initialMintPrice: deploymentParams.userSignature.initialMintPrice.toString(),
					platformCommissionPercentage: deploymentParams.userSignature.platformCommissionPercentage,
					signature: `${deploymentParams.userSignature.signature.slice(0, 18)}...`,
				},
			},
			'})'
		);
		console.log(
			'   → Library encodes constructor as: paymentToken_(address), name_(string), symbol_(string), baseTokenURI_(string), platformAddress_(address), platformCommissionPercentage_(uint96), adminAddress_(address), totalSupply_(uint256), mintPrice_(uint256)'
		);
		console.log('   → Constructor arg values (from params + config):', {
			paymentToken_: paymentToken.contractAddress,
			name_: deploymentParams.contractName,
			symbol_: deploymentParams.contractSymbol,
			baseTokenURI_: deploymentParams.baseTokenURI,
			platformAddress_: platformInfo.platformAddress,
			platformCommissionPercentage_: deploymentParams.platformCommissionPercentage,
			adminAddress_: platformInfo.simpleAccountAddress,
			totalSupply_: deploymentParams.totalSupply?.toString() ?? '0',
			mintPrice_: deploymentParams.initialMintPrice.toString(),
		});

		const deployment = await deployer.deployKAMI721AC(deploymentParams);

		console.log('Deployment result:', {
			success: deployment.success,
			contractAddress: deployment.contractAddress,
			transactionHash: deployment.transactionHash,
			error: deployment.error,
		});

		if (!deployment.success || !deployment.contractAddress) {
			console.error('Error deploying sponsored KAMI721-AC contract:', deployment.error);
			const txHashHint =
				' Check the logs above for the line "Transaction: 0x..." — open that hash on the block explorer (e.g. basescan.org/tx/0x... or sepolia.basescan.org/tx/0x...) to see the exact revert reason.';
			const message =
				deployment.error === 'Deployment transaction failed' || deployment.error?.startsWith('Deployment transaction failed')
					? deploymentRevertedMessage('KAMI721-AC', chainId, blockchainInfo) + txHashHint
					: `Failed to deploy KAMI721-AC contract: ${deployment.error || 'Unknown error'}${txHashHint}`;
			throw new Error(message);
		}

		console.log(`KAMI721-AC contract deployed successfully at: ${deployment.contractAddress}`);

		if (deployment.transactionHash) {
			const txRecord = await createTransaction(
				Web3TransactionType.Deploy721AC,
				deployment.transactionHash,
				blockchainInfo,
				params.ownerAddress,
				params.checkoutId
			);
			if (!txRecord) {
				console.warn(`⚠️  Failed to create transaction record for Deploy721AC: ${deployment.transactionHash}`);
			} else {
				console.log(`✅ Transaction record created for Deploy721AC: ${txRecord.hash}`);
			}
		}

		try {
			console.log(`🔐 Granting OWNER_ROLE to simple account for KAMI721AC contract...`);
			let grantSucceeded = await grantOwnerRoleViaDeployerSimpleAccount(
				chainId,
				deployment.contractAddress as `0x${string}`,
				'ERC721AC',
				platformInfo.simpleAccountAddress as `0x${string}`
			);
			if (grantSucceeded) {
				console.log(`✅ OWNER_ROLE granted successfully to simple account`);
			} else {
				console.warn(`⚠️  Deployer-based grant failed, trying owner-signed grant...`);
				const ownerPrivateKey = await getOwnerPrivateKey(params.ownerAddress);
				if (ownerPrivateKey) {
					grantSucceeded = await grantOwnerRoleToSimpleAccount(
						chainId,
						deployment.contractAddress as `0x${string}`,
						'ERC721AC',
						ownerPrivateKey,
						platformInfo.simpleAccountAddress as `0x${string}`
					);
					if (grantSucceeded) {
						console.log(`✅ OWNER_ROLE granted via owner signature`);
					}
				}
				if (!grantSucceeded) {
					console.warn(`   Please grant OWNER_ROLE manually to ${platformInfo.simpleAccountAddress}`);
				}
			}
		} catch (error) {
			console.warn(`⚠️  Error granting OWNER_ROLE: ${error instanceof Error ? error.message : 'Unknown error'}`);
			console.warn(`   The contract was deployed successfully, but OWNER_ROLE was not granted.`);
			console.warn(`   Operations like setTokenURI may fail until OWNER_ROLE is granted to ${platformInfo.simpleAccountAddress}`);
		}

		if (params.initialMintPrice !== undefined && params.initialMintPrice !== null) {
			try {
				console.log(`Setting initial mint price for KAMI721AC contract: ${deployment.contractAddress}`);
				const ownerPrivateKey = await getOwnerPrivateKey(params.ownerAddress);
				if (!ownerPrivateKey) {
					console.warn(`⚠️  Owner private key not found for ${params.ownerAddress}. Cannot set mint price automatically.`);
					console.warn(`   Please set the mint price manually using setMintPrice() before minting tokens.`);
				} else {
					const mintPriceSet = await setMintPrice(
						chainId,
						deployment.contractAddress as `0x${string}`,
						'ERC721AC',
						params.initialMintPrice,
						{
							ownerPrivateKey: ownerPrivateKey,
							simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
						}
					);
					if (mintPriceSet) {
						console.log(`✅ Mint price set successfully for KAMI721AC contract`);
					} else {
						console.warn(`⚠️  Failed to set mint price. Please set it manually before minting tokens.`);
					}
				}
			} catch (error) {
				console.warn(`⚠️  Error setting initial mint price: ${error instanceof Error ? error.message : 'Unknown error'}`);
				console.warn(`   The contract was deployed successfully, but mint price was not set.`);
				console.warn(`   Please set the mint price manually using setMintPrice() before minting tokens.`);
			}
		} else {
			console.warn(`⚠️  No initialMintPrice provided for KAMI721AC contract.`);
			console.warn(`   Please set the mint price using setMintPrice() before minting tokens.`);
		}

		if (params.maxQuantity !== undefined && params.maxQuantity !== null) {
			try {
				console.log(
					`Setting maxQuantity for KAMI721AC contract: ${deployment.contractAddress}, maxQuantity: ${params.maxQuantity}`
				);
				const ownerPrivateKey = await getOwnerPrivateKey(params.ownerAddress);
				if (!ownerPrivateKey) {
					console.warn(`⚠️  Owner private key not found for ${params.ownerAddress}. Cannot set maxQuantity automatically.`);
					console.warn(`   Please set the maxQuantity manually using setMaxQuantity() before minting tokens.`);
				} else {
					const maxQuantitySet = await setMaxQuantity(chainId, deployment.contractAddress as `0x${string}`, params.maxQuantity, {
						ownerPrivateKey: ownerPrivateKey,
						simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
					});
					if (maxQuantitySet) {
						console.log(`✅ MaxQuantity set successfully for KAMI721AC contract: ${params.maxQuantity}`);
					} else {
						console.warn(`⚠️  Failed to set maxQuantity. Please set it manually before minting tokens.`);
					}
				}
			} catch (error) {
				console.warn(`⚠️  Error setting maxQuantity: ${error instanceof Error ? error.message : 'Unknown error'}`);
				console.warn(`   The contract was deployed successfully, but maxQuantity was not set.`);
				console.warn(`   Please set the maxQuantity manually using setMaxQuantity() before minting tokens.`);
			}
		} else {
			console.log(`ℹ️  No maxQuantity provided for KAMI721AC contract, using unlimited (0).`);
		}

		return {
			contractAddress: deployment.contractAddress,
			transactionHash: deployment.transactionHash || '',
			blockNumber: 0,
			gasUsed: '0',
			checkoutId: params.checkoutId,
		};
	} catch (error) {
		console.error('Error deploying sponsored KAMI721-AC contract:', error);
		throw new Error(`Failed to deploy KAMI721-AC contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export async function deployKami1155Contract(params: DeployKami1155Params): Promise<DeployResponse> {
	try {
		console.log(`Deploying sponsored KAMI1155-C contract with URI: ${params.uri}`);

		const chainId = getHexChainId(params.chainId);

		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(chainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${chainId}`);
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		// Deploy uses direct path (platform EOA is SimpleAccount owner). EntryPoint not used for deploy.
		const deploymentConfig: SponsoredDeploymentConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			contractDeployerAddress: platformInfo.contractDeployerAddress as `0x${string}`,
			platformAddress: platformInfo.platformAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			useEntryPointForExecute: false,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
		};

		const deployer = new KamiSponsoredDeployment(deploymentConfig);

		const userSignature = await generateUserSignature(
			platformPrivateKey,
			params.name || 'KAMI1155C',
			params.symbol || 'K1155C',
			params.uri,
			BigInt(0),
			params.platformCommissionPercentage,
			blockchainInfo.rpcUrl
		);

		const userSignatureData = createUserSignatureData(
			params.ownerAddress as `0x${string}`,
			params.name || 'KAMI1155C',
			params.symbol || 'K1155C',
			params.uri,
			BigInt(0),
			params.platformCommissionPercentage,
			userSignature
		);

		console.log('🚀 Deploying KAMI1155C with sponsored gas...');
		console.log(`   URI: ${params.uri}`);
		console.log(`   Mint Price: 0 ETH`);
		console.log('💰 Platform pays ALL gas fees...');

		const deploymentParams: SponsoredDeploymentParams = {
			contractName: params.name || 'KAMI1155C',
			contractSymbol: params.symbol || 'K1155C',
			baseTokenURI: params.uri,
			initialMintPrice: BigInt(0),
			platformCommissionPercentage: params.platformCommissionPercentage,
			userSignature: userSignatureData,
		};

		const deployment = await deployer.deployKAMI1155C(deploymentParams);

		console.log('Deployment result:', {
			success: deployment.success,
			contractAddress: deployment.contractAddress,
			transactionHash: deployment.transactionHash,
			error: deployment.error,
		});

		if (!deployment.success || !deployment.contractAddress) {
			console.error('Error deploying sponsored KAMI1155-C contract:', deployment.error);
			const message =
				deployment.error === 'Deployment transaction failed'
					? deploymentRevertedMessage('KAMI1155-C', chainId, blockchainInfo)
					: `Failed to deploy KAMI1155-C contract: ${deployment.error || 'Unknown error'}`;
			throw new Error(message);
		}

		if (deployment.transactionHash) {
			await createTransaction(
				Web3TransactionType.Deploy1155C,
				deployment.transactionHash,
				blockchainInfo,
				params.ownerAddress,
				params.checkoutId
			);
		}

		console.log(`KAMI1155-C contract deployed successfully at: ${deployment.contractAddress}`);

		return {
			contractAddress: deployment.contractAddress,
			transactionHash: deployment.transactionHash || '',
			blockNumber: 0,
			gasUsed: '0',
			checkoutId: params.checkoutId,
		};
	} catch (error) {
		console.error('Error deploying sponsored KAMI1155-C contract:', error);
		throw new Error(`Failed to deploy KAMI1155-C contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export async function deployKamiNFTContract(params: DeployContractParams): Promise<DeployResponse> {
	try {
		switch (params.contractType) {
			case 'ERC721C':
				return deployKami721CContract(params as DeployKami721CParams);
			case 'ERC721AC':
				return deployKami721ACContract(params as DeployKami721ACParams);
			case 'ERC1155C':
				return deployKami1155Contract(params as DeployKami1155Params);
			default:
				throw new Error(`Unsupported contract type`);
		}
	} catch (error) {
		console.error(`Failed in deployKamiNftContract: ${error instanceof Error ? error.message : 'Unknown error'}`);
		throw error;
	}
}

/**
 * Deploy a gasless KAMI NFT collection.
 * @param collectionId - Collection to deploy
 * @param checkoutId - Optional checkout id for transaction correlation
 * @param voucherId - Optional voucher id; when provided (e.g. from checkout), its maxQuantity is used for ERC721AC totalSupply instead of the first voucher by id, avoiding DB/contract mismatch for multi-voucher collections
 */
export async function deployGaslessCollection(collectionId: number, checkoutId?: string, voucherId?: number): Promise<DeployResponse> {
	try {
		const collection = await prisma.collection.findUnique({
			where: { collectionId },
		});

		if (!collection) {
			throw new Error(`Collection not found: ${collectionId}`);
		}

		if (collection.contractType === 'ERC1155C') {
			throw new Error(`ERC1155C is not supported for gasless deployment`);
		}

		if (collection.contractAddress) {
			console.log(
				`Collection with id ${collectionId} is already deployed to ${collection.contractAddress}. Returning existing deployment.`
			);
			const chainIdValue = getChainIdWithDefault(collection.chainId);
			if (!chainIdValue) {
				throw new Error(
					`Collection ${collectionId} does not have a chainId set and DEFAULT_CHAIN_ID environment variable is not configured. ` +
						`Please update the collection with a valid chainId or set DEFAULT_CHAIN_ID.`
				);
			}
			if (!collection.chainId && process.env.DEFAULT_CHAIN_ID) {
				console.log(
					`[deployGaslessCollection] Using DEFAULT_CHAIN_ID from environment: ${process.env.DEFAULT_CHAIN_ID} for collection ${collectionId}`
				);
			}
			const chainId = getHexChainId(chainIdValue);
			const txType = collection.contractType === 'ERC721AC' ? 'Deploy721AC' : 'Deploy721C';
			const deploymentTx = checkoutId
				? await prisma.transaction.findFirst({
						where: {
							chainId: chainId,
							type: txType,
							checkoutId: checkoutId,
						},
						orderBy: {
							timestamp: 'desc',
						},
				  })
				: await prisma.transaction.findFirst({
						where: {
							chainId: chainId,
							type: txType,
							from: collection.ownerWalletAddress,
						},
						orderBy: {
							timestamp: 'desc',
						},
				  });

			return {
				contractAddress: collection.contractAddress,
				transactionHash: deploymentTx?.hash || '',
				blockNumber: deploymentTx?.blockNumber || 0,
				gasUsed: deploymentTx?.gasUsed || '0',
				checkoutId: checkoutId,
			};
		}

		let chainIdValue = getChainIdWithDefault(collection.chainId);
		if (!chainIdValue) {
			throw new Error(
				`Collection ${collectionId} does not have a chainId set and DEFAULT_CHAIN_ID environment variable is not configured. ` +
					`Please update the collection with a valid chainId or set DEFAULT_CHAIN_ID.`
			);
		}
		if (!collection.chainId && process.env.DEFAULT_CHAIN_ID) {
			console.log(
				`[deployGaslessCollection] Using DEFAULT_CHAIN_ID from environment: ${process.env.DEFAULT_CHAIN_ID} for collection ${collectionId}`
			);
			await prisma.collection.update({
				where: { collectionId },
				data: { chainId: process.env.DEFAULT_CHAIN_ID },
			});
			chainIdValue = process.env.DEFAULT_CHAIN_ID;
		}

		const chainId = getHexChainId(chainIdValue);
		const ownerAddress = collection.ownerWalletAddress;

		const isValidChainId = await validateChainId(chainId);
		if (!isValidChainId) {
			const errorMsg = `Invalid chainId: ${chainId} for collection ${collectionId}. ChainId must exist in the blockchain table.`;
			console.error(`[deployGaslessCollection] ${errorMsg}`);
			throw new Error(errorMsg);
		}

		const hasAccess = await validateWalletAccess(chainId as `0x${string}`, ownerAddress);
		if (!hasAccess) {
			throw new Error(`Wallet access denied for: ${ownerAddress}`);
		}

		const baseURI = `https://api.kami.com/metadata/${collectionId}/`;

		let fees: { _sum: { percentage: Decimal | null } };
		try {
			fees = await prisma.charge.aggregate({
				where: {
					location: ChargeLocation.Transaction,
					deletedAt: null,
				},
				_sum: { percentage: true },
			});
		} catch (error) {
			console.error(`Error getting fees: ${error instanceof Error ? error.message : 'Unknown error'}`);
			fees = { _sum: { percentage: null } };
		}
		const platformCommissionPercentage = fees?._sum?.percentage?.toNumber() || 0;

		let deployParams: DeployContractParams;

		const blockchainInfo = await getBlockchainInfo(chainId as `0x${string}`);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		let initialMintPrice: number | undefined = undefined;
		let maxQuantity: number | undefined = undefined;
		if (collection.contractType === 'ERC721AC') {
			try {
				const product = await prisma.product.findFirst({
					where: { collectionId: collectionId },
					orderBy: { id: 'asc' },
				});
				if (product && product.price) {
					initialMintPrice = product.price.toNumber();
					console.log(`Found product price for KAMI721AC collection: ${initialMintPrice}`);
				} else {
					console.warn(
						`⚠️  No product price found for KAMI721AC collection ${collectionId}. Mint price will need to be set manually.`
					);
				}

				// Use the specified voucher's maxQuantity when provided (e.g. from checkout), so contract matches the voucher we're minting; otherwise fall back to first voucher by id
				const voucher = voucherId
					? await prisma.voucher.findFirst({
							where: { id: voucherId, collectionId: collectionId },
							include: { product: true },
					  })
					: await prisma.voucher.findFirst({
							where: { collectionId: collectionId },
							orderBy: { id: 'asc' },
							include: { product: true },
					  });
				if (voucher) {
					const voucherMaxQuantity = (voucher as any).maxQuantity;
					const productMaxQuantity = voucher.product ? (voucher.product as any).maxQuantity : null;
					const resolvedMaxQuantity =
						voucherMaxQuantity !== null && voucherMaxQuantity !== undefined
							? voucherMaxQuantity
							: productMaxQuantity !== null && productMaxQuantity !== undefined
							? productMaxQuantity
							: null;
					if (resolvedMaxQuantity !== null && resolvedMaxQuantity !== undefined) {
						maxQuantity = resolvedMaxQuantity;
						console.log(
							`Found maxQuantity for KAMI721AC collection: ${maxQuantity} (from ${
								voucherId ? `voucher ${voucherId}` : 'first voucher'
							}${
								resolvedMaxQuantity === productMaxQuantity && voucherMaxQuantity !== resolvedMaxQuantity
									? ', product fallback'
									: ''
							})`
						);
					} else {
						maxQuantity = 0;
						console.log(
							`No maxQuantity set in voucher${
								voucherId ? ` ${voucherId}` : ''
							} or product for KAMI721AC collection ${collectionId}, using unlimited (0)`
						);
					}
				} else {
					console.warn(
						`⚠️  No voucher found for KAMI721AC collection ${collectionId}${
							voucherId ? ` with id ${voucherId}` : ''
						}. MaxQuantity will default to unlimited (0).`
					);
					maxQuantity = 0;
				}
			} catch (error) {
				console.warn(`⚠️  Error fetching product/voucher data: ${error instanceof Error ? error.message : 'Unknown error'}`);
				maxQuantity = 0;
			}
		}

		switch (collection.contractType) {
			case 'ERC721C':
				deployParams = {
					contractType: 'ERC721C',
					ownerAddress,
					name: collection.name,
					symbol: collection.symbol,
					baseURI,
					initialMintPrice: BigInt(0),
					platformCommissionPercentage: platformCommissionPercentage,
					chainId: chainId as `0x${string}`,
					checkoutId,
				} as DeployKami721CParams;
				break;
			case 'ERC721AC': {
				// KAMI721AC constructor requires valid platformAddress; validate before deploy
				const platformAddr = platformInfo.platformAddress?.trim();
				if (!platformAddr || platformAddr === '0x0000000000000000000000000000000000000000') {
					throw new Error(
						`Cannot deploy KAMI721AC: platform row for chainId ${blockchainInfo.chainId} has no valid platformAddress. ` +
							`Set platform.platformAddress in the database for this chain.`
					);
				}
				const paymentToken = await getDefaultPaymentToken(chainId as `0x${string}`);
				if (
					!paymentToken?.contractAddress?.trim() ||
					paymentToken.contractAddress === '0x0000000000000000000000000000000000000000'
				) {
					throw new Error(
						`Cannot deploy KAMI721AC: no valid payment token for chainId ${chainId}. Check blockchain.paymentTokens.`
					);
				}
				// KAMI721AC constructor reverts with PlatformCommissionTooHigh() if > 2000 (max 20%).
				const KAMI721AC_MAX_COMMISSION_BP = 2000;
				const commissionBasisPoints =
					platformCommissionPercentage > KAMI721AC_MAX_COMMISSION_BP
						? Math.min(KAMI721AC_MAX_COMMISSION_BP, platformCommissionPercentage)
						: platformCommissionPercentage;
				if (commissionBasisPoints !== platformCommissionPercentage) {
					console.warn(
						`[deployGaslessCollection] KAMI721AC allows platformCommissionPercentage max ${KAMI721AC_MAX_COMMISSION_BP} (20%). ` +
							`Clamped ${platformCommissionPercentage} to ${commissionBasisPoints}.`
					);
				}
				if (maxQuantity === 0 || maxQuantity === null || maxQuantity === undefined) {
					console.warn(
						`[deployGaslessCollection] KAMI721AC collection ${collectionId} deploying with totalSupply=0 (unlimited). ` +
							`If the contract reverts, try setting voucher.maxQuantity > 0 for this collection.`
					);
				}
				deployParams = {
					contractType: 'ERC721AC',
					ownerAddress,
					name: collection.name,
					symbol: collection.symbol,
					baseURI: baseURI,
					initialMintPrice: initialMintPrice,
					maxQuantity: maxQuantity,
					platformCommissionPercentage: commissionBasisPoints,
					chainId: chainId as `0x${string}`,
					checkoutId,
				} as DeployKami721ACParams;
				break;
			}
			default:
				throw new Error(`Unsupported contract type: ${collection.contractType}`);
		}

		let result: DeployResponse;
		try {
			result = await deployKamiNFTContract(deployParams);
		} catch (error) {
			console.error('Error deploying gasless KAMI NFT contract:', error instanceof Error ? error.message : 'Unknown error');
			throw error;
		}

		console.log('DeployKamiNFTContract result:', {
			contractAddress: result.contractAddress,
			transactionHash: result.transactionHash,
			blockNumber: result.blockNumber,
			gasUsed: result.gasUsed,
			checkoutId: result.checkoutId,
		});

		if (!result.contractAddress) {
			throw new Error(`Error in deploy results for KAMI NFT contract: No contractAddress!`);
		}

		await prisma.collection.update({
			where: { collectionId },
			data: {
				contractAddress: result.contractAddress,
			},
		});

		if (collection.contractType === 'ERC721AC' && maxQuantity !== undefined && maxQuantity !== null && maxQuantity > 0) {
			try {
				const products = await prisma.product.findMany({
					where: { collectionId: collectionId },
				});

				if (products.length > 0) {
					await prisma.product.updateMany({
						where: { collectionId: collectionId },
						data: {
							availableQuantity: maxQuantity,
						},
					});

					console.log(
						`✅ Set availableQuantity = ${maxQuantity} for ${products.length} product(s) in ERC721AC collection ${collectionId}`
					);
				} else {
					console.warn(`⚠️  No products found for collection ${collectionId}. availableQuantity not updated.`);
				}
			} catch (error) {
				console.warn(
					`⚠️  Error setting availableQuantity for products: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
				console.warn(`   Collection deployed successfully, but availableQuantity was not updated.`);
			}
		} else if (collection.contractType === 'ERC721AC' && (maxQuantity === 0 || maxQuantity === null || maxQuantity === undefined)) {
			console.log(`ℹ️  ERC721AC collection ${collectionId} has unlimited maxQuantity (0). availableQuantity left unchanged.`);
		}

		console.log(`KAMI NFT Collection ${collectionId} (${collection.contractType}) deployed at: ${result.contractAddress}`);
		return result;
	} catch (error) {
		console.error('Error deploying gasless KAMI collection:', error);
		throw error;
	}
}
