import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client/edge';
import { NextRequest, NextResponse } from 'next/server';

// Type definition for a User object with selected fields
type User = Prisma.userGetPayload<{
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
}>;

// Type definition for a successful response containing users
type UserResponse = {
	success: true;
	users: User[];
};

// Type definition for an error response
type ErrorResponse = {
	success: false;
	error: string;
};

/**
 * Handles GET requests to search for users based on wallet address and optional search query.
 *
 * @param request - The incoming request object from Next.js
 * @param params - An object containing the wallet address as a parameter
 * @returns A promise that resolves to a NextResponse containing either a UserResponse or an ErrorResponse
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ walletAddress: string }> }
): Promise<NextResponse<UserResponse | ErrorResponse>> {
	const { walletAddress } = await params;
	const search = (await request.nextUrl.searchParams.get('s')) ?? undefined;

	let where: Prisma.userWhereInput = {};

	if (!search) {
		// If no search query is provided, find users followed by the given wallet address
		where = { follows: { some: { fromWalletAddress: walletAddress } } };
	} else {
		// If a search query is provided, search users by userName, description, or tags
		where = {
			OR: [
				{
					userName: {
						contains: search,
						mode: 'insensitive',
					},
				},
				{
					description: {
						contains: search,
						mode: 'insensitive',
					},
				},
				{
					tags: {
						some: {
							tag: { contains: search, mode: 'insensitive' },
						},
					},
				},
			],
		};
	}

	// Query the database for users matching the search criteria
	const users: User[] = await prisma.user.findMany({
		where,
		select: {
			walletAddress: true,
			userName: true,
			description: true,
			avatarUrl: true,
			tags: true,
		},
	});

	// Return a JSON response with the search results
	return NextResponse.json({ success: true, users });
}
