import type { KAMI721CDeployParams, RoyaltyData } from '@paulstinchcombe/gasless-nft-tx';
import type { ContractType } from '@prisma/client';
import type { Chain } from 'viem';

/**
 * Base deployment parameters for gasless NFT contract
 */
export interface BaseDeployParams extends KAMI721CDeployParams {
	contractType: ContractType;
	ownerAddress: string;
	chainId: string;
	checkoutId?: string;
}

/**
 * KAMI721-C deployment parameters
 */
export interface DeployKami721CParams extends BaseDeployParams {
	contractType: 'ERC721C';
	ownerAddress: string;
	name: string;
	symbol: string;
	baseURI: string;
	initialMintPrice: bigint;
}

/**
 * KAMI721-AC deployment parameters
 */
export interface DeployKami721ACParams extends Omit<BaseDeployParams, 'initialMintPrice'> {
	contractType: 'ERC721AC';
	ownerAddress: string;
	name: string;
	symbol: string;
	baseURI: string;
	initialMintPrice?: number | string | bigint; // Optional: if provided, will be set after deployment
	maxQuantity?: number; // Optional: if provided, will be set during deployment (0 for unlimited)
}

/**
 * KAMI1155-C deployment parameters
 */
export interface DeployKami1155Params extends BaseDeployParams {
	contractType: 'ERC1155C';
	ownerAddress: string;
	uri: string;
	name: string;
	symbol: string;
}

/**
 * Union type for all deployment parameters
 */
export type DeployContractParams = DeployKami721CParams | DeployKami721ACParams | DeployKami1155Params;

/**
 * Base minting parameters for gasless NFT
 */
export interface BaseMintParams {
	contractAddress: string;
	recipientAddress: string;
	chain: Chain; // viem chain object
	privateKey: `0x${string}`;
	checkoutId?: string;
}

/**
 * KAMI721-C minting parameters
 */
export interface MintKami721CParams extends BaseMintParams {
	price: number;
	tokenUri: string;
	royaltyData?: RoyaltyData[];
}

/**
 * KAMI721-AC minting parameters
 */
export interface MintKami721ACParams extends BaseMintParams {
	price: number;
	amount: number;
	tokenUri: string;
	royaltyData: RoyaltyData[];
}

/**
 * KAMI1155-C minting parameters
 */
export interface MintKami1155Params extends BaseMintParams {
	price: number;
	amount: number;
	tokenUri: string;
	royaltyData?: RoyaltyData[];
}

/**
 * Union type for all minting parameters
 */
export type MintTokenParams = MintKami721CParams | MintKami721ACParams | MintKami1155Params;

/**
 * Response from gasless deployment
 */
export interface DeployResponse {
	contractAddress: string;
	transactionHash: string;
	blockNumber: number;
	gasUsed: string;
	checkoutId?: string;
}

/**
 * Response from gasless minting
 */
export interface MintResponse {
	tokenId: string;
	transactionHash: string;
	checkoutId?: string;
	assetId?: number; // Asset ID created after minting (voucher is deleted, asset is created)
	// Batch minting fields (for ERC721AC with quantity > 1)
	amount?: number;
	tokenIds?: any[];
	startTokenId?: string | number;
}

/**
 * Validation result interface for contract quantity state validation
 */
export interface ContractQuantityValidationResult {
	isValid: boolean;
	wasCorrected: boolean;
	contractTotalSupply: number;
	contractMaxQuantity: number;
	contractTotalMinted: number;
	contractAvailableQuantity: number;
	productAvailableQuantityBefore: number;
	productAvailableQuantityAfter: number;
	productMaxQuantityBefore: number | null;
	productMaxQuantityAfter: number | null;
	voucherMaxQuantityBefore: number | null;
	voucherMaxQuantityAfter: number | null;
	difference: number;
}
