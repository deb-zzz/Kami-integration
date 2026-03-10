import { prisma } from '@/lib/db';
import { CollaboratorStatus, ConsumerAction, ProductAudience } from '@prisma/client';
import { Mimetype, Prisma, ProjectStatus, user } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

// Type definition for a bundle of assets
type Bundle = {
	id?: number | null;
	url: string | null;
	type: Mimetype;
	name?: string | null;
	description?: string | null;
};

// Type definition for a product within a collection
export type Product = {
	productId: number;
	ownerWalletAddress: string;
	price?: number;
	availableQuantity?: number;
	maxQuantity?: number;
	consumerAction?: ConsumerAction;
	tokenId?: string;
	name: string;
	description: string;
	imageUrl?: string;
	animationUrl?: string;
	traits?: Record<string, string>[];
	bundle?: Bundle[];
	audience?: ProductAudience;
	likes: number;
	shares: number;
	follows: number;
	likedByMe: boolean;
	followedByMe: boolean;
	createdAt: number;
};

type Collaborator = {
	userProfile: user;
	userWalletAddress: string;
	status: CollaboratorStatus;
};

// Type definition for collection information
export type CollectionInfo = {
	collectionId: number;
	category: string;
	name: string;
	description: string | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
	createdAt: number;
	ownerWalletAddress: string;
	products: Product[];
	collaborators: Collaborator[];
	type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
	likes: number;
	shares: number;
	follows: number;
	likedByMe: boolean;
	followedByMe: boolean;
	isPublished: boolean;
	isOwnedByMe: boolean;
	owner: user;
	chainId: string;
	isVisible: boolean;
};

// Type definition for metadata associated with an asset
export type Metadata = {
	name: string;
	description: string;
	image: string;
	animation_url?: string;
	attributes?: {
		trait_type: string;
		value: string;
	}[];
	properties?: {
		bundle?: {
			id: number | undefined | null;
			url: string;
			type: Mimetype;
			name: string;
			description: string;
		}[];
		creators?: {
			address: string;
			share: number;
		}[];
	};
};

// Type definition for the body of a collection update request
type UpdateCollectionBody = {
	name?: string;
	symbol?: string;
	description?: string;
	avatarUrl?: string;
	bannerUrl?: string;
	productId?: number;
	projectId?: number;
	contractAddress?: string;
	isVisible?: boolean;
};

// Type definition for a collection with its products
export type CollectionWithProducts = Prisma.collectionGetPayload<{
	include: {
		products: { include: { asset: true; voucher: true; bundle: true; likes: true; shares: true; follows: true } };
		project: {
			include: {
				category: true;
				collaborators: {
					include: {
						userProfile: true;
					};
				};
			};
		};
		likes: true;
		shares: true;
		followers: true;
		owner: true;
		chainId: true;
	};
}>;

// Type definition for a collection without its products
export type CollectionWithoutProducts = Prisma.collectionGetPayload<{
	include: {
		project: {
			include: {
				category: true;
				collaborators: {
					include: {
						userProfile: true;
					};
				};
			};
		};
		likes: true;
		shares: true;
		followers: true;
		owner: true;
	};
}>;

/**
 * Handler for GET requests to fetch collection details.
 *
 * @param req - The request object (not used in this function).
 * @param params - An object containing the wallet address and collection ID.
 * @returns A JSON response containing the collection information or an error message.
 */
export const GET = async (
	req: NextRequest,
	{ params }: { params: { walletAddress: string; collectionId: string } },
): Promise<NextResponse> => {
	const { collectionId, walletAddress } = params;
	const userWalletAddress = req.nextUrl.searchParams.get('userWalletAddress') ?? walletAddress;

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
			likedByMe: collection.likes.some((l) => l.fromWalletAddress === userWalletAddress),
			followedByMe: collection.followers.some((f) => f.walletAddress === userWalletAddress),
			isPublished: collection.project.status === ProjectStatus.Publish,
			isOwnedByMe: collection.ownerWalletAddress === userWalletAddress,
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
					availableQuantity: Number(collectionProduct.availableQuantity ?? 0),
					maxQuantity: Number(collectionProduct.maxQuantity ?? 0),
					description: metadata ? metadata.description : (collectionProduct.description ?? ''),
					imageUrl: metadata ? metadata.image : (productAsset.mediaUrl ?? undefined),
					animationUrl: metadata ? metadata.animation_url : (productAsset.animationUrl ?? undefined),
					traits: metadata.attributes ?? [],
					consumerAction: collectionProduct.consumerAction,
					audience: collectionProduct.audience,
					bundle: metadata.properties?.bundle ?? collectionProduct.bundle ?? [],
					tokenId: assetObj?.tokenId ?? voucherObj?.tokenId ?? undefined,
					likes: collectionProduct.likes.length,
					shares: collectionProduct.shares.length,
					follows: collectionProduct.follows.length,
					likedByMe: collectionProduct.likes.some((l) => l.fromWalletAddress === userWalletAddress),
					followedByMe: collectionProduct.follows.some((f) => f.toWalletAddress === userWalletAddress),
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

/**
 * Handler for PUT requests to update collection details.
 *
 * @param req - The request object containing the update data in JSON format.
 * @param params - An object containing the wallet address and collection ID.
 * @returns A JSON response containing the updated collection or an error message.
 */
export const PUT = async (req: NextRequest, { params }: { params: { walletAddress: string; collectionId: string } }) => {
	const { collectionId } = params;
	const { name, symbol, description, avatarUrl, bannerUrl, contractAddress, isVisible }: UpdateCollectionBody = await req.json();
	try {
		// Update the collection with the provided data
		const collection = await prisma.collection.update({
			where: { collectionId: parseInt(collectionId) },
			data: { name, symbol, description, avatarUrl, bannerUrl, contractAddress, isVisible },
		});
		// Return the updated collection as a JSON response
		return NextResponse.json(collection, { status: 200 });
	} catch (error) {
		// Log the error and return a failure response
		console.log((error as Error).message);
		return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
	}
};
