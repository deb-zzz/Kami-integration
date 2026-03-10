/**
 * @fileoverview API route handler for retrieving products associated with a wallet address.
 *
 * This endpoint returns products that have been either shared or liked by the specified wallet address.
 * Products include their associated assets, vouchers, likes, and shares.
 *
 * @route GET /api/[walletAddress]/product
 * @module api/[walletAddress]/product
 */

import { prisma } from '@/lib/db';
import { Prisma, ProductAudience } from '@prisma/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Type definition for the route parameters.
 */
type Props = {
	params: {
		/** The wallet address of the user whose products are being retrieved */
		walletAddress: string;
	};
};

/**
 * Type definition for a product with all related data included.
 */
type Product = Prisma.productGetPayload<{
	include: { asset: true; voucher: true; likes: true; shares: true };
}>;

/**
 * Handles GET requests to retrieve products associated with a wallet address.
 *
 * Returns products that have been either:
 * - Shared by the specified wallet address, OR
 * - Liked by the specified wallet address
 *
 * Products are filtered to only include:
 * - Products with Public audience, OR
 * - Products owned by the requesting wallet address
 *
 * @param request - The incoming request object (unused in this handler)
 * @param params - Route parameters containing the wallet address
 * @returns Promise resolving to a NextResponse with success status and products array
 *
 * @example
 * GET /api/0x123.../product
 * Response: { success: true, products: [...] }
 */
export async function GET(
	request: never,
	{ params }: Props
): Promise<NextResponse<{ success: boolean; products: ReturnType<typeof formatProduct>[] }>> {
	const { walletAddress } = params;

	// Query products that have been shared or liked by the wallet address
	// and are either public or owned by the requesting user
	const products = await prisma.product.findMany({
		where: {
			AND: [
				{
					// Products that have been shared or liked by the wallet address
					OR: [{ shares: { some: { walletAddress } } }, { likes: { some: { fromWalletAddress: walletAddress } } }],
				},
				{
					// Products that are public or owned by the requesting user
					OR: [{ audience: ProductAudience.Public }, { ownerWalletAddress: walletAddress }],
				},
			],
		},
		include: { asset: true, voucher: true, likes: true, shares: true },
	});

	// Format products to include aggregated counts
	const output = products.map((product) => formatProduct(product));
	return NextResponse.json({ success: true, products: output });
}

/**
 * Formats a product object by replacing arrays with their counts.
 *
 * Converts the likes and shares arrays to numeric counts for easier consumption
 * by the frontend.
 *
 * @param product - The product object with all related data
 * @returns Formatted product object with like and share counts
 */
function formatProduct(product: Product) {
	return {
		...product,
		likes: product.likes.length,
		shares: product.shares.length,
	};
}
