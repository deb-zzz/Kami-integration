'use server';

import { convertIPFSUrl, createSignature } from '@/lib/Util';
import {
	AllProjectType,
	CollaboratorType,
	CollectionType,
	FollowersType,
	FollowingType,
	ProductType,
	Profile,
	ProfileCreate,
	ProfileEdit,
	ProfileProduct,
	SocialPost,
	Tag,
} from '@/types';
import axios, { Axios, AxiosError } from 'axios';
import { axiosInstance } from './AxiosInstance';
import { cache } from '@/lib/cache';

export const getProfiles = async () => {
	// console.log(process.env.AUTH);
	const res = await axiosInstance.get('/profile-service', {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});

	return res.data;
};

export const getProfile = async (address: string) => {
	try {
		const res = await axiosInstance.get(`/profile-service/${address}`, {
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		});
		return <{ success: true; profile: Profile }>res.data;
	} catch (e) {
		return <{ success: false; status: number }>{
			success: false,
			status: (e as AxiosError).status,
		};
	}
};

export const cachedGetProfile = cache(async (address: string) => {
	try {
		const res = await axiosInstance.get(`/profile-service/${address}`, {
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		});
		return <{ success: true; profile: Profile }>res.data;
	} catch (e) {
		return <{ success: false; status: number }>{
			success: false,
			status: (e as AxiosError).status,
		};
	}
});

type EditReturn = { success: boolean; profile?: Profile; error?: any };

export const editProfile = async (
	address: string,
	data: ProfileEdit,
): Promise<EditReturn> => {
	try {
		const res = await axiosInstance.put(
			`/profile-service/${address}`,
			{ ...data },
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature(data),
				},
			},
		);
		return <{ success: boolean; profile: Profile }>res.data;
	} catch (e) {
		console.error(e, 'here');
		return { success: false, error: (e as Error).message };
	}
};

export type ProfileTag = {
	tag: string;
	type: string;
};

export const addTags = async (
	address: string,
	data: ProfileTag | ProfileTag[],
): Promise<EditReturn> => {
	try {
		const res = await axiosInstance.post(
			`/profile-service/${address}/tags`,
			data,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature(data),
				},
			},
		);
		return <{ success: boolean; profile: Profile }>res.data;
	} catch (e) {
		console.error(e, 'here');
		return { success: false, error: (e as Error).message };
	}
};

export const removeTags = async (
	address: string,
	data: number | number[],
): Promise<EditReturn> => {
	try {
		const res = await axiosInstance.delete(
			`/profile-service/${address}/tags`,
			{
				data: { tagId: data },
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature({ tagId: data }),
				},
			},
		);
		return <{ success: boolean; profile: Profile }>res.data;
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
};

export const createProfile = async (data: ProfileCreate) => {
	let res;
	try {
		res = await axiosInstance.post(
			`/profile-service`,
			{ ...data },
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature(data),
				},
			},
		);
	} catch (e) {
		console.error('Error creating profile:', (e as AxiosError).message);
		return {
			success: false,
			profile: null,
			error: (e as AxiosError).message,
		};
	}
	if (res.data.success)
		console.log(`Profile created successfully for ${data.userName}`);
	else console.error(`Failed to create profile for ${data.userName}`);
	return <
		{ success: boolean; profile: Profile | null; error: string | null }
	>res.data;
};

type ImageReturn = {
	url: string;
	path: string;
	error?: string;
};

export const uploadAvatar = async (
	fileName: string,
	mimetype: string,
	profileName: string,
) => {
	const data = {
		folder: 'profilePic',
		name: fileName,
		type: mimetype,
	};
	const res = await axiosInstance.post(
		`/media-service/s3/url?c=${'Profile'}&id=${profileName}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	// console.log(res.data);
	return <ImageReturn>res.data;
};

export const uploadBanner = async (
	fileName: string,
	mimetype: string,
	profileName: string,
) => {
	const data = {
		folder: 'profileBanner',
		name: fileName,
		type: mimetype,
	};

	const res = await axiosInstance.post(
		`/media-service/s3/url?c=${'Profile'}&id=${profileName}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	// console.log(res.data);
	return <ImageReturn>res.data;
};

export const getProfileProducts = async (address: string) => {
	// console.log('in trending feed');
	const res = await axiosInstance.get(
		`/profile-service/${address}?withProducts&withAssets`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	// console.log(res.data);

	return <{ success: boolean; profile: ProfileProduct }>res.data;
};

export const followProfile = async (
	address: string,
	profileAddress: string,
) => {
	const res = await axiosInstance.post(
		`/social-service/${profileAddress}/profile/${address}/follow`,
		{},
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature({}),
			},
		},
	);
	// console.log(res.data);
	return <{ success: boolean }>res.data;
};

export const unfollowProfile = async (
	address: string,
	profileAddress: string,
) => {
	try {
		const res = await axiosInstance.delete(
			`/social-service/${profileAddress}/profile/${address}/follow`,
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

export const getFollowInfo = async (address: string) => {
	// console.log('in trending feed');
	const res = await axiosInstance.get(`/profile-service/${address}/follow`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	// console.log(res.data);
	return <{ followers: string[]; following: string[] }>res.data;
};

export const getProfileSocialPost = async (address: string) => {
	// console.log('in trending feed');
	const res = await axiosInstance.get(
		`/social-service/${address}/profile/posts/me`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	res.data.posts.forEach((post: SocialPost) => {
		post.products.forEach((product: any) => {
			product.imageUrl = convertIPFSUrl(product.imageUrl) ?? '';
		});
	});

	return <{ success: boolean; posts: SocialPost[] }>res.data;
};

export const getProfileSocialInteractedPost = async (address: string) => {
	// console.log('in trending feed');
	const res = await axiosInstance.get(
		`/social-service/${address}/profile/posts/others`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	res.data.posts.forEach((post: SocialPost) => {
		post.products.forEach((product: any) => {
			product.imageUrl = convertIPFSUrl(product.imageUrl) ?? '';
		});
	});

	return <{ success: boolean; posts: SocialPost[] }>res.data;
};

export const getSpotlight = async (address: string) => {
	const res = await axiosInstance.get(
		`/profile-service/${address}/spotlight`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	// res.data.forEach((item: any) => {
	// 	replaceVoucherWithAsset(item);
	// });

	// need to double check how the data look if it's deployed for spotlight
	return <any>res.data;
};
export const getSpotlightStatus = async (address: string) => {
	const res = await axiosInstance.get(`/feed-service/${address}/spotlight`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	return <{ success: boolean; showSpotlight: boolean }>res.data;
};

export const updateSpotlightStatus = async (
	address: string,
	id: number,
	data: { spotlight: boolean },
) => {
	try {
		const res = await axiosInstance.put(
			`/profile-service/${address}/spotlight/${id}`,
			data,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
					signature: createSignature(data),
				},
			},
		);
		return <{ success: boolean }>res.data;
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
};

export const switchSpotlight = async (
	address: string,
	data: { showSpotlight: boolean },
) => {
	const res = await axiosInstance.put(
		`/feed-service/${address}/spotlight`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);

	return <{ success: boolean; showSpotlight: boolean }>res.data;
};

export const getCollaboration = async (address: string) => {
	const res = await axiosInstance.get(
		`/profile-service/${address}/collaborations`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);

	res.data.collaborations.collections.forEach(
		(collection: CollectionType) => {
			collection.avatarUrl = convertIPFSUrl(collection.avatarUrl);
			collection.bannerUrl = convertIPFSUrl(collection.bannerUrl);
		},
	);
	return <
		{
			success: boolean;
			collaborations: {
				projects: AllProjectType[];
				collections: CollectionType[];
			};
		}
	>res.data;
};

export const getUsernames = async (username: string) => {
	const res = await axiosInstance.get(
		`/profile-service/auth?username=` + username,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	return <
		{
			success: boolean;
			usernames: string[];
		}
	>res.data;
};

export const getFollowing = async (address: string) => {
	// console.log('in trending feed');
	const res = await axiosInstance.get(
		`/social-service/${address}/profile/following`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	// console.log(res.data);
	return <{ success: boolean; following: FollowingType[] }>res.data;
};

export const getFollowers = async (address: string) => {
	// console.log('in trending feed');
	const res = await axiosInstance.get(
		`/social-service/${address}/profile/followers`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	// console.log(res.data);
	return <{ success: boolean; followers: FollowersType[] }>res.data;
};

export const getSigil = async (address: string) => {
	try {
		const res = await axiosInstance.get(
			`/referral-service/referrals/sigil?walletAddress=${address}`,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
				},
			},
		);
		return <{ sigil: string; error?: string }>res.data;
	} catch (error) {
		console.error('Error fetching sigil:', error);
		return { sigil: null, error: (error as Error).message };
	}
};

export const getSigilById = async (id: string) => {
	const res = await axiosInstance.get(`/referral-service/sigils/uri/${id}`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	return <
		{
			success?: boolean;
			data: {
				uri: string;
			};
			error?: string;
		}
	>res.data;
};

export const cachedGetSigilById = cache(async (id: string) => {
	const res = await axiosInstance.get(`/referral-service/sigils/uri/${id}`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	return <
		{
			success?: boolean;
			data: {
				uri: string;
			};
			error?: string;
		}
	>res.data;
});
