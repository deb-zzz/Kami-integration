import { getOwnerPrivateKey, transferPaymentToken } from '@/lib/gasless-nft';
import { recordActivity } from '@/lib/record-activity';
import { TRANSFER_ERROR_CODE, TransferValidationError, validateTransfer } from '@/lib/transfer';
import { Web3TransactionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 90; // seconds

const ETH_ADDRESS_LENGTH = 42;

const logPrefix = 'Transfer API:';

function log(message: string) {
	console.log(`${logPrefix} ${message}`);
}

function error(message: string) {
	console.error(`${logPrefix} ${message}`);
}

function isValidEthAddress(value: unknown): value is string {
	return typeof value === 'string' && value.length === ETH_ADDRESS_LENGTH && value.startsWith('0x');
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { chainId, fromWalletAddress, toWalletAddress, tokenSymbol, amount } = body;

		if (
			typeof chainId !== 'string' ||
			typeof tokenSymbol !== 'string' ||
			(typeof amount !== 'number' && (typeof amount !== 'string' || isNaN(Number(amount))))
		) {
			return NextResponse.json(
				{ error: 'Missing or invalid fields: chainId, fromWalletAddress, toWalletAddress, tokenSymbol, amount' },
				{ status: 400 },
			);
		}
		if (!isValidEthAddress(fromWalletAddress) || !isValidEthAddress(toWalletAddress)) {
			return NextResponse.json(
				{ error: 'fromWalletAddress and toWalletAddress must be valid 0x-prefixed 42-character addresses' },
				{ status: 400 },
			);
		}
		const amountNum = typeof amount === 'number' ? amount : Number(amount);
		if (!Number.isFinite(amountNum) || amountNum <= 0) {
			return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
		}

		const fromNorm = (fromWalletAddress as string).toLowerCase();
		const toNorm = (toWalletAddress as string).toLowerCase();
		if (fromNorm === toNorm) {
			return NextResponse.json({ error: 'fromWalletAddress and toWalletAddress must differ' }, { status: 400 });
		}

		let validated;
		try {
			validated = await validateTransfer({
				chainId,
				tokenSymbol,
				amount: amountNum,
				fromWalletAddress: fromNorm,
				toWalletAddress: toNorm,
			});
		} catch (err) {
			if (err instanceof TransferValidationError) {
				if (err.code === TRANSFER_ERROR_CODE.PAYMENT_TOKEN_NOT_FOUND) {
					return NextResponse.json({ error: err.message }, { status: 404 });
				}
				if (err.code === TRANSFER_ERROR_CODE.SENDER_NOT_PLATFORM_USER) {
					return NextResponse.json({ error: err.message }, { status: 403 });
				}
				if (err.code === TRANSFER_ERROR_CODE.INSUFFICIENT_BALANCE) {
					return NextResponse.json({ error: err.message }, { status: 402 });
				}
			}
			throw err;
		}

		const fromKey = await getOwnerPrivateKey(fromNorm);
		if (!fromKey) {
			return NextResponse.json({ error: 'Sender wallet is not authorized for gasless transfer' }, { status: 403 });
		}

		const tokenAddress = validated.paymentToken.contractAddress as `0x${string}`;
		const fromAddr = fromNorm as `0x${string}`;
		const toAddr = toNorm as `0x${string}`;

		const decimals = validated.paymentToken.decimals ?? 18;
		const netAmountDecimal = (Number(validated.netAmountToRecipient) / 10 ** decimals).toString();
		const chargeAmountDecimal = (Number(validated.chargeAmount) / 10 ** decimals).toString();

		// 1. Transfer net amount to recipient (record as Transfer in transaction table)
		log(`Transferring ${netAmountDecimal} ${validated.paymentToken.symbol} from ${fromNorm} to ${toNorm}`);
		const result = await transferPaymentToken(
			validated.chainId,
			tokenAddress,
			fromAddr,
			toAddr,
			validated.netAmountToRecipient,
			fromNorm,
			Web3TransactionType.Transfer,
		);
		if (!result.success) {
			error(`Transfer to recipient failed: ${result.error ?? 'Unknown error'}`);
			return NextResponse.json({ error: result.error ?? 'Transfer failed' }, { status: 500 });
		}

		// 2. If charge > 0, transfer charge to platform (record as Charges)
		if (validated.chargeAmount > BigInt(0) && validated.platformFeeAddress) {
			log(`Transferring ${chargeAmountDecimal} ${validated.paymentToken.symbol} from ${fromNorm} to ${validated.platformFeeAddress}`);
			const chargeResult = await transferPaymentToken(
				validated.chainId,
				tokenAddress,
				fromAddr,
				validated.platformFeeAddress,
				validated.chargeAmount,
				fromNorm,
				Web3TransactionType.Charges,
			);
			if (!chargeResult.success) {
				error(`Transfer to recipient succeeded but charge transfer failed: ${chargeResult.error ?? 'Unknown error'}`);
				return NextResponse.json(
					{ error: 'Transfer to recipient succeeded but charge transfer failed', transactionHash: result.transactionHash },
					{ status: 500 },
				);
			} else log('Transfer to recipient succeeded and charge transfer succeeded');
		} else log('Transfer to recipient succeeded and charge transfer not applied');

		// 3. Notify receiver (if platform user) that they received funds
		if (validated.recipientIsUser) {
			await recordActivity({
				walletAddress: toNorm,
				entityType: 'Transfer' as import('@prisma/client').NotificationEntityType,
				entityId: result.transactionHash!,
				entitySubType: 'Succeeded' as import('@prisma/client').NotificationEntitySubType,
				payload: {
					fromUserName: validated.senderUserName,
					amount: amountNum,
					tokenSymbol: validated.paymentToken.symbol,
					transactionHash: result.transactionHash,
				},
			});
			log('Notification sent to receiver');
		} else log('Transfer to recipient succeeded but receiver is not a platform user');

		const chargeApplied =
			validated.chargeAmount > BigInt(0) ? Number(validated.chargeAmount) / Math.pow(10, validated.paymentToken.decimals) : undefined;
		return NextResponse.json({
			success: true,
			transactionHash: result.transactionHash,
			...(chargeApplied !== undefined && { chargeApplied }),
		});
	} catch (err) {
		error(`Transfer error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		return NextResponse.json({ error: err instanceof Error ? err.message : 'Transfer failed' }, { status: 500 });
	}
}
