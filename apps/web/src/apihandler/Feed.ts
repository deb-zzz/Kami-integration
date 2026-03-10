'use server';

import { createSignature } from '@/lib/Util';
import { ExploreType, FeedContent, FeedType, FollowingType } from '@/types';
import { axiosInstance } from './AxiosInstance';

export const getTrendingFeed = async (
	address?: string,
	options?: {
		page?: number;
		searchText?: string;
		limit?: number;
	}
) => {
	const res = await axiosInstance.get(
		`/feed-service/${address ?? ''}/trending?page=${options?.page ?? 1}&${
			options?.searchText ? `search=${options?.searchText}` : ''
		}&limit=${options?.limit ?? 5}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		}
	);

	return <{ success: boolean; feed: FeedType[] }>res.data;
};

export const getFollowingFeed = async (address: string) => {
	const res = await axiosInstance.get(`/feed-service/${address}/following`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});

	return <{ success: boolean; following: FollowingType[] }>res.data;
};

export const getFavouriteFeed = async (address: string) => {
	const res = await axiosInstance.get(`/feed-service/${address}/favourites`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});

	return <{ success: boolean; data: FeedType[] }>res.data;
};

export const getExploreFeed = async (
	address: string,
	options?: { page?: number; searchText?: string; limit?: number }
) => {
	const res = await axiosInstance.get(
		`/feed-service/${address}/explore?page=${options?.page ?? 1}&${
			options?.searchText ? `search=${options?.searchText}` : ''
		}&limit=${options?.limit ?? 5}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		}
	);
	return <{ success: boolean; explore: ExploreType[] }>res.data;
};

export const likePost = async (
	address: string,
	id: number,
	isLiked?: boolean
) => {
	const res = await axiosInstance.post(
		`/social-service/${address}/post/${id}/like`,
		{},
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature({}),
			},
		}
	);
	// console.log(res.data);
	return <any>res.data;
};

export const unlikePost = async (address: string, id: number) => {
	try {
		const res = await axiosInstance.delete(
			`/social-service/${address}/post/${id}/like`,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature({}),
				},
			}
		);
		return <{ success: boolean }>res.data;
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
	// console.log(res.data);
};
