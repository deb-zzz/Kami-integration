import { prisma } from '@/lib/db';
import { mintGaslessNFT, MintResponse, validateChainId } from '@/lib/gasless-nft';
import { FAILED_TO_MINT_GASLESS_NFT_ERROR } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 90;

export async function POST(request: NextRequest) {
	const { voucherId, toWalletAddress: walletAddress }: { voucherId: number; toWalletAddress?: string } = await request.json();
	const voucher = await prisma.voucher.findUnique({
		where: { id: voucherId },
		include: { collection: true },
	});
	if (!voucher?.collection) {
		throw new Error(`Voucher not found: ${voucherId}`);
	}

	// Use collection chainId or fall back to DEFAULT_CHAIN_ID environment variable
	let chainId = voucher.collection.chainId || process.env.DEFAULT_CHAIN_ID;
	
	if (!chainId) {
		const errorMsg = `Collection ${voucher.collection.collectionId} does not have a chainId set and DEFAULT_CHAIN_ID environment variable is not configured. Please update the collection with a valid chainId or set DEFAULT_CHAIN_ID.`;
		console.error(errorMsg);
		return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
	}
	
	// Log if using DEFAULT_CHAIN_ID
	if (!voucher.collection.chainId && process.env.DEFAULT_CHAIN_ID) {
		console.log(`[mint] Using DEFAULT_CHAIN_ID from environment: ${process.env.DEFAULT_CHAIN_ID} for collection ${voucher.collection.collectionId}`);
	}
	
	// Normalize chainId to hex format if needed
	if (!chainId.startsWith('0x')) {
		chainId = `0x${Number.parseInt(chainId, 10).toString(16)}`;
	}
	
	const isValidChainId = await validateChainId(chainId);
	if (!isValidChainId) {
		const errorMsg = `Invalid chainId: ${chainId} for collection ${voucher.collection.collectionId}. ChainId must exist in the blockchain table.`;
		console.error(errorMsg);
		return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
	}

	const contractAddress = voucher.collection.contractAddress;
	if (!contractAddress) {
		throw new Error(`Contract address not found for voucher: ${voucherId}`);
	}
	try {
		if (contractAddress) {
			try {
				const mintResponse: MintResponse = await mintGaslessNFT(voucher.id, walletAddress ?? voucher.walletAddress);
				return NextResponse.json({
					success: true,
					contractAddress,
					tokenId: mintResponse.tokenId,
					transactionHash: mintResponse.transactionHash,
				});
			} catch (error) {
				console.error('Error minting gasless NFT:', error);
				throw new Error(FAILED_TO_MINT_GASLESS_NFT_ERROR);
			}
		} else {
			throw new Error(FAILED_TO_MINT_GASLESS_NFT_ERROR);
		}
	} catch (error) {
		console.error('Error minting gasless NFT:', error instanceof Error ? error.message : error);
		return NextResponse.json(
			{
				success: false,
				error: `Error minting gasless NFT: ${(error as Error).message ?? error}`,
			},
			{ status: 500 }
		);
	}
}
