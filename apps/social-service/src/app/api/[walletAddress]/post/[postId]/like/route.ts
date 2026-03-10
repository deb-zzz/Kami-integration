/**
 * @fileoverview API route handler for liking and unliking posts.
 * 
 * This endpoint allows users to like or unlike a post. When a post is liked,
 * a notification is sent to the post creator (unless they're liking their own post).
 * 
 * @route POST /api/[walletAddress]/post/[postId]/like
 * @route DELETE /api/[walletAddress]/post/[postId]/like
 * @module api/[walletAddress]/post/[postId]/like
 */

import { prisma } from '@/lib/db';
import { EntityType } from '@prisma/client';
import axios from 'axios';
import { NextResponse } from 'next/server';

/**
 * Type definition for the route parameters.
 */
type Props = {
	params: {
		/** The wallet address of the user performing the action */
		walletAddress: string;
		/** The ID of the post being liked or unliked */
		postId: string;
	};
};

/**
 * Handles POST requests to like a post.
 * 
 * Creates a like record in the database and sends a notification to the post creator
 * (unless the user is liking their own post).
 *
 * @param request - The incoming request object (unused)
 * @param params - Route parameters containing walletAddress and postId
 * @returns Promise resolving to NextResponse with success status
 * 
 * @example
 * POST /api/0x123.../post/456/like
 * Response: { success: true }
 */
export async function POST(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, postId } = params;
	try {
		// Find the post by its ID
		const post = await prisma.post.findUniqueOrThrow({ where: { id: Number(postId) } });

		// Create a new like entry in the database
		const liked = await prisma.like.create({
			data: {
				createdAt: Date.now() / 1000,
				fromWalletAddress: walletAddress,
				toWalletAddress: post.createdByAddress,
				entityType: EntityType.Post,
				postId: Number(postId),
			},
			include: {
				fromUser: {
					select: {
						avatarUrl: true,
						userName: true,
					},
				},
			},
		});

		// Don't send notification if user is liking their own post
		if (post.createdByAddress === walletAddress) return NextResponse.json({ success: true });

		// Send notification to post creator
		try {
			await axios.post(
				`http://notifications-service:3000/api/web-push/send?walletAddress=${post.createdByAddress}`,
				{
					topic: 'post-liked',
					payload: {
						postId: post.id,
						walletAddress: walletAddress,
						from: {
							avatarUrl: liked.fromUser?.avatarUrl ?? null,
							userName: liked.fromUser?.userName ?? null,
						},
						post,
					},
					message: `${liked.fromUser?.userName ? liked.fromUser?.userName : 'Someone'} liked your post`,
				}
			);
		} catch (error) {
			// Log notification error but don't fail the request
			console.log((error as Error).message);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}

/**
 * Handles DELETE requests to unlike a post.
 * 
 * Removes the like record from the database. No notification is sent for unlikes.
 *
 * @param request - The incoming request object (unused)
 * @param params - Route parameters containing walletAddress and postId
 * @returns Promise resolving to NextResponse with success status
 * 
 * @example
 * DELETE /api/0x123.../post/456/like
 * Response: { success: true }
 */
export async function DELETE(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, postId } = params;
	try {
		// Delete all like entries matching the wallet address and post ID
		await prisma.like.deleteMany({
			where: {
				fromWalletAddress: walletAddress,
				postId: Number(postId),
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
