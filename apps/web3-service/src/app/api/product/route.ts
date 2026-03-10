import { prisma } from '@/lib/db';
import { Prisma, ProductType, ProductAudience, ConsumerAction, ProhibitReason } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * ============================================================================
 * SUPPORTED FILTERS
 * ============================================================================
 *
 * DIRECT PRODUCT FIELDS:
 * - id: number (exact match)
 * - name: string (contains, case-insensitive)
 * - description: string (contains, case-insensitive)
 * - type: ProductType enum (Standard, Claimable, Series)
 * - currency: string (exact match on currencySymbol)
 * - priceMin / priceMax: number (range)
 * - availableQuantityMin / availableQuantityMax: number (range)
 * - subscriptionValueMin / subscriptionValueMax: number (range)
 * - forSale: boolean (true/false)
 * - spotlight: boolean (true/false)
 * - canSubscribe: boolean (true/false)
 * - audience: ProductAudience enum (Public, Private, Whitelist, PublicBan, Prohibit)
 * - prohibitReason: ProhibitReason enum (NSFW, INFRINGEMENT)
 * - consumerAction: ConsumerAction enum (Buy, Subscribe, Rent, Claim, None)
 * - createdAtFrom / createdAtTo: ISO date string (range)
 *
 * PROJECT FILTERS:
 * - projectId: number (exact match)
 * - projectName: string (contains, case-insensitive)
 *
 * COLLECTION FILTERS:
 * - collectionId: number (exact match)
 * - collectionName: string (contains, case-insensitive)
 *
 * USER FILTERS:
 * - creatorWalletAddress: string (exact match on project.walletAddress)
 * - creatorName: string (contains, case-insensitive on project.user.userName)
 * - ownerWalletAddress: string (exact match)
 * - ownerName: string (contains, case-insensitive on owner.userName)
 *
 * TAG FILTER:
 * - tag: string (contains, case-insensitive)
 *
 * ============================================================================
 * SUPPORTED SORTING
 * ============================================================================
 *
 * DIRECT PRODUCT FIELDS:
 * - id, name, description, type, price, currency, availableQuantity
 * - subscriptionValue, forSale, spotlight, canSubscribe
 * - audience, prohibitReason, consumerAction, createdAt
 * - projectId, collectionId
 *
 * NESTED RELATION FIELDS:
 * - projectName (sorts by project.name)
 * - collectionName (sorts by collection.name)
 * - creatorName (sorts by project.user.userName)
 * - ownerName (sorts by owner.userName)
 *
 * AGGREGATION FIELDS:
 * - likeCount (sorts by count of likes)
 * - followCount (sorts by count of follows)
 * - subscriberCount (sorts by count of subscribers)
 *
 * Multi-sort format: "field1,order1;field2,order2"
 * Example: "spotlight,desc;likeCount,desc;createdAt,desc"
 */

type ProductListItem = {
	id: number;
	name: string;
	description: string | null;
	type: string;
	price: string;
	currency: string | null;
	availableQuantity: number;
	maxQuantity: number | null; // 0 = unlimited supply
	totalMinted: number; // Count of assets linked to this product
	isUnlimited: boolean; // true when maxQuantity === 0
	canSubscribe: boolean;
	subscriptionValue: string | null;
	forSale: boolean;
	audience: string;
	prohibitReason: string | null;
	consumerAction: string;
	spotlight: boolean;
	createdAt: number;

	// Media url (from voucher or first asset)
	mediaUrl: string | null;
	animationUrl: string | null;

	// Project Info
	projectId: number;
	project: {
		projectId: number;
		name: string;
	};

	// Collection Info
	collectionId: number | null;
	collection: {
		collectionId: number;
		name: string;
		chainId: string;
	} | null;

	// Creator Info
	creator: {
		walletAddress: string;
		userName: string;
	};

	// Owner Info
	owner: {
		walletAddress: string;
		userName: string;
	};

	// Tags
	tags: Array<{
		tag: string;
		type: string;
	}>;

	// Optional blockchain data
	blockchain?: {
		chainId: string;
		name: string;
		logoUrl: string | null;
		rpcUrl: string;
		createdAt: number;
	};

	// Aggregations count (only when sorting by these fields)
	likeCount?: number;
	followCount?: number;
	subscriberCount?: number;
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

const nestedSortBuilder: Record<string, (order: 'asc' | 'desc') => Prisma.productOrderByWithRelationInput> = {
	projectName: (order) => ({ project: { name: order } }),
	collectionName: (order) => ({ collection: { name: order } }),
	creatorName: (order) => ({ project: { user: { userName: order } } }),
	ownerName: (order) => ({ owner: { userName: order } }),
};

const aggregationFields: Record<string, string> = {
	likeCount: 'likes',
	followCount: 'follows',
	subscriberCount: 'subscribers',
};

const DECIMAL_NULLABLE_FIELDS = new Set(['price', 'subscriptionValue']);

export async function GET(req: NextRequest): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(req.url);

		// Check if blockchain data is requested
		const includeBlockchain = parseBoolParam(searchParams.get('includeBlockchain')) ?? false;

		// Pagination
		const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
		const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '10', 10)));
		const skip = (page - 1) * perPage;

		// Multi-field sorting (format: field1,order1;field2,order2)
		// Examples: "spotlight,desc;createdAt,desc" or "name,asc"
		const sortParam = searchParams.get('sort') || 'createdAt,desc';
		const sortPairs = sortParam
			.split(';')
			.map((pair) => pair.trim())
			.filter(Boolean);
		const orderBy: Prisma.productOrderByWithRelationInput[] = [];
		let hasAggregationSort = false;

		// Parse multiple sort fields separated by semicolon
		for (const pair of sortPairs) {
			const [field, orderRaw] = pair.split(',').map((s) => s.trim());
			const order = (orderRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

			// Validate field is allowed
			if (aggregationFields[field]) {
				hasAggregationSort = true;
				orderBy.push({
					[aggregationFields[field]]: { _count: order },
				});
			} else if (nestedSortBuilder[field]) {
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

		// Fallback to default if no valid sorts
		if (orderBy.length === 0) {
			orderBy.push({ createdAt: 'desc' });
		}

		// Build where clause
		const where: Prisma.productWhereInput = {};

		// Direct product filters
		const id = searchParams.get('id');
		if (id) {
			where.id = parseInt(id, 10);
		}

		const name = searchParams.get('name') || undefined;
		if (name) {
			where.name = { contains: name, mode: 'insensitive' };
		}

		const description = searchParams.get('description') || undefined;
		if (description) {
			where.description = { contains: description, mode: 'insensitive' };
		}

		const currency = searchParams.get('currency') || undefined;
		if (currency) {
			where.currencySymbol = currency;
		}

		const ownerWalletAddress = searchParams.get('ownerWalletAddress') || undefined;
		if (ownerWalletAddress) {
			where.ownerWalletAddress = ownerWalletAddress;
		}

		// Enum filters with validation
		const typeParam = searchParams.get('type');
		if (typeParam) {
			if (!Object.values(ProductType).includes(typeParam as ProductType)) {
				return NextResponse.json(
					{ error: `Invalid type. Allowed values: ${Object.values(ProductType).join(', ')}` },
					{ status: 400 }
				);
			}
			where.type = typeParam as ProductType;
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

		// Boolean filters
		const forSale = parseBoolParam(searchParams.get('forSale'));
		if (forSale !== undefined) {
			where.forSale = forSale;
		}

		const spotlight = parseBoolParam(searchParams.get('spotlight'));
		if (spotlight !== undefined) {
			where.spotlight = spotlight;
		}

		const canSubscribe = parseBoolParam(searchParams.get('canSubscribe'));
		if (canSubscribe !== undefined) {
			where.canSubscribe = canSubscribe;
		}

		// Range filters
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

		const availableQuantityMin = searchParams.get('availableQuantityMin');
		const availableQuantityMax = searchParams.get('availableQuantityMax');
		if (availableQuantityMin || availableQuantityMax) {
			where.availableQuantity = {
				...(availableQuantityMin ? { gte: parseInt(availableQuantityMin, 10) } : {}),
				...(availableQuantityMax ? { lte: parseInt(availableQuantityMax, 10) } : {}),
			};
		}

		// Date range filter
		const createdAtFrom = searchParams.get('createdAtFrom');
		const createdAtTo = searchParams.get('createdAtTo');
		if (createdAtFrom || createdAtTo) {
			const fromTs = parseUnixTimestamp(createdAtFrom);
			const toTs = parseUnixTimestamp(createdAtTo);

			if (fromTs !== undefined || toTs !== undefined) {
				where.createdAt = {};
				if (fromTs !== undefined) where.createdAt.gte = fromTs;
				if (toTs !== undefined) where.createdAt.lte = toTs;
			}
		}

		// ID filters
		const projectId = searchParams.get('projectId');
		if (projectId) {
			where.projectId = parseInt(projectId, 10);
		}

		const collectionId = searchParams.get('collectionId');
		if (collectionId) {
			where.collectionId = parseInt(collectionId, 10);
		}

		// Nested filters
		const chainId = searchParams.get('chainId');
		const collectionName = searchParams.get('collectionName');
		if (chainId || collectionName) {
			where.collection = {
				...((where.collection as Prisma.collectionWhereInput) || {}),
				...(chainId ? { chainId } : {}),
				...(collectionName ? { name: { contains: collectionName, mode: 'insensitive' } } : {}),
			};
		}

		const creatorWalletAddress = searchParams.get('creatorWalletAddress');
		const creatorName = searchParams.get('creatorName');
		const projectName = searchParams.get('projectName');
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
			where.owner = { userName: { contains: ownerName, mode: 'insensitive' } };
		}

		const tag = searchParams.get('tag');
		if (tag) {
			where.tags = { some: { tag: { contains: tag, mode: 'insensitive' } } };
		}

		// Execute queries in parallel
		const [total, products] = await Promise.all([
			prisma.product.count({ where }),
			prisma.product.findMany({
				where,
				skip,
				take: perPage,
				orderBy,
				select: {
					id: true,
					name: true,
					description: true,
					type: true,
					metadata: true,
					price: true,
					currencySymbol: true,
					availableQuantity: true,
					maxQuantity: true,
					canSubscribe: true,
					subscriptionValue: true,
					forSale: true,
					audience: true,
					prohibitReason: true,
					consumerAction: true,
					spotlight: true,
					createdAt: true,
					projectId: true,
					collectionId: true,
					voucher: {
						select: {
							mediaUrl: true,
							animationUrl: true,
						},
					},
					asset: {
						select: {
							mediaUrl: true,
							animationUrl: true,
						},
					},
					_count: {
						select: {
							asset: true,
							...(hasAggregationSort && {
								likes: true,
								follows: true,
								subscribers: true,
							}),
						},
					},
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
			}),
		]);

		// Only fetch blockchain data if requested
		let blockchainMap: Record<string, any> = {};
		if (includeBlockchain) {
			const chainIds = products.map((p) => p.collection?.chainId).filter((id): id is string => !!id);

			const uniqueChainIds = Array.from(new Set(chainIds)); // Using Array.from() instead of spread

			if (uniqueChainIds.length > 0) {
				const blockchains = await prisma.blockchain.findMany({
					where: { chainId: { in: uniqueChainIds } },
				});
				blockchainMap = Object.fromEntries(blockchains.map((b) => [b.chainId, b]));
			}
		}

		// Format products for admin table view
		const formattedProducts: ProductListItem[] = products.map((product) => {
			// Check if unlimited supply (maxQuantity = 0 or null)
			const isUnlimited = product.maxQuantity === 0 || product.maxQuantity === null;

			return {
				id: product.id,
				name: product.name,
				description: product.description,
				type: product.type,
				metadata: product.metadata,
				price: product.price ? product.price.toString() : '0',
				currency: product.currencySymbol,
				availableQuantity: product.availableQuantity,
				maxQuantity: product.maxQuantity,
				totalMinted: product._count.asset, // Count of assets linked to this product
				isUnlimited,
				canSubscribe: product.canSubscribe,
				subscriptionValue: product.subscriptionValue ? product.subscriptionValue.toString() : null,
				forSale: product.forSale,
				audience: product.audience,
				prohibitReason: product.prohibitReason,
				consumerAction: product.consumerAction,
				spotlight: product.spotlight,
				createdAt: product.createdAt,

				// Media
				mediaUrl: product.asset?.[0]?.mediaUrl ?? product.voucher?.mediaUrl ?? null,
				animationUrl: product.asset?.[0]?.animationUrl ?? product.voucher?.animationUrl ?? null,

				// Project Info
				projectId: product.projectId,
				project: {
					projectId: product.project.id,
					name: product.project.name,
				},

				// Collection info
				collectionId: product.collectionId,
				collection: product.collection
					? {
							collectionId: product.collection.collectionId,
							name: product.collection.name,
							chainId: product.collection.chainId,
					  }
					: null,

				// Blockchain info
				...(includeBlockchain &&
					product.collection?.chainId && {
						blockchain: blockchainMap[product.collection.chainId],
					}),

				// Creator info
				creator: {
					walletAddress: product.project.user.walletAddress,
					userName: product.project.user.userName,
				},

				// Owner info
				owner: {
					walletAddress: product.owner.walletAddress,
					userName: product.owner.userName,
				},

				// Tags
				tags: product.tags,

				// Aggregation counts (only when sorting by these fields)
				...(hasAggregationSort && {
					likeCount: (product._count as any).likes,
					followCount: (product._count as any).follows,
					subscriberCount: (product._count as any).subscribers,
				}),
			};
		});

		return NextResponse.json({
			data: formattedProducts,
			meta: {
				pagination: {
					page,
					perPage,
					total,
					totalPages: Math.ceil(total / perPage),
				},
				filters: {
					id,
					name,
					description,
					type: typeParam,
					currency,
					priceMin,
					priceMax,
					subscriptionValueMin,
					subscriptionValueMax,
					availableQuantityMin,
					availableQuantityMax,
					ownerWalletAddress,
					creatorWalletAddress,
					forSale,
					spotlight,
					canSubscribe,
					audience: audienceParam,
					prohibitReason: prohibitReasonParam,
					consumerAction: consumerActionParam,
					projectId,
					collectionId,
					chainId,
					projectName,
					collectionName,
					creatorName,
					ownerName,
					tag,
					createdAtFrom,
					createdAtTo,
					includeBlockchain,
				},
				sort: {
					fields: orderBy,
					raw: sortParam,
				},
			},
		});
	} catch (e) {
		console.error('Failed to fetch products:', e);
		return NextResponse.json(
			{
				error: 'Failed to fetch products',
				message: (e as Error).message,
			},
			{ status: 500 }
		);
	}
}
