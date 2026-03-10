/**
 * @fileoverview API route handler for retrieving posts liked by a user.
 * 
 * This endpoint returns all posts that have been liked by the specified wallet address.
 * Posts are ordered by creation date (newest first) and include aggregated like and share counts.
 * 
 * @route GET /api/[walletAddress]/post/favorites
 * @module api/[walletAddress]/post/favorites
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * Type definition for a post with all related data included.
 */
type Post = Prisma.postGetPayload<{
	include: {
		comments: true;
		likes: true;
		sharedBy: true;
		content: { include: { product: { include: { asset: true; voucher: true } } } };
	};
}>;

/**
 * Type definition for a post with aggregated counts instead of arrays.
 */
type PostWithCounts = Omit<Post, 'likes'> & {
	likes: number;
	shares: number;
};

/**
 * Type definition for the route parameters.
 */
type Props = {
	params: {
		/** The wallet address of the user whose liked posts are being retrieved */
		walletAddress: string;
	};
};

/**
 * Handles GET requests to retrieve posts liked by a specific wallet address.
 * 
 * Fetches all distinct posts that have been liked by the user, including all related data
 * (comments, likes, shares, content, products). Posts are formatted with aggregated counts.
 *
 * @param req - The request object (unused)
 * @param params - Route parameters containing the wallet address
 * @returns Promise resolving to NextResponse with success status and liked posts array
 * 
 * @example
 * GET /api/0x123.../post/favorites
 * Response: { success: true, posts: [...] }
 */
export async function GET(req: never, { params }: Props): Promise<NextResponse<{ success: boolean; posts?: PostWithCounts[] }>> {
	const { walletAddress } = params;

	try {
		// Retrieve distinct liked posts by the wallet address, including related data.
		const likes = await prisma.like.findMany({
			where: { fromWalletAddress: walletAddress },
			distinct: ['postId'],
			include: {
				post: {
					include: {
						comments: true,
						likes: true,
						sharedBy: true,
						content: { include: { product: { include: { asset: true, voucher: true } } } },
					},
				},
			},
			orderBy: { post: { createdAt: 'desc' } },
		});

		// Extract posts from likes and filter out any null values.
		const posts = likes.map((like) => like.post).filter((post) => post !== null);
		console.log(JSON.stringify(posts, null, 4));

		// Map posts to include counts of likes and shares.
		const postsWithComments: PostWithCounts[] = posts.map((post) => ({
			...post,
			likes: post.likes.length,
			shares: post.sharedBy.length,
		}));

		// Return a successful response with the posts.
		return NextResponse.json({ success: true, posts: postsWithComments });
	} catch (error) {
		// Log the error message and return a failure response.
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
