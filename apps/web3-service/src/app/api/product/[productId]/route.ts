import { PrismaClient } from '@prisma/client';
import { LikeType, ShareType, TipType } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { SupplyService, ProductService } from '@/services';

const prisma = new PrismaClient();

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
};

/**
 * Handles GET requests to fetch detailed information about a specific product.
 *
 * This function retrieves a product by its ID, including various related entities such as assets, vouchers, bundles, collections, likes, owner details, post content, tags, shares, and tips. It also fetches mentions related to the product.
 *
 * @param req - The request object, which is not utilized in this function.
 * @param params - An object containing route parameters.
 * @param params.productId - The ID of the product to fetch. This is expected to be a number.
 * @returns A Promise that resolves to a NextResponse object containing a JSON representation of the formatted product details. If an error occurs, it returns a JSON object with an error message and a 400 status code.
 */
export async function GET(req: NextRequest, { params }: { params: { productId: number } }): Promise<NextResponse> {
	// console.log('WEB3-SERVICE: Get Product Info');
	const { productId } = params;
	const walletAddress = req.nextUrl.searchParams.get('walletAddress') ?? undefined;
	console.log('PRODUCT:', productId);
	if (walletAddress) {
		console.log('WALLET ADDRESS:', walletAddress);
	}

	try {
		// Fetch mentions related to the product (non-blocking - if it fails, we'll use an empty array)
		let mentions: Mention[] | undefined = undefined;
		try {
			mentions = await getMentions(Number(productId), walletAddress);
		} catch (mentionError) {
			// Log but don't fail the entire request if mentions can't be fetched
			console.error('Error fetching mentions (non-blocking):', mentionError);
			mentions = undefined;
		}

		// Fetch the product details from the database
		const product = await prisma.product.findUniqueOrThrow({
			where: {
				id: Number(productId),
			},
			include: {
				asset: {
					include: {
						user: {
							select: { walletAddress: true, userName: true, avatarUrl: true },
						},
					},
				},
				voucher: true,
				bundle: true,
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
				likes: true,
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
				shares: true,
				tip: true,
			},
		});

		console.log('PRODUCT METADATA:', product.metadata);
		// Calculate supply-related fields using SupplyService
		const supplyInfo = ProductService.getSupplyInfo(product);

		// Format the product details for the response
		const formattedProduct = {
			...product,
			// Supply information for KAMI721AC
			maxQuantity: supplyInfo.maxQuantity,
			totalMinted: supplyInfo.totalMinted,
			isUnlimited: supplyInfo.isUnlimited,
			tokenType: supplyInfo.tokenType,
			collection: {
				...product.collection,
			},
			creator: product.project.user,
			collaborators: product.project?.collaborators,
			postContent: undefined, // Exclude posts from the response
			likes: product.likes.length,
			likedBy: product.likes.map((like: LikeType) => like.fromWalletAddress),
			likedByMe: walletAddress ? product.likes.some((like: LikeType) => like.fromWalletAddress === walletAddress) : false,
			shares: product.shares.length,
			sharedBy: product.shares.map((share: ShareType) => share.walletAddress),
			tip: product.tip?.reduce((acc: number, curr: TipType) => acc + curr.value.toNumber(), 0),
			mentions: mentions ?? [],
		};

		return NextResponse.json(formattedProduct);
	} catch (error) {
		// Handle errors by returning a JSON response with an error message
		return NextResponse.json({ error: 'Failed to fetch product: ' + (error as Error).message }, { status: 400 });
	}
}

/**
 * Fetches mentions associated with a given product ID.
 *
 * This function queries the database for posts that mention the specified product. It includes the number of likes and shares for each post and the wallet address of the user who created the post.
 *
 * @param productId - The ID of the product for which to fetch mentions. This is expected to be a number.
 * @returns A Promise that resolves to an array of Mention objects, each containing the post ID, caption, wallet address, number of likes, and number of shares. If an error occurs, it returns undefined.
 */
async function getMentions(productId: number, walletAddress?: string): Promise<Mention[] | undefined> {
	try {
		// Query the database for posts mentioning the product
		const m = await prisma.post.findMany({
			where: {
				content: {
					some: {
						productId: Number(productId),
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

		// Map the results to the Mention type
		return m.map((post) => ({
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
	} catch (error) {
		// Log and handle errors
		console.error('Error fetching mentions:', error);
		return undefined;
	}
}
