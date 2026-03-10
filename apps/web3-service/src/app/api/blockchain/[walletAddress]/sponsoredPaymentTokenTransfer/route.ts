import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { toTokenUnits, transferPaymentToken } from '@/lib/gasless-nft';

export async function POST(request: NextRequest) {
	const { chainId, fromWalletAddress, toWalletAddress, quantity, symbol } = await request.json();
	try {
		const paymentTokens = await prisma.payment_token.findFirst({
			where: {
				blockchain: { chainId: chainId as `0x${string}` },
				symbol: symbol,
			},
		});
		if (!paymentTokens) {
			return NextResponse.json({ error: 'Payment token not found' }, { status: 404 });
		}
		const amount = toTokenUnits(quantity, paymentTokens.decimals);
		const result = await transferPaymentToken(
			chainId as `0x${string}`,
			paymentTokens.contractAddress as `0x${string}`,
			fromWalletAddress as `0x${string}`,
			toWalletAddress as `0x${string}`,
			amount,
			toWalletAddress
		);
		if (!result.success) {
			return NextResponse.json({ error: result.error || 'Transfer failed' }, { status: 500 });
		}
		return NextResponse.json({ success: true, transactionHash: result.transactionHash });
	} catch (error) {
		console.error(`Error transferring payment token: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return NextResponse.json({ error: 'Error transferring payment token' }, { status: 500 });
	}
}
