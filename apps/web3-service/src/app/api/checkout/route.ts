import { NextRequest, NextResponse } from 'next/server';
import type { CheckoutItem } from '@/services';
import { processCheckout } from '@/lib/checkout-processor';
import { initializeCheckoutJob, updateCheckoutJobProgress, completeCheckoutJob, failCheckoutJob } from '@/lib/checkout-job';

// Note: This endpoint can take up to 10 minutes due to blockchain operations (deployment, minting, transactions)
// The API gateway (nginx) timeout must be configured to be >= 10 minutes to avoid 502 Bad Gateway errors
// Current timeout: ~30 seconds (too short) - needs to be increased to at least 90 seconds
// Use ?async=true query parameter to enable async mode which returns immediately
export const maxDuration = 600;

type CheckoutRequest = {
	checkoutId: string;
	checkoutItems: CheckoutItem[];
	walletAddress: string;
};

const CHECKOUT_TIMEOUT = 120000; // 2 minutes

/**
 * Process checkout asynchronously in the background
 */
async function processCheckoutAsync(checkoutId: string, checkoutItems: CheckoutItem[], buyerWalletAddress: string): Promise<void> {
	const timeoutId = setTimeout(async () => {
		console.error(`Checkout ${checkoutId} exceeded timeout of ${CHECKOUT_TIMEOUT}ms`);
		await failCheckoutJob(checkoutId, `Checkout processing exceeded maximum time limit of ${CHECKOUT_TIMEOUT / 1000} seconds`, []);
	}, CHECKOUT_TIMEOUT);

	try {
		await initializeCheckoutJob(checkoutId);

		const result = await processCheckout(checkoutId, checkoutItems, buyerWalletAddress, async (progress, stage) => {
			await updateCheckoutJobProgress(checkoutId, progress, stage);
		});

		clearTimeout(timeoutId);

		if (result.success) {
			await completeCheckoutJob(checkoutId, result);
		} else {
			await failCheckoutJob(checkoutId, result.error || 'Checkout failed', result.errors);
		}
	} catch (error) {
		clearTimeout(timeoutId);
		console.error(`Error processing checkout ${checkoutId}:`, error);
		await failCheckoutJob(checkoutId, `Unexpected error: ${(error as Error).message ?? error}`, []);
	}
}

export async function POST(request: NextRequest) {
	const { checkoutId, checkoutItems, walletAddress: buyerWalletAddress }: CheckoutRequest = await request.json();

	// Log checkout request for cart-service debugging
	console.log('[checkout] Request', {
		checkoutId,
		walletAddress: buyerWalletAddress,
		itemCount: checkoutItems?.length ?? 0,
		checkoutItems: checkoutItems?.map((item) => ({
			collectionId: item.collectionId,
			productId: item.productId,
			voucherId: item.voucherId,
			assetId: item.assetId,
			tokenId: item.tokenId,
			quantity: item.quantity,
			charges: item.charges,
		})),
	});

	// Check if async mode is requested
	const url = new URL(request.url);
	const isAsync = url.searchParams.get('async') === 'true';

	if (isAsync) {
		// Async mode: return immediately and process in background
		try {
			// Initialize job status
			await initializeCheckoutJob(checkoutId);

			// Start background processing (don't await)
			// Use setImmediate to ensure response is sent before processing starts
			setImmediate(() => {
				processCheckoutAsync(checkoutId, checkoutItems, buyerWalletAddress).catch((error) => {
					console.error(`Background checkout processing failed for ${checkoutId}:`, error);
				});
			});

			// Return immediately
			return NextResponse.json(
				{
					success: true,
					checkoutId,
					status: 'pending',
					message: 'Checkout processing started. Use /api/checkout/[checkoutId]/status to check progress.',
				},
				{ status: 202 }, // 202 Accepted
			);
		} catch (error) {
			return NextResponse.json(
				{
					success: false,
					error: `Failed to initialize checkout: ${(error as Error).message ?? error}`,
				},
				{ status: 500 },
			);
		}
	}

	// Sync mode: process and wait for completion (backward compatibility)
	try {
		// Initialize job so GET /api/checkout/:checkoutId/status can be used while processing
		await initializeCheckoutJob(checkoutId);
		const result = await processCheckout(checkoutId, checkoutItems, buyerWalletAddress, async (progress, stage) => {
			await updateCheckoutJobProgress(checkoutId, progress, stage);
		});
		if (result.success) {
			await completeCheckoutJob(checkoutId, result);
		} else {
			await failCheckoutJob(checkoutId, result.error || 'Checkout failed', result.errors);
		}
		return NextResponse.json(result, { status: result.success ? 200 : 400 });
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: `Unexpected error: ${(error as Error).message ?? error}`,
			},
			{ status: 500 },
		);
	}
}
