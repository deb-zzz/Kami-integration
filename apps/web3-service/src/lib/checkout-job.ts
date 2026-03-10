import { redis } from './redis';
import type { CheckoutError } from '@/services';

export type CheckoutJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type CheckoutJobStage = 'validating' | 'deploying' | 'minting' | 'buying' | 'finalizing';

export type CheckoutResponse = {
	success: boolean;
	error?: string;
	deployedCollections?: Array<{ collectionId: number; contractAddress: string; checkoutId?: string }>;
	mintedTokens?: Array<{
		voucherId: number;
		tokenId: number;
		quantity?: number;
		assetId?: number;
		contractAddress?: string;
		checkoutId?: string;
		tokenIds?: number[];
	}>;
	purchasedAssets?: Array<{ collectionId: number; tokenId: number; checkoutId?: string }>;
	errors?: CheckoutError[];
};

export type CheckoutJob = {
	checkoutId: string;
	status: CheckoutJobStatus;
	progress: number; // 0-100
	stage: CheckoutJobStage;
	result?: CheckoutResponse;
	error?: string;
	errors?: CheckoutError[];
	startedAt: number;
	updatedAt: number;
	completedAt?: number;
};

const JOB_KEY_PREFIX = 'checkout:job:';
const JOB_TTL = 3600; // 1 hour in seconds

/**
 * Get Redis key for a checkout job
 */
function getJobKey(checkoutId: string): string {
	return `${JOB_KEY_PREFIX}${checkoutId}`;
}

/**
 * Initialize a checkout job in Redis
 */
export async function initializeCheckoutJob(checkoutId: string): Promise<void> {
	const job: CheckoutJob = {
		checkoutId,
		status: 'pending',
		progress: 0,
		stage: 'validating',
		startedAt: Date.now(),
		updatedAt: Date.now(),
	};

	try {
		await redis.setex(getJobKey(checkoutId), JOB_TTL, JSON.stringify(job));
	} catch (error) {
		console.error(`Failed to initialize checkout job ${checkoutId}:`, error);
		throw error;
	}
}

/**
 * Update checkout job status
 */
export async function updateCheckoutJob(
	checkoutId: string,
	updates: Partial<Pick<CheckoutJob, 'status' | 'progress' | 'stage' | 'result' | 'error' | 'errors'>>
): Promise<void> {
	const maxRetries = 3;
	let retries = 0;

	while (retries < maxRetries) {
		try {
			const key = getJobKey(checkoutId);
			const existing = await redis.get(key);

			if (!existing) {
				console.warn(`Checkout job ${checkoutId} not found in Redis`);
				return;
			}

			const job: CheckoutJob = JSON.parse(existing);
			const updatedJob: CheckoutJob = {
				...job,
				...updates,
				updatedAt: Date.now(),
				completedAt: updates.status === 'completed' || updates.status === 'failed' ? Date.now() : job.completedAt,
			};

			await redis.setex(key, JOB_TTL, JSON.stringify(updatedJob));
			return; // Success
		} catch (error) {
			retries++;
			if (retries >= maxRetries) {
				console.error(`Failed to update checkout job ${checkoutId} after ${maxRetries} retries:`, error);
				// Don't throw - allow processing to continue even if Redis update fails
				return;
			}
			// Wait before retry (exponential backoff)
			await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 50));
		}
	}
}

/**
 * Get checkout job status
 */
export async function getCheckoutJob(checkoutId: string): Promise<CheckoutJob | null> {
	try {
		const key = getJobKey(checkoutId);
		const data = await redis.get(key);

		if (!data) {
			return null;
		}

		return JSON.parse(data) as CheckoutJob;
	} catch (error) {
		console.error(`Failed to get checkout job ${checkoutId}:`, error);
		return null;
	}
}

/**
 * Mark checkout job as completed
 */
export async function completeCheckoutJob(checkoutId: string, result: CheckoutResponse): Promise<void> {
	await updateCheckoutJob(checkoutId, {
		status: 'completed',
		progress: 100,
		stage: 'finalizing',
		result,
	});
}

/**
 * Mark checkout job as failed
 */
export async function failCheckoutJob(checkoutId: string, error: string, errors?: CheckoutError[]): Promise<void> {
	await updateCheckoutJob(checkoutId, {
		status: 'failed',
		error,
		errors,
	});
}

/**
 * Update checkout job progress
 */
export async function updateCheckoutJobProgress(
	checkoutId: string,
	progress: number,
	stage: CheckoutJobStage
): Promise<void> {
	await updateCheckoutJob(checkoutId, {
		status: 'processing',
		progress: Math.min(100, Math.max(0, progress)),
		stage,
	});
}
