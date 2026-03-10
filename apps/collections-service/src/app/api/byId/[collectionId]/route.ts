import { prisma } from '@/lib/db';
import { CollaboratorStatus } from '@prisma/client';
import { ProjectStatus, user } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { CollectionInfo, CollectionWithProducts, Metadata } from '../../[walletAddress]/[collectionId]/route';

// Type definition for a product within a collection

type Collaborator = {
	userProfile: user;
	userWalletAddress: string;
	status: CollaboratorStatus;
};

/**
 * Handler for GET requests to fetch collection details.
 *
 * @param req - The request object (not used in this function).
 * @param params - An object containing the collection ID.
 * @returns A JSON response containing the collection information or an error message.
 */
export const GET = async (req: NextRequest, { params }: { params: { collectionId: string } }): Promise<NextResponse> => {
	const { collectionId } = params;

	try {
		// Fetch the collection with its products and related data
		const collection: CollectionWithProducts = await prisma.collection.findUniqueOrThrow({
			where: { collectionId: parseInt(collectionId) },
			include: {
				products: {
					include: {
						asset: true,
						voucher: true,
						bundle: true,
						likes: true,
						shares: true,
						follows: true,
					},
				},
				project: {
					include: {
						category: true,
						collaborators: {
							include: {
								userProfile: true,
							},
						},
					},
				},
				likes: true,
				shares: true,
				followers: true,
				owner: true,
			},
		});

		let avatarUrl = collection.avatarUrl;
		if (avatarUrl === undefined || avatarUrl === null) {
			const product = await prisma.product.findFirst({
				where: { collectionId: parseInt(collectionId) },
				include: { asset: true, voucher: true },
			});
			if (product) {
				const productAsset =
					(Array.isArray(product.asset) ? product.asset[0] : product.asset) ??
					(Array.isArray(product.voucher) ? product.voucher[0] : product.voucher);
				avatarUrl = productAsset?.mediaUrl ?? null;
			}
			if (avatarUrl !== undefined && avatarUrl !== null) {
				await prisma.collection.update({
					where: { collectionId: parseInt(collectionId) },
					data: { avatarUrl },
				});
			}
		}

		const collaborators: Collaborator[] = collection.project.collaborators.map((c) => ({
			userProfile: c.userProfile,
			userWalletAddress: c.userProfile.walletAddress,
			status: c.status,
		}));
		// Construct the collection information object
		const coll: CollectionInfo = {
			collectionId: collection.collectionId,
			category: collection.project.category?.name ?? 'Uncategorized',
			name: collection.name,
			description: collection.description,
			ownerWalletAddress: collection.ownerWalletAddress,
			avatarUrl: collection.avatarUrl,
			bannerUrl: collection.bannerUrl,
			createdAt: collection.createdAt,
			products: [],
			collaborators: collaborators,
			likes: collection.likes.length,
			shares: collection.shares.length,
			follows: collection.followers.length,
			likedByMe: false,
			followedByMe: false,
			isPublished: collection.project.status === ProjectStatus.Publish,
			isOwnedByMe: false,
			owner: collection.owner,
			type: collection.contractType,
			chainId: collection.chainId,
			isVisible: collection.isVisible,
		};

		// Populate the products array with detailed product information
		if (collection.products && collection.products.length > 0) {
			for (const collectionProduct of collection.products) {
				const productAsset =
					(Array.isArray(collectionProduct.asset) ? collectionProduct.asset[0] : collectionProduct.asset) ??
					(Array.isArray(collectionProduct.voucher) ? collectionProduct.voucher[0] : collectionProduct.voucher);

				if (!productAsset) continue;
				const metadata: Metadata = productAsset.metadata ? JSON.parse(productAsset.metadata?.toString()) : undefined;
				const assetObj = Array.isArray(collectionProduct.asset) ? collectionProduct.asset[0] : collectionProduct.asset;
				const voucherObj = Array.isArray(collectionProduct.voucher) ? collectionProduct.voucher[0] : collectionProduct.voucher;
				coll.products.push({
					productId: collectionProduct.id,
					ownerWalletAddress: collectionProduct.ownerWalletAddress,
					name: metadata ? metadata.name : collectionProduct.name,
					price: Number(collectionProduct.price ?? 0),
					description: metadata ? metadata.description : (collectionProduct.description ?? ''),
					imageUrl: metadata ? metadata.image : (productAsset.mediaUrl ?? undefined),
					animationUrl: metadata ? metadata.animation_url : (productAsset.animationUrl ?? undefined),
					traits: metadata.attributes ?? [],
					consumerAction: collectionProduct.consumerAction,
					bundle: metadata.properties?.bundle ?? collectionProduct.bundle ?? [],
					tokenId: assetObj?.tokenId ?? voucherObj?.tokenId ?? undefined,
					likes: collectionProduct.likes.length,
					shares: collectionProduct.shares.length,
					follows: collectionProduct.follows.length,
					likedByMe: false,
					followedByMe: false,
					createdAt: collectionProduct.createdAt,
				});
			}
		}

		// Return the collection information as a JSON response
		return NextResponse.json(coll, { status: 200 });
	} catch (error) {
		// Handle errors and return a failure response
		console.log(`Error fetching collection: ${error}`);
		return NextResponse.json({ error: 'Failed to fetch collection' }, { status: 500 });
	}
};
