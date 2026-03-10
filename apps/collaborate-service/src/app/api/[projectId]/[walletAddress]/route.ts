'use server';

import { prisma } from '@/lib/db';
import { CollaboratorStatus, MonitizeStatus, Prisma } from '@prisma/client';
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

// Type definition for a project collaborator, including user profile details
type ProjectCollaborator = Prisma.collaboratorsGetPayload<{
	include: {
		userProfile: {
			select: {
				walletAddress: true;
				userName: true;
				description: true;
				avatarUrl: true;
				tags: {
					select: {
						tag: true;
						type: true;
					};
				};
			};
		};
	};
}>;

// Type definition for an error response
type ErrorResponse = {
	success: false;
	error: string;
};

// Type definition for a successful response containing a collaborator
type SuccessResponse = {
	success: true;
	collaborator: ProjectCollaborator;
};

// Type definition for collaborator properties required during creation
type CollaboratorProps = {
	status?: CollaboratorStatus;
	primaryShare?: number;
	secondaryShare?: number;
	writeAccess: boolean;
	message?: string;
};

// Type definition for collaborator properties that can be updated
type CollaboratorUpdateProps = {
	status?: CollaboratorStatus;
	writeAccess?: boolean;
	primaryShare?: number;
	secondaryShare?: number;
	acknowledge?: boolean;
	primaryStatus?: MonitizeStatus;
	secondaryStatus?: MonitizeStatus;
};

// Handler for POST requests to add a new collaborator
/**
 * Adds a new collaborator to a project.
 *
 * @param request - The incoming request object containing the collaborator data in JSON format.
 * @param params - An object containing the projectId and walletAddress as parameters.
 * @returns A NextResponse object containing either a SuccessResponse with the created collaborator or an ErrorResponse.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string; walletAddress: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
	const { projectId, walletAddress } = await params;
	const collaboratorProps: CollaboratorProps = await request.json();

	try {
		await prisma.user.findUniqueOrThrow({ where: { walletAddress } });
		// Create a new collaborator in the database
		const invite = await prisma.collaborators.findUnique({
			where: { projectId_userWalletAddress: { projectId: Number(projectId), userWalletAddress: walletAddress } },
			include: {
				userProfile: {
					select: {
						walletAddress: true,
						userName: true,
						description: true,
						avatarUrl: true,
						tags: {
							select: {
								tag: true,
								type: true,
							},
						},
					},
				},
			},
		});

		if (invite) {
			if (invite.status === 'Accepted') return NextResponse.json({ success: true, collaborator: invite });

			const list = await prisma.notifications.findMany({
				where: {
					walletAddress: walletAddress,
					notificationType: 'Notification',
					message: { contains: 'project-collaborator-status-changed' },
				},
			});

			for (const notification of list) {
				if (notification.message.includes('projectId":' + projectId) && notification.message.includes('invite')) {
					console.log('deleted id :', notification.id);
					await prisma.notifications.delete({ where: { id: notification.id } });
				}
			}

			sendNotification(projectId, walletAddress, 'Invited', collaboratorProps.message);
			return NextResponse.json({ success: true, collaborator: invite });
		}

		const collaborator = await prisma.collaborators.create({
			data: {
				projectId: Number(projectId),
				userWalletAddress: walletAddress,
				status: collaboratorProps.status as CollaboratorStatus,
				invitedAt: collaboratorProps.status === CollaboratorStatus.Invited ? Math.floor(Date.now() / 1000) : undefined,
				primaryShare: collaboratorProps.primaryShare,
				secondaryShare: collaboratorProps.secondaryShare,
				writeAccess: collaboratorProps.writeAccess,
				primaryStatus: CollaboratorStatus.None,
				secondaryStatus: CollaboratorStatus.None,
			},
			include: {
				userProfile: {
					select: {
						walletAddress: true,
						userName: true,
						description: true,
						avatarUrl: true,
						tags: {
							select: {
								tag: true,
								type: true,
							},
						},
					},
				},
			},
		});

		sendNotification(projectId, walletAddress, collaborator.status, collaboratorProps.message);
		return NextResponse.json({ success: true, collaborator: collaborator });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to add collaborator' }, { status: 500 });
	}
}

// Handler for PUT requests to update an existing collaborator
/**
 * Updates an existing collaborator's details.
 *
 * @param request - The incoming request object containing the updated collaborator data in JSON format.
 * @param params - An object containing the projectId and walletAddress as parameters.
 * @returns A NextResponse object containing either a SuccessResponse with the updated collaborator or an ErrorResponse.
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string; walletAddress: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
	const { projectId, walletAddress } = await params;
	const collaboratorProps: CollaboratorUpdateProps = await request.json();
	try {
		console.log('--->', projectId, walletAddress);
		// Update the collaborator in the database
		const collaborator = await prisma.collaborators.update({
			where: { projectId_userWalletAddress: { projectId: Number(projectId), userWalletAddress: walletAddress } },
			data: {
				...collaboratorProps,
				acknowledgedAt: collaboratorProps.acknowledge ? Math.floor(Date.now() / 1000) : undefined,
				respondedAt:
					!collaboratorProps.acknowledge &&
					collaboratorProps.status !== undefined &&
					collaboratorProps.status in ['Accepted', 'Rejected']
						? Math.floor(Date.now() / 1000)
						: undefined,
			},
			include: {
				userProfile: {
					select: {
						walletAddress: true,
						userName: true,
						description: true,
						avatarUrl: true,
						tags: {
							select: { tag: true, type: true },
						},
					},
				},
			},
		});

		sendNotification(projectId, walletAddress, collaborator.status);
		// Return a success response with the updated collaborator
		return NextResponse.json({ success: true, collaborator: collaborator });
	} catch (error) {
		console.error(error);
		// Return an error response if update fails
		return NextResponse.json({ success: false, error: 'Failed to update collaborator' }, { status: 500 });
	}
}

// Handler for DELETE requests to remove a collaborator
/**
 * Removes a collaborator from a project.
 *
 * @param request - The incoming request object.
 * @param params - An object containing the projectId and walletAddress as parameters.
 * @returns A NextResponse object indicating success or an ErrorResponse if the deletion fails.
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string; walletAddress: string }> }
): Promise<NextResponse<{ success: true } | ErrorResponse>> {
	const { projectId, walletAddress } = await params;
	try {
		// Delete the collaborator from the database
		await prisma.collaborators.delete({
			where: { projectId_userWalletAddress: { projectId: Number(projectId), userWalletAddress: walletAddress } },
		});
		// Return a success response
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error(error);
		// Return an error response if deletion fails
		return NextResponse.json({ success: false, error: 'Failed to remove collaborator' }, { status: 500 });
	}
}

async function sendNotification(projectId: string, walletAddress: string, status: CollaboratorStatus | undefined, payloadMessage?: string) {
	const project = await prisma.project.findUnique({
		where: { id: Number(projectId) },
		include: {
			user: {
				select: {
					walletAddress: true,
					userName: true,
					description: true,
					avatarUrl: true,
					tags: {
						select: {
							tag: true,
							type: true,
						},
					},
				},
			},
		},
	});

	if (!project) {
		console.log('Project not found');
		return;
	}

	try {
		await axios.post(`${process.env.NOTIFICATIONS_SERVICE}/web-push/send?walletAddress=${walletAddress}`, {
			topic: 'project-collaborator-status-changed',
			payload: {
				projectId: project.id,
				walletAddress: walletAddress,
				from: {
					walletAddress: project.user.walletAddress,
					avatarUrl: project.user.avatarUrl,
					userName: project.user.userName,
					description: project.user.description,
					tags: project.user.tags,
				},
				message: payloadMessage,
				projectName: project.name,
			},
			message: (() => {
				const name = project.user.userName || 'Someone';
				switch (status) {
					case CollaboratorStatus.Invited:
						return `${name} invited you to collaborate on a project`;
					case CollaboratorStatus.Accepted:
						return `${name} accepted your collaboration invitation`;
					case CollaboratorStatus.Rejected:
						return `${name} declined your collaboration invitation`;
					case CollaboratorStatus.Removed:
						return `${name} removed you from the project`;
					case CollaboratorStatus.Withdrawn:
						return `${name} withdrew their collaboration invitation`;
					default:
						return `${name} updated your collaboration status`;
				}
			})(),
		});
	} catch (error) {
		console.log(`\n${process.env.NOTIFICATIONS_SERVICE}/web-push/send?walletAddress=${walletAddress}`);
		console.log((error as Error).message);
	}
}
