import { prisma } from '@/lib/db';
import { collection, product, project, ProjectStatus, categories, collaborators } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type ProjectWithCollaborations = project & {
	category?: categories | null;
	collaborators?: (collaborators & {
		userProfile?: {
			userName: string;
			avatarUrl: string | null;
			description: string | null;
			walletAddress: string;
		};
	})[];
	collection?:
		| (collection & {
				products?: product[];
				_count?: { vouchers?: number; asset?: number };
		  })
		| null;
};

type ProjectWithCollaborators = ProjectWithCollaborations & {
	ownedByMe: boolean;
	isPublished: boolean;
};

type SuccessResponse = {
	success: true;
	project: ProjectWithCollaborators;
};

type DeleteResponse = {
	success: true;
};

type ErrorResponse = {
	success: false;
	error: string;
};

type Props = {
	params: Promise<{ walletAddress: string; projectId: string }>;
};

/**
 * Fetches a project by its ID for a given wallet address, including collaborations.
 *
 * @param req - The incoming request object.
 * @param params - An object containing the wallet address and project ID as a promise.
 * @returns A promise that resolves to a NextResponse containing either a success response with the project or an error response.
 */
export async function GET(req: NextRequest, { params }: Props): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
	try {
		const { walletAddress, projectId } = await params;
		const project: ProjectWithCollaborations = await prisma.project.findUniqueOrThrow({
			where: { id: Number(projectId) },
			include: {
				collaborators: {
					include: { userProfile: { select: { userName: true, avatarUrl: true, description: true, walletAddress: true } } },
				},
				user: true,
				category: true,
				collection: { include: { products: true, _count: { select: { vouchers: true, asset: true } } } },
			},
		});

		if (!project) {
			return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
		}

		const projectWithCollaborators: ProjectWithCollaborators = {
			...project,
			ownedByMe: project.walletAddress === walletAddress,
			isPublished: project.status === ProjectStatus.Publish,
		};

		return NextResponse.json({ success: true, project: projectWithCollaborators });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to fetch project: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * Updates a project by its ID for a given wallet address.
 *
 * @param req - The incoming request object containing the project update details in JSON format.
 * @param params - An object containing the wallet address and project ID as a promise.
 * @returns A promise that resolves to a NextResponse containing either a success response with the updated project or an error response.
 */
export async function PUT(req: NextRequest, { params }: Props): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
	type ProjectUpdate = {
		name?: string;
		description?: string;
		whiteboardUrl?: string;
		categoryId?: number;
		productId?: number;
		draft?: string;
	};
	try {
		const { walletAddress, projectId } = await params;
		// Verify project exists and belongs to wallet address
		await prisma.project.findUniqueOrThrow({ where: { id: Number(projectId), walletAddress } });

		const {
			name = undefined,
			description = undefined,
			whiteboardUrl = undefined,
			categoryId = undefined,
			draft = undefined,
		}: ProjectUpdate = await req.json();
		const project = await prisma.project.update({
			where: { id: Number(projectId), walletAddress },
			data: {
				name,
				description,
				whiteboardUrl,
				categoryId,
				draft: draft ? JSON.parse(draft) : undefined,
				updatedAt: Math.floor(Date.now() / 1000),
			},
			include: {
				collaborators: true,
				collection: { include: { products: true, _count: { select: { vouchers: true, asset: true } } } },
			},
		});

		const projectWithCollaborators: ProjectWithCollaborators = {
			...project,
			ownedByMe: project.walletAddress === walletAddress,
			isPublished: project.status === ProjectStatus.Publish,
		};

		return NextResponse.json({ success: true, project: projectWithCollaborators });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to update project: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * Deletes a project by its ID for a given wallet address.
 *
 * @param req - The incoming request object.
 * @param params - An object containing the wallet address and project ID as a promise.
 * @returns A promise that resolves to a NextResponse containing either a success response or an error response.
 */
export async function DELETE(req: NextRequest, { params }: Props): Promise<NextResponse<DeleteResponse | ErrorResponse>> {
	try {
		const { walletAddress, projectId } = await params;
		const project = await prisma.project.findUniqueOrThrow({ where: { id: Number(projectId), walletAddress } });
		if (project.status === ProjectStatus.Publish) throw new Error('Cannot delete a published project');
		if (project.whiteboardUrl) {
			// Delete the whiteboard content
		}
		await prisma.project.delete({ where: { id: Number(projectId), walletAddress } });
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to delete project: ' + (error as Error).message }, { status: 500 });
	}
}
