'use server';
import { axiosInstance, createSignature } from './AxiosInstance';

export const likeAsset = async (address: string, id: number) => {
	const res = await axiosInstance.post(
		`/social-service/${address}/asset/${id}/like`,
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

export const unlikeAsset = async (address: string, id: number) => {
	try {
		const res = await axiosInstance.delete(
			`/social-service/${address}/asset/${id}/like`,
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

export const validateAsset = async (address: string, assetId: number) => {
	const res = await axiosInstance.get(
		`/cart-service/cart/items/check?walletAddress=${address}&assetId=${assetId}&quantity=1`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	// console.log('getting project', res.data);
	return <
		{
			canAdd: boolean;
			reason?: string;
			cartQuantity: number;
			availableQuantity: number;
		}
	>res.data;
};

export const listAssetForSale = async (
	assetId: number,
	data: { consumerAction: 'Claim' | 'Buy' | 'Subscribe' | 'Rent' | 'None' },
) => {
	const res = await axiosInstance.post(
		`/web3-service/asset/${assetId}/setConsumerAction`,
		data,
	);

	return res.data;
};

export const setAssetPrice = async (assetId: number, price: string) => {
	try {
		const res = await axiosInstance.post(
			`/web3-service/asset/${assetId}/setPrice`,
			{ price: Number(price) },
		);
		return <{ success: boolean }>res.data;
	} catch (error) {
		console.log('error', error);
		return { success: false, error: (error as Error).message };
	}
};

export const setAssetAudience = async (
	assetId: number,
	audience: 'Public' | 'Private',
) => {
	try {
		const res = await axiosInstance.post(
			`/web3-service/asset/${assetId}/setAudience`,
			{ audience },
		);

		const success = res.data.id;
		return { success, ...res.data };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

export const stopMinting = async (productId: number) => {
	try {
		const res = await axiosInstance.post(
			`/web3-service/nft/${productId}/stopMinting`,
		);
		return <{ success: boolean }>res.data;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};
