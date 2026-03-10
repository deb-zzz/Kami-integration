'use server';
import { createSignature } from '@/lib/Util';
import { FeedContent, FeedType, ProductType, SocialPost } from '@/types';
import { axiosInstance } from './AxiosInstance';
import { cache } from '@/lib/cache';

type ViewCounterReturn = { success: boolean; error?: any };

export const addView = async (
	address: string,
	postId: number
): Promise<ViewCounterReturn> => {
	if (!address) return { success: false };
	try {
		const res = await axiosInstance.post(
			`/post-service/${address}/${postId}/addView`,
			{},
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature({}),
				},
			}
		);
		return <{ success: boolean }>res.data;
	} catch (e) {
		console.error(e, 'here');
		return { success: false, error: (e as Error).message };
	}
};

type CreatePost = {
	contentIDs: { collectionId?: number; productId?: number | undefined }[];
	comment: string | null;
	status?: string;
};
export const createPost = async (address: string, data: CreatePost) => {
	const res = await axiosInstance.post(`/post-service/${address}`, data, {
		headers: {
			Authorization: `Bearer ${String(process.env.AUTH)}`,
			signature: createSignature(data),
		},
	});
	return <{ success: boolean }>res.data;
};

export const repost = async (
	address: string,
	id: number,
	data?: { comment?: string }
) => {
	const res = await axiosInstance.post(
		`/post-service/${address}/${id}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data ? data : {}),
			},
		}
	);

	return <{ success: boolean }>res.data;
};

export const likeComment = async (address: string, id: number) => {
	const res = await axiosInstance.post(
		`/social-service/${address}/comment/${id}/like`,
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

export const unlikeComment = async (address: string, id: number) => {
	try {
		const res = await axiosInstance.delete(
			`/social-service/${address}/comment/${id}/like`,
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

export const commentPost = async (
	address: string,
	id: number,
	data: { comment: string }
) => {
	const res = await axiosInstance.post(
		`/social-service/${address}/post/${id}/comment`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		}
	);
	return <{ success: boolean }>res.data;
};

export const getProduct = async (address: string, productId: number) => {
	const res = await axiosInstance.get(
		`/web3-service/product/${productId}?walletAddress=${address}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		}
	);

	res.data;
	return <ProductType>res.data;
};

export const cachedGetProduct = cache(async (productId: number) => {
	const res = await axiosInstance.get(`/web3-service/product/${productId}`, {
		headers: {
			Authorization: `Bearer ${String(process.env.AUTH)}`,
		},
	});
	res.data;
	return <ProductType>res.data;
});

export const replyComment = async (
	address: string,
	id: number,
	data: { comment: string; replyToCommentId: number }
) => {
	const res = await axiosInstance.post(
		`/social-service/${address}/post/${id}/comment`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		}
	);
	return <{ success: boolean }>res.data;
};

export const deletePost = async (address: string, id: number) => {
	try {
		const res = await axiosInstance.delete(
			`/post-service/${address}/${id}`,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature({}),
				},
			}
		);
		return res.data;
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
};

export const getSinglePost = async (postId: number, walletAddress?: string) => {
	const res = await axiosInstance.get(
		`/post-service/post/${postId}${
			walletAddress ? `?walletAddress=${walletAddress}` : ''
		}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		}
	);
	// console.log('getting project', res.data);

	return <{ success: boolean; posts: FeedType[] }>res.data;
};

export const cachedGetSinglePost = cache(async (postId: number) => {
	const res = await axiosInstance.get(`/post-service/post/${postId}`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});

	return <{ success: boolean; posts: FeedType[] }>res.data;
});

export const pinPost = async (address: string, data: { post_id: number }) => {
	const res = await axiosInstance.post(
		`/profile-service/${address}/pin`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		}
	);
	return <{ success: boolean }>res.data;
};

export const getPinnedPost = async (address: string) => {
	const res = await axiosInstance.get(`/profile-service/${address}/pin`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	// console.log('getting project', res.data);
	return <{ success: boolean; pinnedPost: SocialPost }>res.data;
};

export const trackPostShareApi = async (address: string, postId: number) => {
	const res = await axiosInstance.post(
		`/social-service/${address}//post/${postId}/share`,
		{},
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature({}),
			},
		}
	);
	return <{ success: boolean }>res.data;
};
