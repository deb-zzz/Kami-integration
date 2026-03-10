import { Prisma } from '@prisma/client';
import { Chain } from 'viem';

// Define the types based on the Prisma schema
export type ContractType = 'ERC721C' | 'ERC721AC' | 'ERC1155C' | 'ERC20';
export type ProductType = 'Standard' | 'Claimable' | 'Series';

export const ProductContractTypeMap: Record<ProductType, ContractType> = {
	Standard: 'ERC721C',
	Claimable: 'ERC721AC',
	Series: 'ERC1155C',
};

// Add other type definitions as needed
export type LikeType = {
	fromWalletAddress: string;
	// Add other fields as needed
};

export type ShareType = {
	walletAddress: string;
	// Add other fields as needed
};

export type TipType = {
	value: { toNumber: () => number };
	// Add other fields as needed
};

export type PostType = {
	id: number;
	likes: LikeType[];
	// Add other fields as needed
};

export const MAX_QUANTITY = 100000;

export const MAX_QUANTITY_ERROR = `Quantity must be between 1 and ${MAX_QUANTITY}`;
export const NO_MEDIA_URL_ERROR = 'No media URL provided in metadata';
export const UNEXPECTED_ERROR = 'An unexpected error occurred';
export const FAILED_TO_CREATE_VOUCHER_ERROR = 'Failed to create voucher';
export const NO_COLLECTION_DATA = 'No collection data provided';
export const FAILED_TO_CREATE_COLLECTION_ERROR = 'Failed to create collection';
export const INVALID_CREATOR_SHARE_ERROR = 'Invalid creator shares';
export const FAILED_TO_DEPLOY_GASLESS_COLLECTION_ERROR = 'Failed to deploy gasless collection';
export const FAILED_TO_MINT_GASLESS_NFT_ERROR = 'Failed to mint gasless NFT';

export type Metadata = {
	name: string;
	contract_address?: string;
	token_id?: string;
	description?: string;
	image: string;
	animation_url?: string;
	attributes?: {
		trait_type: string;
		value: string;
	}[];
	properties?: {
		bundle?: {
			uri: string;
			type: string;
			name?: string;
			description?: string;
			cover_url?: string;
			owner_description?: string;
			category?: string;
		}[];
		creators?: {
			address: string;
			name?: string;
			share: number;
			role?: string;
			profile_url?: string;
		}[];
		project_creator?: {
			address: string;
			name?: string;
			profile_url?: string;
		};
	};
};

export type RoyaltyData = {
	receiver: string;
	feeNumerator: number;
	share: number;
};

/**
 * Payment token information interface
 */
export interface PaymentTokenInfo {
	contractAddress: string;
	symbol: string;
	decimals: number;
	name: string;
}

/**
 * Blockchain information interface
 * Contains all necessary data for blockchain operations
 */
export interface BlockchainInfo {
	name: string;
	chainId: string;
	rpcUrl: string;
	explorerUrl?: string;
	paymentTokens: PaymentTokenInfo[];
	blockchain?: Chain;
}

/**
 * Platform contract information interface
 *
 */
export interface PlatformInfo {
	chainId: string;
	simpleAccountAddress: string;
	contractDeployerAddress: string;
	platformFundingWalletAddress: string;
	platformFundingWalletPrivateKey: string;
	platformAddress: string;
	kamiNFTCoreLibraryAddress: string;
	kamiPlatformLibraryAddress: string;
	kamiRoyaltyLibraryAddress: string;
	kamiRentalLibraryAddress: string;
	kamiTransferLibraryAddress: string;
	createdAt: number;
	updatedAt: number;
}

export type KamiNFT = {
	type: ContractType;
	name: string;
	description: string;
	image: string;
	animation_url?: string;
	token_id?: string;
	contract_address?: string;
	chain_id?: string;
	total_supply?: number | string;
	balance?: number | string;
	attributes: {
		trait_type: string;
		value: string;
	}[];
	properties?: {
		bundle?: {
			uri: string;
			type: string;
			name?: string;
			description?: string;
			cover_url?: string;
			owner_description?: string;
			category?: string;
		}[];
		creators?: {
			address: string;
			name?: string;
			share: number | string;
			role?: string;
			profile_url?: string;
		}[];
		project_creator?: {
			address: string;
			name?: string;
			profile_url?: string;
		};
	};
};

// ============================================================================
// KAMI721AC (Claimable) Token Types
// ============================================================================

/**
 * Result of minting a single token
 */
export type TokenMintResult = {
	assetId: number;
	tokenId: string;
	walletAddress: string;
	contractAddress: string;
};

/**
 * Product with supply information for KAMI721AC tokens
 * Used to track minting availability and total minted count
 */
export type ProductWithSupply = {
	productId: number;
	maxQuantity: number; // 0 = unlimited
	availableQuantity: number; // 0 when unlimited (sentinel)
	totalMinted: number; // Count of assets linked to this product
	isUnlimited: boolean; // true when maxQuantity === 0
	tokenType: 'KAMI721C' | 'KAMI721AC';
};

/**
 * Check if a product has unlimited supply
 * @param maxQuantity - The maxQuantity value from the product
 * @returns true if maxQuantity is 0 or null (unlimited)
 */
export function isUnlimitedSupply(maxQuantity: number | null | undefined): boolean {
	return maxQuantity === 0 || maxQuantity === null || maxQuantity === undefined;
}

/**
 * Check if requested quantity can be minted from a product
 * @param product - Product with supply fields
 * @param requestedQuantity - Number of tokens to mint
 * @returns true if minting is allowed
 */
export function canMintFromProduct(product: { maxQuantity: number | null; availableQuantity: number }, requestedQuantity: number): boolean {
	if (isUnlimitedSupply(product.maxQuantity)) return true;
	return requestedQuantity <= product.availableQuantity;
}
