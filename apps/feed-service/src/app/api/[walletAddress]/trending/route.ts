import { prisma } from '@/lib/db';
import { like, Prisma, ProductAudience } from '@prisma/client';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const dynamic = 'force-dynamic';

// Define the structure of a Post object
type Post = {
	id: number;
	likes: number;
	shares: number;
	views: number;
	trendingScore: number;
	createdAt: number;
	postedAt: number;
	reposts: number;
};

// Define the structure of a Feed object with nested relations
type Feed = Prisma.postGetPayload<{
	include: {
		content: {
			include: {
				collection: true;
				product: {
					include: {
						asset: true;
						voucher: true;
					};
				};
			};
		};
		parentPost: true;
		likes: true;
		createdBy: true;
		postedBy: true;
		comments: {
			include: {
				replies: { include: { createdByUser: true; likes: true } };
				createdByUser: true;
				likes: true;
			};
		};
	};
}>;

// Define the structure of a successful response
type Success = {
	success: true;
	feed: any[];
};

// Define the structure of a failed response
type Fail = {
	success: false;
	error?: string;
};

// Define the structure of the request parameters
type Props = { params: { walletAddress: string } };

// GET request handler for fetching trending posts
export async function GET(request: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	headers(); // Initialize headers

	// Get search query, page, and limit
	const search = request.nextUrl.searchParams.get('search');
	const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1');
	const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '5');

	const offset = (page - 1) * limit;

	// Fetch statistics from an external URL
	const response = await fetch(process.env.STATS_URL as string);
	// const response = await fetch("http://localhost:3000/api/stats");

	// Check if the response is successful
	if (!response.ok) {
		return NextResponse.json({ success: false, error: `Failed to fetch stats: ${response.statusText}` }, { status: response.status });
	}

	// Check if response has content
	const text = await response.text();
	if (!text || text.trim().length === 0) {
		return NextResponse.json({ success: false, error: 'Empty response from stats service' }, { status: 500 });
	}

	// Parse JSON with error handling
	let data;
	try {
		data = JSON.parse(text);
	} catch (error) {
		console.error('Failed to parse JSON response:', error);
		return NextResponse.json({ success: false, error: 'Invalid JSON response from stats service' }, { status: 500 });
	}

	const { stats } = data;
	const posts = stats?.posts;
	console.log(JSON.stringify(posts, null, 4));

	// Return an error response if no posts are found
	if (!posts) {
		return NextResponse.json({ success: false, error: 'No feed found' }, { status: 404 });
	}

	let feed: Feed[] = [];

	if (!search) {
		// Fetch the feed from the database for the page
		feed = await prisma.post.findMany({
			include: {
				content: {
					include: {
						collection: { include: { owner: { select: { userName: true, avatarUrl: true, walletAddress: true } } } },
						product: { include: { asset: true, voucher: true } },
					},
					where: {
						OR: [
							{
								product: {
									audience: ProductAudience.Public,
								},
							},
							{
								product: {
									ownerWalletAddress: params.walletAddress,
								},
							},
						],
					},
				},
				parentPost: true,
				likes: true,
				createdBy: true,
				postedBy: true,
				comments: { include: { replies: { include: { createdByUser: true, likes: true } }, createdByUser: true, likes: true } },
			},
			where: {
				id: {
					in: posts.map((post: Post) => post.id),
				},
				content: {
					some: {
						product: {
							audience: ProductAudience.Public,
						},
					},
				},
			},
			skip: offset,
			take: limit,
			orderBy: {
				createdAt: 'desc',
			},
		});
	} else {
		// Fetch the feed from the database for the search
		feed = await prisma.post.findMany({
			include: {
				content: {
					include: {
						collection: { include: { owner: { select: { userName: true, avatarUrl: true, walletAddress: true } } } },
						product: { include: { asset: true, voucher: true } },
					},
					where: {
						product: {
							audience: ProductAudience.Public,
						},
					},
				},
				parentPost: true,
				likes: true,
				createdBy: true,
				postedBy: true,
				comments: { include: { replies: { include: { createdByUser: true, likes: true } }, createdByUser: true, likes: true } },
			},
			where: {
				AND: [
					{
						content: {
							some: {
								product: {
									audience: ProductAudience.Public,
								},
							},
						},
					},
					{
						OR: [
							{
								createdBy: {
									OR: [
										{ userName: { contains: search, mode: 'insensitive' } },
										{ firstName: { contains: search, mode: 'insensitive' } },
										{ lastName: { contains: search, mode: 'insensitive' } },
									],
								},
							},

							{
								caption: { contains: search, mode: 'insensitive' },
							},

							{
								postedBy: {
									OR: [
										{ userName: { contains: search, mode: 'insensitive' } },
										{ firstName: { contains: search, mode: 'insensitive' } },
										{ lastName: { contains: search, mode: 'insensitive' } },
									],
								},
							},

							{
								content: {
									some: {
										product: {
											AND: [
												{
													OR: [
														{ name: { contains: search, mode: 'insensitive' } },
														{ description: { contains: search, mode: 'insensitive' } },
													],
												},
												{
													OR: [
														{ audience: ProductAudience.Public },
														{ ownerWalletAddress: params.walletAddress },
													],
												},
											],
										},
									},
								},
							},
						],
					},
				],
			},
			skip: offset,
			take: limit,
			orderBy: {
				createdAt: 'desc',
			},
		});
	}

	// Format the feed data for the response
	const formattedFeed = feed.map((post: Feed) => {
		return {
			id: post.id,
			likes: post.likes.length,
			likedByMe: post.likes.some((like: like) => like.fromWalletAddress === params.walletAddress),
			repost: post.createdByAddress !== post.postedByAddress || post.parentPostId !== null,
			shares: posts.filter((p: Post) => p.id === post.id)[0].shares,
			views: post.views,
			createdAt: post.createdAt,
			postedAt: post.postedAt,
			reposts: posts.filter((p: Post) => p.id === post.id)[0].reposts,
			content: post.content,
			comments: post.comments.map((c) => {
				return {
					...c,
					likedByMe: c.likes.some((like: like) => like.fromWalletAddress === params.walletAddress),
					likes: c.likes.length,
					replies: c.replies.map((r) => {
						return {
							...r,
							likedByMe: r.likes.some((like: like) => like.fromWalletAddress === params.walletAddress),
							likes: r.likes.length,
						};
					}),
				};
			}),
			parentPostId: post.parentPostId,
			parentPost: post.parentPost,
			caption: post.caption,
			createdBy: {
				firstName: post.createdBy.firstName,
				lastName: post.createdBy.lastName,
				avatarUrl: post.createdBy.avatarUrl,
				userName: post.createdBy.userName,
				walletAddress: post.createdBy.walletAddress,
				parentPost: post.parentPost,
			},
			postedBy: {
				firstName: post.postedBy.firstName,
				lastName: post.postedBy.lastName,
				avatarUrl: post.postedBy.avatarUrl,
				userName: post.postedBy.userName,
				walletAddress: post.postedBy.walletAddress,
			},
			chainId: post.content[0]?.collection?.chainId,
		};
	});

	// Log and return an error response if no stats are found
	if (!stats) {
		console.log(JSON.stringify({ success: false, error: 'No feed found' }));
		return NextResponse.json({ success: false, error: 'No feed found' }, { status: 404 });
	}

	// Return the formatted feed as a JSON response
	return NextResponse.json({ success: true, feed: formattedFeed });
}
