/**
 * Records activity with the notification service for feed/activity display.
 * Fails silently (logs only) so API success is not blocked by notification service errors.
 */

import { NotificationEntityType, NotificationEntitySubType } from '@prisma/client';

const NOTIFICATIONS_SERVICE_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'http://notifications-service:3000';

export type RecordActivityParams = {
	walletAddress: string;
	entityType: NotificationEntityType;
	entityId: string;
	entitySubType: NotificationEntitySubType;
	payload: Record<string, unknown>;
};

/**
 * POSTs activity to the notification service. Does not throw; logs errors only.
 */
export async function recordActivity(params: RecordActivityParams): Promise<void> {
	const { walletAddress, entityType, entityId, entitySubType, payload } = params;
	const url = `${NOTIFICATIONS_SERVICE_URL}/api/activity`;
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				walletAddress,
				entityType,
				entityId,
				entitySubType,
				payload,
			}),
		});
		if (!res.ok) {
			const text = await res.text();
			console.warn(`recordActivity: notification service returned ${res.status} for ${entitySubType} entityId=${entityId}: ${text}`);
		}
	} catch (error) {
		console.warn(
			`recordActivity: failed to call notification service for ${entitySubType} entityId=${entityId}:`,
			error instanceof Error ? error.message : error,
		);
	}
}
