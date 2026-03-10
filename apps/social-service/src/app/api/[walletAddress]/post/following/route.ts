/**
 * @fileoverview API route handler for retrieving posts from followed users.
 * 
 * This endpoint returns posts created by users that the specified wallet address is following.
 * Posts are ordered by creation date (newest first) and include aggregated like and share counts.
 * 
 * @route GET /api/[walletAddress]/post/following
 * @module api/[walletAddress]/post/following
 */

import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Type definition for the route parameters.
 */
type Props = {
	params: {
		/** The wallet address of the user whose following posts are to be retrieved */
		walletAddress: string;
	};
};

/**
 * Handles GET requests to retrieve posts from users that the specified wallet address is following.
 * 
 * Fetches all distinct wallet addresses that the user is following, then retrieves all posts
 * created by those users. Posts include aggregated counts for likes and shares.
 *
 * @param req - The request object (unused)
 * @param params - Route parameters containing the wallet address
 * @returns Promise resolving to NextResponse with success status and posts array
 * 
 * Response structure:
 * - success: boolean indicating operation success
 * - posts: array of post objects with like and share counts
 * 
 * @example
 * GET /api/0x123.../post/following
 * Response: { success: true, posts: [...] }
 */
export async function GET(req: never, { params }: Props) {
	const { walletAddress } = params;

	try {
		// Retrieve distinct wallet addresses that the user is following
		const follows: string[] = (
			await prisma.follow.findMany({
				distinct: ['toWalletAddress'],
				where: { fromWalletAddress: walletAddress },
				select: { toWalletAddress: true },
				orderBy: { createdAt: 'desc' },
			})
		)
			.map((f) => f.toWalletAddress)
			.filter((toWalletAddress): toWalletAddress is string => toWalletAddress !== null);

		console.log(JSON.stringify(follows, null, 4));

		// Retrieve posts created by the followed wallet addresses
		const posts = await prisma.post.findMany({
			where: { createdByAddress: { in: follows } },
			include: {
				comments: true,
				likes: true,
				sharedBy: true,
				content: { include: { product: { include: { asset: true, voucher: true } } } },
			},
			orderBy: { createdAt: 'desc' },
		});

		// Map posts to include counts of likes and shares
		const postsWithComments = posts.map((post) => ({
			...post,
			likes: post.likes.length,
			shares: post.sharedBy.length,
		}));

		return NextResponse.json({ success: true, posts: postsWithComments });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
