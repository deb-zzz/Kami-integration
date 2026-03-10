import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { CollectionInfo, CollectionWithoutProducts, CollectionWithProducts, Metadata } from './[collectionId]/route';
import { ProjectStatus } from '@prisma/client';

// Type definition for the body of a request to create a collection
type CreateCollectionBody = {
	name: string; // Name of the collection
	symbol: string; // Symbol representing the collection
	description: string; // Description of the collection
	projectId: number; // ID of the associated project
	avatarUrl?: string; // Optional URL for the collection's avatar image
	bannerUrl?: string; // Optional URL for the collection's banner image
	type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
	chainId?: string;
};

// Type definition for the request parameters
type CreateProps = {
	params: { walletAddress: string }; // Wallet address of the collection owner
};

/**
 * Handles POST requests to create a new collection.
 *
 * @param req - The incoming request object containing the collection details in the body.
 * @param props - An object containing request parameters.
 * @param props.params.walletAddress - The wallet address of the collection owner.
 *
 * @returns A JSON response with the created collection or an error message.
 */
export const POST = async (req: NextRequest, { params }: CreateProps) => {
	const { walletAddress } = params;
	// Destructure the request body to get collection details
	const {
		name,
		symbol,
		description,
		avatarUrl,
		bannerUrl,
		projectId,
		type,
		chainId: chainIdParam,
	}: CreateCollectionBody = await req.json();
	let collection, chainId: string;
	try {
		if (chainIdParam && chainIdParam !== '') chainId = chainIdParam;
		else if (process.env.DEFAULT_CHAIN_ID && process.env.DEFAULT_CHAIN_ID !== '') chainId = process.env.DEFAULT_CHAIN_ID ?? '';
		else {
			return NextResponse.json({ error: 'Chain ID is required' }, { status: 400 });
		}

		// Validate the chain ID
		const blockchain = await getBlockchain(chainId);
		if (!blockchain) {
			return NextResponse.json({ error: 'Invalid chain ID' }, { status: 400 });
		}

		// Check if we already have a collection with this projectId
		const existingCollection = await prisma.collection.findUnique({
			where: { projectId: projectId },
		});
		if (existingCollection) {
			return NextResponse.json(
				{
					error: `Collection '${existingCollection.name}' (id: ${existingCollection.collectionId}) already exists for this projectId: ${projectId}`,
				},
				{ status: 400 },
			);
		}

		// Create a new collection in the database
		collection = await prisma.collection.create({
			data: {
				name,
				symbol,
				description,
				avatarUrl,
				bannerUrl,
				projectId,
				createdAt: Date.now() / 1000, // Timestamp for creation
				ownerWalletAddress: walletAddress, // Owner's wallet address
				contractType: type,
				chainId: chainId,
			},
		});

		// Return the created collection with a 201 status code
		return NextResponse.json(collection, { status: 201 });
	} catch (error) {
		console.log(error);
		// Return an error message with a 500 status code if creation fails
		return NextResponse.json({ error: 'Failed to create collection: ' + (error as Error).message }, { status: 500 });
	}
};

type Props = {
	params: { walletAddress: string };
};

/**
 * Handles GET requests to retrieve collections for a specific wallet address.
 *
 * @param req - The incoming request object.
 * @param params - An object containing request parameters.
 * @param params.walletAddress - The wallet address for which collections are to be retrieved.
 *
 * @returns A JSON response with the collections or an error message.
 */
export const GET = async (req: NextRequest, { params }: Props) => {
	const { walletAddress } = params;

	const userWalletAddress = req.nextUrl.searchParams.get('userWalletAddress') ?? walletAddress;

	// Check if the request includes a query parameter to include products
	const sp = req.nextUrl.searchParams.get('withProducts');
	const withProductsData: boolean = sp !== null && sp !== 'false';

	// Get hidden collections
	const sh = req.nextUrl.searchParams.get('showHidden') ?? 'false';
	const isVisible: boolean = sh === 'false';

	// Define which related data to include in the response
	const include = { products: withProductsData, likes: true, shares: true, owner: true, project: { include: { category: true } } };
	try {
		// Fetch collections from the database for the given wallet address
		const collections = await prisma.collection.findMany({
			where: { ownerWalletAddress: walletAddress, isVisible: isVisible ? isVisible : undefined },
			include,
		});

		// If withProductsData is true, parse each collection to include product details
		return NextResponse.json(
			{
				collections: await Promise.all(
					collections.map(async (c) => await parseCollection(c.collectionId, walletAddress, userWalletAddress, withProductsData)),
				),
			},
			{ status: 200 },
		);
	} catch (error) {
		// Return an error message with a 500 status code if fetching fails
		return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
	}
};

/**
 * Fetches and processes a collection and its associated products by collection ID.
 *
 * @param collectionId - The unique identifier of the collection to be fetched.
 * @param walletAddress - The wallet address of the user making the request, used to determine if the user has liked or followed the collection or its products.
 * @param includeProducts - A boolean flag indicating whether to include product details in the response. Defaults to true.
 *
 * @returns A Promise that resolves to a CollectionInfo object containing details of the collection and its products, or undefined if an error occurs.
 *
 * The CollectionInfo object includes:
 * - collectionId: The unique identifier of the collection.
 * - name: The name of the collection.
 * - description: A description of the collection.
 * - ownerWalletAddress: The wallet address of the collection's owner.
 * - avatarUrl: The URL of the collection's avatar image.
 * - bannerUrl: The URL of the collection's banner image.
 * - products: An array of product details, if includeProducts is true.
 * - likes: The number of likes the collection has received.
 * - shares: The number of times the collection has been shared.
 * - follows: The number of followers the collection has.
 * - likedByMe: A boolean indicating if the collection is liked by the user with the given walletAddress.
 * - followedByMe: A boolean indicating if the collection is followed by the user with the given walletAddress.
 * - owner: Information about the owner of the collection.
 *
 * Each product in the products array includes:
 * - productId: The unique identifier of the product.
 * - name: The name of the product.
 * - description: A description of the product.
 * - imageUrl: The URL of the product's image.
 * - animationUrl: The URL of the product's animation, if available.
 * - traits: An array of traits or attributes of the product.
 * - bundle: Information about the product's bundle, if applicable.
 * - likes: The number of likes the product has received.
 * - follows: The number of followers the product has.
 * - shares: The number of times the product has been shared.
 * - followedByMe: A boolean indicating if the product is followed by the user with the given walletAddress.
 * - likedByMe: A boolean indicating if the product is liked by the user with the given walletAddress.
 */
async function parseCollection(collectionId: number, walletAddress: string, userWalletAddress: string, includeProducts: boolean = true) {
	try {
		let collection: CollectionWithProducts | CollectionWithoutProducts;
		if (includeProducts) {
			// Fetch a collection with its products and related data from the database
			collection = (await prisma.collection.findUniqueOrThrow({
				where: { collectionId: collectionId },
				include: {
					products: {
						include: {
							asset: true,
							voucher: true,
							bundle: true,
							likes: true,
							follows: true,
							shares: true,
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
					followers: true,
					shares: true,
					owner: true,
				},
			})) as CollectionWithProducts;
		} else {
			collection = (await prisma.collection.findUniqueOrThrow({
				where: { collectionId: collectionId },
				include: {
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
					followers: true,
					shares: true,
					owner: true,
				},
			})) as CollectionWithoutProducts;
		}

		let avatarUrl = collection.avatarUrl;
		if (avatarUrl === undefined || avatarUrl === null) {
			const product = await prisma.product.findFirst({
				where: { collectionId: collectionId },
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
					where: { collectionId: collectionId },
					data: { avatarUrl },
				});
			}
		}

		// Construct a CollectionInfo object with the fetched data
		const coll: CollectionInfo = {
			collectionId: collection.collectionId,
			category: collection.project.category?.name ?? 'Uncategorized',
			name: collection.name,
			description: collection.description,
			ownerWalletAddress: collection.ownerWalletAddress,
			avatarUrl: avatarUrl,
			bannerUrl: collection.bannerUrl,
			createdAt: collection.createdAt,
			products: [],
			collaborators: collection.project.collaborators.map((c) => ({
				userProfile: c.userProfile,
				userWalletAddress: c.userProfile.walletAddress,
				status: c.status,
			})),
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

		// If the collection has products, process each product
		if (collection.hasOwnProperty('products')) {
			const cwp = collection as CollectionWithProducts;
			if (cwp.products && cwp.products.length > 0) {
				for (const collectionProduct of cwp.products) {
					const productAsset =
						(Array.isArray(collectionProduct.asset) ? collectionProduct.asset[0] : collectionProduct.asset) ??
						(Array.isArray(collectionProduct.voucher) ? collectionProduct.voucher[0] : collectionProduct.voucher);

					if (!productAsset) continue;

					// Parse metadata from the product asset
					const metadata: Metadata = productAsset.metadata ? JSON.parse(productAsset.metadata?.toString()) : undefined;
					const assetObj = Array.isArray(collectionProduct.asset) ? collectionProduct.asset[0] : collectionProduct.asset;
					const voucherObj = Array.isArray(collectionProduct.voucher) ? collectionProduct.voucher[0] : collectionProduct.voucher;
					// Add product details to the collection's products array
					coll.products.push({
						productId: collectionProduct.id,
						ownerWalletAddress: collectionProduct.ownerWalletAddress,
						name: metadata ? metadata.name : collectionProduct.name,
						description: metadata ? metadata.description : (collectionProduct.description ?? ''),
						imageUrl: metadata ? metadata.image : (productAsset.mediaUrl ?? undefined),
						animationUrl: metadata ? metadata.animation_url : (productAsset.animationUrl ?? undefined),
						traits: metadata.attributes ?? undefined,
						bundle: metadata.properties?.bundle ?? collectionProduct.bundle ?? undefined,
						tokenId: assetObj?.tokenId ?? voucherObj?.tokenId ?? undefined,
						likes: collectionProduct.likes.length,
						price: Number(collectionProduct.price ?? 0),
						audience: collectionProduct.audience,
						consumerAction: collectionProduct.consumerAction,
						follows: collectionProduct.follows.length,
						shares: collectionProduct.shares.length,
						followedByMe: collectionProduct.follows.some((f) => f.toWalletAddress === walletAddress),
						likedByMe: collectionProduct.likes.some((l) => l.fromWalletAddress === walletAddress),
						createdAt: collectionProduct.createdAt,
					});
				}
			}
		}

		// Return the constructed CollectionInfo object
		return coll;
	} catch (error) {
		// Return undefined if fetching or processing fails
		return undefined;
	}
}

async function getBlockchain(chainId: string) {
	const blockchain = await prisma.blockchain.findUnique({
		where: { chainId: chainId },
	});
	return blockchain;
}
