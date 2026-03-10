import { prisma } from '@/lib/db';
import { EntityType } from '@prisma/client';
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Type definition for the route parameters.
 */
type Props = {
	params: {
		walletAddress: string; // The wallet address of the user performing the action
		targetWalletAddress: string; // The wallet address of the user being liked or unliked
	};
};

/**
 * Handles the POST request to like a user.
 *
 * @param request - The incoming request object.
 * @param params - The route parameters containing wallet addresses.
 * @returns A promise that resolves to a NextResponse object indicating success or failure.
 */
export async function POST(request: NextRequest, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, targetWalletAddress } = params;
	try {
		const person = await prisma.like.create({
			data: {
				createdAt: Date.now() / 1000, // Timestamp of when the like was created
				fromWalletAddress: walletAddress, // The wallet address of the user who likes
				toWalletAddress: targetWalletAddress, // The wallet address of the user being liked
				entityType: EntityType.User, // The type of entity being liked
			},
			include: { toUser: true },
		});

		try {
			// const content = await prisma.postContent.findFirstOrThrow({ where: { post: { some: { id: Number(postId) } } } });
			await axios.post(`http://notifications-service:3000/api/web-push/send?walletAddress=${targetWalletAddress}`, {
				topic: 'profile-liked',
				payload: {
					walletAddress: walletAddress,
					from: {
						avatarUrl: person.toUser?.avatarUrl ?? null,
						userName: person.toUser?.userName ?? null,
					},
					profile: person.toUser,
				},
				message: `${person.toUser?.userName ? person.toUser?.userName : 'Someone'} liked on your profile`,
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
 * Handles the DELETE request to unlike a user.
 *
 * @param request - The incoming request object.
 * @param params - The route parameters containing wallet addresses.
 * @returns A promise that resolves to a NextResponse object indicating success or failure.
 */
export async function DELETE(request: NextRequest, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, targetWalletAddress } = params;
	try {
		await prisma.like.deleteMany({ where: { fromWalletAddress: walletAddress, toWalletAddress: targetWalletAddress } });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
