import { prisma } from '@/lib/db';
import { collection, project, ProjectStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * Type definition for the collaborations response structure
 */
type Collaborations = {
	projects: project[];
	collections: (collection | undefined)[];
};

/**
 * Type definition for the success response structure
 */
type SuccessResponse = {
	success: true;
	collaborations: Collaborations;
};

/**
 * Type definition for the error response structure
 */
type ErrorResponse = {
	success: false;
	error: string;
};

/**
 * GET endpoint to retrieve collaborations for a specific wallet address
 *
 * @param {Request} request - The incoming HTTP request object
 * @param {Object} params - Route parameters
 * @param {string} params.walletAddress - The wallet address of the user to fetch collaborations for
 *
 * @returns {Promise<NextResponse>} A JSON response containing:
 * - On success: { success: true, collaborations: Collaborations }
 *   - projects: Array of projects the user has collaborated on
 *   - collections: Array of collections associated with those projects
 * - On error: { success: false, error: string } with 404 status code
 *
 * @throws {Error} If the user is not found or database query fails
 *
 * @example
 * // Success response
 * {
 *   success: true,
 *   collaborations: {
 *     projects: [...],
 *     collections: [...]
 *   }
 * }
 *
 * // Error response
 * {
 *   success: false,
 *   error: "User not found"
 * }
 */
export async function GET(
	request: Request,
	{ params }: { params: { walletAddress: string } }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
	const { walletAddress } = params;

	try {
		const collaborationsWithProjectsAndCollections = await prisma.user.findUniqueOrThrow({
			where: {
				walletAddress,
			},
			include: {
				collaborations: { include: { project: { include: { collection: true, category: true } } } },
			},
		});

		const collaborations: Collaborations = {
			projects: collaborationsWithProjectsAndCollections.collaborations.map((collaboration) => ({
				...collaboration.project,
				isOwnedByMe: collaboration.project.walletAddress === walletAddress,
				isPublished: collaboration.project.status === ProjectStatus.Publish,
				collection: undefined,
				category: collaboration.project.category?.name ?? 'Uncategorized',
			})),
			collections: collaborationsWithProjectsAndCollections.collaborations.map(
				(collaboration) => collaboration.project.collection ?? undefined
			),
		};

		// Filter out undefined collections
		collaborations.collections = collaborations.collections.filter((collection) => collection !== undefined);

		// Remove duplicate collections
		collaborations.collections = collaborations.collections.filter(
			(collection, index, self) => index === self.findIndex((c) => c?.collectionId === collection?.collectionId)
		);

		return NextResponse.json({ success: true, collaborations });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
	}
}
