import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client/edge';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Type representing a project collaborator with selected user profile fields.
 */
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

/**
 * Successful response type for fetching project collaborators.
 */
type ProjectCollaboratorResponse = {
	success: true;
	collaborators: ProjectCollaborator[];
};

/**
 * Error response type.
 */
type ErrorResponse = {
	success: false;
	error: string;
};

/**
 * Handles GET requests to fetch collaborators for a specific project.
 *
 * @param request - The incoming request object.
 * @param params - An object containing the projectId as a promise.
 * @returns A promise that resolves to a NextResponse containing either a
 * ProjectCollaboratorResponse or an ErrorResponse.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ProjectCollaboratorResponse | ErrorResponse>> {
	const { projectId } = await params;
	try {
		const project = await prisma.collaborators.findMany({
			where: {
				projectId: parseInt(projectId),
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

		return NextResponse.json({ success: true, collaborators: project });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to get collaborators: ' + error }, { status: 500 });
	}
}

/**
 * Handles DELETE requests to remove all collaborators for a specific project.
 *
 * @param request - The incoming request object.
 * @param params - An object containing the projectId as a promise.
 * @returns A promise that resolves to a NextResponse containing either a
 * success message or an ErrorResponse.
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<{ success: true } | ErrorResponse>> {
	const { projectId } = await params;
	try {
		await prisma.collaborators.deleteMany({
			where: {
				projectId: parseInt(projectId),
			},
		});
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to delete collaborators: ' + error }, { status: 500 });
	}

	return NextResponse.json({ success: true });
}
