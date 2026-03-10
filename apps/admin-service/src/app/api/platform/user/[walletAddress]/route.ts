import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { UserProfileResponse, UserProfile, UserProfileErrorResponse } from '@/types/user-profile';

/**
 * Get user profile by wallet address
 *
 * @example
 * GET /api/platform/user/[walletAddress]
 *
 * Response:
 * {
 *   "success": true,
 *   "profile": {
 *     "walletAddress": "0x123...",
 *     "account": { "email": "user@example.com" },
 *     "counts": { "products": 10 },
 *     ...
 *   }
 * }
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ walletAddress: string }> },
): Promise<NextResponse<UserProfileResponse | UserProfileErrorResponse>> {
	const { walletAddress } = await params;

	if (!walletAddress) {
		return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
	}

	try {
		const user = await prisma.user.findUnique({
			where: { walletAddress },
			select: {
				// Basic Info
				walletAddress: true,
				userName: true,
				tagLine: true,
				description: true,
				firstName: true,
				lastName: true,
				avatarUrl: true,
				bannerUrl: true,
				idNumber: true,
				createdAt: true,
				updatedAt: true,

				// NFT & TBA
				nftAddresses: true,
				nftTokenId: true,
				tbaAddresses: true,

				// Socials
				fbUrl: true,
				instagramUrl: true,
				xUrl: true,
				linkedInUrl: true,
				farcasterId: true,
				youtubeUrl: true,
				telegramUrl: true,

				// Today's Pick
				todaysFilm: true,
				todaysMusic: true,
				todaysGame: true,
				todaysFood: true,
				todaysBeverage: true,
				todaysArt: true,

				// Pinned Post
				pinnedPost: {
					select: {
						id: true,
						caption: true,
						createdAt: true,
					},
				},

				// Tags
				tags: {
					select: {
						id: true,
						type: true,
						tag: true,
					},
				},

				_count: {
					select: {
						assets: true,
						project: true,
						product: true,
						collections: true,
						postsCreated: true,
						comments: true,
						likes: true,
						likedBy: true,
						follows: true,
						followedBy: true,
						subscriptions: true,
						ownedSubscriptions: true,
						cartItems: true,
						vouchers: true,
						notifications: true,
					},
				},
			},
		});

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Get account info
		const account = await prisma.account.findUnique({
			where: { walletAddress },
			select: {
				email: true,
				phone: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		// Get whitelist info
		const whitelist = await prisma.whitelist.findFirst({
			where: {
				OR: [{ walletAddress }, { email: account?.email || undefined }],
			},
			select: {
				id: true,
				createdAt: true,
			},
		});

		// Get tip info
		const [tipsReceived, tipsGiven, buyerOrders, sellerOrders] = await Promise.all([
			prisma.tip.aggregate({
				where: { toWalletAddress: walletAddress },
				_sum: { value: true },
				_count: true,
			}),
			prisma.tip.aggregate({
				where: { fromWalletAddress: walletAddress },
				_sum: { value: true },
				_count: true,
			}),
			prisma.order.aggregate({
				where: { fromWalletAddress: walletAddress },
				_sum: { amount: true },
				_count: true,
			}),
			prisma.order.aggregate({
				where: { toWalletAddress: walletAddress },
				_sum: { amount: true },
				_count: true,
			}),
		]);

		const profile: UserProfile = {
			walletAddress: user.walletAddress,
			userName: user.userName,
			tagLine: user.tagLine,
			description: user.description,
			firstName: user.firstName,
			lastName: user.lastName,
			avatarUrl: user.avatarUrl,
			bannerUrl: user.bannerUrl,
			idNumber: user.idNumber,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,

			account: {
				email: account?.email || null,
				phone: account?.phone || null,
				createdAt: account?.createdAt || null,
				updatedAt: account?.updatedAt || null,
			},

			nft: {
				nftAddresses: user.nftAddresses,
				nftTokenId: user.nftTokenId,
				tbaAddresses: user.tbaAddresses,
			},

			social: {
				fbUrl: user.fbUrl,
				instagramUrl: user.instagramUrl,
				xUrl: user.xUrl,
				linkedInUrl: user.linkedInUrl,
				farcasterId: user.farcasterId,
				youtubeUrl: user.youtubeUrl,
				telegramUrl: user.telegramUrl,
			},

			todays: {
				film: user.todaysFilm,
				music: user.todaysMusic,
				game: user.todaysGame,
				food: user.todaysFood,
				beverage: user.todaysBeverage,
				art: user.todaysArt,
			},

			pinnedPost: user.pinnedPost,

			tags: user.tags,

			counts: {
				// Content
				assets: user._count.assets,
				project: user._count.project,
				product: user._count.product,
				collections: user._count.collections,
				postsCreated: user._count.postsCreated,
				comments: user._count.comments,
				vouchers: user._count.vouchers,

				// Social
				likes: user._count.likes,
				likedBy: user._count.likedBy,
				follows: user._count.follows,
				followedBy: user._count.followedBy,

				// Subscriptions
				subscriptions: user._count.subscriptions,
				ownedSubscriptions: user._count.ownedSubscriptions,

				// Cart
				cartItems: user._count.cartItems,

				// Notifications
				notifications: user._count.notifications,
			},

			financials: {
				tipsReceived: {
					count: tipsReceived._count,
					total: tipsReceived._sum.value?.toNumber() || 0,
				},
				tipsGiven: {
					count: tipsGiven._count,
					total: tipsGiven._sum.value?.toNumber() || 0,
				},
				buyerOrders: {
					count: buyerOrders._count,
					total: buyerOrders._sum.amount?.toNumber() || 0,
				},
				sellerOrders: {
					count: sellerOrders._count,
					total: sellerOrders._sum.amount?.toNumber() || 0,
				},
			},

			whitelist: {
				status: !!whitelist,
				id: whitelist?.id || null,
				createdAt: whitelist?.createdAt || null,
			},
		};

		return NextResponse.json({
			success: true,
			profile,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: 'Internal server error' + (error instanceof Error ? error.message : 'Unknown error'),
			},
			{ status: 500 },
		);
	}
}
