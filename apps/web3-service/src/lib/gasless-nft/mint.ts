import { KamiSponsoredOperations, SponsoredMintParams, type RoyaltyData } from '@paulstinchcombe/gasless-nft-tx';
import type { SponsoredOperationsConfig } from '@paulstinchcombe/gasless-nft-tx/dist/kami-sponsored-operations';
import { ENTRY_POINT_V07_ADDRESS } from '@paulstinchcombe/gasless-nft-tx/dist/SmartContractWallet/simpleAccountUserOp';
import { ConsumerAction, ContractType, Web3TransactionType } from '@prisma/client';
import { getPrivateKeyByChainId } from '@/app/utils/secrets';
import { prisma } from '@/lib/db';
import type { Metadata } from '@/lib/types';
import type { Chain } from 'viem';
import { createPublicClient, getAddress, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addFileToIPFS, addMetadataToIPFS } from '@/lib/ipfs';
import { BATCH_CONFIG } from '@/lib/gasless-config';
import {
	getBlockchainInfo,
	getChainIdWithDefault,
	getDefaultPaymentToken,
	getHexChainId,
	getPlatformInfo,
	validateChainId,
	validatePaymentTokens,
} from './config';
import { kamiMaxQuantity, kamiTotalMinted } from './contract-reads';
import { validateAndCorrectContractQuantityState } from './inventory';
import { setTokenURI, setKamiNFTRoyalty, setMintPrice } from './operations';
import { generateOperationSignature, normalizePrivateKey } from './signatures';
import { createTransaction } from './transaction';
import { getPaymentTokenDecimals, toTokenUnits } from './tokens';
import type { MintKami721ACParams, MintKami721CParams, MintKami1155Params, MintTokenParams, MintResponse } from './types';
import { getOwnerPrivateKey, validateWalletAccess } from './wallet';
import { SupplyService } from '@/services/SupplyService';

const SIMPLE_ACCOUNT_OWNER_ABI = [
	{
		inputs: [],
		name: 'owner',
		outputs: [{ internalType: 'address', name: '', type: 'address' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

/**
 * Validates that the platform SimpleAccount's owner is the Platform Funding EOA.
 * Sponsored mint sends a tx from the Platform Funding EOA to the SimpleAccount.execute();
 * the SimpleAccount only allows Owner or EntryPoint to call execute(), so the
 * SimpleAccount must have been deployed with the Platform Funding EOA as owner.
 */
async function validateSimpleAccountOwner(
	simpleAccountAddress: `0x${string}`,
	platformPrivateKey: `0x${string}`,
	rpcUrl: string,
	chain: Chain
): Promise<void> {
	const client = createPublicClient({
		chain,
		transport: http(rpcUrl),
	});
	const owner = await client.readContract({
		address: simpleAccountAddress,
		abi: SIMPLE_ACCOUNT_OWNER_ABI,
		functionName: 'owner',
	});
	const platformAccount = privateKeyToAccount(platformPrivateKey);
	const ownerStr = String(owner).toLowerCase();
	const platformStr = platformAccount.address.toLowerCase();
	if (ownerStr !== platformStr) {
		throw new Error(
			`SimpleAccount owner mismatch: the SimpleAccount at ${simpleAccountAddress} has owner ${owner}, but the Platform Funding EOA is ${platformAccount.address}. ` +
				`Sponsored mint requires the SimpleAccount to be deployed with the Platform Funding EOA as owner. ` +
				`Redeploy the SimpleAccount using the same key as PLATFORM_PRIVATE_KEY (e.g. pnpm deploy:simpleaccount <chainId> <ownerAddress>) and set platform.simpleAccountAddress to the new address, or ensure the platform table's simpleAccountAddress is the account whose owner is ${platformAccount.address}.`
		);
	}
}

export async function mintKami721CToken(params: MintKami721CParams): Promise<MintResponse> {
	try {
		console.log(`Minting sponsored KAMI721-C NFT to ${params.recipientAddress}`);

		const chainId = getHexChainId(params.chain.id.toString());

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

		// Mint uses direct path (platform EOA is SimpleAccount owner). EntryPoint not used for mint.
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
			useEntryPointForExecute: false,
		};

		const handler = new KamiSponsoredOperations(operationsConfig);

		const decimals = await getPaymentTokenDecimals(paymentToken.contractAddress as `0x${string}`, blockchainInfo.rpcUrl);
		const price = toTokenUnits(params.price, decimals);

		const userSignature = await generateOperationSignature(
			params.privateKey,
			params.recipientAddress as `0x${string}`,
			'mint',
			params.contractAddress as `0x${string}`,
			{
				recipient: params.recipientAddress,
				tokenPrice: price,
				uri: params.tokenUri,
				mintRoyalties: params.royaltyData || [],
			},
			blockchainInfo.rpcUrl
		);

		const mintParams: SponsoredMintParams = {
			recipient: params.recipientAddress as `0x${string}`,
			tokenPrice: price,
			uri: params.tokenUri,
			mintRoyalties: params.royaltyData || [],
			userPrivateKey: params.privateKey,
		};

		console.log(`🎨 Minting KAMI721C NFT for ${params.recipientAddress} with sponsored gas...`);
		console.log(`   Contract: ${params.contractAddress} (KAMI721C)`);
		console.log(`   Price: ${price.toString()} (${params.price} USD)`);
		console.log(`   Token URI: ${params.tokenUri}`);
		console.log('💰 Platform pays ALL gas fees...');

		const result = await handler.mintToken(params.contractAddress as `0x${string}`, 'KAMI721C', mintParams, userSignature);

		console.log('Mint result:', {
			success: result.success,
			transactionHash: result.transactionHash,
			error: result.error,
			data: result.data,
		});

		const transactionHash = result.transactionHash || '';
		if (!result.success || !result.transactionHash) {
			throw new Error(`Transaction failed: ${result.error || 'Unknown error'}`);
		}

		const tokenId = result.data?.tokenId?.toString() || '1';

		await createTransaction(
			Web3TransactionType.Mint721C,
			result.transactionHash,
			blockchainInfo,
			params.recipientAddress,
			params.checkoutId
		);

		console.log(`✅ KAMI721-C NFT minted successfully!`);
		console.log(`   Token ID: ${tokenId}`);
		console.log(`   TX: ${transactionHash}`);

		return {
			tokenId,
			transactionHash,
			checkoutId: params.checkoutId,
		};
	} catch (error) {
		console.error('❌ Error minting sponsored KAMI721-C NFT:', error);
		throw new Error(`Failed to mint KAMI721-C NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export async function mintKami721ACToken(params: MintKami721ACParams): Promise<MintResponse> {
	try {
		console.log(`Minting sponsored KAMI721-AC NFT to ${params.recipientAddress}`);

		const chainId = getHexChainId(params.chain.id.toString());

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

		await validateSimpleAccountOwner(
			platformInfo.simpleAccountAddress as `0x${string}`,
			platformPrivateKey as `0x${string}`,
			blockchainInfo.rpcUrl,
			blockchainInfo.blockchain as Chain
		);

		// Mint uses direct path (platform EOA is SimpleAccount owner). EntryPoint not used for mint.
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
			useEntryPointForExecute: false,
		};

		const handler = new KamiSponsoredOperations(operationsConfig);

		let mintPriceCheckFailed = false;
		try {
			const client = createPublicClient({
				chain: blockchainInfo.blockchain as unknown as Chain,
				transport: http(blockchainInfo.rpcUrl),
			});

			const mintPrice = await client.readContract({
				address: params.contractAddress as `0x${string}`,
				abi: [
					{
						inputs: [],
						name: 'mintPrice',
						outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
						stateMutability: 'view',
						type: 'function',
					},
				],
				functionName: 'mintPrice',
			});

			const mintPriceValue = typeof mintPrice === 'bigint' ? mintPrice : BigInt(String(mintPrice));
			if (mintPriceValue === BigInt(0)) {
				console.warn(`⚠️  WARNING: Mint price is not set (0) for KAMI721AC contract ${params.contractAddress}`);
			} else {
				console.log(`✅ Mint price verified for KAMI721AC contract: ${mintPriceValue.toString()}`);
			}
		} catch (error) {
			mintPriceCheckFailed = true;
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.warn(`⚠️  Could not verify mint price from contract: ${errorMessage}`);
		}

		const decimals = await getPaymentTokenDecimals(paymentToken.contractAddress as `0x${string}`, blockchainInfo.rpcUrl);
		const price = toTokenUnits(params.price, decimals);

		const mintAmount = params.amount ?? 1;
		// Use sequential single mints when quantity > 1. The library's batchMintToRecipient uses
		// executeBatch with the SimpleAccount as target, which reverts with "not Owner or EntryPoint".
		const useSequentialMints = mintAmount > 1;

		console.log(`🎨 Minting KAMI721AC NFT for ${params.recipientAddress} with sponsored gas...`);
		console.log(`   Mint Price: Will be read from contract (global mintPrice), fallback: ${price.toString()}`);
		console.log(`   Token URI: ${params.tokenUri}`);
		console.log(`   Amount: ${params.amount}`);
		console.log('💰 Platform pays ALL gas fees...');

		let result: { success: boolean; transactionHash?: string; error?: string; data?: { tokenId?: unknown; tokenIds?: unknown[] } };
		const tokenIds: bigint[] = [];
		let lastTransactionHash = '';

		if (useSequentialMints) {
			console.log(
				`📦 Sequential minting ${mintAmount} tokens to ${params.recipientAddress} (workaround for library executeBatch revert)`
			);
			for (let i = 0; i < mintAmount; i++) {
				const userSignature = await generateOperationSignature(
					params.privateKey,
					params.recipientAddress as `0x${string}`,
					'mint',
					params.contractAddress as `0x${string}`,
					{
						recipient: params.recipientAddress,
						tokenPrice: price,
						uri: params.tokenUri,
						mintRoyalties: params.royaltyData || [],
					},
					blockchainInfo.rpcUrl
				);
				const singleResult = await handler.mintToken(
					params.contractAddress as `0x${string}`,
					'KAMI721AC',
					{
						recipient: params.recipientAddress as `0x${string}`,
						tokenPrice: price,
						uri: params.tokenUri,
						mintRoyalties: params.royaltyData || [],
						userPrivateKey: params.privateKey,
					},
					userSignature
				);
				if (!singleResult.success || !singleResult.transactionHash) {
					const errorMsg = singleResult.error || 'Unknown error';
					if (mintPriceCheckFailed && errorMsg.includes('mintPrice')) {
						throw new Error(
							`Transaction failed at mint ${i + 1}/${mintAmount}: ${errorMsg}. ` +
								`The contract at ${params.contractAddress} may not be a KAMI721AC contract, ` +
								`or the mintPrice() function is not available/initialized.`
						);
					}
					throw new Error(`Transaction failed at mint ${i + 1}/${mintAmount}: ${errorMsg}`);
				}
				const id = singleResult.data?.tokenId;
				if (id !== undefined) tokenIds.push(BigInt(id.toString()));
				lastTransactionHash = singleResult.transactionHash;
				await createTransaction(
					Web3TransactionType.Mint721AC,
					singleResult.transactionHash,
					blockchainInfo,
					params.recipientAddress,
					params.checkoutId
				);
			}
			result = {
				success: true,
				transactionHash: lastTransactionHash,
				data: { tokenIds: tokenIds.length > 0 ? tokenIds : undefined },
			};
		} else {
			const userSignature = await generateOperationSignature(
				params.privateKey,
				params.recipientAddress as `0x${string}`,
				'mint',
				params.contractAddress as `0x${string}`,
				{
					recipient: params.recipientAddress,
					tokenPrice: price,
					uri: params.tokenUri,
					mintRoyalties: params.royaltyData || [],
				},
				blockchainInfo.rpcUrl
			);
			result = await handler.mintToken(
				params.contractAddress as `0x${string}`,
				'KAMI721AC',
				{
					recipient: params.recipientAddress as `0x${string}`,
					tokenPrice: price,
					uri: params.tokenUri,
					mintRoyalties: params.royaltyData || [],
					userPrivateKey: params.privateKey,
				},
				userSignature
			);

			console.log('Mint result:', {
				success: result.success,
				transactionHash: result.transactionHash,
				error: result.error,
				data: result.data,
			});

			const transactionHash = result.transactionHash || '';
			if (!result.success || !transactionHash) {
				const errorMsg = result.error || 'Unknown error';
				if (mintPriceCheckFailed && errorMsg.includes('mintPrice')) {
					throw new Error(
						`Transaction failed: ${errorMsg}. ` +
							`The contract at ${params.contractAddress} may not be a KAMI721AC contract, ` +
							`or the mintPrice() function is not available/initialized. ` +
							`Please verify the contract type and ensure mintPrice is set using setMintPrice() if it's a KAMI721AC contract.`
					);
				}
				throw new Error(`Transaction failed: ${errorMsg}`);
			}

			await createTransaction(
				Web3TransactionType.Mint721AC,
				transactionHash,
				blockchainInfo,
				params.recipientAddress,
				params.checkoutId
			);
		}

		const transactionHash = result.transactionHash || lastTransactionHash;
		let tokenId: string;
		if (mintAmount > 1 && result.data?.tokenIds && Array.isArray(result.data.tokenIds) && result.data.tokenIds.length > 0) {
			tokenId = result.data.tokenIds[0]?.toString() || '1';
			console.log(`✅ KAMI721-AC minted successfully! ${mintAmount} tokens (sequential)`);
			console.log(`   Token IDs: ${result.data.tokenIds.map((id: unknown) => id?.toString()).join(', ')}`);
		} else if (mintAmount > 1) {
			tokenId = tokenIds[0]?.toString() || '1';
			console.log(`✅ KAMI721-AC minted successfully! ${mintAmount} tokens (sequential)`);
			console.log(`   Token IDs: ${tokenIds.map((id) => id.toString()).join(', ')}`);
		} else {
			tokenId = result.data?.tokenId?.toString() || '1';
			console.log(`✅ KAMI721-AC NFT minted successfully!`);
			console.log(`   Token ID: ${tokenId}`);
		}
		console.log(`   TX: ${transactionHash}`);

		return {
			tokenId,
			transactionHash,
			checkoutId: params.checkoutId,
			...(mintAmount > 1 && {
				amount: mintAmount,
				tokenIds: (result.data?.tokenIds ?? tokenIds) as unknown[],
				startTokenId: tokenIds[0]?.toString(),
			}),
		};
	} catch (error) {
		console.error('❌ Error minting sponsored KAMI721-AC NFT:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		if (message.includes('not Owner or EntryPoint')) {
			throw new Error(
				`Sponsored mint failed: the SimpleAccount rejected the call because the caller is not its Owner or the EntryPoint. ` +
					`Ensure the platform's SimpleAccount (platform.simpleAccountAddress) was deployed with the same EOA as PLATFORM_PRIVATE_KEY for this chain. ` +
					`Redeploy with: pnpm deploy:simpleaccount <chainId> <platformFundingEOA> and update the platform table with the new simpleAccountAddress. Original: ${message}`
			);
		}
		throw new Error(`Failed to mint KAMI721-AC NFT: ${message}`);
	}
}

export async function mintKami1155Token(params: MintKami1155Params): Promise<MintResponse> {
	try {
		console.log(`Minting sponsored KAMI1155-C NFT to ${params.recipientAddress}, amount: ${params.amount}`);

		const chainId = getHexChainId(params.chain.id.toString());

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

		// Mint uses direct path (platform EOA is SimpleAccount owner). EntryPoint not used for mint.
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
			useEntryPointForExecute: false,
		};

		const handler = new KamiSponsoredOperations(operationsConfig);

		const decimals = await getPaymentTokenDecimals(paymentToken.contractAddress as `0x${string}`, blockchainInfo.rpcUrl);
		const price = toTokenUnits(params.price, decimals);

		const userSignature = await generateOperationSignature(
			params.privateKey,
			params.recipientAddress as `0x${string}`,
			'mint',
			params.contractAddress as `0x${string}`,
			{
				recipient: params.recipientAddress,
				tokenPrice: price,
				uri: params.tokenUri,
				mintRoyalties: params.royaltyData || [],
				amount: params.amount,
			},
			blockchainInfo.rpcUrl
		);

		const mintParams: SponsoredMintParams = {
			recipient: params.recipientAddress as `0x${string}`,
			tokenPrice: price,
			uri: params.tokenUri,
			mintRoyalties: params.royaltyData || [],
			userPrivateKey: params.privateKey,
		};

		console.log(`🎨 Minting KAMI1155C NFT for ${params.recipientAddress} with sponsored gas...`);
		console.log(`   Price: ${price.toString()} (${params.price} USD)`);
		console.log(`   Token URI: ${params.tokenUri}`);
		console.log(`   Amount: ${params.amount}`);
		console.log('💰 Platform pays ALL gas fees...');

		const result = await handler.mintToken(params.contractAddress as `0x${string}`, 'KAMI1155C', mintParams, userSignature);

		console.log('Mint result:', {
			success: result.success,
			transactionHash: result.transactionHash,
			error: result.error,
			data: result.data,
		});

		const transactionHash = result.transactionHash || '';
		if (!result.success || !result.transactionHash) {
			throw new Error(`Transaction failed: ${result.error || 'Unknown error'}`);
		}

		await createTransaction(
			Web3TransactionType.Mint1155C,
			result.transactionHash,
			blockchainInfo,
			params.recipientAddress,
			params.checkoutId
		);

		const tokenId = result.data?.tokenId?.toString() || '1';

		console.log(`✅ KAMI1155-C NFT minted successfully!`);
		console.log(`   Token ID: ${tokenId}`);
		console.log(`   Amount: ${params.amount}`);
		console.log(`   TX: ${transactionHash}`);

		return {
			tokenId,
			transactionHash,
			checkoutId: params.checkoutId,
		};
	} catch (error) {
		console.error('❌ Error minting sponsored KAMI1155-C NFT:', error);
		throw new Error(`Failed to mint KAMI1155-C NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export async function mintKamiNFTToken(params: MintTokenParams, contractType: ContractType): Promise<MintResponse> {
	console.log(`🔀 Routing mint request: contractType=${contractType}`);
	switch (contractType) {
		case 'ERC721C':
			return mintKami721CToken(params as MintKami721CParams);
		case 'ERC721AC':
			return mintKami721ACToken(params as MintKami721ACParams);
		case 'ERC1155C':
			return mintKami1155Token(params as MintKami1155Params);
		default:
			throw new Error(`Unsupported contract type: ${contractType}`);
	}
}

export async function mintGaslessNFT(
	voucherId: number,
	recipientAddress: string,
	checkoutId?: string,
	quantity?: number
): Promise<MintResponse> {
	try {
		const voucher = await prisma.voucher.findUnique({
			where: { id: voucherId },
			include: {
				collection: true,
				product: true,
				project: {
					include: {
						collaborators: true,
					},
				},
			},
		});

		if (!voucher) {
			throw new Error(`Voucher not found: ${voucherId}`);
		}

		if (voucher.collection?.contractType === 'ERC1155C') {
			throw new Error(`ERC1155C is not supported for gasless minting`);
		}

		if (!voucher.collection?.contractAddress) {
			throw new Error(`Collection not deployed for voucher: ${voucherId}`);
		}

		if (voucher.collection.contractType === 'ERC721AC' && quantity !== undefined) {
			const productMaxQuantity = voucher.product?.maxQuantity ?? null;
			const unlimitedSupply = SupplyService.isUnlimited(productMaxQuantity);
			if (!unlimitedSupply) {
				const availableQuantity = voucher.product?.availableQuantity ?? 0;
				if (quantity > availableQuantity) {
					throw new Error(`Requested quantity (${quantity}) exceeds available quantity (${availableQuantity})`);
				}
			}
			if (quantity <= 0) {
				throw new Error(`Requested quantity must be greater than 0`);
			}

			if (voucher.collection.contractAddress) {
				const chainIdValue = getChainIdWithDefault(voucher.collection.chainId);
				if (!chainIdValue) {
					throw new Error(
						`Collection ${voucher.collection.collectionId} does not have a chainId set and DEFAULT_CHAIN_ID environment variable is not configured.`
					);
				}
				const chainId = getHexChainId(chainIdValue);
				const currentTotalSupply = await kamiTotalMinted(chainId, voucher.collection.contractAddress);
				const maxQuantity = await kamiMaxQuantity(chainId, voucher.collection.contractAddress);

				if (maxQuantity > 0) {
					if (currentTotalSupply + quantity > maxQuantity) {
						throw new Error(
							`Requested quantity (${quantity}) would exceed maxQuantity limit. ` +
								`Current totalSupply: ${currentTotalSupply}, MaxQuantity: ${maxQuantity}, ` +
								`Would result in: ${currentTotalSupply + quantity}`
						);
					}
				}

				console.log(`✅ TotalSupply validation passed for ERC721AC:`, {
					currentTotalSupply,
					requestedQuantity: quantity,
					maxQuantity: maxQuantity > 0 ? maxQuantity : 'unlimited',
					willResultIn: currentTotalSupply + quantity,
				});
			}
		}

		const contractAddress = voucher.collection.contractAddress;
		const contractType = voucher.collection.contractType;

		const chainIdValue = getChainIdWithDefault(voucher.collection.chainId);
		if (!chainIdValue) {
			throw new Error(
				`Collection ${voucher.collection.collectionId} does not have a chainId set and DEFAULT_CHAIN_ID environment variable is not configured.`
			);
		}
		if (!voucher.collection.chainId && process.env.DEFAULT_CHAIN_ID) {
			console.log(
				`[mintGaslessNFT] Using DEFAULT_CHAIN_ID from environment: ${process.env.DEFAULT_CHAIN_ID} for collection ${voucher.collection.collectionId}`
			);
		}

		const chainId = getHexChainId(chainIdValue);

		const isValidChainId = await validateChainId(chainId);
		if (!isValidChainId) {
			const errorMsg = `Invalid chainId: ${chainId} for voucher ${voucherId} (collection ${voucher.collection?.collectionId}). ChainId must exist in the blockchain table.`;
			console.error(`[mintGaslessNFT] ${errorMsg}`);
			throw new Error(errorMsg);
		}

		console.log(`[mintGaslessNFT] Using chainId: ${chainId} for voucher ${voucherId}`);

		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		const hasAccess = await validateWalletAccess(chainId, recipientAddress);
		if (!hasAccess) {
			throw new Error(`Wallet access denied for: ${recipientAddress}`);
		}

		const recipientPrivateKey = await getOwnerPrivateKey(recipientAddress);
		if (!recipientPrivateKey) {
			throw new Error(`\n\n🔑 Recipient private key not found for: ${recipientAddress}\n\n`);
		}

		// Ensure the key we use for signing (e.g. setTokenURIWithSignature) is for the token owner.
		// Contract requires ownerOf(tokenId) == signer; mismatched key causes InvalidSigner revert.
		const derivedAddress = getAddress(privateKeyToAccount(recipientPrivateKey as `0x${string}`).address);
		const normalizedRecipient = getAddress(recipientAddress);
		if (derivedAddress !== normalizedRecipient) {
			throw new Error(
				`\n\n🔑 Recipient private key does not match recipient address.\n` +
					`   Recipient (token owner): ${normalizedRecipient}\n` +
					`   Address derived from key:  ${derivedAddress}\n` +
					`   Fix: ensure the wallet for ${normalizedRecipient} is linked to the key in the account table.\n\n`
			);
		}

		let imageURI: string | undefined = undefined;
		let animationURI: string | undefined = undefined;
		if (voucher.mediaUrl) {
			const imageIPFS = await addFileToIPFS(voucher.mediaUrl);
			imageURI = imageIPFS.ipfsPath;
		}

		if (voucher.animationUrl) {
			const animationIPFS = await addFileToIPFS(voucher.animationUrl);
			animationURI = animationIPFS.ipfsPath;
		}

		const metadata = JSON.parse(voucher.metadata as string) as Metadata;
		if (imageURI) metadata.image = imageURI;
		if (animationURI) metadata.animation_url = animationURI;
		metadata.contract_address = contractAddress;

		if (metadata.properties?.bundle) {
			for (const b of metadata.properties.bundle) {
				if (b.uri) {
					const bundleIPFS = await addFileToIPFS(b.uri);
					b.uri = bundleIPFS.ipfsPath;
				}
				if (b.cover_url) {
					const coverIPFS = await addFileToIPFS(b.cover_url);
					b.cover_url = coverIPFS.ipfsPath;
				}
			}
		}

		const collaborators = voucher.project?.collaborators ?? [];
		const primaryRoyaltyData: RoyaltyData[] = [];
		const secondaryRoyaltyData: RoyaltyData[] = [];

		collaborators.forEach((collaborator) => {
			if (collaborator.primaryShare > 0) {
				const feeNumerator = toTokenUnits(collaborator.primaryShare, 2);
				primaryRoyaltyData.push({
					receiver: collaborator.userWalletAddress,
					feeNumerator,
				});
			}
		});
		collaborators.forEach((collaborator) => {
			if (collaborator.secondaryShare > 0) {
				const feeNumerator = toTokenUnits(collaborator.secondaryShare, 2);
				secondaryRoyaltyData.push({
					receiver: collaborator.userWalletAddress,
					feeNumerator,
				});
			}
		});

		let mintParams: MintTokenParams;

		switch (voucher.collection.contractType) {
			case 'ERC721C':
				mintParams = {
					contractAddress: voucher.collection.contractAddress,
					recipientAddress,
					price: voucher.product?.price || 0,
					tokenUri: 'https://www.kamiunlimited.com',
					royaltyData: primaryRoyaltyData,
					privateKey: recipientPrivateKey,
					chain: blockchainInfo.blockchain,
					checkoutId,
				} as MintKami721CParams;
				break;
			case 'ERC721AC': {
				const mintQuantity = quantity !== undefined ? quantity : 1;
				mintParams = {
					contractAddress: voucher.collection.contractAddress,
					recipientAddress,
					price: voucher.product?.price || 0,
					tokenUri: 'https://www.kamiunlimited.com',
					amount: mintQuantity,
					royaltyData: primaryRoyaltyData,
					privateKey: recipientPrivateKey,
					chain: blockchainInfo.blockchain,
					checkoutId,
				} as MintKami721ACParams;
				break;
			}
			default:
				throw new Error(`Unsupported contract type: ${voucher.collection.contractType}`);
		}

		// KAMI721C uses per-token pricing (price in mint params); never call setMintPrice for ERC721C. Only ERC721AC has a global mint price.
		if (voucher.collection.contractType === 'ERC721AC') {
			try {
				const client = createPublicClient({
					chain: blockchainInfo.blockchain as unknown as Chain,
					transport: http(blockchainInfo.rpcUrl),
				});

				let mintPriceSet = false;
				try {
					await client.readContract({
						address: contractAddress as `0x${string}`,
						abi: [
							{
								inputs: [],
								name: 'mintPrice',
								outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
								stateMutability: 'view',
								type: 'function',
							},
						],
						functionName: 'mintPrice',
					});
					mintPriceSet = true;
				} catch (readError) {
					console.warn(
						`⚠️  Could not read mint price from contract: ${readError instanceof Error ? readError.message : 'Unknown error'}`
					);
				}

				if (!mintPriceSet) {
					const productPrice = voucher.product?.price ? voucher.product.price.toNumber() : 0;
					const ownerPrivateKey = await getOwnerPrivateKey(voucher.collection.ownerWalletAddress);

					if (!ownerPrivateKey) {
						throw new Error(
							`Mint price not set and cannot be set automatically. Please set mint price using setMintPrice() before minting.`
						);
					}

					const priceSet = await setMintPrice(chainId, contractAddress as `0x${string}`, 'ERC721AC', productPrice, {
						ownerPrivateKey: ownerPrivateKey,
						simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
					});

					if (!priceSet) {
						throw new Error(`Failed to set mint price. Please set it manually using setMintPrice() before minting tokens.`);
					}
				}
			} catch (error) {
				console.error(`❌ Error ensuring mint price is set: ${error instanceof Error ? error.message : 'Unknown error'}`);
				throw new Error(`Failed to ensure mint price is set: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		const result = await mintKamiNFTToken(mintParams, voucher.collection.contractType);

		if (!result.tokenId || isNaN(Number(result.tokenId))) {
			throw new Error(`Failed to mint KAMI NFT: No tokenId or tokenId is not a number!`);
		}

		const isERC721AC = voucher.collection.contractType === 'ERC721AC';
		const batchMintQuantity = isERC721AC && quantity && quantity > 1 ? quantity : 1;
		const startTokenId = Number(result.tokenId);
		// Use actual token IDs from batch result when available; otherwise assume consecutive IDs
		const tokenIds: number[] =
			result.tokenIds && Array.isArray(result.tokenIds) && result.tokenIds.length > 0
				? result.tokenIds.map((id: bigint | number | string) => Number(id))
				: Array.from({ length: batchMintQuantity }, (_, i) => startTokenId + i);

		const tokenUris: { tokenId: number; metadataURI: string }[] = [];

		if (tokenIds.length > 1) {
			// Batch: upload metadata and set token URI for each minted token
			for (const tokenId of tokenIds) {
				metadata.token_id = String(tokenId);
				const metadataIPFS = await addMetadataToIPFS(JSON.stringify(metadata ?? {}));
				tokenUris.push({ tokenId, metadataURI: metadataIPFS.ipfsPath });
				await setTokenURI(
					chainId as `0x${string}`,
					contractAddress as `0x${string}`,
					contractType,
					tokenId,
					metadataIPFS.ipfsPath,
					{
						ownerPrivateKey: recipientPrivateKey as `0x${string}`,
						simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
					},
					checkoutId
				);
			}
		} else {
			// Single mint
			metadata.token_id = result.tokenId;
			const metadataIPFS = await addMetadataToIPFS(JSON.stringify(metadata ?? {}));
			const metadataURI = metadataIPFS.ipfsPath;
			tokenUris.push({ tokenId: startTokenId, metadataURI });
			await setTokenURI(
				chainId as `0x${string}`,
				contractAddress as `0x${string}`,
				contractType,
				startTokenId,
				metadataURI,
				{
					ownerPrivateKey: recipientPrivateKey as `0x${string}`,
					simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
				},
				checkoutId
			);
		}

		const createdAssets: number[] = [];
		for (const { tokenId, metadataURI } of tokenUris) {
			const assetTokenMetadata = { ...metadata, token_id: String(tokenId) };

			const asset = await prisma.asset.upsert({
				where: {
					walletAddress_contractAddress_tokenId_chainId: {
						walletAddress: recipientAddress,
						contractAddress: voucher.collection.contractAddress,
						tokenId: String(tokenId),
						chainId: chainId,
					},
				},
				update: {
					walletAddress: recipientAddress,
					consumerAction: ConsumerAction.None,
					price: voucher.product?.price,
				},
				create: {
					walletAddress: recipientAddress,
					contractAddress: voucher.collection.contractAddress,
					tokenId: String(tokenId),
					createdAt: Date.now() / 1000,
					metadataURI: metadataURI,
					metadata: JSON.stringify(assetTokenMetadata, (key, value) => {
						if (typeof value === 'bigint') {
							return value.toString();
						}
						return value;
					}),
					mediaUrl: imageURI,
					animationUrl: animationURI,
					availableQuantity: 1,
					contractType: voucher.collection.contractType,
					chainId: chainId,
					collectionId: voucher.collection.collectionId,
					productId: voucher.product?.id,
					projectId: voucher.projectId,
					consumerAction: ConsumerAction.None,
					price: voucher.product?.price,
					currencySymbol: voucher.product?.currencySymbol,
					audience: voucher.product?.audience,
					spotlight: voucher.product?.spotlight,
					prohibitReason: voucher.product?.prohibitReason,
					canSubscribe: voucher.product?.canSubscribe,
					subscriptionValue: voucher.product?.subscriptionValue,
					likedByMe: false,
				},
			});

			createdAssets.push(asset.id);
		}

		for (const tokenId of tokenIds) {
			try {
				await setKamiNFTRoyalty(
					chainId,
					voucher.collection.contractAddress,
					voucher.collection.contractType,
					tokenId,
					secondaryRoyaltyData,
					{
						rpcUrl: blockchainInfo.rpcUrl,
						ownerPrivateKey: recipientPrivateKey as `0x${string}`,
						simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
						chain: blockchainInfo.blockchain,
					}
				);
			} catch (error) {
				console.warn(`⚠️  Royalty setting failed for token ${tokenId}:`, error instanceof Error ? error.message : 'Unknown error');
			}
		}

		if (!isERC721AC) {
			try {
				await prisma.voucher.delete({ where: { id: voucherId } });
			} catch (error) {
				console.error('Error deleting voucher:', error);
			}
		}

		if (voucher.collection.contractType === 'ERC721AC' && contractAddress && voucher.productId) {
			try {
				await validateAndCorrectContractQuantityState(
					chainId,
					contractAddress,
					voucher.productId,
					voucher.collection.collectionId,
					voucherId
				);
			} catch (validationError) {
				console.error('Error validating contract quantity state:', validationError);
			}
		}

		return {
			...result,
			assetId: createdAssets[0],
			amount: batchMintQuantity,
			tokenIds: tokenIds,
			startTokenId: startTokenId,
		};
	} catch (error) {
		console.error('Error minting gasless KAMI NFT:', error);
		throw error;
	}
}

export async function batchMintGaslessNFTs(voucherIds: number[], recipientAddress: string, checkoutId?: string): Promise<MintResponse[]> {
	try {
		console.log(`Batch minting ${voucherIds.length} gasless KAMI NFTs to ${recipientAddress}`);

		const results: MintResponse[] = [];
		const batchSize = BATCH_CONFIG.maxBatchSize;

		for (let i = 0; i < voucherIds.length; i += batchSize) {
			const batch = voucherIds.slice(i, i + batchSize);
			const batchPromises = batch.map((voucherId) => mintGaslessNFT(voucherId, recipientAddress, checkoutId));
			const batchResults = await Promise.allSettled(batchPromises);

			batchResults.forEach((result, index) => {
				if (result.status === 'fulfilled') {
					results.push(result.value);
				} else {
					console.error(`Failed to mint KAMI NFT voucher ${batch[index]}:`, result.reason);
				}
			});

			if (i + batchSize < voucherIds.length) {
				await new Promise((resolve) => setTimeout(resolve, BATCH_CONFIG.delayBetweenBatches));
			}
		}

		console.log(`Batch minting KAMI NFTs completed: ${results.length}/${voucherIds.length} successful`);
		return results;
	} catch (error) {
		console.error('Error in batch minting gasless KAMI NFTs:', error);
		throw error;
	}
}
