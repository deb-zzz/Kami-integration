'use server';
import { axiosInstance, createSignature } from './AxiosInstance';
import type {
	ServerCartItem,
	CartAvailabilityCheck,
	ServerCartCollection,
	CreateCartItemRequest,
	UpdateCartItemRequest,
	DeleteCartItemsRequest,
	UpdateCartItemSelectionRequest,
	OrderByIdResponse,
	CreateCheckoutRequest,
	CreateCheckoutResponse,
	GetCheckoutByIdResponse,
	CheckoutStatus,
} from '../types/cart-types';

/**
 * Pre-validate quantity before adding to cart
 */
export const checkCartItemAvailability = async (
	walletAddress: string,
	productId: number,
	quantity: number,
): Promise<CartAvailabilityCheck> => {
	try {
		const res = await axiosInstance.get(`/cart-service/cart/items/check`, {
			params: {
				walletAddress,
				productId,
				quantity,
			},
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
			},
		});
		return res.data;
	} catch (error) {
		console.log('error', error);
		console.error('Error checking cart item availability:', error);
		throw error;
	}
};

/**
 * Fetch user's cart items grouped by collection
 */
export const getCartItems = async (walletAddress: string): Promise<ServerCartCollection[]> => {
	try {
		const res = await axiosInstance.get(`/cart-service/cart/items?walletAddress=${walletAddress}`);
		return res.data;
	} catch (error) {
		console.error('Error fetching cart items:', error);
		throw error;
	}
};

/**
 * Add new item to server cart
 */
export const createCartItem = async (
	walletAddress: string,
	productId: number,
	quantity: number,
	checkoutAction: 'BuyAndMint' | 'BuyAndTransfer' = 'BuyAndMint',
): Promise<ServerCartItem> => {
	try {
		const requestData: CreateCartItemRequest = {
			walletAddress,
			productId,
			quantity,
			checkoutAction,
		};

		const res = await axiosInstance.post(`/cart-service/cart/items`, requestData, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
				Signature: createSignature({}),
			},
		});
		return res.data;
	} catch (error) {
		console.error('Error creating cart item:', error);
		throw error;
	}
};

export const addToCart = async (data: {
	walletAddress: string;
	productId: number;
	quantity: number;
	checkoutAction: string;
	assetId?: number | undefined;
}) => {
	try {
		const res = await axiosInstance.post(`/cart-service/cart/items`, data, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		});

		const responseData = res.data;
		let success = false;
		if (responseData && responseData.id && responseData.productId) {
			success = true;
		}

		return { success };
	} catch (error) {
		console.error('Error adding to cart:', error);
		return { success: false, error: (error as Error).message };
	}
};

/**
 * Update existing cart item
 */
export const updateCartItem = async (
	itemId: number,
	walletAddress: string,
	quantity: number,
	checkoutAction: 'BuyAndMint' | 'BuyAndTransfer' = 'BuyAndMint',
): Promise<ServerCartItem> => {
	try {
		const requestData: UpdateCartItemRequest = {
			walletAddress,
			quantity,
			checkoutAction,
		};

		const res = await axiosInstance.put(`/cart-service/cart/items/${itemId}`, requestData, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
				Signature: createSignature(requestData),
			},
		});
		return res.data;
	} catch (error) {
		console.log('error', error);
		console.error('Error updating cart item:', error);
		throw error;
	}
};

/**
 * Delete multiple cart items
 */
export const deleteCartItems = async (walletAddress: string, itemIds: number[]): Promise<{ success: boolean; deletedCount: number }> => {
	try {
		const requestData: DeleteCartItemsRequest = {
			walletAddress,
			ids: itemIds,
		};

		const res = await axiosInstance.delete(`/cart-service/cart/items`, {
			data: requestData,
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
				Signature: createSignature({}),
			},
		});
		return res.data;
	} catch (error) {
		console.error('Error deleting cart items:', error);
		throw error;
	}
};

/**
 * Update cart item selection status
 */
export async function updateCartItemSelection(itemId: number, walletAddress: string, isSelected: boolean): Promise<ServerCartItem> {
	try {
		const requestData: UpdateCartItemSelectionRequest = {
			walletAddress,
			isSelected,
		};

		const res = await axiosInstance.put(`/cart-service/cart/items/${itemId}`, requestData, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
				Signature: createSignature({}),
			},
		});
		return res.data;
	} catch (error) {
		console.error('Error updating cart item selection:', error);
		throw error;
	}
}

/**
 * Create a checkout for cart items
 *
 * @param requestParam - Checkout request parameters
 * @returns Promise with checkout response
 *
 * @example Success Response:
 * ```json
 * {
 *   "success": true,
 *   "status": "failed",
 *   "paymentType": "Crypto",
 *   "checkoutId": "1b437774-5018-4c4f-ad83-2a771564d55c",
 *   "results": {
 *     "success": true,
 *     "deployedCollections": [],
 *     "mintedTokens": [],
 *     "purchasedAssets": [],
 *     "errors": [
 *       {
 *         "collectionId": 316,
 *         "tokenId": 0,
 *         "quantity": 1,
 *         "assetId": 22,
 *         "error": "Failed to buy asset: Unknown error"
 *       }
 *     ]
 *   },
 *   "checkout": {
 *     "id": "1b437774-5018-4c4f-ad83-2a771564d55c",
 *     "userWalletAddress": "0xeB45280E98f6D008F4090dE9f835AdB7556ca769",
 *     "subtotal": 0.6,
 *     "totalCharges": 0.1035,
 *     "totalAmount": 0.7035,
 *     "createdAt": 1765513709550,
 *     "checkoutCharges": [...],
 *     "orders": [...]
 *   }
 * }
 * ```
 *
 * @example Payment URL Response:
 * ```json
 * {
 *   "paymentUrl": "<paymentResult.data>",
 *   "checkoutId": "<id>"
 * }
 * ```
 *
 * @example Validation Error Response:
 * ```json
 * {
 *   "error": "Validation failed",
 *   "fields": "<formattedZodError>"
 * }
 * ```
 *
 * @example Checkout Error Response:
 * ```json
 * {
 *   "error": "Failed to checkout: <error message>"
 * }
 * ```
 */

export const createCheckout = async (requestParam: CreateCheckoutRequest): Promise<CreateCheckoutResponse> => {
	try {
		const res = await axiosInstance.post(`/cart-service/checkout`, requestParam, {
			timeout: 30000, // Expect server to return checkoutId quickly; polling handles completion
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
				Signature: createSignature(requestParam),
			},
		});
		return res.data;
	} catch (error) {
		console.error('Error creating checkout:', error);
		let errorMsg = 'Checkout creation failed';

		// Extract detailed error information from axios errors
		if (error && typeof error === 'object' && 'isAxiosError' in error) {
			const axiosError = error as any;
			errorMsg = axiosError.response?.data?.error || axiosError.message || errorMsg;
		} else if (error instanceof Error) {
			errorMsg = error.message;
		}

		return { success: false, error: errorMsg };
	}
};

export const getCheckoutById = async (
	checkoutId: string,
): Promise<{
	success: boolean;
	data?: GetCheckoutByIdResponse;
	error?: string;
}> => {
	try {
		const res = await axiosInstance.get(`/cart-service/checkout/${checkoutId}`, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
			},
		});
		return { success: true, data: res.data };
	} catch (error) {
		console.error('Error fetching checkout by ID:', error);
		let errorMsg = 'Failed to fetch checkout';
		if (error instanceof Error) {
			errorMsg = error.message;
		}
		return { success: false, error: errorMsg };
	}
};

export const getOrderbyId = async (orderId: string): Promise<OrderByIdResponse> => {
	try {
		const res = await axiosInstance.get(`/cart-service/orders/${orderId}`, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
			},
		});
		return res.data;
	} catch (error) {
		console.error('Error fetching order by ID:', error);
		throw error;
	}
};

/** Get checkout status
 * @param checkoutId - The ID of the checkout to get the status of
 * @returns The status of the checkout
 */
export const getCheckoutStatus = async (checkoutId: string): Promise<CheckoutStatus> => {
	try {
		const res = await axiosInstance.get(`/web3-service/checkout/${checkoutId}/status`, {
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				'Content-Type': 'application/json',
			},
		});
		console.log('Checkout Status:', res.data.status);
		console.log('Checkout Stage:', res.data.stage);
		console.log('Checkout Error:', res.data.error);
		return <CheckoutStatus>res.data;
	} catch (error: unknown) {
		const status =
			error && typeof error === 'object' && 'response' in error
				? (error as { response?: { status?: number } }).response?.status
				: undefined;
		const message = error instanceof Error ? error.message : 'Request failed';

		if (status === 404) {
			console.warn(`Checkout status 404: checkout ${checkoutId} not found or expired`);
			throw new Error('Checkout not found or expired');
		}

		console.error('Error getting checkout status:', status ?? message);
		throw new Error(status ? `Checkout status error (${status})` : message);
	}
};
