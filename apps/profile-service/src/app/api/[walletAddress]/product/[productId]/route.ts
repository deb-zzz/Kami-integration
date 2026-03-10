import { prisma } from '@/lib/db';
import { ConsumerAction } from '@prisma/client';
import { NextResponse } from 'next/server';

type Success = {
	success: true;
};

type Fail = {
	success: false;
	error?: string;
};

export async function PUT(
	req: Request,
	{ params }: { params: { walletAddress: string; productId: string } }
): Promise<NextResponse<Success | Fail>> {
	try {
		const body: { consumerAction: ConsumerAction } = await req.json();
		const { walletAddress, productId } = params;
		await prisma.product.update({
			where: { id: Number(productId), ownerWalletAddress: walletAddress },
			data: {
				consumerAction: body.consumerAction,
			},
		});

		// Return the created user profile as JSON
		return NextResponse.json(
			{
				success: true,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to edit product: ' + (error as Error).message }, { status: 500 });
	}
}
