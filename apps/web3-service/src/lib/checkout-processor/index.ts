import type { CheckoutItem, CheckoutError } from '@/services';
import type { CheckoutResponse, CheckoutJobStage } from '../checkout-job';
import type { ProgressCallback, ToDeploy, ToMint, ToBuy } from './types';
import { PROGRESS_RANGES } from './types';
import { reportProgress } from './helpers';
import { validateCharges, validateAndCategorizeItems } from './validation';
import {
	executeBuyPhase,
	executeDeployPhase,
	executeMintPhase,
	type ExecutionContext,
} from './execution';

/**
 * Process checkout - validates items and performs deployment, minting, and buying operations
 *
 * This is the main checkout orchestration method that handles the complete checkout flow:
 * 1. Validates buyer has sufficient balance for all charges
 * 2. Validates all checkout items (products, vouchers, assets)
 * 3. Categorizes items into operations: deploy, mint, or buy
 * 4. Executes operations in order: buy → deploy → mint
 * 5. Handles payment token transfers for charges
 * 6. Updates product inventory and ownership
 *
 * Business Rules:
 * - ERC721C collections: quantity must be 1 (non-fungible)
 * - ERC721AC collections: supports batch minting, quantities can be > 1
 * - ERC1155C collections: supports multiple quantities
 * - Collections without contractAddress must be deployed first
 * - Vouchers can be minted if collection is deployed
 * - Assets can be bought if collection is deployed and asset exists
 * - ERC721AC buy operations: if seller is creator and supply available, converts to mint
 *
 * Progress Tracking:
 * - 0-10%: Validation phase
 * - 10-30%: Collection deployment
 * - 30-60%: Token minting
 * - 60-90%: Asset purchasing
 * - 90-100%: Finalization
 *
 * @param checkoutId - Unique checkout identifier for tracking and transaction correlation
 * @param checkoutItems - Array of items to checkout. Each item can be:
 *   - Product-based: requires productId, will resolve to voucherId
 *   - Voucher-based: requires voucherId for minting
 *   - Asset-based: requires assetId or tokenId for purchasing existing NFTs
 * @param buyerWalletAddress - Wallet address of the buyer (must have sufficient balance for charges)
 * @param onProgress - Optional callback for progress updates. Receives:
 *   - progress: number (0-100)
 *   - stage: CheckoutJobStage ('validating' | 'deploying' | 'minting' | 'buying' | 'finalizing')
 * @returns CheckoutResponse containing:
 *   - success: boolean indicating overall success
 *   - deployedCollections: Array of successfully deployed collections
 *   - mintedTokens: Array of successfully minted tokens with metadata
 *   - purchasedAssets: Array of successfully purchased assets
 *   - errors: Array of CheckoutError for items that failed
 *   - error: Optional string for general errors
 *
 * @throws Never throws - all errors are caught and returned in CheckoutResponse
 */
export async function processCheckout(
	checkoutId: string,
	checkoutItems: CheckoutItem[],
	buyerWalletAddress: string,
	onProgress?: ProgressCallback,
): Promise<CheckoutResponse> {
	const deployedCollections: { collectionId: number; contractAddress: string; checkoutId?: string }[] = [];
	const mintedTokens: {
		voucherId: number;
		tokenId: number;
		quantity?: number;
		assetId?: number;
		contractAddress?: string;
		checkoutId?: string;
		tokenIds?: number[];
	}[] = [];
	const purchasedAssets: { collectionId: number; tokenId: number; checkoutId?: string }[] = [];
	const errors: CheckoutError[] = [];

	// Phase 1: Charge validation
	await reportProgress(onProgress, 5, 'validating');
	if (!(await validateCharges(checkoutItems, buyerWalletAddress))) {
		return {
			success: false,
			error: 'Insufficient balance to cover charges',
			errors: [],
		};
	}

	// Phase 2: Item validation and categorization
	let toDeploy: ToDeploy[] = [];
	let toMint: ToMint[] = [];
	let toBuy: ToBuy[] = [];

	try {
		await reportProgress(onProgress, PROGRESS_RANGES.VALIDATING_END, 'validating');
		const result = await validateAndCategorizeItems(checkoutItems);
		toDeploy = result.toDeploy;
		toMint = result.toMint;
		toBuy = result.toBuy;
		errors.push(...result.errors);

		if (result.errors.length > 0) {
			return {
				success: false,
				errors: result.errors,
			};
		}
	} catch (error) {
		return {
			success: false,
			error: `Error checking out: ${(error as Error).message ?? error}`,
			errors: [],
		};
	}

	// Ensure all items were categorized
	if (toDeploy.length + toMint.length + toBuy.length < checkoutItems.length) {
		return {
			success: false,
			error: `Some items failed to process`,
			errors: [],
		};
	}

	// Phase 3: Execution (buy → deploy → mint)
	const ctx: ExecutionContext = {
		errors,
		deployedCollections,
		mintedTokens,
		purchasedAssets,
		toMint,
	};

	try {
		await executeBuyPhase(toBuy, buyerWalletAddress, checkoutId, ctx, onProgress);
		await executeDeployPhase(toDeploy, checkoutId, ctx, onProgress);
		await executeMintPhase(ctx.toMint, buyerWalletAddress, checkoutId, ctx, onProgress);

		await reportProgress(onProgress, PROGRESS_RANGES.FINALIZING, 'finalizing');

		return {
			success: true,
			deployedCollections,
			mintedTokens,
			purchasedAssets,
			errors,
		};
	} catch (error) {
		return {
			success: false,
			error: `Unexpected error: ${(error as Error).message ?? error}`,
			errors: [],
		};
	}
}
