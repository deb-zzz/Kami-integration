import { NextRequest } from 'next/server';
import { getCheckoutJob } from '@/lib/checkout-job';

const POLL_INTERVAL = 500; // 500ms
const MAX_DURATION = 300000; // 5 minutes

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ checkoutId: string }> }
): Promise<Response> {
	const { checkoutId } = await params;

	// Create a ReadableStream for SSE
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let lastStatus: string | null = null;
			let lastProgress = -1;
			const startTime = Date.now();

			const sendEvent = (type: string, data: any) => {
				const message = `data: ${JSON.stringify({ type, data })}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			const poll = async () => {
				try {
					// Check timeout
					if (Date.now() - startTime > MAX_DURATION) {
						sendEvent('timeout', { message: 'Stream timeout after 5 minutes' });
						controller.close();
						return;
					}

					const job = await getCheckoutJob(checkoutId);

					if (!job) {
						sendEvent('error', { message: `Checkout job not found: ${checkoutId}` });
						controller.close();
						return;
					}

					// Send status update if status changed
					if (job.status !== lastStatus) {
						sendEvent('status', {
							checkoutId: job.checkoutId,
							status: job.status,
							progress: job.progress,
							stage: job.stage,
						});
						lastStatus = job.status;
					}

					// Send progress update if progress changed
					if (job.progress !== lastProgress) {
						sendEvent('progress', {
							checkoutId: job.checkoutId,
							progress: job.progress,
							stage: job.stage,
						});
						lastProgress = job.progress;
					}

					// Check if job is complete or failed
					if (job.status === 'completed') {
						sendEvent('complete', {
							checkoutId: job.checkoutId,
							result: job.result,
						});
						controller.close();
						return;
					}

					if (job.status === 'failed') {
						sendEvent('error', {
							checkoutId: job.checkoutId,
							error: job.error,
							errors: job.errors,
						});
						controller.close();
						return;
					}

					// Continue polling
					setTimeout(poll, POLL_INTERVAL);
				} catch (error) {
					console.error(`Error polling checkout status for ${checkoutId}:`, error);
					sendEvent('error', {
						message: `Failed to poll checkout status: ${(error as Error).message ?? error}`,
					});
					controller.close();
				}
			};

			// Start polling
			poll();
		},
	});

	// Return SSE response
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no', // Disable buffering in nginx
		},
	});
}
