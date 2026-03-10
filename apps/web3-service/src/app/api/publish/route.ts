import { prisma } from '@/lib/db';
import { Metadata } from '@/lib/types';
import {
	CollaboratorStatus,
	collection,
	ConsumerAction,
	Mimetype,
	ProductAudience,
	ProductType,
	ProjectStatus,
	voucher,
	Prisma,
	EntityType,
	TagTypes,
} from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import {
	MAX_QUANTITY_ERROR,
	NO_MEDIA_URL_ERROR,
	UNEXPECTED_ERROR,
	FAILED_TO_CREATE_VOUCHER_ERROR,
	ProductContractTypeMap,
	MAX_QUANTITY,
	NO_COLLECTION_DATA,
	FAILED_TO_CREATE_COLLECTION_ERROR,
	INVALID_CREATOR_SHARE_ERROR,
	FAILED_TO_DEPLOY_GASLESS_COLLECTION_ERROR,
	FAILED_TO_MINT_GASLESS_NFT_ERROR,
} from '@/lib/types';
import { deployGaslessCollection, mintGaslessNFT, getBlockchainInfo, validateChainId } from '@/lib/gasless-nft';
import { SupplyService } from '@/services';

export const maxDuration = 90;

/**
 * Interface for creating a new NFT with optional collection details
 * @typedef {Object} LazyNFT
 * @property {string} walletAddress - The wallet address of the NFT creator
 * @property {number} [collectionId] - Optional ID of existing collection
 * @property {Object} [newCollection] - Optional details for creating a new collection
 * @property {string} [tokenId] - Optional token ID for the NFT
 * @property {Metadata} metadata - NFT metadata following metadata standards
 * @property {number} projectId - ID of the project this NFT belongs to
 * @property {number} price - Price of the NFT
 * @property {string} currency - Currency symbol for the NFT price
 * @property {ProductType} type - Type of product (ERC721, ERC1155, etc.)
 * @property {number} [quantity] - Optional quantity for multiple editions
 * @property {ProductAudience} [audience] - Optional audience type (Public/Private)
 * @property {ConsumerAction} [consumerAction] - Optional action type (Buy/Mint)
 * @property {boolean} [spotlight] - Optional spotlight flag
 */
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

type LazyNFT = {
	walletAddress: string;
	collectionId?: number;
	newCollection?: CreateCollectionBody;
	tokenId?: string;
	metadata: Metadata;
	projectId: number;
	price: number;
	currency: string;
	type: ProductType;
	quantity?: number;
	audience?: ProductAudience;
	consumerAction?: ConsumerAction;
	spotlight?: boolean;
	tags?: string[];
	shouldDeploy?: boolean;
};

/**
 * Success response type for NFT creation
 * @typedef {Object} Success
 * @property {boolean} success - Always true for success response
 * @property {number} projectId - ID of the project
 * @property {number} productId - ID of the created product
 * @property {number} collectionId - ID of the collection
 * @property {voucher} voucher - Created voucher details
 */
type Success = {
	success: true;
	projectId: number;
	productId: number;
	collectionId: number;
	voucher: voucher;
};

/**
 * Error response type for NFT creation
 * @typedef {Object} Fail
 * @property {boolean} success - Always false for error response
 * @property {string} error - Error message
 */
type Fail = {
	success: false;
	error: string;
};

type Result = Success | Fail;

/**
 * Allocates a token ID for the NFT
 * @param {LazyNFT} lazyNFT - The NFT data
 * @returns {Promise<string>} The allocated token ID
 * @description
 * 1. Uses existing tokenId if provided
 * 2. Uses metadata token_id if available
 * 3. Generates new tokenId based on collection size
 */
const allocateTokenId = async (lazyNFT: LazyNFT): Promise<string> => {
	if (lazyNFT.tokenId) {
		if (lazyNFT.metadata) lazyNFT.metadata.token_id = lazyNFT.tokenId;
		return lazyNFT.tokenId;
	}
	if (lazyNFT.metadata?.token_id) {
		lazyNFT.tokenId = lazyNFT.metadata.token_id;
		return lazyNFT.metadata.token_id;
	}
	const tokenId = String((await prisma.voucher.findMany({ where: { collectionId: lazyNFT.collectionId } })).length + 1);
	lazyNFT.tokenId = tokenId;
	if (lazyNFT.metadata) lazyNFT.metadata.token_id = tokenId;
	return tokenId;
};

/**
 * Handles POST requests for NFT creation
 * @param {NextRequest} req - The incoming request containing LazyNFT data
 * @returns {Promise<NextResponse<Result>>} Success or failure response
 * @description
 * Process:
 * 1. Validates input data (quantity limits)
 * 2. Retrieves or creates collection
 * 3. Creates product and voucher in transaction
 * 4. Updates project status and collaborators
 * 5. Returns created NFT details or error
 *
 * Error Handling:
 * - Quantity exceeding MAX_QUANTITY
 * - Missing collection data
 * - Missing media URL
 * - Collection creation failures
 * - Database transaction failures
 */
export async function POST(req: NextRequest): Promise<NextResponse<Result>> {
	const lazyNFT: LazyNFT = await req.json();
	console.log(JSON.stringify(lazyNFT, null, 4));

	try {
		// Make sure we have a quantity that is less than the max
		if (lazyNFT.quantity && lazyNFT.quantity > MAX_QUANTITY) throw new Error(MAX_QUANTITY_ERROR);

		// Make sure we have a project
		const project = await prisma.project.findUniqueOrThrow({
			where: { id: lazyNFT.projectId },
			include: { voucher: true, product: true, collection: true, user: true },
		});

		// Make sure we have a collection
		if (!lazyNFT.collectionId && !lazyNFT.newCollection) throw new Error(NO_COLLECTION_DATA);

		// Create collection if we don't have one, or if existing collection has different contract type
		let collection: collection | undefined = undefined;
		if (project.collection) {
			// Check if the existing collection's contract type matches the requested type
			if (lazyNFT.newCollection && project.collection.contractType !== lazyNFT.newCollection.type) {
				// Contract type mismatch - cannot reuse collection
				throw new Error(
					`Collection already exists for this project with contract type ${project.collection.contractType}, ` +
						`but requested type is ${lazyNFT.newCollection.type}. ` +
						`A project can only have one collection, and contract types cannot be changed. ` +
						`Please use a different project or collection.`,
				);
			}
			if (lazyNFT.newCollection && lazyNFT.newCollection.chainId !== project.collection.chainId) {
				throw new Error(
					`Collection already exists for this project with chainId ${project.collection.chainId}, ` +
						`but requested chainId is ${lazyNFT.newCollection.chainId}. ` +
						`A project can only have one collection, and chainIds cannot be changed. ` +
						`Please use a different project or collection.`,
				);
			}
			if (lazyNFT.newCollection) {
				console.log('The project already has a collection, so we will use it');
			}
			collection = project.collection;
		} else if (lazyNFT.newCollection) {
			// Use provided chainId or fall back to DEFAULT_CHAIN_ID environment variable
			let chainId = lazyNFT.newCollection.chainId || process.env.DEFAULT_CHAIN_ID;

			if (!chainId) {
				throw new Error(
					`chainId is required in newCollection or DEFAULT_CHAIN_ID environment variable must be set. ` +
						`Please specify the blockchain chainId (e.g., "0x14a34" for Base Sepolia). ` +
						`The chainId must exist in the blockchain table.`,
				);
			}

			// Log if using DEFAULT_CHAIN_ID
			if (!lazyNFT.newCollection.chainId && process.env.DEFAULT_CHAIN_ID) {
				console.log(`[publish] Using DEFAULT_CHAIN_ID from environment: ${process.env.DEFAULT_CHAIN_ID}`);
			}

			// Normalize chainId to hex format
			if (!chainId.startsWith('0x')) {
				chainId = `0x${Number.parseInt(chainId, 10).toString(16)}`;
			}

			// Validate chainId exists in blockchain table
			const isValidChainId = await validateChainId(chainId);
			if (!isValidChainId) {
				throw new Error(`Invalid chainId: ${chainId}. ChainId must exist in the blockchain table.`);
			}

			try {
				collection = await prisma.collection.create({
					data: {
						symbol: lazyNFT.newCollection.symbol,
						name: lazyNFT.newCollection.name,
						description: lazyNFT.newCollection.description,
						projectId: project.id,
						createdAt: new Date().getTime() / 1000,
						ownerWalletAddress: lazyNFT.walletAddress,
						contractType: lazyNFT.newCollection.type,
						chainId: chainId,
						avatarUrl: lazyNFT.newCollection.avatarUrl,
						bannerUrl: lazyNFT.newCollection.bannerUrl,
					},
				});
			} catch (error) {
				console.error('Error creating collection:', (error as Error).message);
				throw new Error(FAILED_TO_CREATE_COLLECTION_ERROR);
			}
		}

		// Make sure we have a collection (should never happen)
		if (!collection) throw new Error(FAILED_TO_CREATE_COLLECTION_ERROR);

		const collectionId = collection.collectionId;

		// Create product and voucher in a transaction to ensure consistency
		const [product, voucher] = await prisma.$transaction(async (tx) => {
			// Use SupplyService to calculate supply values based on product type
			const isClaimable = SupplyService.isClaimable(lazyNFT.type);
			const maxQuantity = SupplyService.calculateMaxQuantity(lazyNFT.type, lazyNFT.quantity);
			const availableQuantity = SupplyService.calculateInitialAvailableQuantity(lazyNFT.type, maxQuantity, lazyNFT.quantity);
			const isUnlimited = isClaimable && SupplyService.isUnlimited(maxQuantity);

			// Add project creator to metadata if not present
			if (lazyNFT.metadata.properties) {
				const props = lazyNFT.metadata.properties;
				if (!props.project_creator) {
					props.project_creator = {
						address: project.user.walletAddress,
						name: project.user.userName,
					};
				}
			}

			const product = await tx.product.create({
				data: {
					createdAt: new Date().getTime() / 1000,
					name: lazyNFT.metadata.name,
					description: lazyNFT.metadata.description ?? collection.description ?? '',
					type: lazyNFT.type,
					ownerWalletAddress: lazyNFT.walletAddress,
					price: lazyNFT.price,
					currencySymbol: lazyNFT.currency,
					availableQuantity,
					maxQuantity,
					collectionId: collectionId,
					projectId: project.id,
					spotlight: lazyNFT.spotlight ?? false,
					audience: lazyNFT.audience ?? ProductAudience.Public,
					consumerAction: lazyNFT.consumerAction ?? ConsumerAction.Buy,
					metadata: JSON.stringify(lazyNFT.metadata),
					bundle: {
						createMany: {
							data:
								lazyNFT.metadata.properties?.bundle?.map((b, index) => {
									return {
										url: b.uri,
										name: b.name,
										description: b.description,
										category: b.category,
										coverUrl: b.cover_url,
										ownerDescription: b.owner_description,
										type: b.type as Mimetype,
										order: index,
									};
								}) ?? [],
						},
					},
				},
			});

			// Log product creation with supply configuration
			console.log(`[publish] Created product ${product.id}:`, {
				type: lazyNFT.type,
				isClaimable,
				isUnlimited,
				maxQuantity: product.maxQuantity,
				availableQuantity: product.availableQuantity,
			});

			// Make sure we have a media url
			const mediaUrl = lazyNFT.metadata.image ?? lazyNFT.metadata.animation_url;
			if (!mediaUrl) {
				throw new Error(NO_MEDIA_URL_ERROR);
			}

			// Create voucher
			// For KAMI721AC: voucher serves as a template with metadata (persists after minting)
			// For KAMI721C: voucher is used for lazy minting (converted to asset on mint)
			const voucher = await tx.voucher.create({
				data: {
					createdAt: new Date().getTime() / 1000,
					tokenId: await allocateTokenId(lazyNFT),
					metadata: JSON.stringify(lazyNFT.metadata),
					mediaUrl,
					animationUrl: lazyNFT.metadata.animation_url ?? undefined,
					productId: product.id,
					projectId: project.id,
					collectionId,
					walletAddress: lazyNFT.walletAddress,
					contractType: ProductContractTypeMap[lazyNFT.type],
					// Set maxQuantity to match product's maxQuantity (0 = unlimited for KAMI721AC)
					maxQuantity: isClaimable ? maxQuantity : undefined,
				},
			});

			// Create tags
			if (lazyNFT.tags) {
				await Promise.all(
					lazyNFT.tags.map(async (t) => {
						await tx.tag.upsert({
							where: { type_tag: { type: TagTypes.Asset, tag: t } },
							create: {
								tag: t,
								type: TagTypes.Asset,
								products: {
									connect: {
										id: product.id,
									},
								},
								vouchers: {
									connect: {
										id: voucher.id,
									},
								},
								createdAt: new Date().getTime() / 1000,
							},
							update: {
								products: {
									connect: {
										id: product.id,
									},
								},
								vouchers: {
									connect: {
										id: voucher.id,
									},
								},
							},
						});
					}),
				);
			}

			let primaryShare = 100;
			const creatorsShare = lazyNFT.metadata.properties?.creators?.map((c) => c.share).reduce((acc, curr) => acc + curr, 0);
			if (creatorsShare && creatorsShare > 0) primaryShare = 100 - creatorsShare;
			if (primaryShare < 0) throw new Error(INVALID_CREATOR_SHARE_ERROR);

			await tx.project.update({
				where: { id: project.id },
				data: {
					status: ProjectStatus.Publish,
					draft: project.draft === null || project.draft === undefined ? Prisma.JsonNull : project.draft,
					updatedAt: Math.floor(Date.now() / 1000),
				},
			});

			const collaborators = await tx.collaborators.findUnique({
				where: { projectId_userWalletAddress: { projectId: project.id, userWalletAddress: lazyNFT.walletAddress } },
			});
			if (!collaborators) {
				await tx.collaborators.create({
					data: {
						projectId: project.id,
						userWalletAddress: lazyNFT.walletAddress,
						status: CollaboratorStatus.Accepted,
						primaryShare: primaryShare,
						secondaryShare: primaryShare,
						writeAccess: true,
						acknowledgedAt: new Date().getTime() / 1000,
						respondedAt: new Date().getTime() / 1000,
						invitedAt: new Date().getTime() / 1000,
					},
				});

				await tx.collaborators.createMany({
					data:
						lazyNFT.metadata.properties?.creators?.map((c) => {
							return {
								projectId: project.id,
								userWalletAddress: c.address,
								primaryShare: c.share,
								secondaryShare: c.share,
								status: CollaboratorStatus.Accepted,
								acknowledgedAt: new Date().getTime() / 1000,
								respondedAt: new Date().getTime() / 1000,
								invitedAt: new Date().getTime() / 1000,
							};
						}) ?? [],
					skipDuplicates: true,
				});
			}
			return [product, voucher, collection];
		});

		if (lazyNFT.shouldDeploy) {
			let contractAddress = '';
			if (!collection.contractAddress) {
				try {
					const { contractAddress: deployedContractAddress } = await deployGaslessCollection(collection.collectionId);
					contractAddress = deployedContractAddress;
				} catch (error) {
					console.error('Error deploying gasless collection:', error);
					throw new Error(FAILED_TO_DEPLOY_GASLESS_COLLECTION_ERROR);
				}
			} else {
				contractAddress = collection.contractAddress;
			}
			if (contractAddress) {
				try {
					await mintGaslessNFT(voucher.id, lazyNFT.walletAddress);
				} catch (error) {
					console.error('Error minting gasless NFT:', error);
					throw new Error(FAILED_TO_MINT_GASLESS_NFT_ERROR);
				}
			} else {
				throw new Error(FAILED_TO_MINT_GASLESS_NFT_ERROR);
			}
		}

		return NextResponse.json({
			success: true,
			projectId: project.id,
			collectionId: collection.collectionId,
			productId: product.id,
			product: { ...product, whitelist: product.whitelist === null ? undefined : product.whitelist },
			voucher,
		});
	} catch (error) {
		if (error instanceof Error) {
			console.log(error.message);
			return NextResponse.json(
				{
					success: false,
					error: `${FAILED_TO_CREATE_VOUCHER_ERROR}: ${error.message}`,
				},
				{ status: 500 },
			);
		}
		console.log(error);
		return NextResponse.json(
			{
				success: false,
				error: UNEXPECTED_ERROR,
			},
			{ status: 500 },
		);
	}
}
