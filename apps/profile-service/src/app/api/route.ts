import { prisma } from '@/lib/db';
import { user } from '@prisma/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Success = {
	success: true;
	profile?: user;
	profiles?: user[];
};

type Fail = {
	success: false;
	error?: string;
};

export async function GET(): Promise<NextResponse<Success | Fail>> {
	// Return the user profiles as JSON
	const profiles: user[] = await prisma.user.findMany();
	return NextResponse.json(
		{
			success: true,
			profiles,
		},
		{ status: 200 }
	);
}

export async function POST(req: Request): Promise<NextResponse<Success | Fail>> {
	const body = await req.json();

	// Create a new user from the request body
	const profile: user = await prisma.user.create({
		data: {
			...body,
			createdAt: new Date().getTime() / 1000,
		},
	});

	// Return the created user profile as JSON
	return NextResponse.json(
		{
			success: true,
			profile,
		},
		{ status: 201 }
	);
}
