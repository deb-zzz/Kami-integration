import { ProductType } from '@prisma/client';

/**
 * Service responsible for supply-related operations for KAMI tokens
 * Handles logic for both limited and unlimited supply products
 */
export class SupplyService {
	/**
	 * Check if a product is claimable
	 * @param productType - The type of product (Standard, Claimable, Series)
	 * @returns true if the product is claimable
	 */
	static isClaimable(productType: ProductType): boolean {
		return productType === ProductType.Claimable;
	}
	/**
	 * Check if a product has unlimited supply
	 * For KAMI721AC, maxQuantity = 0 or null means unlimited supply
	 * @param maxQuantity - The maxQuantity value from the product
	 * @returns true if maxQuantity is 0 or null (unlimited)
	 */
	static isUnlimited(maxQuantity: number | null | undefined): boolean {
		return maxQuantity === 0 || maxQuantity === null || maxQuantity === undefined;
	}

	/**
	 * Check if requested quantity can be minted from a product
	 * @param product - Product with maxQuantity and availableQuantity fields
	 * @param requestedQuantity - Number of tokens to mint
	 * @returns true if minting is allowed
	 */
	static canMint(product: { maxQuantity: number | null; availableQuantity: number }, requestedQuantity: number): boolean {
		if (this.isUnlimited(product.maxQuantity)) return true;
		return requestedQuantity <= product.availableQuantity;
	}

	/**
	 * Calculate the initial availableQuantity for a product based on type and maxQuantity
	 * @param productType - The type of product (Standard, Claimable, Series)
	 * @param maxQuantity - The maxQuantity value (0 = unlimited for Claimable)
	 * @param quantity - The requested quantity
	 * @returns The initial availableQuantity value
	 */
	static calculateInitialAvailableQuantity(
		productType: ProductType,
		maxQuantity: number | undefined,
		quantity: number | undefined,
	): number {
		const isClaimable = productType === ProductType.Claimable;

		if (isClaimable) {
			// For KAMI721AC:
			// - maxQuantity = 0 means unlimited, availableQuantity = 0 (sentinel)
			// - maxQuantity > 0 means limited, availableQuantity = maxQuantity
			const resolvedMaxQuantity = maxQuantity ?? 0;
			return this.isUnlimited(resolvedMaxQuantity) ? 0 : resolvedMaxQuantity;
		}

		// For KAMI721C: single token per product
		return quantity ?? 1;
	}

	/**
	 * Calculate the maxQuantity for a product based on type
	 * @param productType - The type of product (Standard, Claimable, Series)
	 * @param quantity - The requested quantity
	 * @returns The maxQuantity value: for non-Claimable (Standard, Series) returns 1 (single token max); for Claimable returns quantity or 0 (unlimited)
	 */
	static calculateMaxQuantity(productType: ProductType, quantity: number | undefined): number | undefined {
		if (productType !== ProductType.Claimable) {
			return 1;
		}
		// For KAMI721AC: quantity becomes maxQuantity (0 = unlimited)
		return quantity ?? 0;
	}

	/**
	 * Calculate the new availableQuantity after minting
	 * @param product - Product with maxQuantity and availableQuantity fields
	 * @param quantityMinted - Number of tokens minted
	 * @returns The new availableQuantity value (unchanged for unlimited)
	 */
	static calculateNewAvailableQuantity(
		product: { maxQuantity: number | null; availableQuantity: number },
		quantityMinted: number,
	): number {
		if (this.isUnlimited(product.maxQuantity)) {
			// Unlimited supply: keep sentinel value of 0
			return 0;
		}
		// Limited supply: decrement
		return Math.max(0, product.availableQuantity - quantityMinted);
	}

	/**
	 * Check if a product should have its availableQuantity decremented after minting
	 * @param maxQuantity - The maxQuantity value from the product
	 * @returns true if availableQuantity should be decremented
	 */
	static shouldDecrementOnMint(maxQuantity: number | null): boolean {
		return !this.isUnlimited(maxQuantity);
	}

	/**
	 * Get supply status information for a product
	 * @param product - Product with supply-related fields
	 * @returns Object with supply status information
	 */
	static getSupplyStatus(product: { maxQuantity: number | null; availableQuantity: number; type: ProductType }): {
		isUnlimited: boolean;
		isClaimable: boolean;
		maxQuantity: number | null;
		availableQuantity: number;
		canMintMore: boolean;
	} {
		const isUnlimited = this.isUnlimited(product.maxQuantity);
		const isClaimable = product.type === ProductType.Claimable;
		const canMintMore = isUnlimited || product.availableQuantity > 0;

		return {
			isUnlimited,
			isClaimable,
			maxQuantity: product.maxQuantity,
			availableQuantity: product.availableQuantity,
			canMintMore,
		};
	}
}
