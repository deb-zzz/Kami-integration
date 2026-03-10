import { prisma } from '@/lib/db';
import { ProductAudience, ProhibitReason } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest, { params }: { params: { productId: string } }) {
	const { productId } = params;
	const body = (await request.json()) as {
    		audience: ProductAudience;
    		prohibitReason?: ProhibitReason | null;
    	};

    const { audience, prohibitReason } = body;

	if (!audience) {
        return NextResponse.json({ error: 'Audience is required' }, { status: 400 });
    }

    // Validate prohibitReason when audience is Prohibit
    if (audience === ProductAudience.Prohibit) {
        if (!prohibitReason) {
            return NextResponse.json(
                {
                    error: 'Prohibit reason is required when audience is set to Prohibit',
                    fieldErrors: {
                        prohibitReason: 'Required when audience is Prohibit'
                    }
                },
                { status: 400 }
            );
        }

        // Validate prohibitReason is a valid enum value
        if (!Object.values(ProhibitReason).includes(prohibitReason)) {
            return NextResponse.json(
                {
                    error: 'Invalid prohibit reason',
                    fieldErrors: {
                        prohibitReason: 'Invalid prohibit reason value'
                    }
                },
                { status: 400 }
            );
        }
    }

	try {
		const product = await prisma.product.findUnique({
			where: { id: Number(productId) },
		});
		if (!product) {
			console.error(`Set Audience: Product not found: ${productId}`);
			return NextResponse.json({ error: 'Product not found' }, { status: 404 });
		}

		const updatedProduct = await prisma.$transaction(async (tx) => {
			// Prepare update data
			const updateData: {
                audience: ProductAudience;
                prohibitReason: ProhibitReason | null;
            } = {
				audience,
				// Set prohibitReason to null if audience is NOT Prohibit
				prohibitReason:
                  audience === ProductAudience.Prohibit && prohibitReason
                    ? prohibitReason
                    : null
			};

			// 1. Update the product
			const product = await tx.product.update({
				where: { id: Number(productId) },
				data: updateData,
			});

			// 2. Remove related cart items
			await tx.cartItems.updateMany({
				where: {
					productId: Number(productId),
					isActive: true,
					actionedAt: null,
				},
				data: {
					isActive: false,
					deletedAt: Math.floor(Date.now() / 1000),
				},
			});

			return product;
		});
		
		return NextResponse.json(updatedProduct);
	} catch (error) {
		return NextResponse.json({ error: 'Failed to update product audience' }, { status: 500 });
	}
}
