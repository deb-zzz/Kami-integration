import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Handles the PUT request to update the spotlight status of a product.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @param {Object} params - The parameters extracted from the request URL.
 * @param {string} params.walletAddress - The wallet address of the product owner.
 * @param {string} params.productId - The ID of the product to be updated.
 * @returns {Promise<NextResponse>} - A promise that resolves to a NextResponse object.
 *
 * The function expects the request body to contain a JSON object with the following structure:
 * {
 *   spotlight: boolean
 * }
 *
 * The function updates the spotlight status of the product identified by `productId` and owned by `walletAddress`.
 * If the update is successful, it returns a JSON response with a success message.
 * If the product is not found or not owned by the wallet address, it returns a JSON response with an error message.
 */
export async function PUT(request: Request, { params }: { params: { walletAddress: string; productId: string } }) {
	const { walletAddress, productId } = params;
	const { spotlight }: { spotlight: boolean } = await request.json();
	try {
		const updated = await prisma.product.update({
			where: { id: Number(productId), ownerWalletAddress: walletAddress },
			data: { spotlight },
		});
		if (updated.spotlight !== spotlight) throw new Error('Product not updated');
		return NextResponse.json({ success: true, message: `Product ${productId} ${spotlight ? 'spotlighted' : 'unspotlighted'}` });
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				message: 'Product not found or not owned by the wallet address',
				error: error instanceof Error ? error.message : error,
			},
			{ status: 400 }
		);
	}
}
