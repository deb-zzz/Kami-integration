import { prisma } from '@/lib/db';
import { deployGaslessCollection, mintGaslessNFT } from '@/lib/gasless-nft';
import { FAILED_TO_DEPLOY_GASLESS_COLLECTION_ERROR, FAILED_TO_MINT_GASLESS_NFT_ERROR } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 90;

export async function POST(request: NextRequest) {
	const { voucherId, toWalletAddress: walletAddress }: { voucherId: number; toWalletAddress: string } = await request.json();
	try {
		const voucher = await prisma.voucher.findUnique({
			where: { id: voucherId },
			include: { collection: true },
		});
		if (!voucher?.collection) {
			throw new Error(`Voucher not found: ${voucherId}`);
		}

		let contractAddress = '';
		if (!voucher.collection.contractAddress) {
			try {
				const { contractAddress: deployedContractAddress } = await deployGaslessCollection(
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

		if (contractAddress) {
			try {
				await mintGaslessNFT(voucher.id, walletAddress);
			} catch (error) {
				console.error('Error minting gasless NFT:', error);
				throw new Error(FAILED_TO_MINT_GASLESS_NFT_ERROR);
			}
		} else {
			throw new Error(FAILED_TO_MINT_GASLESS_NFT_ERROR);
		}

		return NextResponse.json({ success: true, contractAddress });
	} catch (error) {
		console.error('Error deploying gasless collection:', error);
		return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
	}
}
