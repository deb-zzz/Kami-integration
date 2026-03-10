import { prisma } from '@/lib/db';
import { MonitizeStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

type Props = {
	params: Promise<{ walletAddress: string; projectId: string }>;
};

type Benefactor = {
	walletAddress: string;
	role?: string;
	percentage?: number;
};

type Beneficiaries = {
	mint: {
		beneficiaries: Benefactor[];
	};
	royalties: {
		percentage: number;
		beneficiaries: Benefactor[];
	};
};

export async function GET(req: NextRequest, { params }: Props) {
	const { projectId } = await params;

	try {
		const beneficiaries: Beneficiaries = {
			mint: {
				beneficiaries: [],
			},
			royalties: {
				percentage: 0,
				beneficiaries: [],
			},
		};

		const collaborators = await prisma.collaborators.findMany({
			where: { projectId: Number(projectId) },
			include: {
				project: {
					select: {
						royaltyPercentage: true,
					},
				},
			},
		});

		for (const collaborator of collaborators) {
			if (collaborator.primaryStatus !== MonitizeStatus.None) {
				beneficiaries.mint.beneficiaries.push({
					walletAddress: collaborator.userWalletAddress,
					role: collaborator.role || '',
					percentage: collaborator.primaryShare,
				});
			}
			if (collaborator.secondaryStatus !== MonitizeStatus.None) {
				beneficiaries.royalties.beneficiaries.push({
					walletAddress: collaborator.userWalletAddress,
					role: collaborator.role || '',
					percentage: collaborator.secondaryShare,
				});
			}

			beneficiaries.royalties.percentage += collaborator.project.royaltyPercentage || 0;
		}

		return NextResponse.json({ success: true, beneficiaries }, { status: 200 });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to get collaborators: ' + (error as Error).message }, { status: 500 });
	}
}

export async function POST(req: NextRequest, { params }: Props) {
	const { projectId } = await params;
	const beneficiaries: Beneficiaries = await req.json();

	try {
		const collaborators = await prisma.collaborators.findMany({
			where: { projectId: Number(projectId) },
		});

		if (collaborators.length === 0) {
			return NextResponse.json({ success: false, error: 'No collaborators found' }, { status: 400 });
		}

		await prisma.$transaction(async (tx) => {
			for (const collaborator of collaborators) {
				if (beneficiaries.mint.beneficiaries.some((beneficiary) => beneficiary.walletAddress === collaborator.userWalletAddress)) {
					await tx.collaborators.update({
						where: { id: collaborator.id },
						data: {
							primaryShare: beneficiaries.mint.beneficiaries.find(
								(beneficiary) => beneficiary.walletAddress === collaborator.userWalletAddress
							)?.percentage,
							role: beneficiaries.mint.beneficiaries.find(
								(beneficiary) => beneficiary.walletAddress === collaborator.userWalletAddress
							)?.role,
							primaryStatus: MonitizeStatus.Offered,
						},
					});
				}
				if (
					beneficiaries.royalties.beneficiaries.some(
						(beneficiary) => beneficiary.walletAddress === collaborator.userWalletAddress
					)
				) {
					await tx.collaborators.update({
						where: { id: collaborator.id },
						data: {
							secondaryShare: beneficiaries.royalties.beneficiaries.find(
								(beneficiary) => beneficiary.walletAddress === collaborator.userWalletAddress
							)?.percentage,
							...(collaborator.role == null && {
								role: beneficiaries.royalties.beneficiaries.find(
									(beneficiary) => beneficiary.walletAddress === collaborator.userWalletAddress
								)?.role,
							}),
							secondaryStatus: MonitizeStatus.Offered,
						},
					});
				}
			}
			await tx.project.update({
				where: { id: Number(projectId) },
				data: {
					royaltyPercentage: beneficiaries.royalties.percentage,
				},
			});
		});

		const updatedProject = await prisma.project.findUniqueOrThrow({
			where: { id: Number(projectId) },
		});

		// Notify Minting collaborators
		for (const collaborator of beneficiaries.mint.beneficiaries) {
			await sendNotification(
				projectId,
				collaborator.walletAddress,
				MonitizeStatus.Offered,
				`You have been offered a ${collaborator.percentage}% share of the initial sale price in the project ${updatedProject.name} as ${collaborator.role}`
			);
		}

		// Notify Royalty collaborators
		for (const collaborator of beneficiaries.royalties.beneficiaries) {
			await sendNotification(
				projectId,
				collaborator.walletAddress,
				MonitizeStatus.Offered,
				`You have been offered a ${collaborator.percentage}% share of royalties in the project ${updatedProject.name} as ${collaborator.role}`
			);
		}

		const updatedCollaborators = await prisma.collaborators.findMany({
			where: { projectId: Number(projectId) },
		});

		return NextResponse.json({
			success: true,
			project: updatedProject,
			collaborators: updatedCollaborators,
		});
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to update project: ' + (error as Error).message }, { status: 500 });
	}
}

async function sendNotification(projectId: string, walletAddress: string, status: MonitizeStatus | undefined, payloadMessage?: string) {
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
				message: { contains: 'project-collaborator-status-changed' },
			},
		});

		for (const notification of list) {
			if (notification.message.includes('projectId":' + projectId) && notification.message.includes('invite')) {
				console.log('deleted id :', notification.id);
				await prisma.notifications.delete({ where: { id: notification.id } });
			}
		}
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
					case MonitizeStatus.Offered:
						return payloadMessage || `${name} offered you a share in the project`;
					default:
						return payloadMessage || `${name} updated your monitization status`;
				}
			})(),
		});
	} catch (error) {
		console.log(`\n${process.env.NOTIFICATIONS_SERVICE}/web-push/send?walletAddress=${walletAddress}`);
		console.log((error as Error).message);
	}
}
