/**
 * @fileoverview Utility functions and type definitions for formatting and processing social media data.
 *
 * This module provides type definitions and utility functions for:
 * - Formatting posts with all related data (products, collections, comments, likes)
 * - Extracting traits from asset/voucher metadata
 * - Type definitions for metadata structures
 *
 * @module lib/utils
 */

import { Mimetype, Prisma, comment, asset, voucher, ContractType, ProductAudience } from '@prisma/client';

/**
 * Represents a trait/attribute pair for NFT metadata.
 */
export type Trait = {
	/** The name of the trait (e.g., "Background", "Eyes") */
	name: string;
	/** The value of the trait (e.g., "Blue", "Laser") */
	value: string;
};

/**
 * Metadata structure for NFTs, assets, and vouchers.
 * Follows the OpenSea metadata standard with additional properties.
 */
export type Metadata = {
	/** The name of the NFT/asset */
	name: string;
	/** The contract address of the NFT (optional) */
	contract_address?: string;
	/** The token ID of the NFT (optional) */
	token_id?: string;
	/** Description of the NFT/asset */
	description: string;
	/** URL to the image representing the NFT/asset */
	image: string;
	/** URL to an animation or video (optional) */
	animation_url?: string;
	/** Array of traits/attributes for the NFT */
	attributes?: Trait[];
	/** Additional properties including bundles, creators, and project info */
	properties?: {
		/** Array of bundle items (optional) */
		bundle?: {
			uri: string;
			type: string;
			name?: string;
			description?: string;
		}[];
		/** Array of creators with their share percentages (optional) */
		creators?: {
			address: string;
			name?: string;
			share: number;
		}[];
		/** Project creator information (optional) */
		project_creator?: {
			address: string;
			name?: string;
		};
	};
};

/**
 * Type definition for a post with all related data included from Prisma.
 * Includes content (products), user information, likes, comments, and shares.
 */
export type Post = Prisma.postGetPayload<{
	include: {
		content: {
			include: {
				product: {
					include: {
						asset: true;
						voucher: true;
						collection: true;
						bundle: true;
					};
				};
			};
		};
		postedBy: { select: { avatarUrl: true; userName: true; tagLine: true } };
		sharedBy: { select: { avatarUrl: true; userName: true; tagLine: true } };
		likes: true;
		comments: true;
	};
}> & { reposts: number };

/**
 * Represents a bundle item within a product.
 * Bundles are collections of media files (images, videos, etc.) associated with a product.
 */
export type Bundle = {
	/** Display order of the bundle item */
	order: number;
	/** URL to the bundle item resource */
	url: string;
	/** Local URL if the item has been cached locally */
	localUrl: string | null;
	/** Name of the bundle item */
	name: string | null;
	/** Description of the bundle item */
	description: string | null;
	/** MIME type of the bundle item */
	type: Mimetype | null;
};

/**
 * Formatted post output structure for API responses.
 * This is the standardized format returned to clients when fetching posts.
 */
export type PostOutput = {
	/** Unique identifier for the post */
	id: number;
	/** Unix timestamp (seconds) when the post was created */
	createdAt: number;
	/** Array of products associated with this post */
	products: {
		productId: number;
		name: string | null;
		description: string | null;
		imageUrl: string | null;
		audience: ProductAudience | null;
		collection: {
			collectionId: number;
			name: string | null;
			symbol: string | null;
			description: string | null;
			avatarUrl: string | null;
			bannerUrl: string | null;
			contractAddress: string | null;
			contractType: ContractType | null;
		};
		bundle: Bundle[] | null;
		traits: {
			name: string | null;
			value: string | null;
		}[];
	}[];
	/** Information about the user who posted this */
	postedBy: { avatarUrl: string | null; userName: string | null; tagLine: string | null };
	/** Total number of likes on this post */
	likes: number;
	/** Total number of shares of this post */
	shares: number;
	/** Array of comments on this post */
	comments: comment[] | null;
	/** Whether the requesting user has liked this post */
	likedByMe: boolean;
	/** Whether this post is a repost of another post */
	isRepost: boolean;
	/** Number of times this post has been reposted */
	reposts: number;
	/** Caption/text content of the post */
	caption: string | null;
};

/**
 * Extracts traits/attributes from an asset or voucher metadata.
 *
 * Parses the JSON metadata stored in the asset/voucher and extracts the attributes array.
 * Returns an empty array if the asset/voucher is undefined, has no metadata, or has no attributes.
 *
 * @param asset - The asset or voucher object containing metadata (can be undefined)
 * @returns An array of traits extracted from the metadata, or an empty array if none found
 *
 * @example
 * const traits = getTraits(asset);
 * // Returns: [{ name: "Background", value: "Blue" }, { name: "Eyes", value: "Laser" }]
 */
const getTraits = (asset?: asset | voucher): Trait[] => {
	if (!asset || !asset.metadata) return [];
	const metadata = JSON.parse(asset.metadata.toString()) as Metadata;
	return metadata.attributes ?? [];
};

/**
 * Formats a post object from the database into a structured output format for API responses.
 *
 * Transforms the raw database post object into a standardized format that includes:
 * - Aggregated counts (likes, shares, reposts)
 * - User interaction status (likedByMe, isRepost)
 * - Formatted product data with collections and traits
 * - User information for the poster
 *
 * @param post - The post object retrieved from the database with all related data
 * @param walletAddress - The wallet address of the user requesting the post (used to determine likedByMe)
 * @returns The formatted post output ready for API response
 *
 * @example
 * const formatted = formatPost(post, "0x123...");
 * // Returns: { id: 1, likes: 5, shares: 2, likedByMe: true, ... }
 */
export const formatPost = (post: Post, walletAddress: string): PostOutput => {
	const { id, createdAt, content, likes, sharedBy, comments, parentPostId } = post;

	return {
		id,
		createdAt,
		products: content.map((c) => ({
			productId: c.product?.id ?? 0,
			name: c.product?.name ?? null,
			description: c.product?.description ?? null,
			imageUrl: c.product?.asset?.[0]?.mediaUrl ?? c.product?.voucher?.mediaUrl ?? null,
			audience: c.product?.audience ?? null,
			collection: {
				collectionId: c.product?.collection?.collectionId ?? 0,
				name: c.product?.collection?.name ?? null,
				symbol: c.product?.collection?.symbol ?? null,
				description: c.product?.collection?.description ?? null,
				avatarUrl: c.product?.collection?.avatarUrl ?? null,
				bannerUrl: c.product?.collection?.bannerUrl ?? null,
				contractAddress: c.product?.collection?.contractAddress ?? null,
				contractType: c.product?.collection?.contractType ?? null,
			},
			traits: getTraits(c.product?.asset?.[0] ?? c.product?.voucher ?? undefined),
			bundle:
				c.product?.bundle?.map((a) => ({
					order: a.order,
					url: a.url,
					localUrl: a.localUrl,
					name: a.name,
					description: a.description,
					type: a.type,
				})) ?? null,
		})),
		likes: likes.length,
		shares: sharedBy.length,
		comments,
		likedByMe: likes.some((like) => like.fromWalletAddress === walletAddress),
		isRepost: parentPostId != null && parentPostId > 0,
		postedBy: {
			avatarUrl: post.postedBy.avatarUrl,
			userName: post.postedBy.userName,
			tagLine: post.postedBy.tagLine,
		},
		reposts: post.reposts,
		caption: post.caption,
	};
};

/**
 * Formats an array of posts from the database into structured output format.
 *
 * Convenience function that applies formatPost to each post in an array.
 *
 * @param posts - Array of post objects retrieved from the database
 * @param walletAddress - The wallet address of the user requesting the posts
 * @returns Array of formatted post outputs
 *
 * @example
 * const formatted = formatPosts(posts, "0x123...");
 * // Returns: [{ id: 1, ... }, { id: 2, ... }]
 */
export const formatPosts = (posts: Post[], walletAddress: string): PostOutput[] => {
	return posts.map((post) => formatPost(post, walletAddress));
};
