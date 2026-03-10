import { prisma } from '@/lib/db';
import { ProductAudience } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * Handles GET requests to retrieve the list of users that a specific wallet address is following.
 *
 * @param req - The request object (not used in this function).
 * @param params - An object containing the wallet address as a parameter.
 * @returns A JSON response with the list of followed users and their posts.
 */
export async function GET(req: never, { params }: { params: { walletAddress: string } }) {
	try {
		// Fetch the list of users that the given wallet address is following
		const following = await prisma.follow.findMany({
			where: { fromWalletAddress: params.walletAddress },
			include: {
				toUser: {
					include: {
						postsCreated: {
							include: {
								parentPost: true,
								createdBy: { select: { userName: true, avatarUrl: true, walletAddress: true, description: true } },
								postedBy: { select: { userName: true, avatarUrl: true, walletAddress: true, description: true } },
								comments: {
									include: {
										replies: { include: { likes: true, createdByUser: true } },
										likes: true,
										createdByUser: true,
									},
								},
								likes: true,
								sharedBy: true,
								content: {
									include: {
										product: {
											include: { asset: true, voucher: true, bundle: true },
											where: { audience: { equals: ProductAudience.Public } },
										},
										collection: {
											include: { owner: { select: { userName: true, avatarUrl: true, walletAddress: true } } },
										},
									},
								},
							},
						},
					},
				},
			},
		});

		// Transform the list of followed users into the desired output format
		const output = following.map((follow) => {
			return {
				// The wallet address of the user being followed
				followedWalletAddress: follow.toWalletAddress,

				// The username of the user being followed
				followedUserName: follow.toUser?.userName,

				// The avatar URL of the user being followed
				followedUserAvatarUrl: follow.toUser?.avatarUrl,

				// Transform the posts created by the followed user
				posts: follow.toUser?.postsCreated
					// Sort posts by their creation date in ascending order
					.toSorted((a, b) => a.createdAt - b.createdAt)
					.map((p) => {
						return {
							...p,
							repost: p.createdByAddress !== p.postedByAddress || p.parentPostId !== null,
							// Count of users who shared the post
							shares: p.sharedBy.length,

							// Remove the sharedBy array from the output
							sharedBy: undefined,

							parentPostId: p.parentPostId,
							parentPost: p.parentPost,

							// Count of likes on the post
							likes: p.likes.length,

							// Transform the comments on the post
							comments: p.comments.map((c) => {
								return {
									...c,

									// Check if the current user liked the comment
									likedByMe: c.likes.some((like) => like.fromWalletAddress === params.walletAddress),

									// Count of likes on the comment
									likes: c.likes.length,

									// Transform the replies to the comment
									replies: c.replies.map((r) => {
										return {
											...r,

											// Check if the current user liked the reply
											likedByMe: r.likes.some((like) => like.fromWalletAddress === params.walletAddress),

											// Count of likes on the reply
											likes: r.likes.length,
										};
									}),
								};
							}),
						};
					}),
			};
		});

		// Return the transformed data as a JSON response
		return NextResponse.json({ success: true, following: output });
	} catch (error) {
		// Log the error and return a 500 Internal Server Error response
		console.error(error);
		return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
}
