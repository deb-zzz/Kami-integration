'use server';

import {
	ActivityType,
	NotificationEntitySubType,
	NotificationEntityType,
} from '@/types';
import { axiosInstance } from './AxiosInstance';

export type ActivityReponse = { success: boolean; activity: ActivityType[] };
/**
 * Create a activity
 * @param address - The address of the user
 * @param message - The message of the activity
 * @param payload - The payload of the activity
 * @param entityType - The entity type of the activity (optional)
 * @param entitySubType - The entity sub type of the activity (optional)
 *
 */
export async function createActivity(
	address: string,
	message: string,
	payload?: object,
	entityType?: NotificationEntityType,
	entitySubType?: NotificationEntitySubType,
	entityId?: string
) {
	try {
		// Log the subscription for debugging purposes
		// console.log(subscription);

		// Send a POST request to the notifications service
		// console.log('Creating activity for address:', {
		// 	walletAddress: address,
		// 	entityId: entityId,
		// 	entityType: entityType && entityType.toString(),
		// 	entitySubType: entitySubType && entitySubType.toString(),
		// 	payload: {
		// 		walletAddress: address,
		// 		message,
		// 		...payload,
		// 	},
		// });
		const res = await axiosInstance.post(
			`/notifications-service/activity?walletAddress=${address}`,
			{
				walletAddress: address,
				entityId: entityId,
				entityType: entityType && entityType.toString(),
				entitySubType: entitySubType && entitySubType.toString(),
				payload: {
					walletAddress: address,
					message,
					...payload,
				},
			}
		);

		return <{ success: boolean; notification: ActivityType }>res.data;
	} catch (error: any) {
		// Log any errors that occur during the request
		console.error(
			'Error subscribing to notifications:',
			error.response?.data || error.message
		);
	}
}

export async function getActivities(address: string) {
	const res = await axiosInstance.get(
		`/notifications-service/activity?walletAddress=${address}&type=Activity`
	);
	// console.log('getActivity', res.data);
	const data = <ActivityReponse>res.data;

	return {
		success: data.success,
		activity: data.activity.map((activity: ActivityType) => ({
			...activity,
			notification: {
				...activity.notification,
				message: JSON.parse(activity.notification.message),
			},
		})),
	};
}
