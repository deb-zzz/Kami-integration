import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recordActivity } from '@/lib/record-activity';
import { ProductAudience } from '@prisma/client';

export async function POST(request: NextRequest, { params }: { params: { assetId: string } }) {
	const { assetId } = params;
	const { audience } = (await request.json()) as { audience: ProductAudience };

	if (!audience) {
		return NextResponse.json({ error: 'Audience is required' }, { status: 400 });
	}

	if (!Object.values(ProductAudience).includes(audience)) {
		return NextResponse.json(
			{
				error: `Invalid audience. Allowed values: ${Object.values(ProductAudience).join(', ')}`,
			},
			{ status: 400 },
		);
	}

	try {
		const asset = await prisma.asset.findUnique({
			where: { id: Number(assetId) },
		});
		if (!asset) {
			console.error(`Set Audience: Asset not found: ${assetId}`);
			return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
		}

		const updatedAsset = await prisma.asset.update({
			where: { id: Number(assetId) },
			data: { audience },
		});

		await recordActivity({
			walletAddress: asset.walletAddress,
			entityType: 'Asset',
			entityId: asset.productId != null ? String(asset.productId) : String(assetId),
			entitySubType: 'SetAudience',
			payload: { assetId: Number(assetId), audience },
		});

		return NextResponse.json({ success: true, asset: updatedAsset }, { status: 200 });
	} catch (error) {
		console.error(`Set Audience: Error: ${error instanceof Error ? error.message : error}`);
		return NextResponse.json({ error: `Failed to set audience: ${error instanceof Error ? error.message : error}` }, { status: 500 });
	}
}
