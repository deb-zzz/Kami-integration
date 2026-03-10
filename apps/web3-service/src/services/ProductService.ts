import { prisma } from '@/lib/db';
import { ProductType, ContractType, Prisma } from '@prisma/client';
import { SupplyService } from './SupplyService';

// Type definitions for product queries
export type ProductWithVoucher = Prisma.productGetPayload<{
	include: { voucher: true; collection: true };
}>;

export type ProductWithAssets = Prisma.productGetPayload<{
	include: { asset: true; collection: true; voucher: true };
}>;

/**
 * Service responsible for product-related operations
 * Handles retrieval and manipulation of products with token type awareness
 */
export class ProductService {
	/**
	 * Get a product by ID with voucher and collection included
	 * @param productId - Product ID to fetch
	 * @returns Product with voucher and collection, or null if not found
	 */
	static async getProductWithVoucher(productId: number): Promise<ProductWithVoucher | null> {
		return prisma.product.findUnique({
			where: { id: productId },
			include: { voucher: true, collection: true },
		});
	}

	/**
	 * Get a product by ID with assets and collection included
	 * @param productId - Product ID to fetch
	 * @returns Product with assets and collection, or null if not found
	 */
	static async getProductWithAssets(productId: number): Promise<ProductWithAssets | null> {
		return prisma.product.findUnique({
			where: { id: productId },
			include: { asset: true, collection: true, voucher: true },
		});
	}

	/**
	 * Check if minting is allowed for a product
	 * @param productId - Product ID to check
	 * @param requestedQuantity - Number of tokens to mint
	 * @returns Object with canMint flag and reason
	 */
	static async checkMintingAllowed(
		productId: number,
		requestedQuantity: number
	): Promise<{ canMint: boolean; reason?: string; product?: ProductWithVoucher }> {
		const product = await this.getProductWithVoucher(productId);

		if (!product) {
			return { canMint: false, reason: `Product not found: ${productId}` };
		}

		if (!product.voucher) {
			return { canMint: false, reason: `No voucher associated with product ${productId}. Cannot mint.` };
		}

		if (!SupplyService.canMint(product, requestedQuantity)) {
			return {
				canMint: false,
				reason: `Requested quantity (${requestedQuantity}) exceeds available quantity (${product.availableQuantity})`,
			};
		}

		return { canMint: true, product };
	}

	/**
	 * Get the token type for a product
	 * @param productType - The ProductType enum value
	 * @returns The corresponding token type string
	 */
	static getTokenType(productType: ProductType): 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C' {
		switch (productType) {
			case ProductType.Claimable:
				return 'KAMI721AC';
			case ProductType.Series:
				return 'KAMI1155C';
			default:
				return 'KAMI721C';
		}
	}

	/**
	 * Get the contract type for a product type
	 * @param productType - The ProductType enum value
	 * @returns The corresponding ContractType enum value
	 */
	static getContractType(productType: ProductType): ContractType {
		switch (productType) {
			case ProductType.Claimable:
				return ContractType.ERC721AC;
			case ProductType.Series:
				return ContractType.ERC1155C;
			default:
				return ContractType.ERC721C;
		}
	}

	/**
	 * Update product after minting
	 * Handles both limited and unlimited supply products
	 * @param productId - Product ID to update
	 * @param quantityMinted - Number of tokens minted
	 * @param buyerWalletAddress - Wallet address of the buyer (for ownership transfer)
	 * @param isERC721AC - Whether this is an ERC721AC product
	 */
	static async updateAfterMint(
		productId: number,
		quantityMinted: number,
		buyerWalletAddress: string,
		isERC721AC: boolean
	): Promise<void> {
		const product = await prisma.product.findUnique({
			where: { id: productId },
		});

		if (!product) {
			console.warn(`Product ${productId} not found for post-mint update`);
			return;
		}

		const shouldDecrement = SupplyService.shouldDecrementOnMint(product.maxQuantity);
		const newAvailableQuantity = shouldDecrement
			? SupplyService.calculateNewAvailableQuantity(product, quantityMinted)
			: product.availableQuantity;

		console.log(`📊 Updating product ${productId} after mint:`, {
			quantityMinted,
			currentAvailableQuantity: product.availableQuantity,
			newAvailableQuantity,
			isERC721AC,
			isUnlimited: SupplyService.isUnlimited(product.maxQuantity),
		});

		// Build update data
		const updateData: Prisma.productUpdateInput = {
			consumerAction: 'None',
		};

		// Only decrement availableQuantity for limited supply
		if (shouldDecrement) {
			updateData.availableQuantity = newAvailableQuantity;
		}

		// For ERC721AC: don't change owner on mint - owner is the creator
		// For ERC721C: transfer ownership to buyer using relation connect
		if (!isERC721AC) {
			updateData.owner = { connect: { walletAddress: buyerWalletAddress } };
		}

		await prisma.product.update({
			where: { id: productId },
			data: updateData,
		});
	}

	/**
	 * Update product after a buy/transfer operation
	 * @param productId - Product ID to update
	 * @param newOwnerWalletAddress - Wallet address of the new owner
	 */
	static async updateAfterBuy(productId: number, newOwnerWalletAddress: string): Promise<void> {
		await prisma.product.update({
			where: { id: productId },
			data: {
				owner: { connect: { walletAddress: newOwnerWalletAddress } },
				consumerAction: 'None',
			},
		});
	}

	/**
	 * Get supply information for a product
	 * @param product - Product with supply fields
	 * @returns Supply information object
	 */
	static getSupplyInfo(product: { maxQuantity: number | null; availableQuantity: number; type: ProductType; asset?: { id: number }[] }): {
		maxQuantity: number | null;
		availableQuantity: number;
		totalMinted: number;
		isUnlimited: boolean;
		tokenType: 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C';
	} {
		return {
			maxQuantity: product.maxQuantity,
			availableQuantity: product.availableQuantity,
			totalMinted: product.asset?.length ?? 0,
			isUnlimited: SupplyService.isUnlimited(product.maxQuantity),
			tokenType: this.getTokenType(product.type),
		};
	}
}
