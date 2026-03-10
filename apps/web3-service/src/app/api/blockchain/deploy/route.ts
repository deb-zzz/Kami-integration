import { prisma } from '@/lib/db';
import { deployGaslessCollection, DeployResponse, validateChainId } from '@/lib/gasless-nft';
import { FAILED_TO_DEPLOY_GASLESS_COLLECTION_ERROR } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 90;

export async function POST(request: NextRequest) {
	const { voucherId } = await request.json();
	try {
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
			console.log(
				`[deploy] Using DEFAULT_CHAIN_ID from environment: ${process.env.DEFAULT_CHAIN_ID} for collection ${voucher.collection.collectionId}`
			);
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

		let contractAddress = '';
		if (!voucher.collection.contractAddress) {
			try {
				const { contractAddress: deployedContractAddress }: DeployResponse = await deployGaslessCollection(
					voucher.collection.collectionId,
					undefined,
					voucher.id
				);
				contractAddress = deployedContractAddress;
			} catch (error) {
				console.error('Error deploying gasless collection:', error);
				throw new Error(FAILED_TO_DEPLOY_GASLESS_COLLECTION_ERROR);
			}
		} else {
			contractAddress = voucher.collection.contractAddress;
		}
		return NextResponse.json({ success: true, contractAddress });
	} catch (error) {
		console.error('Error deploying gasless collection:', error);
		return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
	}
}
