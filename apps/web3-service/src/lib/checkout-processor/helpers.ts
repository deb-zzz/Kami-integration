import { prisma } from '@/lib/db';
import { getPlatformInfo, toTokenUnits, transferPaymentToken } from '@/lib/gasless-nft';
import type { CheckoutItem, CheckoutError } from '@/services';
import type { ProgressCallback, PaymentTokenWithBlockchain } from './types';
import type { CheckoutJobStage } from '../checkout-job';

/**
 * Report progress if callback is provided
 */
export async function reportProgress(
	onProgress: ProgressCallback | undefined,
	percent: number,
	stage: CheckoutJobStage,
): Promise<void> {
	if (onProgress) {
		await onProgress(percent, stage);
	}
}

/**
 * Create and push a checkout error with consistent structure
 */
export function pushItemError(
	errors: CheckoutError[],
	item: CheckoutItem,
	message: string,
	overrides?: Partial<CheckoutError>,
): void {
	errors.push({
		collectionId: item.collectionId,
		tokenId: item.tokenId ?? undefined,
		quantity: item.quantity ?? undefined,
		voucherId: item.voucherId ?? undefined,
		assetId: item.assetId ?? undefined,
		error: message,
		...overrides,
	} as CheckoutError);
}

/**
 * Get payment token for a chain
 * Uses dynamic import to avoid circular dependency with gasless-nft
 */
export async function getPaymentToken(chainId: `0x${string}`): Promise<PaymentTokenWithBlockchain | null> {
	const { getDefaultPaymentToken } = await import('@/lib/gasless-nft');
	const paymentTokenInfo = await getDefaultPaymentToken(chainId, 'USDC');
	if (!paymentTokenInfo) {
		return null;
	}
	const paymentToken = await prisma.payment_token.findFirst({
		where: {
			chainId: chainId,
			contractAddress: paymentTokenInfo.contractAddress,
		},
		include: { blockchain: true },
	});
	return paymentToken;
}

/**
 * Transfer charges for an item (used by both buy and mint operations)
 * Returns error message if transfer fails, null on success
 */
export async function transferChargesForItem(
	item: { charges?: number | null },
	chainId: `0x${string}`,
	buyerWalletAddress: string,
): Promise<string | null> {
	if (!item.charges) {
		return null; // No charges to transfer
	}

	const paymentToken = await getPaymentToken(chainId);
	if (!paymentToken) {
		return `Payment token not found for chain: ${chainId}`;
	}

	const paymentTokenAddress = paymentToken.contractAddress as `0x${string}`;
	const charges = toTokenUnits(item.charges, paymentToken.decimals);
	const platformInfo = await getPlatformInfo(chainId);
	if (!platformInfo) {
		return `Platform info not found for chain: ${chainId}`;
	}

	// Execute payment token transfer: buyer → platform
	await transferPaymentToken(
		chainId,
		paymentTokenAddress,
		buyerWalletAddress as `0x${string}`,
		platformInfo.platformAddress as `0x${string}`,
		charges,
		buyerWalletAddress,
	);

	return null; // Success
}
