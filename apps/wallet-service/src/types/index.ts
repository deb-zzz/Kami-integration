import { Prisma } from '@prisma/client';
import { TokenData } from '../services/WalletService';

type CheckoutWithRelations = Prisma.checkoutGetPayload<{
	include: {
		orders: {
			include: {
				orderItems: {
					include: {
						product: true;
					};
				};
			};
		};
		checkoutCharges: true;
	};
}>;

export interface WalletBalance {
	address: string;
	ethBalance: string;
	usdcBalance: string;
	ethBalanceFormatted: string;
	usdcBalanceFormatted: string;
}

export interface TransferRequest {
	fromAddress: string;
	toAddress: string;
	amount: string;
	privateKey?: string;
	paymentToken?: string;
}

export interface TransferResponse {
	success: boolean;
	transactionHash?: string;
	error?: string;
}

export interface ListingPaginationQueryParams {
	page?: number;
	perPage?: number;
	sortBy?: string;
	order?: 'asc' | 'desc';
	filters?: {
		[key: string]: any; // for future extensibility
	};
}

export interface TransactionDetails {
	hash: string;
	from: string;
	to: string;
	value: string;
	valueFormatted: string;
	gasLimit: string;
	gasPrice: string;
	gasUsed?: string;
	blockNumber?: number;
	blockHash?: string;
	transactionIndex?: number;
	status?: number;
	nonce: number;
	data: string;
	tokenData?: TokenData[];
}

export interface TransactionSummary {
	transaction: TransactionDetails;
	checkout: CheckoutWithRelations | null;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface ErrorResponse {
	success: false;
	error: string;
	message: string;
	details?: Array<{
		field: string;
		message: string;
	}>;
}

export interface platformWallet {
	chainId: string;
	simpleAccountAddress: string;
	contractDeployerAddress: string;
	platformFundingWalletAddress: string;
	platformFundingWalletPrivateKey: string;
	platformAddress: string;
	kamiNFTCoreLibraryAddress: string;
	kamiPlatformLibraryAddress: string;
	kamiRoyaltyLibraryAddress: string;
	kamiRentalLibraryAddress: string;
	kamiTransferLibraryAddress: string;
	createdAt: number;
	updatedAt: number;
}

export interface PlatformWalletReport {
	chainId: string;
	chainName?: string;
	wallets: {
		label: string;
		address: string;
		ethBalance: string;
		usdcBalance: string;
		ethBalanceFormatted: string;
		usdcBalanceFormatted: string;
		isLow?: boolean;
	}[];
}
