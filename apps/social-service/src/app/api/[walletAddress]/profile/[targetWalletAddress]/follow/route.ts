/**
 * @fileoverview API route handler for following and unfollowing users.
 *
 * This endpoint allows users to follow or unfollow other users. When a user is followed,
 * a notification is sent to the user being followed.
 *
 * @route POST /api/[walletAddress]/profile/[targetWalletAddress]/follow
 * @route DELETE /api/[walletAddress]/profile/[targetWalletAddress]/follow
 * @module api/[walletAddress]/profile/[targetWalletAddress]/follow
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
		/** The wallet address of the user performing the follow/unfollow action */
		walletAddress: string;
		/** The wallet address of the user being followed/unfollowed */
		targetWalletAddress: string;
	};
};

/**
 * Handles POST requests to create a follow relationship between two users.
 *
 * Creates a follow record in the database and sends a notification to the user being followed.
 *
 * @param request - The incoming request object (unused)
 * @param params - Route parameters containing walletAddress and targetWalletAddress
 * @returns Promise resolving to NextResponse with success status
 *
 * @example
 * POST /api/0x123.../profile/0x456.../follow
 * Response: { success: true }
 */
export async function POST(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, targetWalletAddress } = params;
	try {
		// Create the follow relationship
		const follow = await prisma.follow.create({
			data: {
				createdAt: Date.now() / 1000,
				entityType: EntityType.User,
				fromWalletAddress: walletAddress,
				toWalletAddress: targetWalletAddress,
			},
			include: { toUser: true, fromUser: true },
		});

		// Send notification to the user being followed
		try {
			await axios.post(`http://notifications-service:3000/api/web-push/send?walletAddress=${targetWalletAddress}`, {
				topic: 'profile-follow',
				payload: {
					walletAddress: walletAddress,
					from: {
						avatarUrl: follow.fromUser?.avatarUrl ?? null,
						userName: follow.fromUser?.userName ?? null,
					},
					profile: follow.fromUser,
				},
				message: `${follow.fromUser?.userName ? follow.fromUser?.userName : 'Someone'} followed you.`,
			});
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
 * Handles DELETE requests to remove a follow relationship between two users.
 *
 * Removes the follow record from the database. No notification is sent for unfollows.
 *
 * @param request - The incoming request object (unused)
 * @param params - Route parameters containing walletAddress and targetWalletAddress
 * @returns Promise resolving to NextResponse with success status
 *
 * @example
 * DELETE /api/0x123.../profile/0x456.../follow
 * Response: { success: true }
 */
export async function DELETE(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, targetWalletAddress } = params;
	try {
		// Remove all follow records matching the wallet addresses
		await prisma.follow.deleteMany({
			where: {
				fromWalletAddress: walletAddress,
				toWalletAddress: targetWalletAddress,
			},
		});
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
