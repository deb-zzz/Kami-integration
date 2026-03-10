import { ChargeType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getHexChainId, getPaymentTokenBalances, getPlatformInfo, toTokenUnits } from '@/lib/gasless-nft';
import type { ValidatedTransfer } from './types';
import { TRANSFER_ERROR_CODE, TransferValidationError } from './types';

export type ValidateTransferParams = {
	chainId: string;
	tokenSymbol: string;
	amount: number | string;
	fromWalletAddress: string;
	toWalletAddress: string;
};

/**
 * Validates transfer params: resolves payment token, checks platform user (sender),
 * recipient-is-user, charge (TransferOut), and sender balance.
 * @throws TransferValidationError with code for route to map to 400/402/403/404
 */
export async function validateTransfer(params: ValidateTransferParams): Promise<ValidatedTransfer> {
	const { chainId, tokenSymbol, amount, fromWalletAddress, toWalletAddress } = params;
	const hexChainId = getHexChainId(chainId) as `0x${string}`;

	// 1. Resolve payment token by chainId + tokenSymbol
	const paymentToken = await prisma.payment_token.findFirst({
		where: {
			blockchain: { chainId: hexChainId },
			symbol: { equals: tokenSymbol, mode: 'insensitive' },
		},
	});
	if (!paymentToken) {
		throw new TransferValidationError('Payment token not found', TRANSFER_ERROR_CODE.PAYMENT_TOKEN_NOT_FOUND);
	}

	const decimals = paymentToken.decimals;
	const amountInTokenUnits = toTokenUnits(amount, decimals);

	// 2. Sender must be a platform user (exists in user table; walletAddress may be stored mixed case)
	const senderUser = await prisma.user.findFirst({
		where: { walletAddress: { equals: fromWalletAddress, mode: 'insensitive' } },
	});
	if (!senderUser) {
		throw new TransferValidationError('Sender is not a platform user', TRANSFER_ERROR_CODE.SENDER_NOT_PLATFORM_USER);
	}

	// 3. Recipient-is-user (determines whether we apply charge)
	const recipientUser = await prisma.user.findFirst({
		where: { walletAddress: { equals: toWalletAddress, mode: 'insensitive' } },
	});
	const recipientIsUser = !!recipientUser;

	// 4. TransferOut charge (when recipient is not a user)
	let chargeAmount = BigInt(0);
	if (!recipientIsUser) {
		const chargeRow = await prisma.charges.findUnique({
			where: { type: ChargeType.TransferOut },
		});
		if (chargeRow) {
			const fixedAmount = Number(chargeRow.fixedAmount);
			const percentage = Number(chargeRow.percentage);
			const chargeFixed = toTokenUnits(fixedAmount, decimals);
			const 			chargePct =
				percentage > 0 ? (amountInTokenUnits * BigInt(Math.round(percentage * 100))) / BigInt(10000) : BigInt(0);
			chargeAmount = chargeFixed + chargePct;
		}
	}

	const netAmountToRecipient = amountInTokenUnits - chargeAmount;
	const totalRequired = amountInTokenUnits;

	// 5. Balance check: fromWalletAddress must have >= totalRequired
	const tokenAddress = paymentToken.contractAddress as `0x${string}`;
	const balances = await getPaymentTokenBalances(hexChainId, fromWalletAddress as `0x${string}`, [tokenAddress]);
	const balanceInfo = balances[0];
	if (balanceInfo?.error || balanceInfo === undefined) {
		throw new TransferValidationError(
			balanceInfo?.error ?? 'Failed to fetch balance',
			TRANSFER_ERROR_CODE.INSUFFICIENT_BALANCE,
		);
	}
	if (balanceInfo.balance < totalRequired) {
		throw new TransferValidationError(
			'Insufficient payment token balance',
			TRANSFER_ERROR_CODE.INSUFFICIENT_BALANCE,
		);
	}

	// 6. Platform fee address when charge > 0
	let platformFeeAddress: `0x${string}` | null = null;
	if (chargeAmount > BigInt(0)) {
		const platformInfo = await getPlatformInfo(hexChainId);
		if (platformInfo?.platformAddress) {
			platformFeeAddress = platformInfo.platformAddress as `0x${string}`;
		}
	}

	return {
		paymentToken,
		chainId: hexChainId,
		amountInTokenUnits,
		recipientIsUser,
		chargeAmount,
		netAmountToRecipient,
		totalRequired,
		platformFeeAddress,
		senderUserName: senderUser.userName,
	};
}
