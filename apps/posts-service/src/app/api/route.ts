/**
 * @fileoverview API route: list all posts.
 *
 * @route GET /api
 *
 * Returns all posts in the system with full relations: comments (with likes),
 * content (collection, product with asset/voucher), likes, createdBy, postedBy,
 * sharedBy. Responses are not cached (force-dynamic).
 *
 * @returns {Promise<NextResponse<Success | Fail>>}
 *   - 200: { success: true, posts: PostData[] }
 *   - No error responses; empty array if no posts.
 *
 * @example
 *   const res = await fetch('/api');
 *   const { success, posts } = await res.json();
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Post shape including comments, content, likes, and user relations. */
type PostData = Prisma.postGetPayload<{
	include: {
		comments: { include: { likes: true } };
		content: { include: { collection: true; product: { include: { asset: true; voucher: true } }; asset: true } };
		likes: true;
		createdBy: true;
		postedBy: true;
		sharedBy: true;
	};
}>;

type Success = {
	success: true;
	posts: PostData[];
};

type Fail = {
	success: false;
	error?: string;
};

/**
 * GET /api — Fetch all posts.
 *
 * @description Returns every post with comments, content, likes, and user (createdBy, postedBy, sharedBy) data.
 * No request body or query params. Responses are force-dynamic (no cache).
 *
 * @param _request - Unused (Next.js route handler signature).
 * @param _context - Unused (no dynamic params for this route).
 * @returns NextResponse<Success | Fail>
 *   - Success (200): { success: true, posts: PostData[] }
 *   - Fail: not returned by this handler; empty array if no posts.
 */
export async function GET(): Promise<NextResponse<Success | Fail>> {
	const posts: PostData[] = await prisma.post.findMany({
		include: {
			comments: { include: { likes: true } },
			content: { include: { collection: true, product: { include: { asset: true, voucher: true } }, asset: true } },
			likes: true,
			createdBy: true,
			postedBy: true,
			sharedBy: true,
		},
	});

	return NextResponse.json(
		{
			success: true,
			posts,
		},
		{ status: 200 }
	);
}
