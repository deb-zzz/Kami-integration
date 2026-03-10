/**
 * Central NFT/contract-type rules for checkout.
 *
 * Single source of truth for:
 * - Mint: allowed or not, max quantity (1 vs multiple).
 * - Buy: allowed or not, max quantity (1 vs multiple).
 * - Deploy: supported or not (gasless).
 *
 * When adding new NFT/contract types, update this module and validation/categorisation.
 */

import { ContractType } from '@prisma/client';

export type NftOperation = 'mint' | 'buy' | 'deploy';

export type ContractTypeRules = {
	/** Mint (voucher) allowed in checkout */
	mintAllowed: boolean;
	/** Max quantity for mint (1 = non-fungible only) */
	mintMaxQuantity: 1 | number;
	/** Buy (existing asset) allowed in checkout */
	buyAllowed: boolean;
	/** Max quantity for buy (1 = single token transfer only) */
	buyMaxQuantity: 1 | number;
	/** Gasless deploy supported */
	deploySupported: boolean;
};

const RULES: Record<ContractType, ContractTypeRules> = {
	[ContractType.ERC721C]: {
		mintAllowed: true,
		mintMaxQuantity: 1,
		buyAllowed: true,
		buyMaxQuantity: 1,
		deploySupported: true,
	},
	[ContractType.ERC721AC]: {
		mintAllowed: true,
		mintMaxQuantity: Number.MAX_SAFE_INTEGER, // batch mint
		buyAllowed: true,
		buyMaxQuantity: 1,
		deploySupported: true,
	},
	[ContractType.ERC1155C]: {
		mintAllowed: false,
		mintMaxQuantity: 1,
		buyAllowed: true,
		buyMaxQuantity: Number.MAX_SAFE_INTEGER,
		deploySupported: false,
	},
	[ContractType.ERC20]: {
		mintAllowed: false,
		mintMaxQuantity: 1,
		buyAllowed: false,
		buyMaxQuantity: 1,
		deploySupported: false,
	},
};

/**
 * Get rules for a contract type.
 */
export function getContractTypeRules(contractType: ContractType): ContractTypeRules {
	const rules = RULES[contractType];
	if (!rules) {
		return {
			mintAllowed: false,
			mintMaxQuantity: 1,
			buyAllowed: false,
			buyMaxQuantity: 1,
			deploySupported: false,
		};
	}
	return rules;
}

/**
 * Check if mint is supported for this contract type (gasless checkout).
 */
export function isMintSupported(contractType: ContractType): boolean {
	return getContractTypeRules(contractType).mintAllowed;
}

/**
 * Check if deploy is supported for this contract type (gasless).
 */
export function isDeploySupported(contractType: ContractType): boolean {
	return getContractTypeRules(contractType).deploySupported;
}

/**
 * Check if buy is supported for this contract type.
 */
export function isBuySupported(contractType: ContractType): boolean {
	return getContractTypeRules(contractType).buyAllowed;
}

/**
 * Validate mint quantity for contract type. Returns error message or null if valid.
 */
export function validateMintQuantity(contractType: ContractType, quantity: number | null | undefined): string | null {
	const rules = getContractTypeRules(contractType);
	if (!rules.mintAllowed) {
		return `ERC1155C deploy/mint is not supported in checkout; only ERC721C and ERC721AC are supported for mint.`;
	}
	const qty = quantity ?? 1;
	if (qty < 1) {
		return `Quantity must be at least 1 for mint`;
	}
	if (rules.mintMaxQuantity === 1 && qty > 1) {
		return `Quantity must be 1 for ERC721C Collection`;
	}
	return null;
}

/**
 * Validate buy quantity for contract type. Returns error message or null if valid.
 */
export function validateBuyQuantity(contractType: ContractType, quantity: number | null | undefined): string | null {
	const rules = getContractTypeRules(contractType);
	if (!rules.buyAllowed) {
		return `Buy is not supported for this contract type`;
	}
	const qty = quantity ?? 1;
	if (qty < 1) {
		return `Quantity must be at least 1 for buy`;
	}
	if (rules.buyMaxQuantity === 1 && qty > 1) {
		return `Quantity must be 1 for ERC721AC buy operations. Each token must be purchased separately.`;
	}
	return null;
}
