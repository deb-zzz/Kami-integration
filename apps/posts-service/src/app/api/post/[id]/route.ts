/**
 * @fileoverview API route: fetch a single post by id (public, no wallet scope).
 *
 * @route GET /api/post/[id]
 *
 * Path params: id (string) — post id.
 *
 * Query params:
 *   - walletAddress (optional): If provided, used to set likedByMe on the post and on
 *     each comment/reply so the client can show "liked by current user" state.
 *
 * Returns a SinglePostData shape: aggregated counts (likes, shares, views, reposts),
 * likedByMe, repost flag, content, comments with replies and like counts, createdBy/postedBy
 * user summaries, caption, parentPost when present.
 *
 * @returns
 *   - 200: { success: true, posts: [SinglePostData] }
 *   - 500: { success: false, error: string }
 */

import { prisma } from '@/lib/db';
import { Fail, PostData, SinglePostData, SuccessSingle } from '@/lib/types';
import { like } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type Props = {
	params: {
		id: string;
	};
};

/**
 * GET /api/post/[id] — Fetch one post by id with client-friendly single-post payload.
 *
 * @description Loads post by id only (no wallet scope). Optional ?walletAddress sets likedByMe
 * on the post and on each comment/reply. Response is SinglePostData: counts, likedByMe, repost flag,
 * content, comments with replies and like counts, createdBy/postedBy summaries.
 *
 * @param req - NextRequest; optional query param walletAddress.
 * @param context - Route context; params must include id (post id).
 * @param context.params.id - Post id to fetch.
 * @returns NextResponse<SuccessSingle | Fail>
 *   - Success (200): { success: true, posts: [SinglePostData] }
 *   - Fail (500): { success: false, error: 'Failed to fetch post' }
 */
export async function GET(req: NextRequest, { params }: Props): Promise<NextResponse<SuccessSingle | Fail>> {
	try {
		const walletAddress = req.nextUrl.searchParams.get('walletAddress');
		const post: PostData = await prisma.post.findUniqueOrThrow({
			where: { id: Number(params.id) },
			include: {
				comments: { include: { likes: true, createdByUser: true, replies: { include: { likes: true, createdByUser: true } } } },
				content: { include: { collection: true, product: { include: { asset: true, voucher: true } }, asset: true } },
				likes: true,
				createdBy: true,
				postedBy: true,
				sharedBy: true,
				parentPost: true,
				childPosts: true,
			},
		});

		// Build client payload: counts, likedByMe from optional walletAddress, user summaries
		const data: SinglePostData = {
			id: post.id,
			likes: post.likes.length,
			likedByMe: walletAddress ? post.likes.some((like: like) => like.fromWalletAddress === walletAddress) : false,
			repost: post.createdByAddress !== post.postedByAddress || post.parentPostId !== null,
			shares: post.sharedBy.length,
			views: post.views,
			createdAt: post.createdAt,
			postedAt: post.postedAt,
			reposts: post.childPosts.length,
			content: post.content,
			comments: post.comments.map((c) => {
				return {
					...c,
					likedByMe: c.likes.some((like: like) => like.fromWalletAddress === walletAddress),
					likes: c.likes.length,
					replies: c.replies.map((r) => {
						return {
							...r,
							likedByMe: r.likes.some((like: like) => like.fromWalletAddress === walletAddress),
							likes: r.likes.length,
						};
					}),
				};
			}),
			parentPostId: post.parentPostId || 0,
			parentPost: post.parentPostId ? post.parentPost : null,
			caption: post.caption || '',
			createdBy: {
				firstName: post.createdBy.firstName || '',
				lastName: post.createdBy.lastName || '',
				avatarUrl: post.createdBy.avatarUrl || '',
				userName: post.createdBy.userName || '',
				walletAddress: post.createdBy.walletAddress || '',
				parentPost: post.parentPost,
			},
			postedBy: {
				firstName: post.postedBy.firstName || '',
				lastName: post.postedBy.lastName || '',
				avatarUrl: post.postedBy.avatarUrl || '',
				userName: post.postedBy.userName || '',
				walletAddress: post.postedBy.walletAddress || '',
			},
		};

		return NextResponse.json({ success: true, posts: [data] }, { status: 200 });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to fetch post' }, { status: 500 });
	}
}
