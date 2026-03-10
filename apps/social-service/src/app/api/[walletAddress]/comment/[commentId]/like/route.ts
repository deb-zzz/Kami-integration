import { prisma } from '@/lib/db';
import { EntityType } from '@prisma/client';
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Type definition for the request parameters.
 */
type Props = {
	params: {
		walletAddress: string;
		commentId: string;
	};
};

/**
 * Handles the POST request to like a comment.
 *
 * @param request - The incoming Next.js request object.
 * @param params - The parameters extracted from the request URL.
 * @param params.walletAddress - The wallet address of the user liking the comment.
 * @param params.commentId - The ID of the comment to be liked.
 *
 * @returns A NextResponse object containing a JSON response with a success boolean.
 */
export async function POST(request: NextRequest, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, commentId } = params;
	try {
		const comment = await prisma.comment.findUniqueOrThrow({
			where: { id: Number(commentId) },
			include: { post: true, createdByUser: true },
		});
		const liked = await prisma.like.create({
			data: {
				createdAt: Date.now() / 1000,
				fromWalletAddress: walletAddress,
				toWalletAddress: comment.createdByAddress,
				entityType: EntityType.Comment,
				commentId: Number(commentId),
			},
			include: {
				fromUser: true,
				post: true,
			},
		});

		if (walletAddress === comment.createdByAddress) return NextResponse.json({ success: true });
		try {
			await axios.post(`http://notifications-service:3000/api/web-push/send?walletAddress=${comment.createdByAddress}`, {
				topic: 'post-liked',
				payload: {
					postId: comment.post.id,
					walletAddress: comment.createdByAddress,
					from: {
						avatarUrl: liked.fromUser?.avatarUrl ?? null,
						userName: liked.fromUser?.userName ?? null,
					},
					post: comment.post,
				},
				message: `${liked.fromUser?.userName ? liked.fromUser?.userName : 'Someone'} liked your comment on a post.`,
			});
		} catch (error) {
			console.log((error as Error).message);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}

/**
 * Handles the DELETE request to remove a like from a comment.
 *
 * @param request - The incoming Next.js request object.
 * @param params - The parameters extracted from the request URL.
 * @param params.walletAddress - The wallet address of the user removing the like.
 * @param params.commentId - The ID of the comment from which the like is to be removed.
 *
 * @returns A NextResponse object containing a JSON response with a success boolean.
 */
export async function DELETE(request: NextRequest, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, commentId } = params;
	try {
		await prisma.like.deleteMany({ where: { fromWalletAddress: walletAddress, commentId: Number(commentId) } });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
