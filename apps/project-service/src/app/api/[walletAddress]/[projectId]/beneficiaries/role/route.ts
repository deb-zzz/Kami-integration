import { prisma } from '@/lib/db';
import { MonitizeStatus } from '@prisma/client';
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

type Props = {
	params: Promise<{
		projectId: string;
	}>;
};

type Roles = {
	walletAddress: string;
	role: string;
}[];

export async function GET(req: NextRequest, { params }: Props) {
	const { projectId } = await params;

	const collaborators = await prisma.collaborators.findMany({
		where: { projectId: Number(projectId) },
		select: {
			userWalletAddress: true,
			role: true,
		},
	});

	return NextResponse.json({
		success: true,
		roles: collaborators.map((collaborator) => ({ walletAddress: collaborator.userWalletAddress, role: collaborator.role })),
	});
}

export async function POST(req: NextRequest, { params }: Props) {
	const { projectId } = await params;
	const roles: Roles = await req.json();

	const collaborators = await prisma.collaborators.findMany({
		where: { projectId: Number(projectId) },
		include: {
			project: {
				select: {
					name: true,
				},
			},
		},
	});

	if (collaborators.length === 0) {
		return NextResponse.json({ success: false, error: 'Collaborators not found' }, { status: 404 });
	}
	await prisma.$transaction(async (tx) => {
		for (const collaborator of collaborators) {
			const role = roles.find((role) => role.walletAddress === collaborator.userWalletAddress);
			if (role?.role && role.role !== collaborator.role) {
				const updatedCollaborator = await tx.collaborators.update({
					where: { id: collaborator.id },
					data: { role: role.role },
				});
				if (updatedCollaborator) {
					await sendNotification(
						projectId,
						collaborator.userWalletAddress,
						role.role,
						`You have been offered a ${role.role} role in the project ${collaborator.project.name}`
					);
				}
			}
		}
	});

	return NextResponse.json({ success: true });
}

async function sendNotification(projectId: string, walletAddress: string, role: string, payloadMessage?: string) {
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
		// delete old notifications
		const list = await prisma.notifications.findMany({
			where: {
				walletAddress: walletAddress,
				notificationType: 'Notification',
				message: { contains: 'project-collaborator-role-changed' },
			},
		});

		for (const notification of list) {
			if (notification.message.includes('projectId":' + projectId) && notification.message.includes('invite')) {
				console.log('deleted id :', notification.id);
				await prisma.notifications.delete({ where: { id: notification.id } });
			}
		}
		await axios.post(`${process.env.NOTIFICATIONS_SERVICE}/web-push/send?walletAddress=${walletAddress}`, {
			topic: 'project-collaborator-role-changed',
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
					case MonitizeStatus.Offered:
						return payloadMessage || `${name} offered you the ${role} role in the project ${project.name}`;
					default:
						return payloadMessage || `${name} updated your role to ${role} in the project ${project.name}`;
				}
			})(),
		});
	} catch (error) {
		console.log(`\n${process.env.NOTIFICATIONS_SERVICE}/web-push/send?walletAddress=${walletAddress}`);
		console.log(error instanceof Error ? error.message : error);
	}
}
