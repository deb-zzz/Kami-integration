import { prisma } from '@/lib/db';
import { EntityType } from '@prisma/client';
import axios from 'axios';
import { NextResponse } from 'next/server';

type Props = {
	params: {
		walletAddress: string;
		collectionId: string;
	};
};

export async function POST(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, collectionId } = params;
	try {
		// Fetch the collection and its owner
		const collection = await prisma.collection.findUniqueOrThrow({
			where: { collectionId: Number(collectionId) },
			include: { owner: true },
		});

		// Fetch the user performing the action
		const user = await prisma.user.findUniqueOrThrow({ where: { walletAddress } });
		
		// Create the like record
		await prisma.like.create({
			data: {
				createdAt: Date.now() / 1000,
				fromWalletAddress: walletAddress,
				toWalletAddress: collection.ownerWalletAddress,
				entityType: EntityType.Collection,
				collectionCollectionId: Number(collectionId),
			},
		});

		// Send notification to collection owner (if not self-liking)
		try {
			await axios.post(
				`http://notifications-service:3000/api/web-push/send?walletAddress=${collection.ownerWalletAddress}`,
				{
					topic: 'collection-liked',
					payload: {
						collectionId: collection.collectionId,
						walletAddress: walletAddress,
						from: {
							avatarUrl: user.avatarUrl ?? null,
							userName: user?.userName ?? null,
						},
						collection,
					},
					message: `${user?.userName ? user?.userName : 'Someone'} liked your collection`,
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
 * Handles DELETE requests to unlike a collection.
 * 
 * Removes the like record from the database. No notification is sent for unlikes.
 * 
 * @param request - The incoming request object (unused)
 * @param params - Route parameters containing walletAddress and collectionId
 * @returns Promise resolving to NextResponse with success status
 * 
 * @example
 * DELETE /api/0x123.../collection/456/like
 * Response: { success: true }
 */
export async function DELETE(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, collectionId } = params;
	try {
		// Remove all like records matching the wallet address and collection ID
		await prisma.like.deleteMany({
			where: {
				fromWalletAddress: walletAddress,
				collectionCollectionId: Number(collectionId),
			},
		});
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
