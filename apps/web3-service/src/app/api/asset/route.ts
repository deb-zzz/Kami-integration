import { prisma } from '@/lib/db';
import { Prisma, ProductAudience, ConsumerAction, ProhibitReason, ContractType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * ============================================================================
 * SUPPORTED FILTERS
 * ============================================================================
 *
 * DIRECT ASSET FIELDS:
 * - id: number (exact match)
 * - walletAddress: string (exact match)
 * - chainId: string (exact match)
 * - collectionId: number (exact match)
 * - productId: number (exact match)
 * - projectId: number (exact match)
 * - contractType: ContractType enum (ERC721C, ERC721AC, ERC1155C)
 * - audience: ProductAudience enum (Public, Private, Whitelist, PublicBan, Prohibit)
 * - prohibitReason: ProhibitReason enum (NSFW, INFRINGEMENT)
 * - consumerAction: ConsumerAction enum (Buy, Subscribe, Rent, Claim, None)
 * - spotlight: boolean (true/false)
 * - canSubscribe: boolean (true/false)
 * - priceMin / priceMax: number (range)
 * - subscriptionValueMin / subscriptionValueMax: number (range)
 * - createdAtFrom / createdAtTo: ISO date string (range)
 *
 * NESTED FILTERS:
 * - collectionName: string (contains, case-insensitive on collection.name)
 * - projectName: string (contains, case-insensitive on project.name)
 * - creatorWalletAddress: string (exact match on project.walletAddress)
 * - creatorName: string (contains, case-insensitive on project.user.userName)
 * - ownerName: string (contains, case-insensitive on user.userName)
 *
 * TAG FILTER:
 * - tag: string (contains, case-insensitive)
 *
 * ============================================================================
 * SUPPORTED SORTING
 * ============================================================================
 *
 * DIRECT ASSET FIELDS:
 * - id, createdAt, price, availableQuantity, audience, consumerAction, spotlight
 * - contractType, projectId, collectionId, productId, walletAddress
 *
 * NESTED: collectionName, projectName, ownerName
 * Decimal/nullable: price, subscriptionValue (nulls: 'last')
 *
 * Multi-sort format: "field1,order1;field2,order2"
 * Example: "spotlight,desc;createdAt,desc"
 */

type AssetListItem = {
	id: number;
	walletAddress: string;
	chainId: string | null;
	contractAddress: string;
	tokenId: string;
	metadata: unknown;
	metadataURI: string | null;
	mediaUrl: string | null;
	animationUrl: string | null;
	availableQuantity: number;
	projectId: number | null;
	productId: number | null;
	collectionId: number | null;
	contractType: string;
	consumerAction: string | null;
	audience: string | null;
	spotlight: boolean;
	prohibitReason: string | null;
	canSubscribe: boolean;
	subscriptionValue: string | null;
	price: string | null;
	currencySymbol: string | null;
	createdAt: number;

	// Project Info
	project: {
		projectId: number;
		name: string;
	} | null;

	// Collection Info
	collection: {
		collectionId: number;
		name: string;
		chainId: string;
	} | null;

	// Creator Info (from project)
	creator: {
		walletAddress: string;
		userName: string;
	} | null;

	// Owner Info
	owner: {
		walletAddress: string;
		userName: string;
	};

	// Product details (when asset is linked to a product)
	product: {
		id: number;
		name: string;
		description: string | null;
		type: string;
		price: string;
		currency: string | null;
		availableQuantity: number;
		maxQuantity: number | null;
		forSale: boolean;
		audience: string;
		consumerAction: string;
		spotlight: boolean;
		collectionId: number | null;
		projectId: number;
		ownerWalletAddress: string;
		collection: { collectionId: number; name: string; chainId: string } | null;
		project: { projectId: number; name: string };
		owner: { walletAddress: string; userName: string };
		tags: Array<{ tag: string; type: string }>;
	} | null;

	// Tags
	tags: Array<{ tag: string; type: string }>;

	// Optional blockchain data
	blockchain?: {
		chainId: string;
		name: string;
		logoUrl: string | null;
		rpcUrl: string;
		createdAt: number;
	};
};

function parseUnixTimestamp(dateStr: string | null): number | undefined {
	if (!dateStr) return undefined;
	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return undefined;
		return Math.floor(date.getTime() / 1000);
	} catch {
		return undefined;
	}
}

function parseBoolParam(val: string | null): boolean | undefined {
	if (val === null || val === '') return undefined;
	const lower = val.toLowerCase();
	if (lower === 'true') return true;
	if (lower === 'false') return false;
	return undefined;
}

const nestedSortBuilder: Record<string, (order: 'asc' | 'desc') => Prisma.assetOrderByWithRelationInput> = {
	projectName: (order) => ({ project: { name: order } }),
	collectionName: (order) => ({ collection: { name: order } }),
	ownerName: (order) => ({ user: { userName: order } }),
};

const DECIMAL_NULLABLE_FIELDS = new Set(['price', 'subscriptionValue']);

export async function GET(req: NextRequest): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(req.url);

		const includeBlockchain = parseBoolParam(searchParams.get('includeBlockchain')) ?? false;

		const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
		const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '10', 10)));
		const skip = (page - 1) * perPage;

		const sortParam = searchParams.get('sort') || 'createdAt,desc';
		const sortPairs = sortParam
			.split(';')
			.map((pair) => pair.trim())
			.filter(Boolean);
		const orderBy: Prisma.assetOrderByWithRelationInput[] = [];

		for (const pair of sortPairs) {
			const [field, orderRaw] = pair.split(',').map((s) => s.trim());
			const order = (orderRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

			if (nestedSortBuilder[field]) {
				orderBy.push(nestedSortBuilder[field](order));
			} else if (DECIMAL_NULLABLE_FIELDS.has(field)) {
				orderBy.push({
					[field]: {
						sort: order,
						nulls: 'last',
					},
				});
			} else {
				orderBy.push({ [field]: order });
			}
		}

		if (orderBy.length === 0) {
			orderBy.push({ createdAt: 'desc' });
		}

		const where: Prisma.assetWhereInput = {};

		const id = searchParams.get('id');
		if (id) {
			where.id = parseInt(id, 10);
		}

		const walletAddress = searchParams.get('walletAddress') || undefined;
		if (walletAddress) {
			where.walletAddress = walletAddress;
		}

		const chainId = searchParams.get('chainId') || undefined;
		if (chainId) {
			where.chainId = chainId;
		}

		const collectionId = searchParams.get('collectionId');
		if (collectionId) {
			where.collectionId = parseInt(collectionId, 10);
		}

		const productId = searchParams.get('productId');
		if (productId) {
			where.productId = parseInt(productId, 10);
		}

		const projectId = searchParams.get('projectId');
		if (projectId) {
			where.projectId = parseInt(projectId, 10);
		}

		const contractTypeParam = searchParams.get('contractType');
		if (contractTypeParam) {
			if (!Object.values(ContractType).includes(contractTypeParam as ContractType)) {
				return NextResponse.json(
					{ error: `Invalid contractType. Allowed values: ${Object.values(ContractType).join(', ')}` },
					{ status: 400 }
				);
			}
			where.contractType = contractTypeParam as ContractType;
		}

		const audienceParam = searchParams.get('audience');
		if (audienceParam) {
			if (!Object.values(ProductAudience).includes(audienceParam as ProductAudience)) {
				return NextResponse.json(
					{ error: `Invalid audience. Allowed values: ${Object.values(ProductAudience).join(', ')}` },
					{ status: 400 }
				);
			}
			where.audience = audienceParam as ProductAudience;
		}

		const prohibitReasonParam = searchParams.get('prohibitReason');
		if (prohibitReasonParam) {
			if (!Object.values(ProhibitReason).includes(prohibitReasonParam as ProhibitReason)) {
				return NextResponse.json(
					{ error: `Invalid prohibitReason. Allowed values: ${Object.values(ProhibitReason).join(', ')}` },
					{ status: 400 }
				);
			}
			where.prohibitReason = prohibitReasonParam as ProhibitReason;
		}

		const consumerActionParam = searchParams.get('consumerAction');
		if (consumerActionParam) {
			if (!Object.values(ConsumerAction).includes(consumerActionParam as ConsumerAction)) {
				return NextResponse.json(
					{ error: `Invalid consumerAction. Allowed values: ${Object.values(ConsumerAction).join(', ')}` },
					{ status: 400 }
				);
			}
			where.consumerAction = consumerActionParam as ConsumerAction;
		}

		const spotlight = parseBoolParam(searchParams.get('spotlight'));
		if (spotlight !== undefined) {
			where.spotlight = spotlight;
		}

		const canSubscribe = parseBoolParam(searchParams.get('canSubscribe'));
		if (canSubscribe !== undefined) {
			where.canSubscribe = canSubscribe;
		}

		const priceMin = searchParams.get('priceMin');
		const priceMax = searchParams.get('priceMax');
		if (priceMin || priceMax) {
			where.price = {
				...(priceMin ? { gte: parseFloat(priceMin) } : {}),
				...(priceMax ? { lte: parseFloat(priceMax) } : {}),
			};
		}

		const subscriptionValueMin = searchParams.get('subscriptionValueMin');
		const subscriptionValueMax = searchParams.get('subscriptionValueMax');
		if (subscriptionValueMin || subscriptionValueMax) {
			where.subscriptionValue = {
				...(subscriptionValueMin ? { gte: parseFloat(subscriptionValueMin) } : {}),
				...(subscriptionValueMax ? { lte: parseFloat(subscriptionValueMax) } : {}),
			};
		}

		const createdAtFrom = searchParams.get('createdAtFrom');
		const createdAtTo = searchParams.get('createdAtTo');
		if (createdAtFrom || createdAtTo) {
			const fromTs = parseUnixTimestamp(createdAtFrom);
			const toTs = parseUnixTimestamp(createdAtTo);
			if (fromTs !== undefined || toTs !== undefined) {
				where.createdAt = {};
				if (fromTs !== undefined) (where.createdAt as { gte?: number }).gte = fromTs;
				if (toTs !== undefined) (where.createdAt as { lte?: number }).lte = toTs;
			}
		}

		const collectionName = searchParams.get('collectionName');
		const projectName = searchParams.get('projectName');
		const creatorWalletAddress = searchParams.get('creatorWalletAddress');
		const creatorName = searchParams.get('creatorName');
		if (chainId || collectionName) {
			where.collection = {
				...((where.collection as Prisma.collectionWhereInput) || {}),
				...(chainId ? { chainId } : {}),
				...(collectionName ? { name: { contains: collectionName, mode: 'insensitive' } } : {}),
			};
		}
		if (creatorWalletAddress || creatorName || projectName) {
			where.project = {
				...((where.project as Prisma.projectWhereInput) || {}),
				...(creatorWalletAddress ? { walletAddress: creatorWalletAddress } : {}),
				...(projectName ? { name: { contains: projectName, mode: 'insensitive' } } : {}),
				...(creatorName ? { user: { userName: { contains: creatorName, mode: 'insensitive' } } } : {}),
			};
		}

		const ownerName = searchParams.get('ownerName');
		if (ownerName) {
			where.user = { userName: { contains: ownerName, mode: 'insensitive' } };
		}

		const tag = searchParams.get('tag');
		if (tag) {
			where.tags = { some: { tag: { contains: tag, mode: 'insensitive' } } };
		}

		const [total, assets] = await Promise.all([
			prisma.asset.count({ where }),
			prisma.asset.findMany({
				where,
				skip,
				take: perPage,
				orderBy,
				select: {
					id: true,
					walletAddress: true,
					chainId: true,
					contractAddress: true,
					tokenId: true,
					metadata: true,
					metadataURI: true,
					mediaUrl: true,
					animationUrl: true,
					availableQuantity: true,
					projectId: true,
					productId: true,
					collectionId: true,
					contractType: true,
					consumerAction: true,
					audience: true,
					spotlight: true,
					prohibitReason: true,
					canSubscribe: true,
					subscriptionValue: true,
					price: true,
					currencySymbol: true,
					createdAt: true,
					project: {
						select: {
							id: true,
							name: true,
							user: {
								select: {
									walletAddress: true,
									userName: true,
								},
							},
						},
					},
					collection: {
						select: {
							collectionId: true,
							name: true,
							chainId: true,
						},
					},
					user: {
						select: {
							walletAddress: true,
							userName: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							description: true,
							type: true,
							price: true,
							currencySymbol: true,
							availableQuantity: true,
							maxQuantity: true,
							forSale: true,
							audience: true,
							consumerAction: true,
							spotlight: true,
							collectionId: true,
							projectId: true,
							ownerWalletAddress: true,
							collection: {
								select: {
									collectionId: true,
									name: true,
									chainId: true,
								},
							},
							project: {
								select: {
									id: true,
									name: true,
								},
							},
							owner: {
								select: {
									walletAddress: true,
									userName: true,
								},
							},
							tags: {
								select: {
									tag: true,
									type: true,
								},
							},
						},
					},
					tags: {
						select: {
							tag: true,
							type: true,
						},
					},
				},
			}),
		]);

		let blockchainMap: Record<string, { chainId: string; name: string; logoUrl: string | null; rpcUrl: string; createdAt: number }> =
			{};
		if (includeBlockchain) {
			const chainIds = assets.map((a) => a.collection?.chainId).filter((id): id is string => !!id);
			const uniqueChainIds = Array.from(new Set(chainIds));
			if (uniqueChainIds.length > 0) {
				const blockchains = await prisma.blockchain.findMany({
					where: { chainId: { in: uniqueChainIds } },
				});
				blockchainMap = Object.fromEntries(blockchains.map((b) => [b.chainId, b]));
			}
		}

		const formattedAssets: AssetListItem[] = assets.map((asset) => ({
			id: asset.id,
			walletAddress: asset.walletAddress,
			chainId: asset.chainId,
			contractAddress: asset.contractAddress,
			tokenId: asset.tokenId,
			metadata: asset.metadata,
			metadataURI: asset.metadataURI,
			mediaUrl: asset.mediaUrl,
			animationUrl: asset.animationUrl,
			availableQuantity: asset.availableQuantity,
			projectId: asset.projectId,
			productId: asset.productId,
			collectionId: asset.collectionId,
			contractType: asset.contractType,
			consumerAction: asset.consumerAction,
			audience: asset.audience,
			spotlight: asset.spotlight,
			prohibitReason: asset.prohibitReason,
			canSubscribe: asset.canSubscribe,
			subscriptionValue: asset.subscriptionValue ? asset.subscriptionValue.toString() : null,
			price: asset.price ? asset.price.toString() : null,
			currencySymbol: asset.currencySymbol,
			createdAt: asset.createdAt,
			project: asset.project
				? {
						projectId: asset.project.id,
						name: asset.project.name,
				  }
				: null,
			collection: asset.collection
				? {
						collectionId: asset.collection.collectionId,
						name: asset.collection.name,
						chainId: asset.collection.chainId,
				  }
				: null,
			creator: asset.project?.user
				? {
						walletAddress: asset.project.user.walletAddress,
						userName: asset.project.user.userName,
				  }
				: null,
			owner: {
				walletAddress: asset.user.walletAddress,
				userName: asset.user.userName,
			},
			product: asset.product
				? {
						id: asset.product.id,
						name: asset.product.name,
						description: asset.product.description,
						type: asset.product.type,
						price: asset.product.price ? asset.product.price.toString() : '0',
						currency: asset.product.currencySymbol,
						availableQuantity: asset.product.availableQuantity,
						maxQuantity: asset.product.maxQuantity,
						forSale: asset.product.forSale,
						audience: asset.product.audience,
						consumerAction: asset.product.consumerAction,
						spotlight: asset.product.spotlight,
						collectionId: asset.product.collectionId,
						projectId: asset.product.projectId,
						ownerWalletAddress: asset.product.ownerWalletAddress,
						collection: asset.product.collection
							? {
									collectionId: asset.product.collection.collectionId,
									name: asset.product.collection.name,
									chainId: asset.product.collection.chainId,
							  }
							: null,
						project: {
							projectId: asset.product.project.id,
							name: asset.product.project.name,
						},
						owner: {
							walletAddress: asset.product.owner.walletAddress,
							userName: asset.product.owner.userName,
						},
						tags: asset.product.tags,
				  }
				: null,
			tags: asset.tags,
			...(includeBlockchain &&
				asset.collection?.chainId && {
					blockchain: blockchainMap[asset.collection.chainId],
				}),
		}));

		return NextResponse.json({
			data: formattedAssets,
			meta: {
				pagination: {
					page,
					perPage,
					total,
					totalPages: Math.ceil(total / perPage),
				},
				filters: {
					id,
					walletAddress,
					chainId,
					collectionId,
					productId,
					projectId,
					contractType: contractTypeParam,
					audience: audienceParam,
					prohibitReason: prohibitReasonParam,
					consumerAction: consumerActionParam,
					spotlight,
					canSubscribe,
					priceMin,
					priceMax,
					subscriptionValueMin,
					subscriptionValueMax,
					createdAtFrom,
					createdAtTo,
					collectionName,
					projectName,
					creatorWalletAddress,
					creatorName,
					ownerName,
					tag,
					includeBlockchain,
				},
				sort: {
					fields: orderBy,
					raw: sortParam,
				},
			},
		});
	} catch (e) {
		console.error('Failed to fetch assets:', e);
		return NextResponse.json(
			{
				error: 'Failed to fetch assets',
				message: (e as Error).message,
			},
			{ status: 500 }
		);
	}
}
