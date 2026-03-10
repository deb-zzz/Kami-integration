import { prisma } from '@/lib/db';
import { exclude } from '@/utils/common';
import { SellerGroupedCheckoutItems } from '@/types/checkout-order';
import { ChargeLocation, ConsumerAction } from '@prisma/client';

export async function validateBuyer(walletAddress: string) {
	const buyer = await prisma.user.findUnique({
		where: { walletAddress },
	});
	if (!buyer) throw new Error('buyerWalletAddress not found');
	return buyer;
}

type CheckoutRequestItem = { productId: number; quantity: number; assetId?: number };

export async function validateAndProcessCheckoutItems(buyerWalletAddress: string, items: CheckoutRequestItem[]) {
	// Match cart by (productId, assetId); load selected cart items
	const cartItems = await prisma.cartItems.findMany({
		where: {
			walletAddress: buyerWalletAddress,
			isActive: true,
			isSelected: true,
		},
		orderBy: [{ productId: 'asc' }, { assetId: 'asc' }],
	});

	const sortedRequest = [...items].sort((a, b) => a.productId - b.productId || (a.assetId ?? 0) - (b.assetId ?? 0));
	const sortedCart = cartItems
		.filter((c) => c.productId != null)
		.sort((a, b) => (a.productId ?? 0) - (b.productId ?? 0) || (a.assetId ?? 0) - (b.assetId ?? 0));

	if (sortedRequest.length !== sortedCart.length) {
		throw new Error(`Some items were not found in cart or not selected for checkout.`);
	}
	for (let i = 0; i < sortedRequest.length; i++) {
		const r = sortedRequest[i];
		const c = sortedCart[i];
		if (r.productId !== (c.productId ?? 0) || (r.assetId ?? null) !== (c.assetId ?? null)) {
			throw new Error(
				`Cart does not match request: productId ${r.productId}${r.assetId != null ? ` assetId ${r.assetId}` : ''} not found or not selected.`,
			);
		}
	}

	const productIds = [...new Set(items.map((i) => i.productId))];
	const products = await prisma.product.findMany({
		where: { id: { in: productIds } },
		include: { owner: true, collection: true, voucher: true, asset: true },
	});
	const productMap = new Map(products.map((p) => [p.id, p]));

	const invalidProducts: {
		productId: number;
		assetId?: number;
		requested?: number;
		available?: number;
		unlisted?: boolean;
	}[] = [];

	const enrichedProducts: ((typeof products)[0] & { quantity: number; subtotal: number; assetId?: number | null })[] = [];

	for (let i = 0; i < sortedRequest.length; i++) {
		const req = sortedRequest[i];
		const cart = sortedCart[i];
		const product = productMap.get(req.productId);
		if (!product) {
			invalidProducts.push({ productId: req.productId, assetId: req.assetId });
			continue;
		}
		const requestedQty = req.quantity;
		const availableQty =
			req.assetId != null
				? (product.asset?.find((a) => a.id === req.assetId)?.availableQuantity ?? product.availableQuantity ?? 0)
				: (product.availableQuantity ?? product.asset?.[0]?.availableQuantity ?? 0);
		if (product.maxQuantity && product.maxQuantity > 0 && requestedQty > availableQty) {
			invalidProducts.push({
				productId: product.id,
				assetId: req.assetId,
				requested: requestedQty,
				available: availableQty,
			});
		}
		if (product.consumerAction === ConsumerAction.None) {
			invalidProducts.push({ productId: product.id, assetId: req.assetId, unlisted: true });
		}
		enrichedProducts.push({
			...product,
			quantity: requestedQty,
			subtotal: Number(product.price) * requestedQty,
			assetId: cart.assetId ?? undefined,
		});
	}

	if (invalidProducts.length > 0) {
		const msg = invalidProducts
			.map((p) =>
				p.unlisted
					? `productId=${p.productId}${p.assetId != null ? ` assetId=${p.assetId}` : ''} (unlisted)`
					: `productId=${p.productId}${p.assetId != null ? ` assetId=${p.assetId}` : ''} (requested=${p.requested}, available=${p.available})`,
			)
			.join(', ');
		throw new Error(`Invalid products: ${msg}`);
	}

	return { productIds, checkoutItems: enrichedProducts };
}

export function groupItemsBySeller(products: any[]) {
	const sellerGrp: SellerGroupedCheckoutItems = {};

	for (const item of products) {
		const sellerWalletAddress = item.ownerWalletAddress;
		if (!sellerGrp[sellerWalletAddress]) {
			sellerGrp[sellerWalletAddress] = {
				walletAddress: sellerWalletAddress,
				userName: item.owner.userName,
				collections: {},
				total: 0,
			};
		}
		const cleanItem = exclude(item, ['ownerWalletAddress', 'collectionId', 'owner', 'collection']);
		if (item.collection) {
			const collectionId = item.collection.collectionId;
			if (!sellerGrp[sellerWalletAddress].collections![collectionId]) {
				sellerGrp[sellerWalletAddress].collections![collectionId] = {
					collectionId,
					name: item.collection.name,
					items: [],
					total: 0,
				};
			}
			sellerGrp[sellerWalletAddress].collections![collectionId].items.push(cleanItem);
			sellerGrp[sellerWalletAddress].collections![collectionId].total += item.subtotal;
		}
		sellerGrp[sellerWalletAddress].total += item.subtotal;
	}

	// Flatten to structured response.
	return Object.values(sellerGrp).map((seller) => ({
		walletAddress: seller.walletAddress,
		userName: seller.userName,
		collections: Object.values(seller.collections ?? {}),
		total: seller.total,
	}));
}

export async function calculateCharges(subtotal: number, location: ChargeLocation) {
	const charges = await prisma.charge.findMany({
		where: {
			location,
			deletedAt: null,
			chargeType: {
				deletedAt: null,
			},
		},
		orderBy: { chargeType: { name: 'asc' } },
		include: { chargeType: true },
	});
	const overallAppliedCharges = charges.map((c) => {
		const fixed = Number(c.fixedAmount);
		const percent = Number(c.percentage);
		let amount = 0;
		if (fixed > 0) amount = fixed;
		else if (percent > 0) amount = (subtotal * percent) / 100;
		return {
			id: c.id,
			name: c.chargeType.name,
			description: c.description,
			fixedAmount: fixed,
			percentage: percent,
			amount,
		};
	});
	const overallTotalCharges = overallAppliedCharges.reduce((sum, c) => sum + c.amount, 0);
	return { overallAppliedCharges, overallTotalCharges };
}
