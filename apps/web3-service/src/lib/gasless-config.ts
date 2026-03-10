/**
 * Configuration utilities for gasless NFT operations
 */

import { getBlockchainInfo, getPlatformInfo } from './gasless-nft';

export interface GaslessConfig {
	rpcUrl: string;
	chainId: string;
	relayerUrl?: string;
	apiKey?: string;
	privateKey?: string;
	simpleAccountAddress?: string;
}

/**
 * Get gasless configuration from environment variables
 * @returns GaslessConfig - Configuration object
 */
export async function getGaslessConfig(chainId: string): Promise<GaslessConfig> {
	if (!chainId.startsWith('0x') || isNaN(Number.parseInt(chainId, 16)))
		throw new Error('chainId must be a hex value starting with 0x and equate to a number');

	const bcInfo = await getBlockchainInfo(chainId);
	if (!bcInfo) throw new Error(`Blockchain for chainId ${chainId} not found!`);

	const platform = await getPlatformInfo(chainId);
	if (!platform) throw new Error(`Platform not configured for chainId ${chainId}`);

	const rpcUrl = bcInfo.rpcUrl;
	const privateKey = platform.platformFundingWalletPrivateKey;
	const simpleAccountAddress = platform.simpleAccountAddress;

	return {
		rpcUrl,
		chainId: Number.parseInt(chainId, 16).toString(),
		privateKey,
		simpleAccountAddress,
	};
}

/**
 * Validate that required configuration is set for gasless operations
 * Validates that blockchain and platform info exist in the database for the given chainId
 * @param chainId - The chain ID to validate
 * @throws Error if required configuration is missing
 */
export async function validateGaslessConfig(chainId: string): Promise<void> {
	const config = await getGaslessConfig(chainId);

	if (!config.rpcUrl) {
		throw new Error(`RPC URL not configured for chainId ${chainId}. Ensure the blockchain table has an rpcUrl for this chainId.`);
	}

	if (!config.chainId) {
		throw new Error(`ChainId not configured for chainId ${chainId}. Ensure the blockchain table has an entry for this chainId.`);
	}

	// Required for gasless operations
	if (!config.privateKey) {
		throw new Error(`Platform funding wallet private key not configured for chainId ${chainId}. Ensure the platform table has platformFundingWalletPrivateKey for this chainId.`);
	}

	if (!config.simpleAccountAddress) {
		throw new Error(`SimpleAccount address not configured for chainId ${chainId}. Ensure the platform table has simpleAccountAddress for this chainId.`);
	}

	// Optional but recommended
	if (!config.relayerUrl) {
		console.warn(`[validateGaslessConfig] Relayer URL not set for chainId ${chainId}, using default relayer`);
	}

	if (!config.apiKey) {
		console.warn(`[validateGaslessConfig] API key not set for chainId ${chainId}, some features may be limited`);
	}
}

/**
 * Default royalty configuration for Kami NFTs
 */
export const DEFAULT_ROYALTY_CONFIG = {
	feeNumerator: 250, // 2.5%
	maxFeeNumerator: 1000, // 10% maximum
};

/**
 * Contract type mapping for gasless operations
 */
export const GASLESS_CONTRACT_TYPES = {
	ERC721C: 'ERC721C',
	ERC721AC: 'ERC721AC',
	ERC1155C: 'ERC1155C',
	ERC20: 'ERC20',
} as const;

/**
 * Batch processing configuration
 */
export const BATCH_CONFIG = {
	maxBatchSize: 10,
	delayBetweenBatches: 1000, // 1 second
	retryAttempts: 3,
	retryDelay: 2000, // 2 seconds
} as const;
