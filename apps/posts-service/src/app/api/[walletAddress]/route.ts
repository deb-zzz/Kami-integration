/**
 * @fileoverview API routes for posts scoped by wallet address.
 *
 * @route GET /api/[walletAddress]
 *   List all posts created by the given wallet address.
 *
 * @route POST /api/[walletAddress]
 *   Create a new post for the given wallet address with optional content and caption.
 *
 * Path params:
 *   - walletAddress (string): Ethereum-style wallet address of the post creator/owner.
 *
 * GET: No query or body. Returns posts with comments (incl. replies, likes), content,
 * likes, createdBy, postedBy, sharedBy, parentPost, childPosts.
 *
 * POST body:
 *   - contentIDs: { collectionId: number; productId?: number; assetId?: number }[]
 *   - comment?: string
 *   - status?: 'Published' | 'Draft' (default: 'Published')
 *
 * POST validates that all collectionIds belong to published projects and, when assetId
 * is provided, that the asset exists, matches collection/product, and its project is published.
 * Any user can post about any asset (no ownership check).
 */

import { prisma } from '@/lib/db';
import { Fail, PostData, Success } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

type Props = { params: { walletAddress: string } };

/**
 * GET /api/[walletAddress] — List posts by creator wallet.
 *
 * @description Returns all posts where createdByAddress matches the path wallet address.
 * No request body or query params.
 *
 * @param _request - NextRequest (unused).
 * @param context - Route context; must include params.walletAddress.
 * @param context.params.walletAddress - Ethereum-style wallet address of the post creator.
 * @returns NextResponse<Success | Fail>
 *   - Success (200): { success: true, posts: PostData[] }
 *   - Fail (400): { success: false, error: 'Missing wallet address parameter' }
 */
export async function GET(_: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	const walletAddress = params.walletAddress;
	if (!walletAddress) {
		return NextResponse.json({ success: false, error: 'Missing wallet address parameter' }, { status: 400 });
	}

	const posts: PostData[] = await prisma.post.findMany({
		where: { createdByAddress: walletAddress },
		include: {
			comments: { include: { likes: true, replies: { include: { likes: true } } } },
			content: { include: { collection: true, product: { include: { asset: true, voucher: true } }, asset: true } },
			likes: true,
			createdBy: true,
			postedBy: true,
			sharedBy: true,
			parentPost: true,
			childPosts: true,
		},
	});

	return NextResponse.json({ success: true, posts });
}

/** Request body for creating a post. */
type Content = {
	contentIDs: {
		collectionId: number;
		productId?: number;
		assetId?: number;
	}[];
	comment?: string;
	status?: 'Published' | 'Draft';
};

/**
 * POST /api/[walletAddress] — Create a new post.
 *
 * @description Validates contentIDs against published collections, creates the post and postContent records.
 * Request body must be JSON with contentIDs; comment and status are optional.
 *
 * @param req - NextRequest; body parsed as Content.
 * @param context - Route context; must include params.walletAddress.
 * @param context.params.walletAddress - Wallet address of the post creator/owner.
 * @returns NextResponse<Success | Fail>
 *   - Success (200): { success: true }
 *   - Fail (400): { success: false, error } — missing wallet, or 'Some content IDs are invalid'
 *   - Fail (500): { success: false, error: string } — server/DB error
 */
export async function POST(req: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	try {
		const walletAddress = params.walletAddress;
		if (!walletAddress) {
			return NextResponse.json({ success: false, error: 'Missing wallet address parameter' }, { status: 400 });
		}

		const { contentIDs, comment, status = 'Published' } = (await req.json()) as Content;

		// Ensure every collectionId exists and belongs to a published project
		const collections = await prisma.collection.findMany({
			where: { collectionId: { in: contentIDs.map(({ collectionId }) => collectionId) }, project: { status: 'Publish' } },
		});
		if (collections.length !== contentIDs.length) {
			return NextResponse.json({ success: false, error: 'Some content IDs are invalid' }, { status: 400 });
		}

		// For each item with assetId: validate asset exists, matches collection/product, project published
		const assetIds = contentIDs.map((c) => c.assetId).filter((id): id is number => id != null);
		if (assetIds.length > 0) {
			const assets = await prisma.asset.findMany({
				where: { id: { in: assetIds } },
				include: { project: true },
			});
			const assetById = new Map(assets.map((a) => [a.id, a]));
			for (const item of contentIDs) {
				if (item.assetId == null) continue;
				const asset = assetById.get(item.assetId);
				if (!asset) {
					return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 400 });
				}
				if (asset.project?.status !== 'Publish') {
					return NextResponse.json({ success: false, error: 'Asset project is not published' }, { status: 400 });
				}
				if (asset.collectionId !== item.collectionId) {
					return NextResponse.json({ success: false, error: 'Asset does not match collection' }, { status: 400 });
				}
				if (item.productId != null && asset.productId !== item.productId) {
					return NextResponse.json({ success: false, error: 'Asset does not match product' }, { status: 400 });
				}
			}
		}

		// Create post row (no content links yet)
		const newPost = await prisma.post.create({
			data: {
				createdByAddress: walletAddress,
				postedByAddress: walletAddress,
				createdAt: Math.floor(Date.now() / 1000),
				postedAt: Math.floor(Date.now() / 1000),
				caption: comment,
				status: status,
			},
			include: {
				comments: { include: { likes: true } },
				content: { include: { collection: true, product: true, asset: true } },
				likes: true,
				createdBy: true,
				postedBy: true,
				sharedBy: true,
			},
		});

		// Link each content item to the new post via postContent
		for (const c of contentIDs) {
			await prisma.postContent.create({
				data: {
					collectionId: c.collectionId,
					productId: c.productId ?? null,
					assetId: c.assetId ?? null,
					post: { connect: { id: newPost.id } },
				},
			});
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (e) {
		console.log(e);
		return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
	}
}
