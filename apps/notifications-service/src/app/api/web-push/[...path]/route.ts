import { prisma } from '@/lib/db';
import webpush from 'web-push';
import { NotificationType } from '@prisma/client';

export const dynamic = 'force-dynamic';

let isSetup = false;

/**
 * Sets up the web-push configuration with GCM API Key and VAPID details.
 * This function should be called once before sending any push notifications.
 */
const setup = () => {
	webpush.setGCMAPIKey('AIzaSyD9ItzoY2XwsSAyBmdQ5YU0dgTkG0NDntc');
	webpush.setVapidDetails(
		'mailto:paul@kamiunlimited.com',
		process.env.VAPID_PUBLIC_KEY as string,
		process.env.VAPID_PRIVATE_KEY as string
	);
	isSetup = true;
};

/**
 * Handles GET requests for web-push operations.
 *
 * This function processes incoming GET requests and routes them to the appropriate handler
 * based on the request's pathname. It supports fetching VAPID public keys, notifications,
 * and unread notifications for a user identified by their wallet address.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response.
 *                                The response status is 200 on success, 400 if the wallet address is missing,
 *                                404 if the user is not found or the endpoint is not recognized.
 */
export async function GET(request: Request) {
	const { pathname, searchParams } = new URL(request.url);
	if (pathname.includes('vapid')) return new Response(process.env.VAPID_PUBLIC_KEY);

	const walletAddress = searchParams.get('walletAddress') ?? undefined;
	if (!walletAddress) return new Response('Wallet address is required', { status: 400 });

	const user = await prisma.user.findUnique({ where: { walletAddress } });
	if (!user) return new Response('User not found', { status: 404 });

	switch (pathname) {
		case '/api/web-push/notifications':
			return getNotifications(walletAddress);
		case '/api/web-push/unread':
			return getUnreadNotifications(walletAddress);
		default:
			return new Response('Not found', { status: 404 });
	}
}

/**
 * Handles POST requests for web-push operations.
 *
 * This function processes incoming POST requests and routes them to the appropriate handler
 * based on the request's pathname. It supports marking notifications as read, setting push subscriptions,
 * sending push notifications, and marking all notifications as read for a user identified by their wallet address.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response.
 *                                The response status is 200 on success, 400 if the wallet address is missing,
 *                                404 if the user is not found or the endpoint is not recognized.
 */
export async function POST(request: Request): Promise<Response> {
	if (!isSetup) {
		setup();
		isSetup = true;
	}
	const { pathname, searchParams } = new URL(request.url);

	if (pathname === '/api/web-push/markread') return markAsRead(request);

	const walletAddress = searchParams.get('walletAddress') ?? undefined;
	if (!walletAddress) return new Response('Wallet address is required', { status: 400 });

	const user = await prisma.user.findUnique({ where: { walletAddress } });
	if (!user) return new Response('User not found', { status: 404 });

	switch (pathname) {
		case '/api/web-push/subscription':
			return setSubscription(request, walletAddress);
		case '/api/web-push/send':
			return sendPush(request, walletAddress);
		case '/api/web-push/markallread':
			return markAllAsRead(walletAddress);
		default:
			return new Response('Not found', { status: 404 });
	}
}

/**
 * Sets a push subscription for a user.
 *
 * @param {Request} request - The incoming HTTP request containing the subscription data.
 * @param {string} walletAddress - The wallet address of the user.
 * @returns {Promise<Response>} - The HTTP response indicating success or failure.
 */
async function setSubscription(request: Request, walletAddress: string): Promise<Response> {
	try {
		const body: { subscription: webpush.PushSubscription } = await request.json();
		await prisma.pushSubscriptions.upsert({
			where: { walletAddress },
			update: {
				subscription: JSON.stringify(body.subscription),
			},
			create: {
				walletAddress,
				subscription: JSON.stringify(body.subscription),
				createdAt: Math.floor(Date.now() / 1000),
			},
		});
		return new Response(JSON.stringify({ message: 'Subscribed!' }), { status: 201 });
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
	}
}

/**
 * Sends a push notification to a user.
 *
 * @param {Request} request - The incoming HTTP request containing the notification payload.
 * @param {string} walletAddress - The wallet address of the user.
 * @returns {Promise<Response>} - The HTTP response indicating success or failure.
 */
async function sendPush(request: Request, walletAddress: string): Promise<Response> {
	try {
		const subscription = await prisma.pushSubscriptions.findUnique({
			where: { walletAddress },
		});
		const body = await request.json();
		const pushPayload = JSON.stringify(body);
		if (subscription) {
			const sub: webpush.PushSubscription = JSON.parse(subscription.subscription);
			await webpush.sendNotification(sub, pushPayload);
		}
		await prisma.notifications.create({
			data: {
				walletAddress,
				message: pushPayload,
				notificationType: NotificationType.Notification,
				createdAt: Math.floor(Date.now() / 1000),
			},
		});
		return new Response(JSON.stringify({ message: `${subscription ? 'Push Sent' : 'Notification Created'}` }), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
	}
}

/**
 * Retrieves all notifications for a given wallet address.
 *
 * @param {string} walletAddress - The wallet address of the user.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response containing the notifications in JSON format.
 *                                The response status is 200 on success, or 400 if an error occurs.
 */
async function getNotifications(walletAddress: string): Promise<Response> {
	try {
		const notifications = await prisma.notifications.findMany({
			where: {
				walletAddress,
				notificationType: NotificationType.Notification,
			},
		});
		return new Response(JSON.stringify(notifications), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
	}
}

/**
 * Retrieves unread notifications for a given wallet address.
 *
 * @param {string} walletAddress - The wallet address of the user.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response containing the count of unread notifications in JSON format.
 *                                The response status is 200 on success, or 400 if an error occurs.
 */
async function getUnreadNotifications(walletAddress: string): Promise<Response> {
	try {
		const notifications = await prisma.notifications.findMany({
			where: {
				walletAddress,
				readAt: null,
				notificationType: NotificationType.Notification,
			},
		});
		return new Response(JSON.stringify({ unread: notifications.length }), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
	}
}

/**
 * Marks a specific notification as read.
 *
 * @param {Request} request - The incoming HTTP request containing the notification ID in JSON format.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response indicating the result of the operation.
 *                                The response status is 200 on success, or 400 if an error occurs or if the notification ID is missing.
 */
async function markAsRead(request: Request): Promise<Response> {
	try {
		const { notificationId } = await request.json();
		if (!notificationId) return new Response('Notification ID is required', { status: 400 });
		await prisma.notifications.update({ where: { id: Number(notificationId) }, data: { readAt: Math.floor(Date.now() / 1000) } });
		return new Response(JSON.stringify({ message: 'Notification marked as read.' }), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
	}
}

/**
 * Marks all notifications as read for a given wallet address.
 *
 * @param {string} walletAddress - The wallet address of the user.
 * @returns {Promise<Response>} - A promise that resolves to an HTTP response indicating the result of the operation.
 *                                The response status is 200 on success, or 400 if an error occurs.
 */
async function markAllAsRead(walletAddress: string): Promise<Response> {
	try {
		await prisma.notifications.updateMany({
			where: {
				walletAddress,
				notificationType: NotificationType.Notification,
				NOT: { message: { contains: 'project-collaborator-status-changed' } },
			},
			data: { readAt: Math.floor(Date.now() / 1000) },
		});

		const projectNotifications = await prisma.notifications.findMany({
			where: {
				walletAddress,
				notificationType: NotificationType.Notification,
				message: { contains: 'project-collaborator-status-changed' },
			},
		});
		console.log('-------------------------------start of projectNotifications----------------------------------');
		console.log(projectNotifications.length, 'length of projectNotifications');
		console.log('-------------------------------end of projectNotifications----------------------------------');

		const filtered = projectNotifications.filter(
			(notification) =>
				notification.message.includes('accepted your collaboration') || notification.message.includes('declined your collaboration')
		);
		console.log('-------------------------------start of filtered----------------------------------');
		console.log(filtered.length, 'length of filtered');
		console.log(
			filtered.map((notification) => ({
				id: notification.id,
				message: JSON.parse(notification.message).message,
				projectId: JSON.parse(notification.message).projectId,
			}))
		);
		console.log('-------------------------------end of filtered----------------------------------');

		await prisma.notifications.updateMany({
			where: {
				id: { in: filtered.map((notification) => notification.id) },
			},
			data: { readAt: Math.floor(Date.now() / 1000) },
		});

		return new Response(JSON.stringify({ message: 'All notifications marked as read.' }), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
	}
}
