import { prisma } from '@/lib/db';
import { ProductAudience, like } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type Props = { params: { walletAddress: string } };

export async function GET(request: NextRequest, { params }: Props) {
	const { walletAddress } = params;

	const { success, error, data } = await getFavourites(walletAddress);

	return NextResponse.json({ success, error, data });
}

async function getFavourites(walletAddress: string) {
	try {
		const favourites = await prisma.post.findMany({
			where: {
				likes: {
					some: {
						fromWalletAddress: walletAddress,
					},
				},
				content: {
					some: {
						product: {
							audience: ProductAudience.Public,
						},
					},
				},
			},
			include: {
				likes: true,
				comments: { include: { replies: { include: { createdByUser: true, likes: true } }, createdByUser: true, likes: true } },
				content: {
					include: {
						// collection: true,
						product: { include: { asset: true, voucher: true } },
						collection: { include: { owner: { select: { userName: true, avatarUrl: true, walletAddress: true } } } },
					},
					where: {
						product: {
							audience: ProductAudience.Public,
						},
					},
				},
				parentPost: true,
				createdBy: { select: { userName: true, avatarUrl: true, walletAddress: true, description: true } },
				postedBy: { select: { userName: true, avatarUrl: true, walletAddress: true, description: true } },
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		const data = favourites.map((favourite) => ({
			...favourite,
			repost: favourite.createdByAddress !== favourite.postedByAddress || favourite.parentPostId !== null,
			content: favourite.content,
			likedByMe: favourite.likes.some((like) => like.fromWalletAddress === walletAddress),
			likes: favourite.likes.length,
			comments: favourite.comments.map((c) => {
				return {
					...c,
					likedByMe: c.likes.some((like: like) => like.fromWalletAddress === walletAddress),
					likes: c.likes.length,
					replies: c.replies.map((r) => {
						return {
							...r,
							likedByMe: r.likes.some((like: like) => like.fromWalletAddress === walletAddress),
							likes: r.likes.length,
						};
					}),
				};
			}),
			views: favourite.views,
			createdAt: favourite.createdAt,
			postedAt: favourite.postedAt,
			chainId: favourite.content[0].collection.chainId,
		}));

		return { success: true, error: null, data };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : error };
	}
}
