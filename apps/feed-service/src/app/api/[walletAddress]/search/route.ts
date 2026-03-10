import { prisma } from '@/lib/db';
import { ProductAudience } from '@prisma/client';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import Redis from 'ioredis';

/**
 * Force dynamic rendering to ensure fresh data on each request
 */
const dynamic = 'force-dynamic';

/**
 * Represents the search results structure with segmented data
 */
type SearchResults = {
	profiles: any[];
	products: any[];
	collections: any[];
	tags: any[];
};

/**
 * Represents a successful API response
 */
type Success = {
	success: true;
	results: SearchResults;
};

/**
 * Represents a failed API response
 */
type Fail = {
	success: false;
	error: string;
};

/**
 * Represents the request parameters structure
 */
type Props = {
	params: {
		walletAddress: string;
	};
};

/**
 * Handles GET requests to search across Profiles, Products, and Collections
 * @async
 * @param {NextRequest} request - Next.js request object
 * @param {Props} params - Request parameters containing wallet address
 * @returns {Promise<NextResponse<Success | Fail>>} JSON response with segmented search results or error
 *
 * @description
 * This endpoint performs the following operations:
 * 1. Validates search query parameter
 * 2. Checks Redis cache for existing results
 * 3. Executes parallel database queries with database-level sorting
 * 4. Formats results for each entity type
 * 5. Caches results in Redis
 * 6. Returns segmented search results
 */
export async function GET(request: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	headers(); // Initialize headers

	try {
		// Extract and validate query parameters
		const searchQuery = request.nextUrl.searchParams.get('q');
		const tagFilter = request.nextUrl.searchParams.get('tag');
		const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '10');

		// Validate search query
		if (!searchQuery || searchQuery.trim().length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Search query parameter "q" is required',
				},
				{ status: 400 }
			);
		}

		// Truncate very long search queries
		const sanitizedQuery = searchQuery.trim().substring(0, 100);
		const sanitizedTag = tagFilter?.trim().substring(0, 100);

		// Initialize Redis client
		const redis = new Redis(process.env.REDIS_URL as string);

		// Check cache
		const cacheKey = `search:${params.walletAddress}:${sanitizedQuery}:${sanitizedTag || 'notag'}:${limit}`;
		const cachedResults = await redis.get(cacheKey);

		if (cachedResults) {
			await redis.quit();
			return NextResponse.json(JSON.parse(cachedResults));
		}

		// Execute parallel database queries
		const [profiles, products, collections, tags] = await Promise.all([
			// Profile search query - sorted by createdAt at DB, then re-sorted in-memory for collaboration/follow priority
			prisma.user.findMany({
				where: {
					AND: [
						{
							OR: [
								{ userName: { contains: sanitizedQuery, mode: 'insensitive' } },
								{ firstName: { contains: sanitizedQuery, mode: 'insensitive' } },
								{ lastName: { contains: sanitizedQuery, mode: 'insensitive' } },
							],
						},
						...(sanitizedTag
							? [
									{
										tags: {
											some: {
												tag: { contains: sanitizedTag, mode: 'insensitive' as const },
											},
										},
									},
							  ]
							: []),
					],
				},
				select: {
					walletAddress: true,
					userName: true,
					firstName: true,
					lastName: true,
					avatarUrl: true,
					tagLine: true,
					bannerUrl: true,
					createdAt: true,
					tags: {
						select: {
							id: true,
							tag: true,
							type: true,
						},
					},
					followedBy: {
						where: { fromWalletAddress: params.walletAddress },
						select: { fromWalletAddress: true },
					},
					project: {
						where: {
							collaborators: {
								some: {
									userWalletAddress: params.walletAddress,
									status: 'Accepted',
								},
							},
						},
						select: { id: true },
					},
				},
				orderBy: {
					createdAt: 'desc',
				},
				take: limit * 3,
			}),

			// Product search query - sorted by createdAt at DB, then re-sorted in-memory for ownership/collaboration/likes priority
			prisma.product.findMany({
				where: {
					AND: [
						{ name: { contains: sanitizedQuery, mode: 'insensitive' } },
						{
							OR: [{ audience: ProductAudience.Public }, { ownerWalletAddress: params.walletAddress }],
						},
						...(sanitizedTag
							? [
									{
										tags: {
											some: {
												tag: { contains: sanitizedTag, mode: 'insensitive' as const },
											},
										},
									},
							  ]
							: []),
					],
				},
				include: {
					owner: {
						select: {
							walletAddress: true,
							userName: true,
							avatarUrl: true,
							firstName: true,
							lastName: true,
						},
					},
					tags: {
						select: {
							id: true,
							tag: true,
							type: true,
						},
					},
					asset: {
						select: {
							mediaUrl: true,
							thumbnailUrl: true,
							animationUrl: true,
						},
					},
					voucher: {
						select: {
							mediaUrl: true,
							animationUrl: true,
						},
					},
					collection: {
						select: {
							collectionId: true,
							name: true,
							avatarUrl: true,
						},
					},
					likes: {
						where: {
							fromWalletAddress: params.walletAddress,
						},
						select: {
							id: true,
						},
					},
					follows: {
						where: {
							fromWalletAddress: params.walletAddress,
						},
						select: {
							id: true,
						},
					},
					project: {
						select: {
							collaborators: {
								where: {
									userWalletAddress: params.walletAddress,
									status: 'Accepted',
								},
								select: { userWalletAddress: true },
							},
						},
					},
				},
				orderBy: {
					createdAt: 'desc',
				},
				take: limit * 3,
			}),

			// Collection search query - sorted by createdAt at DB, then re-sorted in-memory for ownership/collaboration/follows priority
			prisma.collection.findMany({
				where: {
					AND: [
						{ name: { contains: sanitizedQuery, mode: 'insensitive' } },
						...(sanitizedTag
							? [
									{
										products: {
											some: {
												tags: {
													some: {
														tag: { contains: sanitizedTag, mode: 'insensitive' as const },
													},
												},
											},
										},
									},
							  ]
							: []),
					],
				},
				include: {
					owner: {
						select: {
							walletAddress: true,
							userName: true,
							avatarUrl: true,
							firstName: true,
							lastName: true,
						},
					},
					products: {
						where: {
							OR: [{ audience: ProductAudience.Public }, { ownerWalletAddress: params.walletAddress }],
						},
						take: limit,
						select: {
							id: true,
							name: true,
							tags: {
								select: {
									id: true,
									tag: true,
									type: true,
								},
							},
							asset: {
								select: {
									mediaUrl: true,
									thumbnailUrl: true,
								},
							},
							voucher: {
								select: {
									mediaUrl: true,
								},
							},
						},
						orderBy: {
							createdAt: 'desc',
						},
					},
					followers: {
						where: { walletAddress: params.walletAddress },
						select: {
							walletAddress: true,
						},
					},
					project: {
						select: {
							collaborators: {
								where: {
									userWalletAddress: params.walletAddress,
									status: 'Accepted',
								},
								select: { userWalletAddress: true },
							},
						},
					},
				},
				orderBy: {
					createdAt: 'desc',
				},
				take: limit * 3,
			}),

			// Tag search query - search for tags matching the query
			prisma.tag.findMany({
				where: {
					tag: { contains: sanitizedQuery, mode: 'insensitive' },
				},
				select: {
					id: true,
					tag: true,
					type: true,
					createdAt: true,
					_count: {
						select: {
							users: true,
							products: true,
							assets: true,
							vouchers: true,
						},
					},
				},
				orderBy: {
					tag: 'asc',
				},
				take: limit,
			}),
		]);

		// Re-sort profiles in-memory: collaborated first, followed second (createdAt already sorted at DB level)
		const sortedProfiles = profiles.sort((a, b) => {
			const aIsCollaborator = a.project.length > 0;
			const bIsCollaborator = b.project.length > 0;

			if (aIsCollaborator && !bIsCollaborator) return -1;
			if (!aIsCollaborator && bIsCollaborator) return 1;

			const aIsFollowed = a.followedBy.length > 0;
			const bIsFollowed = b.followedBy.length > 0;

			if (aIsFollowed && !bIsFollowed) return -1;
			if (!aIsFollowed && bIsFollowed) return 1;

			return 0; // Maintain DB sort order (createdAt desc)
		});

		// Re-sort products in-memory: owned first, collaborated second, liked third (createdAt already sorted at DB level)
		const sortedProducts = products.sort((a, b) => {
			const aIsOwned = a.ownerWalletAddress === params.walletAddress;
			const bIsOwned = b.ownerWalletAddress === params.walletAddress;

			if (aIsOwned && !bIsOwned) return -1;
			if (!aIsOwned && bIsOwned) return 1;

			const aIsCollaborator = a.project.collaborators.length > 0;
			const bIsCollaborator = b.project.collaborators.length > 0;

			if (aIsCollaborator && !bIsCollaborator) return -1;
			if (!aIsCollaborator && bIsCollaborator) return 1;

			const aIsLiked = a.likes.length > 0;
			const bIsLiked = b.likes.length > 0;

			if (aIsLiked && !bIsLiked) return -1;
			if (!aIsLiked && bIsLiked) return 1;

			return 0; // Maintain DB sort order (createdAt desc)
		});

		// Re-sort collections in-memory: owned first, collaborated second, followed third (createdAt already sorted at DB level)
		const sortedCollections = collections.sort((a, b) => {
			const aIsOwned = a.ownerWalletAddress === params.walletAddress;
			const bIsOwned = b.ownerWalletAddress === params.walletAddress;

			if (aIsOwned && !bIsOwned) return -1;
			if (!aIsOwned && bIsOwned) return 1;

			const aIsCollaborator = a.project.collaborators.length > 0;
			const bIsCollaborator = b.project.collaborators.length > 0;

			if (aIsCollaborator && !bIsCollaborator) return -1;
			if (!aIsCollaborator && bIsCollaborator) return 1;

			const aIsFollowed = a.followers.length > 0;
			const bIsFollowed = b.followers.length > 0;

			if (aIsFollowed && !bIsFollowed) return -1;
			if (!aIsFollowed && bIsFollowed) return 1;

			return 0; // Maintain DB sort order (createdAt desc)
		});

		// Format profile results
		const formattedProfiles = sortedProfiles.map((profile) => ({
			walletAddress: profile.walletAddress,
			userName: profile.userName,
			displayName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.userName,
			firstName: profile.firstName,
			lastName: profile.lastName,
			avatarUrl: profile.avatarUrl,
			bannerUrl: profile.bannerUrl,
			tagLine: profile.tagLine,
			tags: profile.tags.map((t) => ({
				id: t.id,
				tag: t.tag,
				type: t.type,
			})),
			followerCount: profile.followedBy.length,
			isFollowing: profile.followedBy.some((f) => f.fromWalletAddress === params.walletAddress),
		}));

		// Format product results
		const formattedProducts = sortedProducts.map((product) => ({
			id: product.id,
			name: product.name,
			description: product.description,
			price: product.price?.toString(),
			currency: product.currencySymbol,
			type: product.type,
			audience: product.audience,
			availableQuantity: product.availableQuantity,
			forSale: product.forSale,
			tags: product.tags.map((t) => ({
				id: t.id,
				tag: t.tag,
				type: t.type,
			})),
			mediaUrl:
				product.asset[0]?.thumbnailUrl ||
				product.asset[0]?.mediaUrl ||
				product.voucher?.mediaUrl ||
				product.asset[0]?.animationUrl ||
				product.voucher?.animationUrl,
			owner: {
				walletAddress: product.owner.walletAddress,
				userName: product.owner.userName,
				displayName: `${product.owner.firstName || ''} ${product.owner.lastName || ''}`.trim() || product.owner.userName,
				avatarUrl: product.owner.avatarUrl,
			},
			collection: product.collection
				? {
						id: product.collection.collectionId,
						name: product.collection.name,
						avatarUrl: product.collection.avatarUrl,
				  }
				: null,
			isLiked: product.likes.length > 0,
			isFollowing: product.follows.length > 0,
			isOwned: product.ownerWalletAddress === params.walletAddress,
		}));

		// Format collection results
		const formattedCollections = sortedCollections.map((collection) => ({
			collectionId: collection.collectionId,
			name: collection.name,
			description: collection.description,
			avatarUrl: collection.avatarUrl,
			bannerUrl: collection.bannerUrl,
			symbol: collection.symbol,
			chainId: collection.chainId,
			contractAddress: collection.contractAddress,
			itemCount: collection.products.length,
			previewItems: collection.products.map((p) => ({
				id: p.id,
				name: p.name,
				tags: p.tags.map((t) => ({
					id: t.id,
					tag: t.tag,
					type: t.type,
				})),
				mediaUrl: p.asset[0]?.thumbnailUrl || p.asset[0]?.mediaUrl || p.voucher?.mediaUrl,
			})),
			owner: {
				walletAddress: collection.owner.walletAddress,
				userName: collection.owner.userName,
				displayName: `${collection.owner.firstName || ''} ${collection.owner.lastName || ''}`.trim() || collection.owner.userName,
				avatarUrl: collection.owner.avatarUrl,
			},
			followerCount: collection.followers.length,
			isFollowing: collection.followers.some((f) => f.walletAddress === params.walletAddress),
			isOwned: collection.ownerWalletAddress === params.walletAddress,
		}));

		// Format tag results
		const formattedTags = tags.map((tag) => ({
			id: tag.id,
			tag: tag.tag,
			type: tag.type,
			createdAt: tag.createdAt,
			usageCount: {
				users: tag._count.users,
				products: tag._count.products,
				assets: tag._count.assets,
				vouchers: tag._count.vouchers,
				total: tag._count.users + tag._count.products + tag._count.assets + tag._count.vouchers,
			},
		}));

		// Build response (simplified, no pagination metadata)
		const response: Success = {
			success: true,
			results: {
				profiles: formattedProfiles,
				products: formattedProducts,
				collections: formattedCollections,
				tags: formattedTags,
			},
		};

		// Cache results for 5 minutes (300 seconds)
		await redis.setex(cacheKey, 300, JSON.stringify(response));
		await redis.quit();

		return NextResponse.json(response);
	} catch (error) {
		console.error('Search error:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'An error occurred while processing your search request',
			},
			{ status: 500 }
		);
	}
}
