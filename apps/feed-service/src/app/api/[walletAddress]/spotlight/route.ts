import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to update a user's spotlight visibility setting
 *
 * @route PUT /api/[walletAddress]/spotlight
 *
 * @param request - NextRequest object containing:
 *   - URL Parameters:
 *     - walletAddress: string - The user's wallet address (required)
 *   - Request Body:
 *     - showSpotlight: boolean - Whether to show the user in spotlight
 *
 * @returns NextResponse with one of:
 *   Success (200): { success: true, showSpotlight: boolean }
 *   Error (400) - Missing wallet address: { error: "Wallet address is required" }
 *   Error (500) - Server error: { error: "Internal server error" }
 */
export async function PUT(request: NextRequest, { params }: { params: { walletAddress: string } }) {
	try {
		const walletAddress = params.walletAddress;
		if (!walletAddress) return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
		const { showSpotlight }: { showSpotlight: boolean } = await request.json();
		const user = await prisma.user.update({ where: { walletAddress }, data: { showSpotlight } });
		return NextResponse.json({ success: true, showSpotlight: user.showSpotlight });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * API endpoint to get a user's spotlight visibility setting
 *
 * @route GET /api/[walletAddress]/spotlight
 *
 * @param request - NextRequest object containing:
 *   - URL Parameters:
 *     - walletAddress: string - The user's wallet address (required)
 *
 * @returns NextResponse with one of:
 *   Success (200): { success: true, showSpotlight: boolean }
 *   Error (400) - Missing wallet address: { error: "Wallet address is required" }
 *   Error (404) - User not found: { error: "User not found" }
 *   Error (500) - Server error: { error: "Internal server error" }
 */
export async function GET(request: NextRequest, { params }: { params: { walletAddress: string } }) {
	try {
		const walletAddress = params.walletAddress;
		if (!walletAddress) return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
		const user = await prisma.user.findUnique({ where: { walletAddress } });
		if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
		return NextResponse.json({ success: true, showSpotlight: user.showSpotlight });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
