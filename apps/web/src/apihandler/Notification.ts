'use server';

import { ActivityType, NotificationMessage, NotificationType } from '@/types';
import { axiosInstance } from './AxiosInstance';

/**
 * Subscribes a user to web push notifications.
 *
 * @param {string} address - The wallet address of the user.
 * @param {string} subscription - The subscription object as a JSON string.
 *
 * This function sends a POST request to the notifications service to register
 * a user's subscription for web push notifications. The subscription object
 * is expected to be a JSON string that will be parsed before being sent.
 */
export async function subscribeToNotifications(
	address: string,
	subscription: string
) {
	try {
		// Log the subscription for debugging purposes
		//console.log(subscription);

		// Send a POST request to the notifications service
		const res = await axiosInstance.post(
			`/notifications-service/web-push/subscription?walletAddress=${address}`,
			{ subscription: JSON.parse(subscription) } // Parse the subscription JSON string
		);
	} catch (error: any) {
		// Log any errors that occur during the request
		console.error(
			'Error subscribing to notifications:',
			error.response?.data || error.message
		);
	}
}

export async function getNotifications(address: string) {
	const res = await axiosInstance.get(
		`/notifications-service/web-push/notifications?walletAddress=${address}`
	);
	// console.log('getNotifications', res.data);
	return <NotificationType[]>res.data;
}

export async function markNotificationAsRead(notificationId: number) {
	const res = await axiosInstance.post(
		`/notifications-service/web-push/markread`,
		{ notificationId }
	);
	return <{ error?: string; message?: string }>res.data;
}
export async function clearNotification(address: string) {
	const res = await axiosInstance.post(
		`/notifications-service/web-push/markallread?walletAddress=${address}`
	);
	return <{ error?: string; message?: string }>res.data;
}
