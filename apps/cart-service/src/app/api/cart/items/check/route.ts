import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ConsumerAction } from '@prisma/client';

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const walletAddress = searchParams.get('walletAddress');
	const productId = searchParams.get('productId') ? Number(searchParams.get('productId')) : undefined;
	const playlistId = searchParams.get('playlistId') ? Number(searchParams.get('playlistId')) : undefined;
	const assetId = searchParams.get('assetId') ? Number(searchParams.get('assetId')) : undefined;
	const quantity = Number(searchParams.get('quantity'));

	if (!walletAddress || (!productId && !playlistId)) {
		return NextResponse.json({ error: 'walletAddress and either productId or playlistId are required' }, { status: 400 });
	}

	if (isNaN(quantity) || quantity <= 0) {
		return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
	}

	try {
		// Check if item already in cart
		// Sum all quantities for this product across all actions
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

		const requestedQty = (totalInCart._sum.quantity ?? 0) + (quantity ?? 1);

		// If product, validate stock
		if (productId) {
			// When both productId and assetId: validate specific asset and use asset-scoped stock
			if (assetId != null) {
				const asset = await prisma.asset.findFirst({
					where: { id: assetId, productId },
					select: { availableQuantity: true },
				});
				if (!asset) {
					return NextResponse.json({
						canAdd: false,
						reason: 'Asset not found or does not belong to this product',
					});
				}
				if (quantity > 1) {
					return NextResponse.json({
						canAdd: false,
						reason: 'Quantity must be 1 when buying a specific asset',
					});
				}
				if (asset.availableQuantity < 1) {
					return NextResponse.json({
						canAdd: false,
						reason: 'This asset is not available for purchase',
					});
				}

				const product = await prisma.product.findUnique({
					where: { id: Number(productId) },
					select: { consumerAction: true, maxQuantity: true },
				});
				if (!product) {
					return NextResponse.json({
						canAdd: false,
						reason: 'Product not found',
					});
				}
				if (product.consumerAction === ConsumerAction.None) {
					return NextResponse.json({
						canAdd: false,
						reason: 'Product has been unlisted from sale',
					});
				}

				const availableQty = asset.availableQuantity;
				if (product.maxQuantity && product.maxQuantity > 0 && requestedQty > availableQty) {
					return NextResponse.json({
						canAdd: false,
						reason: 'Exceeds available stock',
						cartQuantity: totalInCart._sum.quantity ?? 0,
						availableQuantity: availableQty,
					});
				}
				if (requestedQty === availableQty) {
					return NextResponse.json({
						canAdd: true,
						reason: 'You have reached the maximum quantity available for this product',
						cartQuantity: totalInCart._sum.quantity ?? 0,
						availableQuantity: availableQty,
					});
				}
				return NextResponse.json({
					canAdd: true,
					cartQuantity: totalInCart._sum.quantity ?? 0,
					availableQuantity: availableQty,
				});
			}

			// Product-only path (no assetId)
			const product = await prisma.product.findUnique({
				where: { id: Number(productId) },
				select: {
					availableQuantity: true,
					consumerAction: true,
					maxQuantity: true,
					asset: {
						select: { availableQuantity: true },
					},
				},
			});

			if (!product) {
				return NextResponse.json({
					canAdd: false,
					reason: 'Product not found',
				});
			}

			if (product.consumerAction === ConsumerAction.None) {
				return NextResponse.json({
					canAdd: false,
					reason: 'Product has been unlisted from sale',
				});
			}

			// use asset quantity if available, otherwise product qty
			const availableQty = product.availableQuantity ?? product.asset?.[0]?.availableQuantity ?? 0;

			if (product.maxQuantity && product.maxQuantity > 0 && requestedQty > availableQty) {
				return NextResponse.json({
					canAdd: false,
					reason: 'Exceeds available stock',
					cartQuantity: totalInCart._sum.quantity ?? 0,
					availableQuantity: availableQty,
				});
			}

			if (requestedQty === availableQty) {
				return NextResponse.json({
					canAdd: true,
					reason: 'You have reached the maximum quantity available for this product',
					cartQuantity: totalInCart._sum.quantity ?? 0,
					availableQuantity: availableQty,
				});
			}

			return NextResponse.json({
				canAdd: true,
				cartQuantity: totalInCart._sum.quantity ?? 0,
				availableQuantity: availableQty,
			});
		}
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
