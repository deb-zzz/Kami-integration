/**
 * @fileoverview API route: list posts that reference a specific asset.
 *
 * @route GET /api/asset/[assetId]/posts
 *
 * Path params: assetId (string) — asset id.
 *
 * Returns all posts that have at least one postContent row with the given assetId,
 * with the same shape as other post list endpoints (comments, content, likes,
 * createdBy, postedBy, sharedBy, parentPost, childPosts).
 *
 * @returns
 *   - 200: { success: true, posts: PostData[] }
 *   - 400: { success: false, error: 'Missing asset id' }
 *   - 500: { success: false, error: string }
 */

import { prisma } from '@/lib/db';
import { Fail, PostData, Success } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

type Props = { params: { assetId: string } };

/**
 * GET /api/asset/[assetId]/posts — List posts that reference this asset.
 *
 * @description Returns all posts where at least one content item has assetId matching the path.
 */
export async function GET(_: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	try {
		const assetId = params.assetId;
		if (!assetId) {
			return NextResponse.json({ success: false, error: 'Missing asset id' }, { status: 400 });
		}

		const id = Number(assetId);
		if (Number.isNaN(id)) {
			return NextResponse.json({ success: false, error: 'Invalid asset id' }, { status: 400 });
		}

		const posts: PostData[] = await prisma.post.findMany({
			where: { content: { some: { assetId: id } } },
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

		return NextResponse.json({ success: true, posts }, { status: 200 });
	} catch (error) {
		console.error((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to fetch posts' }, { status: 500 });
	}
}
