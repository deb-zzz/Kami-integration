import { prisma } from '@/lib/db';
import { LikeType, ShareType } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

type Mention = {
	postId: number;
	caption: string;
	creatorWalletAddress: string;
	likes: number;
	shares: number;
	reposts?: number;
	postedBy: {
		walletAddress: string;
		userName: string;
		avatarUrl: string | null;
	};
	numComments?: number;
};

/**
 * GET /api/asset/[assetId]
 * Returns a single asset with full details: collection, project, product (when linked),
 * owner, tags, likes, shares, and mentions (posts that reference this asset).
 */
export async function GET(req: NextRequest, { params }: { params: { assetId: string } }): Promise<NextResponse> {
	const { assetId } = params;
	const walletAddress = req.nextUrl.searchParams.get('walletAddress') ?? undefined;

	const id = Number(assetId);
	if (Number.isNaN(id)) {
		return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
	}

	try {
		let mentions: Mention[] = [];
		try {
			mentions = await getMentionsForAsset(id, walletAddress);
		} catch (mentionError) {
			console.error('Error fetching mentions for asset (non-blocking):', mentionError);
		}

		const asset = await prisma.asset.findUnique({
			where: { id },
			include: {
				collection: true,
				project: {
					include: {
						collaborators: {
							include: {
								userProfile: {
									select: { avatarUrl: true, userName: true, tagLine: true, description: true },
								},
							},
						},
						user: {
							select: {
								walletAddress: true,
								userName: true,
								tagLine: true,
								description: true,
								avatarUrl: true,
							},
						},
					},
				},
				product: {
					include: {
						collection: true,
						project: {
							include: {
								user: {
									select: {
										walletAddress: true,
										userName: true,
										tagLine: true,
										description: true,
										avatarUrl: true,
									},
								},
							},
						},
						owner: {
							select: {
								walletAddress: true,
								userName: true,
								tagLine: true,
								description: true,
								avatarUrl: true,
							},
						},
						tags: { select: { tag: true, type: true } },
					},
				},
				user: {
					select: {
						walletAddress: true,
						userName: true,
						tagLine: true,
						description: true,
						avatarUrl: true,
					},
				},
				tags: { select: { tag: true, type: true } },
				likes: true,
				shares: true,
			},
		});

		if (!asset) {
			return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
		}

		const formattedProduct = asset.product
			? {
					...asset.product,
					price: asset.product.price ? asset.product.price.toString() : null,
					subscriptionValue: asset.product.subscriptionValue ? asset.product.subscriptionValue.toString() : null,
					creator: asset.product.project?.user,
					owner: asset.product.owner,
					collection: asset.product.collection,
					project: asset.product.project
						? {
								projectId: asset.product.project.id,
								name: asset.product.project.name,
								user: asset.product.project.user,
						  }
						: null,
			  }
			: null;

		const formattedAsset = {
			...asset,
			price: asset.price ? asset.price.toString() : null,
			subscriptionValue: asset.subscriptionValue ? asset.subscriptionValue.toString() : null,
			collection: asset.collection,
			creator: asset.project?.user ?? null,
			collaborators: asset.project?.collaborators,
			owner: asset.user,
			product: formattedProduct,
			tags: asset.tags,
			likes: asset.likes.length,
			likedBy: asset.likes.map((like: LikeType) => like.fromWalletAddress),
			likedByMe: walletAddress ? asset.likes.some((like: LikeType) => like.fromWalletAddress === walletAddress) : false,
			shares: asset.shares.length,
			sharedBy: asset.shares.map((share: ShareType) => share.walletAddress),
			mentions,
		};

		return NextResponse.json(formattedAsset);
	} catch (error) {
		console.error('Failed to fetch asset:', error);
		return NextResponse.json({ error: 'Failed to fetch asset: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * Fetches posts that reference this asset via postContent.assetId.
 */
async function getMentionsForAsset(assetId: number, walletAddress?: string): Promise<Mention[]> {
	const posts = await prisma.post.findMany({
		where: {
			content: {
				some: {
					assetId: assetId,
				},
			},
		},
		include: {
			likes: true,
			sharedBy: true,
			childPosts: {
				select: {
					id: true,
					parentPostId: true,
				},
			},
			postedBy: {
				select: {
					walletAddress: true,
					userName: true,
					avatarUrl: true,
				},
			},
			comments: { select: { id: true } },
		},
	});

	return posts.map((post) => ({
		postId: post.id,
		caption: post.caption ?? '',
		likes: post.likes.length,
		likedByMe: walletAddress ? post.likes.some((like) => like.fromWalletAddress === walletAddress) : false,
		shares: post.sharedBy.length,
		reposts: post.childPosts.length,
		creatorWalletAddress: post.createdByAddress,
		postedBy: post.postedBy,
		numComments: post.comments.length,
	}));
}
