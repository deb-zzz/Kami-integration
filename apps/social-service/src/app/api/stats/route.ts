import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createClient } from 'redis';

/**
 * Type definition for the statistics data structure.
 */
type Stats = {
	generatedAt: number; // Timestamp when the stats were generated
	general: {
		totalUsers: number; // Total number of users
		totalPosts: number; // Total number of posts
		totalCollections: number; // Total number of collections
		totalLikes: number; // Total number of likes
		totalFollows: number; // Total number of follows
	};
	today: {
		totalUsers: number; // Number of users created today
		totalPosts: number; // Number of posts created today
		totalCollections: number; // Number of collections created today
		totalLikes: number; // Number of likes given today
		totalFollows: number; // Number of follows made today
	};
	posts: {
		id: number; // Post ID
		likes: number; // Number of likes on the post
		shares: number; // Number of shares of the post
		views: number; // Number of views of the post
		trendingScore: number; // Calculated trending score of the post
		createdAt: number; // Timestamp when the post was created
		postedAt: number; // Timestamp when the post was posted
		reposts: number; // Number of reposts
	}[];
	profiles: {
		walletAddress: string; // User's wallet address
		followedBy: number; // Number of followers
		follows: number; // Number of users followed
		likes: number; // Number of likes received
	}[];
	collections: {
		id: number; // Collection ID
		likes: number; // Number of likes on the collection
		shares: number; // Number of shares of the collection
	}[];
};

/**
 * Weight map for calculating trending scores.
 */
const weight: Map<string, number> = new Map([
	['likes', 0.3],
	['shares', 0.4],
	['views', 0.2],
	['timeDecay', 0.1], // Time decay weight
]);

/**
 * Handles POST requests to generate and return statistics.
 * @returns {Promise<NextResponse>} JSON response with the statistics.
 */
export async function POST() {
	return NextResponse.json(await getStatsFromDatabase());
}

/**
 * Handles GET requests to retrieve statistics.
 * @returns {Promise<NextResponse<{ success: boolean; stats: Stats }>>} JSON response with success status and statistics.
 */
export async function GET(): Promise<
	NextResponse<{
		success: boolean;
		stats: Stats;
	}>
> {
	let stats = await getStatsFromCache();
	if (stats) {
		return NextResponse.json({ success: true, stats });
	}

	stats = await getStatsFromDatabase();
	return NextResponse.json({ success: true, stats });
}

/**
 * Retrieves statistics from the cache.
 * @returns {Promise<Stats | undefined>} The cached statistics or undefined if not found.
 */
async function getStatsFromCache(): Promise<Stats | undefined> {
	const cache = createClient({ url: process.env.REDIS_URL as string });
	cache.on('error', (err) => console.error('Redis Client Error', err));
	await cache.connect();
	const stats = await cache.get('stats');
	cache.disconnect();
	return stats !== null ? JSON.parse(stats) : undefined;
}

/**
 * Retrieves statistics from the database and updates the cache.
 * @returns {Promise<Stats>} The statistics retrieved from the database.
 */
async function getStatsFromDatabase(): Promise<Stats> {
	const generatedAt = Date.now() / 1000;

	// Fetch general statistics
	const totalUsers = await prisma.user.count();
	const totalPosts = await prisma.post.count();
	const totalCollections = await prisma.collection.count();
	const totalLikes = await prisma.like.count();
	const totalFollows = await prisma.follow.count();

	// Fetch today's statistics
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const totalUsersToday = await prisma.user.count({
		where: {
			createdAt: {
				gte: today.getTime() / 1000,
			},
		},
	});
	const totalPostsToday = await prisma.post.count({
		where: {
			createdAt: {
				gte: today.getTime() / 1000,
			},
		},
	});
	const totalCollectionsToday = await prisma.collection.count({
		where: {
			createdAt: {
				gte: today.getTime() / 1000,
			},
		},
	});
	const totalLikesToday = await prisma.like.count({
		where: {
			createdAt: {
				gte: today.getTime() / 1000,
			},
		},
	});
	const totalFollowsToday = await prisma.follow.count({
		where: {
			createdAt: {
				gte: today.getTime() / 1000,
			},
		},
	});

	// Fetch and format posts
	const posts = await prisma.post.findMany({
		select: {
			id: true,
			createdByAddress: true,
			postedByAddress: true,
			sharedBy: true,
			views: true,
			createdAt: true,
			postedAt: true,
			content: { include: { product: true } },
		},
		orderBy: {
			createdAt: 'desc',
		},
	});

	const formattedPosts = await Promise.all(
		posts.map(async (post) => {
			const likesCount = await prisma.like.count({
				where: {
					postId: post.id,
				},
			});
			// Count reposts where createdByAddress is different from postedByAddress
			const repostsCount = await prisma.post.count({
				where: {
					createdByAddress: {
						not: post.postedByAddress,
					},
				},
			});
			return {
				id: post.id,
				likes: likesCount,
				shares: post.sharedBy.length,
				views: post.views,
				trendingScore:
					likesCount * weight.get('likes')! +
					post.sharedBy.length * weight.get('shares')! +
					post.views * weight.get('views')! +
					1 / (1 + (weight.get('timeDecay')! * (Date.now() - post.createdAt)) / 3600),
				createdAt: post.createdAt,
				postedAt: post.postedAt,
				reposts: repostsCount,
			};
		})
	);

	// Fetch and format profiles
	const profiles = await prisma.user.findMany({
		select: {
			walletAddress: true,
		},
	});

	const formattedProfiles = await Promise.all(
		profiles.map(async (profile) => {
			const followedByCount = await prisma.follow.count({
				where: {
					toWalletAddress: profile.walletAddress,
				},
			});
			const followsCount = await prisma.follow.count({
				where: {
					fromWalletAddress: profile.walletAddress,
				},
			});
			const likesCount = await prisma.like.count({
				where: {
					toWalletAddress: profile.walletAddress,
				},
			});
			return {
				walletAddress: profile.walletAddress,
				followedBy: followedByCount,
				follows: followsCount,
				likes: likesCount,
			};
		})
	);

	// Fetch and format collections
	const collections = await prisma.collection.findMany({
		select: {
			collectionId: true,
			shares: true,
		},
	});

	const formattedCollections = await Promise.all(
		collections.map(async (collection) => {
			const likesCount = await prisma.like.count({
				where: {
					collectionCollectionId: collection.collectionId,
				},
			});
			return {
				id: collection.collectionId,
				likes: likesCount,
				shares: collection.shares.length,
			};
		})
	);

	// Compile all statistics
	const stats: Stats = {
		generatedAt,
		general: {
			totalUsers,
			totalPosts,
			totalCollections,
			totalLikes,
			totalFollows,
		},
		today: {
			totalUsers: totalUsersToday,
			totalPosts: totalPostsToday,
			totalCollections: totalCollectionsToday,
			totalLikes: totalLikesToday,
			totalFollows: totalFollowsToday,
		},
		posts: formattedPosts.sort((a, b) => b.trendingScore - a.trendingScore),
		profiles: formattedProfiles,
		collections: formattedCollections,
	};

	// Update cache with new statistics
	const cache = createClient({ url: process.env.REDIS_URL as string });
	cache.on('error', (err) => console.error('Redis Client Error', err));
	await cache.connect();
	await cache.set('stats', JSON.stringify(stats), {
		EX: 60 * 6, // 6 minutes
	});
	await cache.disconnect();
	return stats;
}
