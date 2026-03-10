import { Prisma } from '@prisma/client';
import type {
	CollectionWithVouchersAndAssets,
	VoucherWithCollection,
	AssetWithCollection,
	CheckoutItem,
} from '@/services';
import type { CheckoutJobStage } from '../checkout-job';

export type ToDeploy = {
	collectionId: number;
	tokenId: number | null;
	quantity: number | null;
	collection: CollectionWithVouchersAndAssets;
	charges?: number | null;
};

export type ToMint = {
	voucherId: number;
	quantity: number;
	voucher: VoucherWithCollection;
	charges?: number | null;
};

export type ToBuy = {
	contractAddress: string;
	tokenId: number;
	quantity: number;
	asset: AssetWithCollection;
	charges?: number | null;
};

export type PaymentTokenWithBlockchain = Prisma.payment_tokenGetPayload<{ include: { blockchain: true } }>;

export type ProgressCallback = (progress: number, stage: CheckoutJobStage) => Promise<void> | void;

export type MintedTokenEntry = {
	voucherId: number;
	tokenId: number;
	quantity?: number;
	assetId?: number;
	contractAddress?: string;
	checkoutId?: string;
	tokenIds?: number[];
};

export type DeployedCollectionResult = {
	collectionId: number;
	contractAddress: string;
	checkoutId?: string;
};

export type PurchasedAssetResult = {
	collectionId: number;
	tokenId: number;
	checkoutId?: string;
};

export type Erc721acMintGroup = {
	voucher: VoucherWithCollection;
	totalQuantity: number;
	charges: number;
};

// Progress ranges for checkout phases
export const PROGRESS_RANGES = {
	VALIDATING_START: 0,
	VALIDATING_END: 10,
	DEPLOYING_START: 10,
	DEPLOYING_END: 30,
	MINTING_START: 30,
	MINTING_END: 60,
	BUYING_START: 60,
	BUYING_END: 90,
	FINALIZING: 95,
} as const;
