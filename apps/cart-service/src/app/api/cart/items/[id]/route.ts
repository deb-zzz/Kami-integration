import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CheckoutActions, ConsumerAction } from '@prisma/client';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const id = (await params).id;
		const body = await request.json();
		const { walletAddress, quantity, checkoutAction, isSelected } = body;

		if (!id || !walletAddress) {
			return NextResponse.json({ error: 'Cart item ID and walletAddress are required' }, { status: 400 });
		}

		// Find the existing active, non-actioned cart item
		const existingItem = await prisma.cartItems.findFirst({
			where: {
				id: Number(id),
				walletAddress,
				isActive: true,
				actionedAt: null,
			},
			include: {
				product: {
					select: {
						availableQuantity: true,
						consumerAction: true,
						maxQuantity: true,
						asset: {
							select: { id: true, availableQuantity: true },
						},
					},
				},
			},
		});

		if (!existingItem || existingItem.walletAddress !== walletAddress) {
			return NextResponse.json({ error: 'Cart item not found or not owned by this wallet' }, { status: 400 });
		}

		// Validate checkoutAction (if provided)
		if (checkoutAction && !Object.values(CheckoutActions).includes(checkoutAction)) {
			return NextResponse.json({ error: 'Invalid checkoutAction' }, { status: 400 });
		}

		// Validate consumerAction
		if (existingItem.product?.consumerAction === ConsumerAction.None) {
			return NextResponse.json({ error: 'Product has been unlisted from sale' }, { status: 400 });
		}

		// Validate quantity (if provided)
		if (quantity !== undefined) {
			if (quantity <= 0) {
				return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 });
			}

			// Check against product stock (use specific asset when cart item has assetId)
			const available =
				existingItem.assetId != null
					? (existingItem.product?.asset?.find((a) => a.id === existingItem.assetId)?.availableQuantity ??
						existingItem.product?.availableQuantity ??
						0)
					: (existingItem.product?.availableQuantity ?? existingItem.product?.asset?.[0]?.availableQuantity ?? 0);

			if (existingItem.product?.maxQuantity && existingItem.product?.maxQuantity > 0 && quantity > available) {
				return NextResponse.json({ error: `Quantity exceeds available stock (${available})` }, { status: 400 });
			}
		}

		// Update cart item
		const updatedItem = await prisma.cartItems.update({
			where: { id: Number(id) },
			data: {
				quantity: quantity ?? existingItem.quantity,
				checkoutAction: checkoutAction ?? existingItem.checkoutAction,
				isSelected: isSelected ?? existingItem.isSelected,
				updatedAt: Math.floor(Date.now() / 1000),
			},
		});

		return NextResponse.json(updatedItem);
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
