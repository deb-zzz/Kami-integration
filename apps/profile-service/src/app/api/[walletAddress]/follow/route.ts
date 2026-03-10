import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest, { params }: { params: { walletAddress: string } }) => {
	const { walletAddress } = params;
	const { follow }: { follow: string } = await req.json();
	try {
		await prisma.user.update({
			where: { walletAddress },
			data: {
				follows: {
					createMany: {
						data: [
							{
								createdAt: Date.now() / 1000,
								entityType: 'User',
								toWalletAddress: follow,
							},
						],
						skipDuplicates: true,
					},
				},
			},
		});
		return NextResponse.json({ message: 'User followed successfully' }, { status: 200 });
	} catch (error) {
		return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
	}
};

export const DELETE = async (req: NextRequest, { params }: { params: { walletAddress: string } }) => {
	const { walletAddress } = params;
	const { unfollow }: { unfollow: string } = await req.json();
	try {
		await prisma.user.update({
			where: { walletAddress },
			data: {
				followedBy: {
					deleteMany: {
						toWalletAddress: unfollow,
						entityType: 'User',
					},
				},
			},
		});
		return NextResponse.json({ message: 'User unfollowed successfully' }, { status: 200 });
	} catch (error) {
		return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
	}
};

export const GET = async (req: never, { params }: { params: { walletAddress: string } }) => {
	const { walletAddress } = params;
	try {
		const user = await prisma.user.findUniqueOrThrow({
			where: { walletAddress },
			include: { followedBy: true, follows: true },
		});

		return NextResponse.json(
			{
				followers: user.followedBy.map((f) => f.fromWalletAddress),
				following: user.follows.map((f) => f.toWalletAddress),
			},
			{ status: 200 }
		);
	} catch (error) {
		return NextResponse.json({ error: 'Failed to get follows' }, { status: 500 });
	}
};
