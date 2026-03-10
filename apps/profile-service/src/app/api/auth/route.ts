import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { user } from '@prisma/client';

type AuthRequest = {
	email?: string;
	phoneNumber?: string;
	walletAddress: string;
};

type AuthResponse = {
	success: boolean;
	profile?: user;
	error?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse<AuthResponse>> {
	const body: AuthRequest = await request.json();
	const { walletAddress } = body;
	const profile = await prisma.user.findUnique({ where: { walletAddress } });
	if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
	return NextResponse.json({ success: true, profile });
}

type UsernameListResponse = {
	success: boolean;
	usernames: string[];
};

export async function GET(request: NextRequest): Promise<NextResponse<UsernameListResponse>> {
	const username = request.nextUrl.searchParams.get('username') ?? undefined;
	if (!username) return NextResponse.json({ success: true, usernames: [] });
	const usernames = await prisma.user.findMany({ where: { userName: { startsWith: username, mode: 'insensitive' } } });
	return NextResponse.json({ success: true, usernames: usernames.map((user) => user.userName) });
}
