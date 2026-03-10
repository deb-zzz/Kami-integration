import { prisma } from '@/lib/db';
import { EntityType } from '@prisma/client';
import axios from 'axios';
import { NextResponse } from 'next/server';

type Props = {
	params: {
		walletAddress: string;
		assetId: string;
	};
};

export async function POST(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, assetId } = params;
	try {
		const asset = await prisma.asset.findUniqueOrThrow({
			where: { id: Number(assetId) },
			include: {
				user: true,
			},
		});

		const user = await prisma.user.findUniqueOrThrow({ where: { walletAddress } });
		await prisma.like.create({
			data: {
				createdAt: Date.now() / 1000,
				fromWalletAddress: walletAddress,
				toWalletAddress: asset.walletAddress,
				entityType: EntityType.Asset,
				assetId: Number(assetId),
			},
		});

		if (asset.walletAddress === walletAddress) {
			await prisma.asset.update({
				where: { id: Number(assetId) },
				data: {
					likedByMe: true,
				},
			});
		}

		try {
			const metadata = asset.metadata as { name: string; avatarUrl: string };
			await axios.post(`http://notifications-service:3000/api/web-push/send?walletAddress=${asset.walletAddress}`, {
				topic: 'asset-liked',
				payload: {
					assetId: asset.id,
					walletAddress: walletAddress,
					from: {
						avatarUrl: user.avatarUrl ?? null,
						userName: user?.userName ?? null,
					},
					asset: {
						name: metadata?.name ?? undefined,
						avatarUrl: metadata?.avatarUrl ?? undefined,
					},
				},
				message: `${user?.userName ? user?.userName : 'Someone'} liked your product`,
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

export async function DELETE(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, assetId } = params;
	try {
		await prisma.like.deleteMany({ where: { fromWalletAddress: walletAddress, assetId: Number(assetId) } });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
