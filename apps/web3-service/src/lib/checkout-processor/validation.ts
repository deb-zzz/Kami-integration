import { prisma } from '@/lib/db';
import { getPaymentTokenBalances, getHexChainId } from '@/lib/gasless-nft';
import { ConsumerAction, ContractType } from '@prisma/client';
import {
	CheckoutService,
	ProductService,
	SupplyService,
	type CollectionWithVouchersAndAssets,
	type VoucherWithCollection,
	type AssetWithCollection,
	type CheckoutItem,
	type CheckoutError,
} from '@/services';
import type { ToDeploy, ToMint, ToBuy, Erc721acMintGroup } from './types';
import { getPaymentToken } from './helpers';
import {
	isMintSupported,
	isDeploySupported,
	validateMintQuantity,
	validateBuyQuantity,
} from './nft-rules';

// Use CheckoutService for data retrieval
const getCollection = CheckoutService.getCollection.bind(CheckoutService);
const getAsset = CheckoutService.getAsset.bind(CheckoutService);
const getAssetByTokenId = CheckoutService.getAssetByTokenId.bind(CheckoutService);
const getVoucher = CheckoutService.getVoucher.bind(CheckoutService);
const getProduct = ProductService.getProductWithVoucher.bind(ProductService);
const isSellerCreator = CheckoutService.isSellerCreator.bind(CheckoutService);

// Wrapper functions to maintain backwards compatibility with existing code
function isUnlimitedSupply(product: { maxQuantity: number | null }): boolean {
	return SupplyService.isUnlimited(product.maxQuantity);
}

function canMint(product: { maxQuantity: number | null; availableQuantity: number }, requestedQuantity: number): boolean {
	return SupplyService.canMint(product, requestedQuantity);
}

/**
 * Validate that buyer has sufficient balance to cover all charges
 * FIXED: Now properly aggregates charges when multiple items use the same chain+paymentToken
 */
export async function validateCharges(checkoutItems: CheckoutItem[], buyerWalletAddress: string): Promise<boolean> {
	const totalChargesByChainAndPaymentToken = new Map<`0x${string}`, Map<`0x${string}`, number>>();

	// Aggregate charges by chain and payment token
	for (const item of checkoutItems) {
		if (item.charges) {
			const collection = await getCollection(item.collectionId);
			if (!collection) throw new Error(`Collection not found: ${item.collectionId}`);
			const chainId = collection.chainId as `0x${string}`;
			const paymentToken = await getPaymentToken(chainId);
			if (!paymentToken) throw new Error(`Payment token not found for chain: ${chainId}`);
			const paymentTokenAddress = paymentToken.contractAddress as `0x${string}`;

			if (totalChargesByChainAndPaymentToken.has(chainId)) {
				const paymentTokenMap = totalChargesByChainAndPaymentToken.get(chainId)!;
				// FIX: Add to existing value instead of replacing
				const currentCharges = paymentTokenMap.get(paymentTokenAddress) ?? 0;
				paymentTokenMap.set(paymentTokenAddress, currentCharges + (item.charges ?? 0));
			} else {
				totalChargesByChainAndPaymentToken.set(chainId, new Map([[paymentTokenAddress, item.charges ?? 0]]));
			}
		}
	}

	if (totalChargesByChainAndPaymentToken.size === 0) return true;

	// Flatten map to array (simplified - no need for find/+= since we already aggregated)
	const summarisedCharges: { chainId: `0x${string}`; paymentTokenAddress: `0x${string}`; totalCharges: number }[] = [];
	for (const [chainId, paymentTokenMap] of Array.from(totalChargesByChainAndPaymentToken.entries())) {
		for (const [paymentTokenAddress, charges] of Array.from(paymentTokenMap.entries())) {
			summarisedCharges.push({ chainId, paymentTokenAddress, totalCharges: charges });
		}
	}

	// Validate balance for each charge
	for (const charge of summarisedCharges) {
		const paymentTokenBalances = await getPaymentTokenBalances(charge.chainId, buyerWalletAddress as `0x${string}`, [
			charge.paymentTokenAddress,
		]);
		if (paymentTokenBalances.length > 0) {
			const paymentTokenBalance = paymentTokenBalances[0];
			if (paymentTokenBalance.formattedBalance < charge.totalCharges) {
				return false;
			}
		} else {
			return false;
		}
	}
	return true;
}

/**
 * Validate that item has at least one identifier
 */
function validateItemIdentifiers(item: CheckoutItem, errors: CheckoutError[]): boolean {
	const hasTokenId = item.tokenId !== undefined && item.tokenId !== null;
	if (!item.productId && !item.voucherId && !item.assetId && !hasTokenId) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			voucherId: item.voucherId,
			assetId: item.assetId,
			error: `Product ID, Voucher ID, Asset ID, or Token ID is required`,
		});
		return false;
	}
	return true;
}

/**
 * Resolve productId to voucherId and validate quantity
 * Skip when item.assetId is set (buy intent: client sent assetId or we set it from tokenId lookup).
 */
async function resolveProductToVoucher(item: CheckoutItem, errors: CheckoutError[]): Promise<boolean> {
	if (item.assetId != null) {
		return true; // Buy intent - do not resolve to voucher
	}
	if (!item.productId || item.voucherId) {
		return true; // Not a product-based item or already has voucherId
	}

	const product = await getProduct(item.productId);
	if (!product) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			error: `Product not found: ${item.productId}`,
		});
		return false;
	}

	const requestedQuantity = item.quantity ?? 1;
	if (!canMint(product, requestedQuantity)) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			error: `Requested quantity (${requestedQuantity}) exceeds available quantity (${product.availableQuantity})`,
		});
		return false;
	}

	if (product.voucher) {
		item.voucherId = product.voucher.id;
	} else {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			error: `No voucher associated with product ${item.productId}. Cannot mint.`,
		});
		return false;
	}

	return true;
}

/**
 * Validate voucher exists when voucherId is provided.
 * Returns false if we pushed an error (caller should continue to next item).
 */
async function validateVoucher(item: CheckoutItem, errors: CheckoutError[]): Promise<boolean> {
	if (!item.voucherId) return true;
	if (await getVoucher(item.voucherId)) return true;
	errors.push({
		collectionId: item.collectionId,
		tokenId: item.tokenId,
		quantity: item.quantity,
		voucherId: item.voucherId,
		error: `Voucher not found`,
	});
	return false;
}

/**
 * Validate collection exists
 */
async function validateCollection(item: CheckoutItem, errors: CheckoutError[]): Promise<CollectionWithVouchersAndAssets | null> {
	const collection = await getCollection(item.collectionId);
	if (!collection) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			error: `Collection not found`,
		});
		return null;
	}
	return collection;
}

/**
 * Validate asset exists when assetId is provided and collection is deployed.
 * Returns false if we pushed an error (caller should continue to next item).
 */
async function validateAsset(
	item: CheckoutItem,
	collection: CollectionWithVouchersAndAssets,
	errors: CheckoutError[],
): Promise<boolean> {
	if (item.assetId && collection.contractAddress && !(await getAsset(collection.contractAddress, item.assetId))) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			assetId: item.assetId,
			error: `Asset not found`,
		});
		return false;
	}
	return true;
}

/**
 * Validate quantity constraints based on contract type (uses central nft-rules).
 */
function validateQuantityConstraints(item: CheckoutItem, collection: CollectionWithVouchersAndAssets, errors: CheckoutError[]): boolean {
	// Mint path (voucherId) vs buy path (assetId/tokenId) - use corresponding rule
	const isMintPath = !!item.voucherId;
	const qtyError = isMintPath
		? validateMintQuantity(collection.contractType, item.quantity)
		: validateBuyQuantity(collection.contractType, item.quantity);
	if (qtyError) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			voucherId: item.voucherId,
			assetId: item.assetId,
			error: qtyError,
		});
		return false;
	}

	// For collections without contractAddress (not yet deployed):
	// - Quantity can be 0 or positive (0 might indicate unlimited)
	if (collection.contractType !== ContractType.ERC721C && !collection.contractAddress) {
		if (item.quantity != null && item.quantity < 0) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				error: `Quantity must be greater than or equal to 0 (unlimited)`,
			});
			return false;
		}
	}

	// For pre-minted collections (with contractAddress):
	// - Quantity must be positive
	if (collection.contractType !== ContractType.ERC721C && collection.contractAddress) {
		if (item.quantity != null && item.quantity <= 0) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				error: `Quantity must be greater than 0 for pre-minted collections`,
			});
			return false;
		}
	}

	return true;
}

/**
 * Categorize item for mint operation
 */
async function categorizeMintItem(
	item: CheckoutItem,
	collection: CollectionWithVouchersAndAssets,
	erc721acMintGroups: Map<number, Erc721acMintGroup>,
	toDeploy: ToDeploy[],
	toMint: ToMint[],
	errors: CheckoutError[],
): Promise<boolean> {
	if (!item.voucherId) {
		return false; // Not a mint operation
	}

	// If collection is not deployed, it must be deployed first
	if (!collection.contractAddress) {
		toDeploy.push({ ...item, collection: collection });
		return true;
	}

	// Fetch voucher details for minting
	const voucher = await getVoucher(item.voucherId);
	if (!voucher) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			voucherId: item.voucherId,
			error: `Voucher not found`,
		});
		return false;
	}

	// ERC721AC supports batch minting - group by voucherId to optimize gas
	if (collection.contractType === ContractType.ERC721AC) {
		const existingGroup = erc721acMintGroups.get(item.voucherId);
		if (existingGroup) {
			existingGroup.totalQuantity += item.quantity ?? 1;
			existingGroup.charges += item.charges ?? 0;
		} else {
			erc721acMintGroups.set(item.voucherId, {
				voucher: voucher,
				totalQuantity: item.quantity ?? 1,
				charges: item.charges ?? 0,
			});
		}
	} else {
		// Non-ERC721AC: add directly to mint queue (no batching)
		toMint.push({ voucherId: item.voucherId, voucher: voucher, quantity: item.quantity ?? 1, charges: item.charges ?? 0 });
	}

	return true;
}

/**
 * Try to convert ERC721AC buy operation to mint (if seller is creator and supply available)
 */
async function tryConvertBuyToMint(
	item: CheckoutItem,
	asset: AssetWithCollection,
	collection: CollectionWithVouchersAndAssets,
	erc721acMintGroups: Map<number, Erc721acMintGroup>,
	errors: CheckoutError[],
): Promise<boolean> {
	// When the item refers to a specific existing asset (assetId or tokenId resolved to asset), the user
	// is buying that listed token. Do not convert to mint — we must sell that asset, not mint a new one.
	if (item.assetId != null) {
		return false;
	}
	if (collection.contractType !== ContractType.ERC721AC || !asset.productId) {
		return false; // Not applicable
	}

	const sellerIsCreator = await isSellerCreator(asset, collection);
	if (!sellerIsCreator) {
		// Seller is not creator - must buy existing token, quantity must be 1
		if (item.quantity && item.quantity > 1) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				assetId: item.assetId,
				error: `Quantity must be 1 for ERC721AC buy operations. Each token must be purchased separately.`,
			});
		}
		return false;
	}

	// Seller is creator - check if we can mint instead of buy
	const product = await prisma.product.findUnique({
		where: { id: asset.productId },
	});

	const unlimitedSupply = product && isUnlimitedSupply(product);
	const canMintMore = product && (unlimitedSupply || product.availableQuantity > 0);

	if (!canMintMore) {
		// Cannot mint - must buy, but quantity must be 1 for ERC721AC
		if (item.quantity && item.quantity > 1) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				assetId: item.assetId,
				error: `Quantity must be 1 for ERC721AC buy operations. No available quantity for minting.`,
			});
		}
		return false;
	}

	// Convert to mint: find voucher and add to mint groups
	const voucher = await prisma.voucher.findFirst({
		where: { productId: asset.productId },
		include: { collection: true },
	});

	if (!voucher) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			assetId: item.assetId,
			error: `No voucher found for product. Cannot mint without voucher.`,
		});
		return false;
	}

	const requestedQuantity = item.quantity ?? 1;
	// Validate quantity is available (unless unlimited)
	if (!unlimitedSupply && requestedQuantity > product!.availableQuantity) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			assetId: item.assetId,
			error: `Requested quantity (${requestedQuantity}) exceeds available quantity (${product!.availableQuantity})`,
		});
		return false;
	}

	// Add to ERC721AC mint group (batch minting)
	const existingGroup = erc721acMintGroups.get(voucher.id);
	if (existingGroup) {
		existingGroup.totalQuantity += requestedQuantity;
		existingGroup.charges += item.charges ?? 0;
	} else {
		erc721acMintGroups.set(voucher.id, {
			voucher: voucher as VoucherWithCollection,
			totalQuantity: requestedQuantity,
			charges: item.charges ?? 0,
		});
	}

	return true; // Successfully converted to mint
}

/**
 * Categorize item for buy operation
 */
async function categorizeBuyItem(
	item: CheckoutItem,
	collection: CollectionWithVouchersAndAssets,
	erc721acMintGroups: Map<number, Erc721acMintGroup>,
	toBuy: ToBuy[],
	errors: CheckoutError[],
): Promise<boolean> {
	// Buy operations require either assetId or tokenId
	if (!item.assetId && !item.tokenId) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			assetId: item.assetId,
			error: `Asset ID or Token ID is required to buy`,
		});
		return false;
	}

	// Collection must be deployed to buy existing assets
	if (!collection.contractAddress) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			assetId: item.assetId,
			error: `Contract address is required to buy a pre-minted asset`,
		});
		return false;
	}

	// Fetch asset by assetId or tokenId
	let asset: AssetWithCollection | null = null;
	if (item.assetId) {
		asset = await getAsset(collection.contractAddress, item.assetId);
	} else if (item.tokenId) {
		asset = await getAssetByTokenId(collection.contractAddress, item.tokenId, collection.chainId);
	}

	if (!asset) {
		errors.push({
			collectionId: item.collectionId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			assetId: item.assetId,
			error: `Asset not found${item.assetId ? ` with assetId: ${item.assetId}` : item.tokenId ? ` with tokenId: ${item.tokenId}` : ''}`,
		});
		return false;
	}

	// Try to convert ERC721AC buy to mint (if applicable)
	if (await tryConvertBuyToMint(item, asset, collection, erc721acMintGroups, errors)) {
		return true; // Converted to mint, skip buy
	}

	// Add to buy queue: purchase existing NFT from seller
	toBuy.push({
		contractAddress: collection.contractAddress,
		tokenId: item.tokenId ?? Number(asset.tokenId),
		quantity: item.quantity ?? 1,
		asset: asset,
		charges: item.charges ?? 0,
	});

	return true;
}

/**
 * Flush ERC721AC mint groups to mint queue
 */
export function flushErc721acMintGroupsToMintQueue(
	erc721acMintGroups: Map<number, Erc721acMintGroup>,
	toMint: ToMint[],
): void {
	for (const [voucherId, group] of Array.from(erc721acMintGroups.entries())) {
		toMint.push({
			voucherId: voucherId,
			voucher: group.voucher,
			quantity: group.totalQuantity,
			charges: group.charges,
		});
	}
}

/**
 * Validate and categorize all checkout items
 * Returns categorized items and any validation errors
 */
export async function validateAndCategorizeItems(
	checkoutItems: CheckoutItem[],
): Promise<{
	toDeploy: ToDeploy[];
	toMint: ToMint[];
	toBuy: ToBuy[];
	errors: CheckoutError[];
}> {
	const toDeploy: ToDeploy[] = [];
	const toMint: ToMint[] = [];
	const toBuy: ToBuy[] = [];
	const errors: CheckoutError[] = [];

	// Group ERC721AC mints by voucherId to batch mint operations
	const erc721acMintGroups = new Map<number, Erc721acMintGroup>();

	for (const item of checkoutItems) {
		// Validate identifiers
		if (!validateItemIdentifiers(item, errors)) {
			continue;
		}

		// Validate collection exists (needed before tokenId lookup and categorization)
		const collection = await validateCollection(item, errors);
		if (!collection) {
			continue;
		}

		// When tokenId present without assetId, resolve buy vs mint via asset table (use hex chainId to match how assets are stored)
		if (
			item.tokenId != null &&
			item.assetId == null &&
			collection.contractAddress &&
			collection.chainId
		) {
			const assetByToken = await getAssetByTokenId(
				collection.contractAddress,
				item.tokenId,
				getHexChainId(collection.chainId),
			);
			if (assetByToken) {
				item.assetId = assetByToken.id;
			}
		}

		// Resolve product to voucher if needed (skipped when item.assetId is set)
		if (!(await resolveProductToVoucher(item, errors))) {
			continue;
		}

		// When tokenId was provided but no asset found, mint path requires productId or voucherId
		if (item.tokenId != null && item.assetId == null && !item.voucherId) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				voucherId: item.voucherId,
				assetId: item.assetId,
				error: `Product ID or Voucher ID is required to mint when token is not yet in the asset table`,
			});
			continue;
		}

		// Validate voucher exists
		if (!(await validateVoucher(item, errors))) {
			continue;
		}

		// ERC1155C deploy/mint not supported in checkout - reject early
		if (item.voucherId && collection.contractType === ContractType.ERC1155C) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				voucherId: item.voucherId,
				error: `ERC1155C deploy/mint is not supported in checkout; only ERC721C and ERC721AC are supported for mint.`,
			});
			continue;
		}

		// Reject deploy for contract types that don't support gasless deploy
		if (item.voucherId && !collection.contractAddress && !isDeploySupported(collection.contractType)) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				voucherId: item.voucherId,
				error: `ERC1155C deploy/mint is not supported in checkout; only ERC721C and ERC721AC are supported for mint.`,
			});
			continue;
		}

		// Reject mint for deployed ERC1155C (mint not supported)
		if (item.voucherId && collection.contractAddress && !isMintSupported(collection.contractType)) {
			errors.push({
				collectionId: item.collectionId,
				tokenId: item.tokenId,
				quantity: item.quantity,
				voucherId: item.voucherId,
				error: `ERC1155C deploy/mint is not supported in checkout; only ERC721C and ERC721AC are supported for mint.`,
			});
			continue;
		}

		// Validate asset exists (early check for buy operations)
		if (!(await validateAsset(item, collection, errors))) {
			continue;
		}

		// Validate quantity constraints
		if (!validateQuantityConstraints(item, collection, errors)) {
			continue;
		}

		// Categorize: try mint first (voucher-based)
		if (item.voucherId) {
			await categorizeMintItem(item, collection, erc721acMintGroups, toDeploy, toMint, errors);
			continue; // Always continue when voucherId is set - either categorized as mint/deploy or error recorded
		}

		// Categorize: buy operation (asset-based)
		await categorizeBuyItem(item, collection, erc721acMintGroups, toBuy, errors);
	}

	// Flatten ERC721AC mint groups into mint queue
	flushErc721acMintGroupsToMintQueue(erc721acMintGroups, toMint);

	return { toDeploy, toMint, toBuy, errors };
}
