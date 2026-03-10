/**
 * @fileoverview API route: increment view count for a post.
 *
 * @route POST /api/[walletAddress]/[id]/addView
 *
 * Path params: id (number) — post id. walletAddress is in the path but not used for this action.
 *
 * Increments the post's view counter by 1 and returns the updated post.
 *
 * @returns
 *   - 200: { success: true, post: post }
 *   - 200 with success: false and error message if update fails (e.g. post not found).
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

type PostRecord = Prisma.postGetPayload<Record<string, never>>;

type Props = {
	params: {
		id: number;
	};
};

type ResponseObjectSuccess = {
	success: true;
	post: PostRecord;
};

type ResponseObjectError = {
	success: false;
	error: string;
};

type ResponseObject = ResponseObjectSuccess | ResponseObjectError;

/**
 * POST /api/[walletAddress]/[id]/addView — Increment view count for post by id.
 *
 * @description No request body. Path param id identifies the post. walletAddress is in the URL but not used.
 * Atomically increments the post's view counter by 1.
 *
 * @param _request - Unused.
 * @param context - Route context; params must include id (post id).
 * @param context.params.id - Post id whose view count to increment.
 * @returns NextResponse<ResponseObject>
 *   - Success: { success: true, post: post } (updated post record)
 *   - Fail: { success: false, error: string } — e.g. post not found (no explicit status code set)
 */
export async function POST(req: never, { params }: Props): Promise<NextResponse<ResponseObject>> {
	const id = Number(params.id);
	try {
		const post = await prisma.post.update({
			where: { id },
			data: { views: { increment: 1 } },
		});
		return NextResponse.json({ success: true, post });
	} catch (error) {
		return NextResponse.json({ success: false, error: (error as Error).message });
	}
}
