import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest, { params }: { params: { walletAddress: string } }) => {
	const { walletAddress } = params;
	const { post_id }: { post_id: number } = await req.json();

	try {
		const user = await prisma.user.update({
			where: { walletAddress },
			data: {
				pinnedPostId: post_id === 0 ? null : post_id,
			},
		});

		return NextResponse.json({ success: true, user });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ error: 'Failed to pin post: ' + (error as Error).message }, { status: 500 });
	}
};

export const GET = async (req: NextRequest, { params }: { params: { walletAddress: string } }) => {
	const { walletAddress } = params;

	const user = await prisma.user.findUnique({
		where: { walletAddress },
		include: {
			pinnedPost: {
				include: {
					comments: { include: { likes: true } },
					content: { include: { collection: true, product: { include: { asset: true, voucher: true } } } },
					likes: true,
					createdBy: true,
					postedBy: true,
					sharedBy: true,
				},
			},
		},
	});

	if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

	const pinnedPost = user.pinnedPost;
	if (!pinnedPost) return NextResponse.json({ error: 'No pinned post found' }, { status: 404 });

	return NextResponse.json({ success: true, pinnedPost });
};
