import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recordActivity } from '@/lib/record-activity';
import { ConsumerAction } from '@prisma/client';

export async function POST(request: NextRequest, { params }: { params: { assetId: string } }) {
	const { assetId } = params;
	const { consumerAction } = (await request.json()) as { consumerAction: ConsumerAction };

	if (!consumerAction) {
		return NextResponse.json({ error: 'Consumer action is required' }, { status: 400 });
	}

	if (!Object.values(ConsumerAction).includes(consumerAction)) {
		return NextResponse.json(
			{
				error: `Invalid consumer action. Allowed values: ${Object.values(ConsumerAction).join(', ')}`,
			},
			{ status: 400 },
		);
	}

	try {
		const asset = await prisma.asset.findUnique({
			where: { id: Number(assetId) },
		});
		if (!asset) {
			console.error(`Set Consumer Action: Asset not found: ${assetId}`);
			return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
		}

		const updatedAsset = await prisma.asset.update({
			where: { id: Number(assetId) },
			data: { consumerAction },
		});

		await recordActivity({
			walletAddress: asset.walletAddress,
			entityType: 'Asset',
			entityId: asset.productId != null ? String(asset.productId) : String(assetId),
			entitySubType: 'SetConsumerAction',
			payload: { assetId: Number(assetId), consumerAction },
		});

		return NextResponse.json({ success: true, asset: updatedAsset }, { status: 200 });
	} catch (error) {
		console.error(`Set Consumer Action: Error: ${error instanceof Error ? error.message : error}`);
		return NextResponse.json(
			{ error: `Failed to set consumer action: ${error instanceof Error ? error.message : error}` },
			{ status: 500 },
		);
	}
}
