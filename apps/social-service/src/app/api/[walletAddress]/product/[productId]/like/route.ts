import { prisma } from '@/lib/db';
import { EntityType } from '@prisma/client';
import axios from 'axios';
import { NextResponse } from 'next/server';

type Props = {
	params: {
		walletAddress: string;
		productId: string;
	};
};

export async function POST(request: never, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, productId } = params;
	try {
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: Number(productId) },
			include: {
				owner: true,
				voucher: true,
			},
		});

		const user = await prisma.user.findUniqueOrThrow({ where: { walletAddress } });
		await prisma.like.create({
			data: {
				createdAt: Date.now() / 1000,
				fromWalletAddress: walletAddress,
				toWalletAddress: product.ownerWalletAddress,
				entityType: EntityType.Product,
				productId: Number(productId),
			},
		});

		try {
			await axios.post(`http://notifications-service:3000/api/web-push/send?walletAddress=${product.ownerWalletAddress}`, {
				topic: 'product-liked',
				payload: {
					productId: product.id,
					walletAddress: walletAddress,
					from: {
						avatarUrl: user.avatarUrl ?? null,
						userName: user?.userName ?? null,
					},
					product: {
						name: product.name,
						avatarUrl: product.voucher?.mediaUrl ?? undefined,
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
	const { walletAddress, productId } = params;
	try {
		await prisma.like.deleteMany({ where: { fromWalletAddress: walletAddress, productId: Number(productId) } });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
