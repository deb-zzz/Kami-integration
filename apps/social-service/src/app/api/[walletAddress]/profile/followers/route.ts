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
			where: { toWalletAddress: params.walletAddress },
			include: {
				fromUser: {
					include: {
						postsCreated: {
							include: {
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
										collection: { select: { collectionId: true, name: true, avatarUrl: true, chainId: true } },
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
				followerWalletAddress: follow.fromWalletAddress,

				// The username of the user being followed
				followerUserName: follow.fromUser?.userName,

				// The avatar URL of the user being followed
				followerUserAvatarUrl: follow.fromUser?.avatarUrl,

				// Transform the posts created by the followed user
				posts: follow.fromUser?.postsCreated
					// Sort posts by their creation date in ascending order
					.toSorted((a, b) => a.createdAt - b.createdAt)
					.map((p) => {
						return {
							...p,

							// Count of users who shared the post
							shares: p.sharedBy.length,

							// Remove the sharedBy array from the output
							sharedBy: undefined,

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

		type ContentItem = {
			id: number;
			collectionId: number;
			productId: number | null;
			product: { audience: ProductAudience } | null;
			collection: { collectionId: number; name: string | null; avatarUrl: string | null; chainId: string | null };
		};
		// Return the transformed data as a JSON response
		// Map through output, filter out products from each post if product.audience !== ProductAudience.Public
		return NextResponse.json({
			success: true,
			followers: output.map((follower) => ({
				...follower,
				posts: follower.posts
					?.filter((post) => post.content) // filter out posts with null content
					.map((post) => ({
						...post,
						content: post.content
							? post.content
									.map((contentItem: ContentItem) => {
										// If product is present and its audience is not public, exclude this content item
										if (contentItem.product && contentItem.product.audience !== ProductAudience.Public) {
											return null;
										}
										return contentItem;
									})
									.filter((contentItem: ContentItem | null) => contentItem !== null)
							: undefined,
					})),
			})),
		});
	} catch (error) {
		// Log the error and return a 500 Internal Server Error response
		console.error(error);
		return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
}
