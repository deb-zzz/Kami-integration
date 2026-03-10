import { AssetType } from '@/types';

export enum CheckoutActions {
	None,
	BuyAndTransfer,
	BuyAndMint,
	BuyService,
	Rent,
}

// Types for server-side cart operations
export type ServerCartItem = {
	id: number;
	walletAddress: string;
	productId: number;
	assetId?: number;
	playlistId: number | null;
	checkoutAction: 'BuyAndMint' | 'BuyAndTransfer';
	rentalMinutes: number;
	quantity: number;
	isActive: boolean;
	isSelected: boolean;
	deletedAt: number | null;
	createdAt: number;
	updatedAt: number | null;
	actionedAt: number | null;
	user: { userName: string };
	product: {
		id: number;
		name: string;
		description: string;
		type: string;
		price: string | null;
		currencySymbol: string;
		availableQuantity: number;
		ownerWalletAddress: string;
		canSubscribe: boolean;
		subscriptionValue: string | null;
		audience: string;
		consumerAction: string;
		whitelist: null;
		spotlight: boolean;
		projectId: number;
		collectionId: number;
		createdAt: number;
		maxQuantity: number;
		collection: {
			collectionId: number;
			projectId: number;
			name: string;
			symbol: string;
			description: string;
			avatarUrl: string;
			bannerUrl: string | null;
			contractAddress: string | null;
			contractType: string;
			ownerWalletAddress: string;
			createdAt: number;
			chainId: string;
		};
		voucher: {
			id: number;
			walletAddress: string;
			contractAddress: string | null;
			tokenId: string;
			mediaUrl: string;
			animationUrl: string | null;
			metadata: string;
			projectId: number;
			productId: number;
			collectionId: number;
			contractType: string;
			createdAt: number;
		};
		asset: AssetType[];
		project: {
			id: number;
			walletAddress: string;
			name: string;
			description: string;
			mediaUrl: string | null;
			whiteboardUrl: string | null;
			status: string;
			categoryId: number | null;
			draft: any;
			createdAt: number;
			updatedAt: number;
		};
	};
	playlist: any | null;
};

export type CartAvailabilityCheck = {
	canAdd: boolean;
	reason?: string;
	cartQuantity: number;
	availableQuantity: number;
};

export type ServerCartCollection = {
	collection: Collection;
	items: ServerCartItem[];
};

export type CreateCartItemRequest = {
	walletAddress: string;
	productId: number;
	quantity: number;
	checkoutAction: 'BuyAndMint' | 'BuyAndTransfer';
};

export type UpdateCartItemRequest = {
	walletAddress: string;
	quantity: number;
	checkoutAction: 'BuyAndMint' | 'BuyAndTransfer';
};

export type DeleteCartItemsRequest = {
	walletAddress: string;
	ids: number[];
};

export type UpdateCartItemSelectionRequest = {
	walletAddress: string;
	isSelected: boolean;
};

export interface CreateCheckoutResponse {
	success?: boolean;
	status?: string;
	paymentType?: string;
	checkoutId?: string;
	results?: Results;
	checkout?: GetCheckoutByIdResponse;
	paymentUrl?: string;
	error?: string;
	fields?: string;
}

export interface Results {
	success: boolean;
	deployedCollections: any[];
	mintedTokens: any[];
	purchasedAssets: PurchasedAsset[];
	errors: CheckoutError[];
}

export interface PurchasedAsset {
	collectionId: number;
	tokenId: number;
	checkoutId: string;
}

export interface CheckoutError {
	collectionId: number;
	tokenId: number;
	quantity: number;
	assetId: number;
	error: string;
}

export interface GetCheckoutByIdResponse {
	id: string;
	userWalletAddress: string;
	subtotal: number;
	totalCharges: number;
	totalAmount: number;
	createdAt: number;
	checkoutCharges: CheckoutCharge[];
	orders: Order[];
}

export interface CheckoutCharge {
	id: string;
	checkoutId: string;
	chargeId: string;
	chargeTypeName: string;
	fixedAmount: number;
	percentage: number;
	appliedAmount: number;
}

export interface Order {
	id: string;
	checkoutId: string;
	paymentId: null;
	paymentType: PaymentType;
	currency: string;
	fromWalletAddress: string;
	toWalletAddress: string;
	status: OrderStatus;
	amount: number;
	createdAt: number;
	updatedAt: number;
	orderItems: OrderItem[];
}

export enum OrderStatus {
	New = 'New',
	Pending = 'Pending',
	Paid = 'Paid',
	Completed = 'Completed',
	Cancelled = 'Cancelled',
	Failed = 'Failed',
}

export interface OrderItem {
	id: string;
	orderId: string;
	productId: number;
	checkoutAction: string;
	status: OrderStatus;
	unitPrice: number;
	errorMessage: string | null;
	quantity: number;
	subtotal: number;
	charges: number;
	product: Product;
}

export interface Product {
	id: number;
	name: string;
	description: string;
	type: string;
	price: number;
	currencySymbol: string;
	availableQuantity: number;
	ownerWalletAddress: string;
	canSubscribe: boolean;
	subscriptionValue: null;
	forSale: boolean;
	audience: string;
	consumerAction: string;
	whitelist: null;
	spotlight: boolean;
	projectId: number;
	collectionId: number;
	createdAt: number;
	prohibitReason?: string | null;
	collection: Collection;
}

export interface Collection {
	collectionId: number;
	projectId: number;
	name: string;
	symbol: string;
	description: string;
	avatarUrl: string;
	bannerUrl: string | null;
	chainId: string;
	contractAddress: string | null;
	contractType: string;
	ownerWalletAddress: string;
	createdAt: number;
}

export interface User {
	walletAddress: string;
	userName: string;
}

export type CreateCheckoutRequest = {
	fromWalletAddress: string;
	paymentType: PaymentType;
	currency: string;
	items: CheckoutItem[];
};

export enum PaymentType {
	Crypto = 'Crypto',
	Fiat = 'Fiat',
}

export interface CheckoutItem {
	productId: number;
	quantity: number;
}

export interface OrderByIdResponse extends Order {
	buyer: User;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
type JobStage = 'validating' | 'deploying' | 'minting' | 'buying' | 'finalizing';
export type CheckoutStatusErrors =
	| {
			collectionId: number;
			tokenId: number | null;
			quantity: number | null;
			voucherId?: number;
			assetId?: number;
			productId?: number;
			error: string;
	  }[]
	| undefined;

/** Polling response from web3-service checkout status endpoint. */
export interface CheckoutStatus {
	/** True when checkout finished successfully (status === 'completed'). */
	success: boolean;
	checkoutId: string;
	/** 'completed' | 'failed' | 'pending' | 'processing' */
	status: JobStatus;
	/** Checkout result when success is true and status is 'completed'. */
	result?: GetCheckoutByIdResponse;
	/** Human-readable failure message when success is false. */
	error?: string;
	/** Per-item or detailed errors when success is false. */
	errors?: CheckoutStatusErrors;
	/** Optional progress 0–100 when status is pending/processing. */
	progress?: number;
	/** Optional stage label when status is pending/processing. */
	stage?: JobStage;
}
