'use server';
import { axiosInstance, createSignature } from './AxiosInstance';

export const likeProduct = async (address: string, id: number) => {
	const res = await axiosInstance.post(
		`/social-service/${address}/product/${id}/like`,
		{},
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature({}),
			},
		}
	);
	// console.log(res.data);
	return <{ success: boolean }>res.data;
};

export const unlikeProduct = async (address: string, id: number) => {
	try {
		const res = await axiosInstance.delete(
			`/social-service/${address}/product/${id}/like`,
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

export const validateProduct = async (address: string, productId: number) => {
	const res = await axiosInstance.get(
		`/cart-service/cart/items/check?walletAddress=${address}&productId=${productId}&quantity=1`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		}
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

export const listForSale = async (
	walletAddress: string,
	productId: number,
	data: { consumerAction: 'Claim' | 'Buy' | 'Subscribe' | 'Rent' | 'None' }
) => {
	const res = await axiosInstance.put(
		`/profile-service/${walletAddress}/product/${productId}`,
		data
	);

	return res.data;
};

export const setProductPrice = async (productId: number, price: string) => {
	try {
		const res = await axiosInstance.post(
			`/web3-service/product/${productId}/setPrice`,
			{ price }
		);
		return <{ success: boolean }>res.data;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

export const setAudience = async (
	productId: number,
	audience: 'Public' | 'Private'
) => {
	try {
		const res = await axiosInstance.put(
			`/web3-service/product/${productId}/audience`,
			{ audience }
		);

		const success = res.data.id;
		return { success, ...res.data };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};
