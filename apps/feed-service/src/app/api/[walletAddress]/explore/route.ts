import { prisma } from '@/lib/db';
import { Prisma, ProductAudience } from '@prisma/client';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import Redis from 'ioredis';
//

/**
 * Force dynamic rendering to ensure fresh data on each request
 */
const dynamic = 'force-dynamic';

/**
 * Represents a successful API response
 * @typedef {Object} Success
 * @property {boolean} success - Always true for successful responses
 * @property {any[]} explore - Array of recommended products
 */
type Success = {
	success: true;
	explore: any[];
};

/**
 * Represents a failed API response
 * @typedef {Object} Fail
 * @property {boolean} success - Always false for failed responses
 * @property {string} [error] - Optional error message
 */
type Fail = {
	success: false;
	error?: string;
};

/**
 * Represents the request parameters structure
 * @typedef {Object} Props
 * @property {Object} params - URL parameters
 * @property {string} params.walletAddress - Wallet address of the user
 */
type Props = {
	params: {
		walletAddress: string;
	};
};

/**
 * Represents the search query parameters structure
 * @typedef {Object} Search
 * @property {string} [search] - Search query
 */
type Search = {
	search?: string;
	page?: number;
	limit?: number;
};

/**
 * Handles GET requests to fetch personalized product recommendations based on user interests
 * @async
 * @param {NextRequest} _ - Next.js request object (unused)
 * @param {Props} params - Request parameters containing wallet address
 * @returns {Promise<NextResponse<Success | Fail>>} JSON response with recommended products or error
 *
 * @description
 * This endpoint performs the following operations:
 * 1. Fetches user profile and their interest tags
 * 2. Queries products matching user interests and search query
 * 3. Formats product data for response, including media URLs
 * 4. Returns formatted products as recommendations
 */
export async function GET(request: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	headers(); // Initialize headers

	// Get search query, page, and limit
	const search = request.nextUrl.searchParams.get('search');
	const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1');
	const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '24');

	const offset = (page - 1) * limit;
	let tags: string[] | undefined = undefined;

	// Fetch user profile and filter for relevant tags if no search query
	if (!search) {
		const profile = await prisma.user.findUnique({
			where: { walletAddress: params.walletAddress },
			include: { tags: true },
		});

		if (profile) {
			tags = profile?.tags.filter((t) => t.type === 'Interest' || t.type === 'Other').map((t) => t.tag);
		}
	}

	let products: Prisma.productGetPayload<{
		include: {
			asset: { include: { tags: true } };
			collection: { include: { owner: { select: { userName: true; avatarUrl: true; walletAddress: true } } } };
			voucher: { include: { tags: true } };
		};
	}>[] = [];

	// Get explore from redis
	const redis = new Redis(process.env.REDIS_URL as string);
	const explore = await redis.get('explore');
	if (explore) {
		try {
			products = JSON.parse(explore) as Prisma.productGetPayload<{
				include: {
					asset: { include: { tags: true } };
					collection: { include: { owner: { select: { userName: true; avatarUrl: true; walletAddress: true } } } };
					voucher: { include: { tags: true } };
				};
			}>[];
		} catch (parseError) {
			console.error('Failed to parse explore data from Redis:', parseError);
			// If parsing fails, continue to fetch from database
			products = [];
		}
	}

	if (products.length === 0) {
		// Get explore from database - public products or products owned by the user
		products = await prisma.product.findMany({
			where: {
				audience: ProductAudience.Public,
			},
			include: {
				asset: { include: { tags: true } },
				collection: { include: { owner: { select: { userName: true, avatarUrl: true, walletAddress: true } } } },
				voucher: { include: { tags: true } },
			},
			orderBy: { createdAt: 'desc' },
		});

		// Cache explore in redis
		await redis.set('explore', JSON.stringify(products));
	}

	// Filter products based on tags if no search query
	if (!search && tags && tags.length > 0) {
		const taggedProducts = products.filter(
			(p) =>
				p.asset?.map((t1) => {
					t1.tags.some((t) => tags.includes(t.tag)) || p.voucher?.tags.some((t) => tags.includes(t.tag));
				}) || p.voucher?.tags.some((t) => tags.includes(t.tag))
		);
		products = products.filter((p) => !taggedProducts.includes(p));
		products = [...taggedProducts, ...products];
	} else if (search) {
		// Filter products based on search query
		products = products.filter(
			(p) =>
				p.name.toLowerCase().includes(search.toLowerCase()) ||
				p.description?.toLowerCase().includes(search.toLowerCase()) ||
				p.asset?.map((t1) => {
					t1.tags.some((t) => t.tag.toLowerCase().includes(search.toLowerCase()));
				}) ||
				p.voucher?.tags.some((t) => t.tag.toLowerCase().includes(search.toLowerCase()))
		);
	}

	// Slice products based on offset and limit
	products = products.slice(offset, offset + limit);

	// Format products for response
	const formattedProducts = products.map((p) => ({
		...p,
		asset: undefined,
		voucher: undefined,
	}));

	await redis.quit();
	// Return the formatted products as a JSON response
	return NextResponse.json({ success: true, explore: formattedProducts });
}
