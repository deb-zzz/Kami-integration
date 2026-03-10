/**
 * @fileoverview API routes for a single post identified by wallet address and post id.
 *
 * @route GET /api/[walletAddress]/[id]
 *   Fetch one post by id, scoped to createdByAddress = walletAddress.
 *
 * @route DELETE /api/[walletAddress]/[id]
 *   Delete the post by id (no wallet check on delete).
 *
 * @route PUT /api/[walletAddress]/[id]
 *   Update post (e.g. add a like). Body: { like?: boolean; comment?: string; shareTo?: string }.
 *   Currently only `like: true` is implemented: creates a like from walletAddress.
 *
 * @route POST /api/[walletAddress]/[id]
 *   Repost: create a new post that references this one as parent. Body: { comment?: string }.
 *   Copies post data and links content; sets postedByAddress to path wallet, parentPostId to original.
 *
 * Path params: walletAddress (string), id (number, post id).
 */

import { prisma } from '@/lib/db';
import { Success, Fail, PostData } from '@/lib/types';
import { post } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type Props = {
	params: {
		walletAddress: string;
		id: number;
	};
};

/**
 * GET /api/[walletAddress]/[id] — Fetch a single post by id and creator wallet.
 *
 * @description Loads one post where id and createdByAddress both match; throws if not found.
 * No request body or query params.
 *
 * @param _request - Unused.
 * @param context - Route context; params must include walletAddress and id.
 * @param context.params.walletAddress - Wallet address of the post creator (must match post).
 * @param context.params.id - Post id.
 * @returns NextResponse<Success | Fail>
 *   - Success (200): { success: true, posts: [PostData] }
 *   - Fail (500): { success: false, error: 'Failed to fetch post' } — not found or DB error
 */
export async function GET(req: never, { params }: Props): Promise<NextResponse<Success | Fail>> {
	try {
		const post: PostData = await prisma.post.findUniqueOrThrow({
			where: { id: Number(params.id), createdByAddress: params.walletAddress },
			include: {
				comments: { include: { likes: true, replies: { include: { likes: true } } } },
				content: { include: { collection: true, product: { include: { asset: true, voucher: true } }, asset: true } },
				likes: true,
				createdBy: true,
				postedBy: true,
				sharedBy: true,
				parentPost: true,
				childPosts: true,
			},
		});

		return NextResponse.json({ success: true, posts: [post] }, { status: 200 });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to fetch post' }, { status: 500 });
	}
}

/**
 * DELETE /api/[walletAddress]/[id] — Delete a post by id.
 *
 * @description Deletes the post by id only (no wallet check). Cascades depend on schema.
 *
 * @param _request - Unused.
 * @param context - Route context; params must include id.
 * @param context.params.id - Post id to delete.
 * @returns NextResponse
 *   - Success (200): { success: true }
 *   - Fail (500): { success: false, error: 'Failed to delete post' }
 */
export async function DELETE(req: never, { params }: Props) {
	try {
		await prisma.post.delete({ where: { id: Number(params.id) } });
		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to delete post' }, { status: 500 });
	}
}

type SocialProps = {
	params: {
		id: number;
		walletAddress: string;
	};
};

/** Body for social actions (like, comment, share). Only like is implemented. */
type Socials = {
	like?: boolean;
	comment?: string;
	shareTo?: string;
};

/**
 * PUT /api/[walletAddress]/[id] — Update post (e.g. add like).
 *
 * @description Request body: { like?: boolean; comment?: string; shareTo?: string }.
 * Currently only like is implemented: when like === true, creates a like from path walletAddress.
 *
 * @param req - NextRequest; body parsed as Socials.
 * @param context - Route context; params must include id and walletAddress.
 * @param context.params.id - Post id to update.
 * @param context.params.walletAddress - Wallet address performing the action (e.g. liker).
 * @returns NextResponse
 *   - Success (200): { success: true }
 *   - Fail (500): { success: false, error: 'Failed to update post' }
 */
export async function PUT(req: NextRequest, { params }: SocialProps) {
	try {
		const social: Socials = await req.json();
		const post = await prisma.post.findUniqueOrThrow({
			where: { id: Number(params.id) },
		});

		if (social.like) {
			await prisma.post.update({
				where: { id: Number(params.id) },
				data: {
					likes: {
						create: {
							fromWalletAddress: params.walletAddress,
							createdAt: Date.now(),
							entityType: 'Post',
							toWalletAddress: post.postedByAddress,
						},
					},
				},
			});
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to update post' }, { status: 500 });
	}
}

type Repost = Omit<post, 'id'>;

/**
 * POST /api/[walletAddress]/[id] — Repost: create a new post that shares the same content.
 *
 * @description Request body: { comment?: string }. Creates a new post with same content,
 * postedByAddress = path wallet, parentPostId = original post (or existing parent), status Published.
 *
 * @param req - NextRequest; body may include comment for the repost caption.
 * @param context - Route context; params must include id and walletAddress.
 * @param context.params.id - Source post id to repost.
 * @param context.params.walletAddress - Wallet address of the user reposting.
 * @returns NextResponse<Success | Fail>
 *   - Success (200): { success: true }
 *   - Fail (500): { success: false, error: string }
 */
export async function POST(req: NextRequest, { params }: SocialProps): Promise<NextResponse<Success | Fail>> {
	try {
		const { comment } = await req.json();
		const post = await prisma.post.findUniqueOrThrow({
			where: { id: Number(params.id) },
			include: { content: true },
		});

		const { id, content, ...postWithoutId } = post;
		console.log(`Reposting ${id}`);
		const repostData: Repost = { ...postWithoutId, caption: comment, postedByAddress: params.walletAddress };

		// Create new post linking to same content; chain to root parent if this post was already a repost
		await prisma.post.create({
			data: {
				...repostData,
				parentPostId: Number(post.parentPostId ?? params.id),
				postedByAddress: params.walletAddress,
				postedAt: Math.floor(Date.now() / 1000),
				status: 'Published',
				content: {
					connect: content.map((contentItem) => ({ id: contentItem.id })),
				},
			},
			include: {
				comments: true,
				content: true,
				likes: true,
				createdBy: true,
				postedBy: true,
				sharedBy: true,
			},
		});

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to re-post: ' + (error as Error).message }, { status: 500 });
	}
}
