import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { setMaxQuantity, kamiTotalMinted, getHexChainId, getOwnerPrivateKey, getPlatformInfo } from '@/lib/gasless-nft';
import { recordActivity } from '@/lib/record-activity';

/**
 * POST /api/nft/[productId]/stopMinting
 * Stop minting a KAMI721AC NFT by setting contract maxQuantity = totalMinted
 * and product availableQuantity = 0, maxQuantity = totalMinted.
 *
 * productId is provided in the URL.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
	try {
		const { productId: productIdParam } = await params;
		const productId = parseInt(productIdParam, 10);

		if (Number.isNaN(productId) || productId <= 0) {
			return NextResponse.json({ success: false, error: 'Invalid productId' }, { status: 400 });
		}

		const product = await prisma.product.findUnique({
			where: { id: productId },
			include: {
				collection: true,
			},
		});

		if (!product) {
			return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
		}

		if (!product.collectionId || !product.collection) {
			return NextResponse.json({ success: false, error: 'Product has no collection' }, { status: 400 });
		}

		const collection = product.collection;
		if (collection.contractType !== 'ERC721AC') {
			return NextResponse.json(
				{ success: false, error: 'Stop mint is only supported for KAMI721AC (Claimable) products' },
				{ status: 400 },
			);
		}

		if (!collection.contractAddress) {
			return NextResponse.json({ success: false, error: 'Collection has no deployed contract' }, { status: 400 });
		}

		const chainId = getHexChainId(collection.chainId);
		const contractAddress = collection.contractAddress as `0x${string}`;

		const totalMinted = await kamiTotalMinted(chainId, contractAddress);

		const ownerPrivateKey = await getOwnerPrivateKey(collection.ownerWalletAddress);
		if (!ownerPrivateKey) {
			return NextResponse.json({ success: false, error: 'Owner private key not available for this collection' }, { status: 403 });
		}

		const platformInfo = await getPlatformInfo(collection.chainId);
		if (!platformInfo) {
			return NextResponse.json({ success: false, error: 'Platform info not found for chain' }, { status: 500 });
		}

		const setOk = await setMaxQuantity(chainId, contractAddress, totalMinted, {
			ownerPrivateKey,
			simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
		});

		if (!setOk) {
			return NextResponse.json({ success: false, error: 'Failed to set maxQuantity on contract' }, { status: 502 });
		}

		await prisma.product.update({
			where: { id: productId },
			data: {
				availableQuantity: 0,
				maxQuantity: totalMinted,
			},
		});

		const voucher = await prisma.voucher.findUnique({
			where: { productId },
		});
		if (voucher) {
			await prisma.voucher.update({
				where: { id: voucher.id },
				data: { maxQuantity: totalMinted },
			});
		}
		await recordActivity({
			walletAddress: product.ownerWalletAddress,
			entityType: 'Product',
			entityId: String(productId),
			entitySubType: 'StoppedMinting',
			payload: { productId: Number(productId) },
		});

		return NextResponse.json({
			success: true,
			productId,
			collectionId: collection.collectionId,
			contractAddress: collection.contractAddress,
			totalMinted,
			message: 'Minting stopped; maxQuantity set to totalMinted, product and voucher quantities updated.',
		});
	} catch (error) {
		console.error('[POST /api/nft/[productId]/stopMinting] Error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to stop minting',
			},
			{ status: 500 },
		);
	}
}
