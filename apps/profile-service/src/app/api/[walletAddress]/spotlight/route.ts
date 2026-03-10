import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Handles GET requests to retrieve spotlighted products for a given wallet address.
 *
 * This function is an API route handler that processes incoming GET requests. It extracts the wallet address
 * from the request parameters and uses it to fetch spotlighted products associated with that address.
 * The response is returned in JSON format.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @param {Object} context - The context object containing route parameters.
 * @param {Object} context.params - The parameters object.
 * @param {string} context.params.walletAddress - The wallet address to retrieve spotlighted products for.
 * @returns {Promise<NextResponse>} - A promise that resolves to a NextResponse containing the spotlighted products in JSON format.
 * The response will be an array of product objects, each including an `nft` field and excluding `asset` and `voucher` fields.
 */
export async function GET(request: Request, { params }: { params: { walletAddress: string } }) {
	const { walletAddress } = params;
	const spotlight = await getSpotlight(walletAddress);
	return NextResponse.json(spotlight);
}

/**
 * Retrieves spotlighted products for a given wallet address.
 *
 * This function queries the database to find products that are marked as spotlighted and belong to the specified wallet address.
 * It includes related asset and voucher data, orders the results by creation date in descending order, and limits the results to the top three.
 * The function then transforms each product to include an `nft` field, which is derived from either the asset or voucher, and removes the original
 * `asset` and `voucher` fields from the response.
 *
 * @param {string} walletAddress - The wallet address to retrieve spotlighted products for.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of spotlighted product objects. Each object contains:
 *   - All original product fields.
 *   - An `nft` field, which is either the `asset` or `voucher` of the product.
 *   - The `asset` and `voucher` fields are set to `undefined`.
 *   If no spotlighted products are found, the function returns an empty array.
 */
async function getSpotlight(walletAddress: string) {
	try {
		const spotlightedProducts = await prisma.product.findMany({
			where: {
				ownerWalletAddress: walletAddress,
				spotlight: true,
				owner: { showSpotlight: true },
			},
			include: {
				collection: { select: { name: true, avatarUrl: true } },
				asset: true,
				voucher: true,
				owner: { select: { userName: true, walletAddress: true, avatarUrl: true, description: true, showSpotlight: true } },
			},
			orderBy: {
				createdAt: 'desc',
			},
			take: 3,
		});

		if (spotlightedProducts.length === 0) return [];

		return spotlightedProducts.map((product) => {
			return {
				...product,
				nft: product.asset ?? product.voucher,
				ownedBy: { ...product.owner },
				voucher: undefined,
				asset: undefined,
				owner: undefined,
			};
		});
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		return [];
	}
}

/**
 * Represents the request body for updating the spotlight visibility of a user.
 *
 * This type defines the structure of the request body for the POST request to update the spotlight visibility
 * of a user. It includes a single field, `showSpotlight`, which is a boolean value indicating whether the
 * user wants to show their spotlight.
 */
type SpotlightRequestBody = {
	showSpotlight: boolean;
};

/**
 * Handles POST requests to update the spotlight visibility for a user.
 *
 * This function is an API route handler that processes incoming POST requests. It extracts the wallet address
 * from the request parameters and uses it to update the spotlight visibility for the user.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @param {Object} context - The context object containing route parameters.
 * @param {Object} context.params - The parameters object.
 * @param {string} context.params.walletAddress - The wallet address of the user to update.
 * @returns {Promise<NextResponse>} - A promise that resolves to a NextResponse containing a JSON object with a `success` field, which is `true` if the update was successful, and `false` otherwise.
 */
export async function POST(request: Request, { params }: { params: { walletAddress: string } }) {
	const { walletAddress } = params;
	const { showSpotlight } = (await request.json()) as SpotlightRequestBody;

	try {
		await prisma.user.update({
			where: { walletAddress: walletAddress },
			data: { showSpotlight },
		});
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		return NextResponse.json({ success: false }, { status: 500 });
	}

	return NextResponse.json({ success: true });
}
