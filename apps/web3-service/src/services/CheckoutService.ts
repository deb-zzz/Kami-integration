import { prisma } from '@/lib/db';
import { getHexChainId } from '@/lib/gasless-nft';
import { ContractType, Prisma } from '@prisma/client';
import { SupplyService } from './SupplyService';
import { ProductService, ProductWithVoucher } from './ProductService';

// Type definitions for checkout operations
export type CollectionWithVouchersAndAssets = Prisma.collectionGetPayload<{
	include: { vouchers: true; asset: true };
}>;

export type VoucherWithCollection = Prisma.voucherGetPayload<{
	include: { collection: true };
}>;

export type AssetWithCollection = Prisma.assetGetPayload<{
	include: { collection: true };
}>;

export type CheckoutItem = {
	collectionId: number;
	productId?: number; // Primary identifier for KAMI721AC minting
	voucherId?: number; // Legacy support for KAMI721C lazy minting
	assetId?: number; // For buying existing assets (secondary sale)
	tokenId: number | null;
	quantity: number | null;
	charges: number | null;
};

export type CheckoutError = {
	collectionId: number;
	tokenId: number | null;
	quantity: number | null;
	voucherId?: number;
	assetId?: number;
	productId?: number;
	error: string;
};

/**
 * Service responsible for checkout-related operations
 * Handles minting, buying, and validation for all token types
 */
export class CheckoutService {
	/**
	 * Get a collection by ID with vouchers and assets
	 * @param collectionId - Collection ID to fetch
	 * @returns Collection with vouchers and assets, or null if not found
	 */
	static async getCollection(collectionId: number): Promise<CollectionWithVouchersAndAssets | null> {
		return prisma.collection.findUnique({
			where: { collectionId },
			include: { vouchers: true, asset: true },
		});
	}

	/**
	 * Get a voucher by ID with collection
	 * @param voucherId - Voucher ID to fetch
	 * @returns Voucher with collection, or null if not found
	 */
	static async getVoucher(voucherId: number): Promise<VoucherWithCollection | null> {
		return prisma.voucher.findUnique({
			where: { id: voucherId },
			include: { collection: true },
		});
	}

	/**
	 * Get an asset by contract address and asset ID
	 * @param contractAddress - Contract address
	 * @param assetId - Asset ID
	 * @returns Asset with collection, or null if not found
	 */
	static async getAsset(contractAddress: string, assetId: number): Promise<AssetWithCollection | null> {
		return prisma.asset.findFirst({
			where: { contractAddress, id: assetId },
			include: { collection: true },
		});
	}

	/**
	 * Get an asset by token ID and contract address.
	 * Normalizes chainId to hex so the lookup matches how assets are stored after mint.
	 * @param contractAddress - Contract address
	 * @param tokenId - Token ID
	 * @param chainId - Chain ID (decimal or hex; normalized to hex for query)
	 * @returns Asset with collection, or null if not found or chainId missing
	 */
	static async getAssetByTokenId(
		contractAddress: string,
		tokenId: string | number,
		chainId: string | null | undefined
	): Promise<AssetWithCollection | null> {
		if (chainId == null || chainId === '') {
			return null;
		}
		const normalizedChainId = getHexChainId(chainId);
		return prisma.asset.findFirst({
			where: {
				contractAddress,
				tokenId: tokenId.toString(),
				chainId: normalizedChainId,
			},
			include: { collection: true },
		});
	}

	/**
	 * Resolve a productId to a voucherId for minting
	 * @param item - Checkout item with productId
	 * @returns Result with voucherId or error
	 */
	static async resolveProductToVoucher(item: CheckoutItem): Promise<{
		success: boolean;
		voucherId?: number;
		product?: ProductWithVoucher;
		error?: CheckoutError;
	}> {
		if (!item.productId) {
			return {
				success: false,
				error: {
					collectionId: item.collectionId,
					tokenId: item.tokenId,
					quantity: item.quantity,
					error: 'Product ID is required',
				},
			};
		}

		const product = await ProductService.getProductWithVoucher(item.productId);
		if (!product) {
			return {
				success: false,
				error: {
					collectionId: item.collectionId,
					tokenId: item.tokenId,
					quantity: item.quantity,
					productId: item.productId,
					error: `Product not found: ${item.productId}`,
				},
			};
		}

		// Validate quantity for KAMI721AC products
		const requestedQuantity = item.quantity ?? 1;
		if (!SupplyService.canMint(product, requestedQuantity)) {
			return {
				success: false,
				error: {
					collectionId: item.collectionId,
					tokenId: item.tokenId,
					quantity: item.quantity,
					productId: item.productId,
					error: `Requested quantity (${requestedQuantity}) exceeds available quantity (${product.availableQuantity})`,
				},
			};
		}

		// Get voucher associated with product for minting
		if (!product.voucher) {
			return {
				success: false,
				error: {
					collectionId: item.collectionId,
					tokenId: item.tokenId,
					quantity: item.quantity,
					productId: item.productId,
					error: `No voucher associated with product ${item.productId}. Cannot mint.`,
				},
			};
		}

		return {
			success: true,
			voucherId: product.voucher.id,
			product,
		};
	}

	/**
	 * Validate a checkout item
	 * @param item - Checkout item to validate
	 * @returns Validation result with errors if any
	 */
	static async validateCheckoutItem(item: CheckoutItem): Promise<{
		valid: boolean;
		errors: CheckoutError[];
		resolvedVoucherId?: number;
		product?: ProductWithVoucher;
	}> {
		const errors: CheckoutError[] = [];

		// Must have productId, voucherId, or assetId
		if (!item.productId && !item.voucherId && !item.assetId) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				voucherId: item.voucherId,
				assetId: item.assetId,
				error: 'Product ID, Voucher ID, or Asset ID is required',
			});
			return { valid: false, errors };
		}

		// If productId is provided, resolve to voucher
		let resolvedVoucherId = item.voucherId;
		let product: ProductWithVoucher | undefined;
		
		if (item.productId && !item.voucherId) {
			const result = await this.resolveProductToVoucher(item);
			if (!result.success) {
				errors.push(result.error!);
				return { valid: false, errors };
			}
			resolvedVoucherId = result.voucherId;
			product = result.product;
		}

		// Validate voucher exists
		if (resolvedVoucherId) {
			const voucher = await this.getVoucher(resolvedVoucherId);
			if (!voucher) {
				errors.push({
					collectionId: item.collectionId,
					tokenId: item.tokenId,
					quantity: item.quantity,
					voucherId: resolvedVoucherId,
					error: 'Voucher not found',
				});
				return { valid: false, errors };
			}
		}

		// Validate collection exists
		const collection = await this.getCollection(item.collectionId);
		if (!collection) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				error: 'Collection not found',
			});
			return { valid: false, errors };
		}

		// Validate quantity for ERC721C
		if (item.quantity && item.quantity > 1 && collection.contractType === ContractType.ERC721C) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				error: 'Quantity must be 1 for ERC721C Collection',
			});
			return { valid: false, errors };
		}

		// Validate quantity > 0 for non-ERC721C
		if (collection.contractType !== ContractType.ERC721C) {
			if (!item.quantity || item.quantity <= 0) {
				errors.push({
					collectionId: item.collectionId,
					tokenId: item.tokenId,
					quantity: item.quantity,
					error: 'Quantity must be greater than 0',
				});
				return { valid: false, errors };
			}
		}

		return { valid: true, errors: [], resolvedVoucherId, product };
	}

	/**
	 * Check if the seller is the creator of an asset
	 * @param asset - Asset to check
	 * @param collection - Collection the asset belongs to
	 * @returns true if seller is the creator
	 */
	static async isSellerCreator(
		asset: AssetWithCollection,
		collection: CollectionWithVouchersAndAssets
	): Promise<boolean> {
		try {
			if (!asset.productId) {
				return false;
			}

			const product = await prisma.product.findUnique({
				where: { id: asset.productId },
				include: { project: true },
			});

			if (!product || !product.project) {
				return false;
			}

			// Compare seller (asset.walletAddress) with creator (project.walletAddress)
			const sellerAddress = asset.walletAddress.toLowerCase();
			const creatorAddress = product.project.walletAddress.toLowerCase();

			return sellerAddress === creatorAddress;
		} catch (error) {
			console.error('Error checking if seller is creator:', error);
			return false;
		}
	}

	/**
	 * Determine if a checkout item should be routed to mint or buy
	 * @param item - Checkout item
	 * @param collection - Collection
	 * @param asset - Asset (if buying)
	 * @returns Object indicating whether to mint or buy
	 */
	static async determineCheckoutAction(
		item: CheckoutItem,
		collection: CollectionWithVouchersAndAssets,
		asset?: AssetWithCollection
	): Promise<{
		action: 'mint' | 'buy' | 'deploy';
		voucherId?: number;
		reason?: string;
	}> {
		// If voucher is provided and no contract address, need to deploy first
		if (item.voucherId && !collection.contractAddress) {
			return { action: 'deploy' };
		}

		// If voucher is provided and contract exists, mint
		if (item.voucherId) {
			return { action: 'mint', voucherId: item.voucherId };
		}

		// For ERC721AC with asset, check if we should mint or buy
		if (collection.contractType === ContractType.ERC721AC && asset?.productId) {
			const isCreator = await this.isSellerCreator(asset, collection);
			
			if (isCreator) {
				// Get product to check if we can mint
				const product = await prisma.product.findUnique({
					where: { id: asset.productId },
				});

				const canMintMore = product && (
					SupplyService.isUnlimited(product.maxQuantity) ||
					product.availableQuantity > 0
				);

				if (canMintMore) {
					// Find voucher for this product
					const voucher = await prisma.voucher.findFirst({
						where: { productId: asset.productId },
					});

					if (voucher) {
						return { action: 'mint', voucherId: voucher.id };
					}
				}
			}
		}

		// Default to buy
		return { action: 'buy' };
	}
}
