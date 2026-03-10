import { prisma } from '@/lib/db';
import { CollaboratorStatus, project, ProjectStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type ProjectsWithCollaborations = project & {
	ownedByMe: boolean;
	isPublished: boolean;
};

type GetSuccessResponse = {
	success: true;
	projects: ProjectsWithCollaborations[];
	myCollaborations: ProjectsWithCollaborations[];
};

type PostSuccessResponse = {
	success: true;
	project: ProjectsWithCollaborations;
};

type ErrorResponse = {
	success: false;
	error: string;
};

type Props = {
	params: Promise<{ walletAddress: string }>;
};

/**
 * Fetches all projects associated with a given wallet address, including collaborations.
 *
 * @param req - The incoming request object.
 * @param params - An object containing the wallet address as a promise.
 * @returns A promise that resolves to a NextResponse containing either a success response with projects or an error response.
 */
export async function GET(req: NextRequest, { params }: Props): Promise<NextResponse<GetSuccessResponse | ErrorResponse>> {
	try {
		const { walletAddress } = await params;
		const projects = await prisma.project.findMany({
			where: {
				OR: [{ walletAddress: walletAddress }, { collaborators: { some: { userWalletAddress: walletAddress } } }],
			},
			include: {
				category: true,
				collaborators: { include: { userProfile: { select: { userName: true, avatarUrl: true, walletAddress: true } } } },
				collection: { include: { products: true, _count: { select: { vouchers: true, asset: true } } } },
				user: { select: { userName: true, avatarUrl: true, walletAddress: true } },
			},
		});

		const projectsWithCollaborations = projects.map((project) => {
			return {
				...project,
				ownedByMe: project.walletAddress === walletAddress,
				isPublished: project.status === ProjectStatus.Publish,
			};
		});
		return NextResponse.json({
			success: true,
			projects: projectsWithCollaborations.filter((project) => project.ownedByMe),
			myCollaborations: projectsWithCollaborations.filter(
				(project) =>
					!project.ownedByMe &&
					project.collaborators.some(
						(collaborator) =>
							collaborator.userWalletAddress === walletAddress && collaborator.status === CollaboratorStatus.Accepted
					)
			),
			// projects: projectsWithCollaborations.toSorted((a, b) => (a.ownedByMe !== b.ownedByMe ? 0 : a ? -1 : 1)),
		});
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to fetch projects: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * Creates a new project for a given wallet address.
 *
 * @param req - The incoming request object containing the project details in JSON format.
 * @param params - An object containing the wallet address as a promise.
 * @returns A promise that resolves to a NextResponse containing either a success response with the created project or an error response.
 */
export async function POST(req: NextRequest, { params }: Props): Promise<NextResponse<PostSuccessResponse | ErrorResponse>> {
	try {
		const { walletAddress } = await params;
		const { name, description, categoryId } = await req.json();
		console.log('Creating project', name, description, walletAddress, new Date().getDate() / 1000);
		const project = await prisma.project.create({
			data: {
				name,
				description,
				categoryId,
				walletAddress,
				createdAt: new Date().getTime() / 1000,
				collaborators: {
					create: {
						userWalletAddress: walletAddress,
						status: CollaboratorStatus.Accepted,
						primaryShare: 100,
						secondaryShare: 100,
						role: 'Owner',
						writeAccess: true,
					},
				},
			},
		});
		console.log('Created project', project);
		return NextResponse.json({
			success: true,
			project: {
				...project,
				ownedByMe: true,
				isPublished: false,
			},
		});
	} catch (error) {
		console.log('Failed to create project', error);
		return NextResponse.json({ success: false, error: 'Failed to create project: ' + (error as Error).message }, { status: 500 });
	}
}
