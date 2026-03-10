import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutJob } from '@/lib/checkout-job';

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ checkoutId: string }> }
): Promise<NextResponse> {
	const { checkoutId } = await params;

	try {
		const job = await getCheckoutJob(checkoutId);

		if (!job) {
			return NextResponse.json(
				{
					success: false,
					error: `Checkout job not found: ${checkoutId}`,
				},
				{ status: 404 }
			);
		}

		// Top-level success reflects checkout outcome: only true when status === 'completed'
		const checkoutSuccess = job.status === 'completed';

		return NextResponse.json({
			success: checkoutSuccess,
			checkoutId: job.checkoutId,
			status: job.status,
			progress: job.progress,
			stage: job.stage,
			result: job.result,
			error: job.error,
			errors: job.errors,
			startedAt: job.startedAt,
			updatedAt: job.updatedAt,
			completedAt: job.completedAt,
		});
	} catch (error) {
		console.error(`Error getting checkout status for ${checkoutId}:`, error);
		return NextResponse.json(
			{
				success: false,
				error: `Failed to get checkout status: ${(error as Error).message ?? error}`,
			},
			{ status: 500 }
		);
	}
}
