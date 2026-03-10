import type { payment_token } from '@prisma/client';

export const TRANSFER_ERROR_CODE = {
	PAYMENT_TOKEN_NOT_FOUND: 'PAYMENT_TOKEN_NOT_FOUND',
	SENDER_NOT_PLATFORM_USER: 'SENDER_NOT_PLATFORM_USER',
	INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
} as const;

export type TransferErrorCode = (typeof TRANSFER_ERROR_CODE)[keyof typeof TRANSFER_ERROR_CODE];

export class TransferValidationError extends Error {
	constructor(
		message: string,
		public readonly code: TransferErrorCode
	) {
		super(message);
		this.name = 'TransferValidationError';
	}
}

export type ValidatedTransfer = {
	paymentToken: payment_token;
	chainId: `0x${string}`;
	amountInTokenUnits: bigint;
	recipientIsUser: boolean;
	chargeAmount: bigint;
	netAmountToRecipient: bigint;
	totalRequired: bigint;
	platformFeeAddress: `0x${string}` | null;
	/** Sender's platform userName (for notifications) */
	senderUserName: string;
};
