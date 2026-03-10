import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CheckoutActions, ConsumerAction } from '@prisma/client';

type CartItemRequest = {
	walletAddress: string;
	productId?: number;
	playlistId?: number;
	assetId?: number; /// optional: specific asset to buy (for buy path)
	quantity: number;
	checkoutAction: CheckoutActions;
};

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const walletAddress = searchParams.get('walletAddress');

	if (!walletAddress) {
		return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
	}

	try {
		// 1. Fetch items
		const cartItems = await prisma.cartItems.findMany({
			where: {
				walletAddress,
				isActive: true,
				actionedAt: null,
			},
			include: {
				user: { select: { userName: true } },
				product: {
					include: {
						collection: {
							include: {
								owner: { select: { userName: true, walletAddress: true } }, // 👈 collection owner
							},
						},
						voucher: true,
						asset: true,
						project: true,
					},
				},
				playlist: true,
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		// 2. Find invalid selected items
		const invalidItems = cartItems.filter((item) => item.isSelected && item.product?.consumerAction === 'None');

		// 3. Update DB if needed
		if (invalidItems.length > 0) {
			await prisma.cartItems.updateMany({
				where: { id: { in: invalidItems.map((i) => i.id) } },
				data: { isSelected: false },
			});

			// 4. Update in-memory array so returned data matches DB
			invalidItems.forEach((item) => {
				item.isSelected = false;
			});
		}

		// 5. Group items by collection
		const grouped = cartItems.reduce((acc: any, item) => {
			const collection = item.product?.collection;
			const collectionId = collection?.collectionId ?? 'no-collection';

			if (!acc[collectionId]) {
				acc[collectionId] = {
					collection,
					items: [],
					latestCreatedAt: 0,
				};
			}

			acc[collectionId].items.push(item);

			// Track the newest item timestamp in this collection
			acc[collectionId].latestCreatedAt = Math.max(acc[collectionId].latestCreatedAt, item.createdAt ?? 0);

			return acc;
		}, {});

		// 6. Convert to array & sort
		const result = Object.values(grouped).sort((a: any, b: any) => b.latestCreatedAt - a.latestCreatedAt);

		return NextResponse.json(result);
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const body: CartItemRequest = await request.json();
		const { walletAddress, productId, playlistId, assetId, quantity, checkoutAction } = body;

		if (!walletAddress || (!productId && !playlistId)) {
			return NextResponse.json({ error: 'walletAddress and either productId or playlistId are required' }, { status: 400 });
		}

		// Validate checkoutAction
		if (!checkoutAction || !Object.values(CheckoutActions).includes(checkoutAction)) {
			return NextResponse.json({ error: 'Invalid checkoutAction' }, { status: 400 });
		}

		// Validate quantity
		if (quantity !== undefined && quantity <= 0) {
			return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 });
		}

		// When assetId provided, validate it belongs to product and is available
		if (productId && assetId != null) {
			const asset = await prisma.asset.findFirst({
				where: { id: assetId, productId },
				select: { id: true, availableQuantity: true },
			});
			if (!asset) {
				return NextResponse.json({ error: 'Asset not found or does not belong to this product' }, { status: 400 });
			}
			if (asset.availableQuantity < 1) {
				return NextResponse.json({ error: 'This asset is not available for purchase' }, { status: 400 });
			}
			if ((quantity ?? 1) > 1) {
				return NextResponse.json({ error: 'Quantity must be 1 when buying a specific asset' }, { status: 400 });
			}
		}

		// Sum quantities for this product (and asset when buying a specific asset)
		const totalInCart = await prisma.cartItems.aggregate({
			_sum: { quantity: true },
			where: {
				walletAddress,
				productId,
				...(assetId != null ? { assetId } : {}),
				isActive: true,
				actionedAt: null,
			},
		});

		// Validate product stock availability if productId is provided
		if (productId) {
			const product = await prisma.product.findUnique({
				where: { id: productId },
				select: {
					availableQuantity: true,
					maxQuantity: true,
					consumerAction: true,
					asset: {
						select: { id: true, availableQuantity: true, productId: true },
					},
				},
			});

			if (!product) {
				return NextResponse.json({ error: 'Product not found' }, { status: 400 });
			}

			if (product.consumerAction === ConsumerAction.None) {
				return NextResponse.json({ error: 'Product has been unlisted from sale' }, { status: 400 });
			}

			const availableQty =
				assetId != null
					? (product.asset?.find((a) => a.id === assetId)?.availableQuantity ?? 0)
					: (product.asset?.[0]?.availableQuantity ?? product.availableQuantity);
			const requestedQty = (totalInCart._sum.quantity ?? 0) + (quantity ?? 1);

			if (product.maxQuantity && product.maxQuantity > 0 && requestedQty > availableQty) {
				return NextResponse.json({ error: `Quantity exceeds available stock (${availableQty})` }, { status: 400 });
			}
		}

		let cartItem;

		const existingItem = await prisma.cartItems.findFirst({
			where: {
				walletAddress,
				productId,
				playlistId,
				assetId: assetId ?? null,
				checkoutAction,
				isActive: true,
				actionedAt: null,
			},
		});

		if (existingItem) {
			cartItem = await prisma.cartItems.update({
				where: { id: existingItem.id },
				data: {
					quantity: existingItem.quantity + (quantity ?? 1),
					updatedAt: Math.floor(Date.now() / 1000),
				},
			});
		} else {
			cartItem = await prisma.cartItems.create({
				data: {
					walletAddress,
					productId,
					playlistId,
					assetId: assetId ?? null,
					checkoutAction,
					quantity: quantity ?? 1,
					createdAt: Math.floor(Date.now() / 1000),
				},
			});
		}

		return NextResponse.json(cartItem);
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	const body = await request.json();
	const { ids, walletAddress } = body;

	if (!Array.isArray(ids) || ids.length === 0) {
		return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
	}

	if (!walletAddress) {
		return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
	}

	try {
		const deleted = await prisma.cartItems.updateMany({
			where: {
				id: { in: ids.map(Number) },
				walletAddress,
				isActive: true,
				actionedAt: null,
			},
			data: { isActive: false, deletedAt: Math.floor(Date.now() / 1000) },
		});

		return NextResponse.json({ success: true, deletedCount: deleted.count });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
