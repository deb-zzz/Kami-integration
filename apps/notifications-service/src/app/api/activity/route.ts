import { prisma } from '@/lib/db';
import { NotificationEntityType, NotificationEntitySubType, notifications, NotificationType } from '@prisma/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Activity = {
	notification: notifications;
	activityText?: string;
	activityTime: Date;
};

type ActivityResponse = {
	success: boolean;
	activity?: Activity[];
	message?: string;
};

/**
 * Handles GET requests for web-push operations.
 *
 * This function processes incoming GET requests and routes them to the appropriate handler
 * based on the request's pathname. It supports fetching VAPID public keys, notifications,
 * and unread notifications for a user identified by their wallet address.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<ActivityResponse>} - A promise that resolves to an HTTP response.
 *                                The response status is 200 on success, 400 if the wallet address is missing,
 *                                404 if the user is not found or the endpoint is not recognized.
 */
export async function GET(request: Request): Promise<NextResponse<ActivityResponse>> {
	const { searchParams } = new URL(request.url);

	const walletAddress = searchParams.get('walletAddress') ?? undefined;
	if (!walletAddress) return NextResponse.json({ success: false, message: 'Wallet address is required' }, { status: 400 });

	const spType = searchParams.get('type') ?? NotificationType.Notification;
	const type = spType === NotificationType.Notification ? NotificationType.Notification : undefined;

	try {
		const user = await prisma.user.findUnique({ where: { walletAddress } });
		if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

		const activity = await getActivity(walletAddress, type as NotificationType);
		return NextResponse.json({ success: true, activity });
	} catch (err) {
		console.log((err as Error).message);
		return NextResponse.json({ success: false, message: 'Internal server error: ' + (err as Error).message }, { status: 500 });
	}
}

/*
{
	"topic": "project-collaborator-status-changed",
	"message": "pcs007 invited you to collaborate on a project",
	"payload": {
		"from": {
			"tags": [
				{ "tag": "SOFTWARE DEVELOPMENT", "type": "Skill" },
				{ "tag": "TEACHING", "type": "Skill" },
				{ "tag": "PIANO", "type": "Skill" },
				{ "tag": "AVIATION", "type": "Interest" },
				{ "tag": "MUSIC", "type": "Interest" },
				{ "tag": "GUITAR", "type": "Skill" }
			],
			"userName": "pcs007",
			"avatarUrl": "https://kami-storage.s3.ap-southeast-1.amazonaws.com/Project/pcs007/profilePic/man_person_people_avatar_icon_230017.webp",
			"description": "<p>Aspiring Pilot | Aviation Enthusiast</p><p><strong>Paul</strong> is a dedicated and passionate aviation enthusiast with a dream of soaring through the skies as a professional pilot. From an early age, John has been captivated by the art of flight, spending countless hours studying aircraft, understanding aerodynamics, and immersing himself in aviation culture.</p><p>Currently pursuing [aeronautics education, flight training, or any relevant field], Paul is committed to building a strong foundation in aviation. He has completed [list certifications or milestones if applicable, e.g., ground school training, private pilot license (PPL) coursework] and actively seeks opportunities to expand his knowledge and skills.</p>"
		},
		"message": "Collaborate with me",
		"projectId": 4,
		"projectName": "Planes",
		"walletAddress": "0x60348CbDc4afd872000e73f3a105E71f25aA8BAb"
	}
}
*/

/**
 * Handles POST requests for new activities.
 *
 * This function processes incoming POST requests and creates a new activity for a user.
 *
 * @param {Request} request - The incoming HTTP request. The request body should contain the wallet address and the payload.
 * @returns {Promise<ActivityResponse>} - A promise that resolves to an HTTP response.
 */
export async function POST(request: Request): Promise<NextResponse<ActivityResponse>> {
	try {
		const { walletAddress, entityType, entityId, entitySubType, payload } = await request.json();
		const user = await prisma.user.findUnique({ where: { walletAddress } });
		if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
		if (!payload) return NextResponse.json({ success: false, message: 'Payload is required' }, { status: 400 });
		if (!entityId) return NextResponse.json({ success: false, message: 'Entity id is required' }, { status: 400 });

		if (entityType && !Object.values(NotificationEntityType).includes(entityType))
			return NextResponse.json(
				{
					success: false,
					message: `Invalid entity type.  Must be one of [${Object.values(NotificationEntityType).join(', ')}]`,
				},
				{ status: 400 }
			);
		if (entitySubType && !Object.values(NotificationEntitySubType).includes(entitySubType))
			return NextResponse.json(
				{
					success: false,
					message: `Invalid entity sub type.  Must be one of [${Object.values(NotificationEntitySubType).join(', ')}]`,
				},
				{ status: 400 }
			);

		const notification = await prisma.notifications.create({
			data: {
				walletAddress,
				message: JSON.stringify(payload),
				notificationType: NotificationType.Activity,
				createdAt: Math.floor(Date.now() / 1000),
				entityId,
				entityType,
				entitySubType,
			},
		});

		return NextResponse.json({ success: true, notification });
	} catch (err) {
		console.log((err as Error).message);
		return NextResponse.json({ success: false, message: 'Internal server error: ' + (err as Error).message }, { status: 500 });
	}
}

/**
 * Retrieves all activity for a given wallet address.
 *
 * @param {string} walletAddress - The wallet address of the user.
 * @returns {Promise<Activity[]>} - A promise that resolves to an array of Activity objects.
 *
 */
async function getActivity(walletAddress: string, type: NotificationType): Promise<Activity[]> {
	try {
		const notificationType = type === NotificationType.Notification ? NotificationType.Notification : undefined;
		const notifications = await prisma.notifications.findMany({
			where: { walletAddress, notificationType },
			include: { profile: { select: { walletAddress: true, userName: true, avatarUrl: true } } },
			orderBy: { createdAt: 'desc' },
		});

		const activity: Activity[] = [];

		for (const notification of notifications) {
			if (!notification.entityId || !notification.entityType || !notification.entitySubType) {
				activity.push({
					notification: notification,
					activityText: undefined,
					activityTime: new Date(notification.createdAt * 1000),
				});
				continue;
			}

			switch (notification.entityType) {
				case 'User':
					const user = await prisma.user.findUnique({
						where: { walletAddress: notification.entityId },
					});
					if (user) {
						activity.push({
							notification: notification,
							activityText: `${notification.entitySubType.toLowerCase()} ${user.userName}`,
							activityTime: new Date(notification.createdAt * 1000),
						});
					}
					break;
				case 'Post':
					const post = await prisma.post.findUnique({
						where: { id: Number.parseInt(notification.entityId) },
						include: {
							postedBy: {
								select: {
									walletAddress: true,
									userName: true,
									avatarUrl: true,
								},
							},
						},
					});
					if (post) {
						activity.push({
							notification: notification,
							activityText: `${notification.entitySubType} ${post.caption}`,
							activityTime: new Date(notification.createdAt * 1000),
						});
					}
					break;
				case 'Collection':
					const collection = await prisma.collection.findUnique({
						where: { collectionId: Number.parseInt(notification.entityId) },
						include: {
							owner: {
								select: {
									walletAddress: true,
									userName: true,
									avatarUrl: true,
								},
							},
						},
					});
					if (collection) {
						activity.push({
							notification: notification,
							activityText: `${notification.entitySubType} collection ${collection.name}`,
							activityTime: new Date(notification.createdAt * 1000),
						});
					}
					break;
				case 'Project':
					const project = await prisma.project.findUnique({
						where: { id: Number.parseInt(notification.entityId) },
						include: {
							category: true,
							collaborators: {
								include: {
									userProfile: {
										select: {
											walletAddress: true,
											userName: true,
											avatarUrl: true,
										},
									},
								},
							},
							user: {
								select: {
									walletAddress: true,
									userName: true,
									avatarUrl: true,
								},
							},
						},
					});
					if (project) {
						activity.push({
							notification: notification,
							activityText: `${notification.entitySubType} project ${project.name}`,
							activityTime: new Date(notification.createdAt * 1000),
						});
					}
					break;
				case 'Product': {
					const product = await prisma.product.findUnique({
						where: { id: Number.parseInt(notification.entityId) },
						include: {
							asset: true,
							voucher: true,
							collection: true,
							bundle: true,
							owner: { select: { walletAddress: true, userName: true, avatarUrl: true } },
						},
					});
					if (product) {
						activity.push({
							notification: notification,
							activityText: `${notification.entitySubType} product ${product.name}`,
							activityTime: new Date(notification.createdAt * 1000),
						});
					}
					break;
				}
				case 'Collaborate': {
					const collaborate = await prisma.collaborators.findUnique({
						where: { id: Number.parseInt(notification.entityId) },
						include: {
							project: {
								select: {
									id: true,
									name: true,
									collaborators: {
										select: {
											id: true,
											userProfile: { select: { walletAddress: true, userName: true, avatarUrl: true } },
										},
									},
								},
							},
							userProfile: { select: { walletAddress: true, userName: true, avatarUrl: true } },
						},
					});
					if (collaborate) {
						activity.push({
							notification: notification,
							activityText: `${notification.entitySubType} ${collaborate.userProfile.userName} to collaborate on ${collaborate.project.name}`,
							activityTime: new Date(notification.createdAt * 1000),
						});
					}
					break;
				}
				case 'Playlist':
					break;
				default:
					break;
			}
		}

		return activity;
	} catch (err) {
		console.log((err as Error).message);
		throw err;
	}
}
