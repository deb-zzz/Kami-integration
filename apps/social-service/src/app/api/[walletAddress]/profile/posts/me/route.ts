/**
 * @fileoverview API route handler for retrieving a user's own posts.
 *
 * This endpoint returns all posts that were posted by the specified wallet address.
 * Posts are ordered by creation date (oldest first) and include repost counts.
 *
 * @route GET /api/[walletAddress]/profile/posts/me
 * @module api/[walletAddress]/profile/posts/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatPost } from '@/lib/utils';
import { ProductAudience } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Handles GET requests to retrieve posts posted by a specific wallet address.
 *
 * Returns all posts where the postedBy wallet address matches the specified address.
 * Posts are filtered to only include those where products in the post content are either:
 * - Products with Public audience, OR
 * - Products owned by the requesting wallet address
 *
 * Posts are formatted using the formatPost utility and include repost counts.
 *
 * @param req - The incoming request object
 * @param params - Route parameters containing the wallet address
 * @returns Promise resolving to NextResponse with success status and formatted posts array
 *
 * @example
 * GET /api/0x123.../profile/posts/me
 * Response: { success: true, posts: [...] }
 */
export async function GET(req: NextRequest, { params }: { params: { walletAddress: string } }) {
	const { walletAddress } = params;

	const posts = await prisma.post.findMany({
		where: {
			AND: [
				{
					// Posts posted by the wallet address
					postedBy: {
						walletAddress,
					},
				},
				{
					// Posts where content products are public or owned by the requesting user
					OR: [
						{
							// Posts with no products (only collections)
							content: {
								every: {
									product: null,
								},
							},
						},
						{
							// Posts where all products are public or owned by the user
							content: {
								every: {
									OR: [
										{ product: null },
										{
											product: {
												OR: [{ audience: ProductAudience.Public }, { ownerWalletAddress: walletAddress }],
											},
										},
									],
								},
							},
						},
					],
				},
			],
		},
		include: {
			content: {
				include: {
					product: { include: { asset: true, voucher: true, collection: true, bundle: true } },
				},
			},
			postedBy: { select: { avatarUrl: true, userName: true, tagLine: true } },
			sharedBy: { select: { avatarUrl: true, userName: true, tagLine: true } },
			likes: true,
			comments: true,
		},
		orderBy: {
			createdAt: 'asc',
		},
	});

	const withReposts = posts.map((post) => ({ ...post, reposts: posts.filter((p) => post.id === p.parentPostId).length }));
	const list = withReposts.map((post) => formatPost(post, walletAddress));
	return NextResponse.json({ success: true, posts: list });
}
