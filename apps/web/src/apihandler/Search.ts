'use server';

import { axiosInstance } from './AxiosInstance';

export type SearchProfile = {
	walletAddress: string;
	userName: string;
	displayName: string;
	firstName: string;
	lastName: string;
	avatarUrl: string;
	bannerUrl: string;
	tagLine: string;
	tags: {
		id: number;
		tag: string;
		type: string;
	}[];
	followerCount: number;
	isFollowing: boolean;
};

export type SearchProduct = {
	id: number;
	name: string;
	description: string;
	price: string;
	currency: string;
	type: string;
	audience: string;
	availableQuantity: number;
	forSale: boolean;
	tags: {
		id: number;
		tag: string;
		type: string;
	}[];
	mediaUrl: string;
	owner: {
		walletAddress: string;
		userName: string;
		displayName: string;
		avatarUrl: string;
	};
	collection: {
		id: number;
		name: string;
		avatarUrl: string;
	};
	isLiked: boolean;
	isFollowing: boolean;
	isOwned: boolean;
};

export type SearchCollection = {
	collectionId: number;
	name: string;
	description: string;
	avatarUrl: string;
	bannerUrl: string;
	symbol: string;
	chainId: string;
	contractAddress: string;
	itemCount: number;
	previewItems: {
		id: number;
		name: string;
		tags: {
			id: number;
			tag: string;
			type: string;
		}[];
		mediaUrl: string;
	}[];
	owner: {
		walletAddress: string;
		userName: string;
		displayName: string;
		avatarUrl: string;
	};
	followerCount: number;
	isFollowing: boolean;
	isOwned: boolean;
};

export type SearchTag = {
	id: number;
	tag: string;
	type: string;
	createdAt: string;
	usageCount: {
		users: number;
		products: number;
		assets: number;
		vouchers: number;
		total: number;
	};
};

export type SearchResults = {
	profiles: SearchProfile[];
	products: SearchProduct[];
	collections: SearchCollection[];
	tags: SearchTag[];
};

export type SearchResponse = {
	success: boolean;
	results: SearchResults;
};

export const searchAll = async (
	walletAddress: string,
	query: string,
	options?: {
		tag?: string;
		limit?: number;
	}
): Promise<SearchResponse> => {
	try {
		const params = new URLSearchParams({
			q: query,
			...(options?.limit && { limit: options.limit.toString() }),
			...(options?.tag && { tag: options.tag }),
		});

		const res = await axiosInstance.get(
			`/feed-service/${walletAddress}/search?${params.toString()}`,
			{
				headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
			}
		);

		return res.data;
	} catch (error) {
		console.error('Search error:', error);
		return {
			success: false,
			results: {
				profiles: [],
				products: [],
				collections: [],
				tags: [],
			},
		};
	}
};
