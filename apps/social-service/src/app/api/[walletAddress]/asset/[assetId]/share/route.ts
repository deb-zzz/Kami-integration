import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Type definition for the parameters expected by the POST function.
 */
type Props = {
	params: {
		walletAddress: string; // The wallet address of the user sharing the asset
		assetId: string; // The ID of the asset to be shared
	};
};

/**
 * Handles the POST request to share an asset.
 *
 * @param request - The incoming request object (not used in this function).
 * @param params - An object containing the wallet address and asset ID.
 * @returns A promise that resolves to a NextResponse object indicating success or failure.
 *
 * The function attempts to update an asset in the database by connecting it to a user
 * identified by their wallet address. If the update is successful, it returns a response
 * with `{ success: true }`. If an error occurs, it logs the error and returns a response
 * with `{ success: false }`.
 */
export async function POST(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, assetId } = params;
	try {
		await prisma.asset.update({
			where: { id: Number(assetId) },
			data: {
				shares: { connect: { walletAddress } },
			},
		});
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
