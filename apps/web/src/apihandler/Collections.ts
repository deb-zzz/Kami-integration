'use server';
import { CollectionType, ProductType } from '@/types';
import { axiosInstance, createSignature } from './AxiosInstance';
import { convertIPFSUrl } from '@/lib/Util';
import { cache } from '@/lib/cache';

export const getACollection = async (address: string, id: number) => {
	const res = await axiosInstance.get(
		`/collections-service/${address}/${id}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	// console.log(res.data);
	res.data.avatarUrl = convertIPFSUrl(res.data.avatarUrl);
	res.data.bannerUrl = convertIPFSUrl(res.data.bannerUrl);
	if (res.data.products) {
		res.data.products.forEach((product: ProductType) => {
			product.imageUrl = convertIPFSUrl(product.imageUrl) ?? '';
			if (product.animationUrl) {
				product.animationUrl =
					convertIPFSUrl(product.animationUrl) ?? undefined;
			}
		});
	}
	return <CollectionType>res.data;
};
export const cachedGetACollection = cache(async (id: number) => {
	const res = await axiosInstance.get(`/collections-service/byId/${id}`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	// console.log(res.data);
	res.data.avatarUrl = convertIPFSUrl(res.data.avatarUrl);
	res.data.bannerUrl = convertIPFSUrl(res.data.bannerUrl);
	if (res.data.products) {
		res.data.products.forEach((product: ProductType) => {
			product.imageUrl = convertIPFSUrl(product.imageUrl) ?? '';
			if (product.animationUrl) {
				product.animationUrl =
					convertIPFSUrl(product.animationUrl) ?? undefined;
			}
		});
	}
	return <CollectionType>res.data;
});

export const createCollection = async (
	address: string,
	newCollection: {
		name?: string;
		description?: string;
		symbol?: string;
		projectId: number;
		type: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
		chainId: string;
	},
) => {
	const res = await axiosInstance.post(
		`/collections-service/${address}`,
		{
			...newCollection,
		},
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	// console.log(res.data);
	return <
		{
			collectionId: number;
			projectId: number;
			name: string;
			symbol: string;
			description: string;
			avatarUrl: string;
			bannerUrl: string;
			contractAddress: string;
			contractType: string;
			ownerWalletAddress: string;
			createdAt: number;
		}
	>res.data;
};

export const getAllCollectionForProfile = async (
	address: string,
	userAddress: string | undefined,
	withProducts: boolean = false,
) => {
	const res = await axiosInstance.get(
		`/collections-service/${address}${userAddress ? '?userWalletAddress=' + userAddress : ''}${withProducts ? '&withProducts=true' : ''}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	res.data.collections.forEach((collection: CollectionType) => {
		collection.avatarUrl = convertIPFSUrl(collection.avatarUrl);
		collection.bannerUrl = convertIPFSUrl(collection.bannerUrl);
	});
	return <{ collections: CollectionType[] }>{
		collections: res.data.collections,
	};
};

export const likeCollection = async (address: string, id: number) => {
	const res = await axiosInstance.post(
		`/social-service/${address}/collection/${id}/like`,
		{},
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature({}),
			},
		},
	);
	// console.log(res.data);
	return <any>res.data;
};

export const unlikeCollection = async (address: string, id: number) => {
	try {
		const res = await axiosInstance.delete(
			`/social-service/${address}/collection/${id}/like`,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature({}),
				},
			},
		);
		return <{ success: boolean }>res.data;
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
	// console.log(res.data);
};

export const updateCollection = async (
	address: string,
	id: number,
	data: {
		description?: string;
		avatarUrl?: string;
		bannerUrl?: string;
	},
) => {
	try {
		const res = await axiosInstance.put(
			`/collections-service/${address}/${id}`,
			data,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature({}),
				},
			},
		);
		return <{ success: boolean }>res.data;
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
	// console.log(res.data);
};
