import { KamiSponsoredOperations, SponsoredPaymentTokenTransferParams } from '@paulstinchcombe/gasless-nft-tx';
import type { SponsoredOperationsConfig } from '@paulstinchcombe/gasless-nft-tx/dist/kami-sponsored-operations';
import { ENTRY_POINT_V07_ADDRESS } from '@paulstinchcombe/gasless-nft-tx/dist/SmartContractWallet/simpleAccountUserOp';
import { Web3TransactionType } from '@prisma/client';
import { getPrivateKeyByChainId } from '@/app/utils/secrets';
import type { Chain } from 'viem';
import { createPublicClient, formatUnits, http } from 'viem';
import { getBlockchainInfo, getPlatformInfo } from './config';
import {
	ensureEntryPointDeposit,
	ENTRY_POINT_GAS_LIMIT_OPERATION,
	USER_OP_CALL_GAS_LIMIT_OPERATION,
} from './entrypoint-deposit';
import { generateOperationSignature, normalizePrivateKey } from './signatures';
import { createTransaction } from './transaction';
import { getOwnerPrivateKey } from './wallet';

/**
 * Converts a decimal token value to the smallest payment token units
 */
export function toTokenUnits(value: number | string, decimals: number): bigint {
	if (value === null || value === undefined || isNaN(Number(value))) {
		console.warn(`Invalid value for toTokenUnits: ${value}, using 0`);
		return BigInt(0);
	}

	const [whole, fraction = ''] = String(value).split('.');
	const fractionPadded = (fraction + '0'.repeat(decimals)).slice(0, decimals);
	const valueString = whole + fractionPadded;
	const normalized = valueString.replace(/^0+/, '') || '0';
	return BigInt(normalized);
}

/**
 * Gets the decimals of an ERC20 payment token using viem
 */
export async function getPaymentTokenDecimals(paymentToken: `0x${string}`, rpcUrl?: string): Promise<number> {
	const erc20Abi = [
		{
			constant: true,
			inputs: [],
			name: 'decimals',
			outputs: [{ name: '', type: 'uint8' }],
			type: 'function',
		},
	];

	const client = createPublicClient({
		transport: http(rpcUrl || 'https://sepolia.base.org'),
	});

	try {
		const decimals = await client.readContract({
			address: paymentToken,
			abi: erc20Abi,
			functionName: 'decimals',
		});
		return typeof decimals === 'bigint' ? Number(decimals) : Number(decimals);
	} catch (error) {
		console.error('Error fetching token decimals:', error);
		throw new Error(`Failed to fetch token decimals for ${paymentToken}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Transfer payment tokens between addresses using sponsored gas operations.
 * Platform pays ALL gas fees, user pays ZERO.
 * @param transactionType - Type for the created transaction record (default: Charges). Use Transfer when called from the transfer API.
 */
export async function transferPaymentToken(
	chainId: `0x${string}`,
	paymentTokenAddress: `0x${string}`,
	fromAddress: `0x${string}`,
	toAddress: `0x${string}`,
	amount: bigint,
	buyerAddress: string,
	transactionType: Web3TransactionType = Web3TransactionType.Charges,
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		const fromPrivateKey = await getOwnerPrivateKey(fromAddress);
		if (!fromPrivateKey) {
			throw new Error(`Private key not found for owner: ${fromAddress}`);
		}

		const buyerPrivateKey = await getOwnerPrivateKey(buyerAddress);
		if (!buyerPrivateKey) {
			throw new Error(`Private key not found for buyer: ${buyerAddress}`);
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		if (process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true') {
			const depositResult = await ensureEntryPointDeposit({
				chainId: blockchainInfo.chainId,
				simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
				gasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
			});
			if (depositResult.funded) {
				console.log(
					`   [EntryPoint] Topped up deposit for transferPaymentToken: ${depositResult.previousBalance.toString()} -> ${
						depositResult.newBalance?.toString() ?? '?'
					} wei`
				);
			}
		}

		const useEntryPoint = process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true';
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			paymentToken: paymentTokenAddress,
			chain: blockchainInfo.blockchain,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
			useEntryPointForExecute: useEntryPoint,
			...(useEntryPoint && {
				callGasLimit: USER_OP_CALL_GAS_LIMIT_OPERATION,
				handleOpsGasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
			}),
		};

		const handler = new KamiSponsoredOperations(operationsConfig);

		const userSignature = await generateOperationSignature(
			fromPrivateKey,
			fromAddress,
			'transferPaymentToken',
			paymentTokenAddress,
			{
				from: fromAddress,
				to: toAddress,
				amount: amount.toString(),
			},
			blockchainInfo.rpcUrl
		);

		const transferParams: SponsoredPaymentTokenTransferParams = {
			from: fromAddress,
			to: toAddress,
			amount: amount,
			userPrivateKey: buyerPrivateKey,
		};

		console.log('💸 Transferring payment tokens with sponsored gas...');
		console.log(`   From: ${fromAddress}`);
		console.log(`   To: ${toAddress}`);
		console.log(`   Amount: ${amount.toString()}`);
		console.log(`   Token: ${paymentTokenAddress}`);
		console.log('💰 Platform pays ALL gas fees...');

		const result = await handler.transferPaymentToken(paymentTokenAddress, transferParams, userSignature);

		if (!result.success) {
			return {
				success: false,
				error: result.error || 'Transfer failed',
			};
		}

		console.log(`✅ Payment token transfer completed: ${result.transactionHash}`);

		try {
			await createTransaction(transactionType, result.transactionHash!, blockchainInfo, fromAddress);
		} catch (error) {
			console.warn('Failed to create transaction record:', error);
		}

		return {
			success: true,
			transactionHash: result.transactionHash,
		};
	} catch (error) {
		console.error('❌ Error transferring payment token:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Get wallet balances for multiple payment tokens (ERC20).
 */
export async function getPaymentTokenBalances(
	chainId: `0x${string}`,
	walletAddress: `0x${string}`,
	paymentTokenAddresses: `0x${string}`[]
): Promise<Array<{ tokenAddress: string; balance: bigint; formattedBalance: number; decimals?: number; error?: string }>> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const client = createPublicClient({
			chain: blockchainInfo.blockchain as unknown as Chain,
			transport: http(blockchainInfo.rpcUrl),
		});

		const erc20Abi = [
			{
				inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
				name: 'balanceOf',
				outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
				stateMutability: 'view',
				type: 'function',
			},
			{
				inputs: [],
				name: 'decimals',
				outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
				stateMutability: 'view',
				type: 'function',
			},
		] as const;

		const balancePromises = paymentTokenAddresses.map(async (tokenAddress) => {
			try {
				const [balance, decimals] = await Promise.all([
					client.readContract({
						address: tokenAddress,
						abi: erc20Abi,
						functionName: 'balanceOf',
						args: [walletAddress],
					}),
					client
						.readContract({
							address: tokenAddress,
							abi: erc20Abi,
							functionName: 'decimals',
						})
						.catch(() => undefined),
				]);

				const balanceBigInt = typeof balance === 'bigint' ? balance : BigInt(balance);
				const decimalsNumber =
					decimals !== undefined ? (typeof decimals === 'bigint' ? Number(decimals) : Number(decimals)) : undefined;

				const formattedBalance =
					decimalsNumber !== undefined ? parseFloat(formatUnits(balanceBigInt, decimalsNumber)) : Number(balanceBigInt);

				return {
					tokenAddress,
					balance: balanceBigInt,
					formattedBalance,
					decimals: decimalsNumber,
				};
			} catch (error) {
				console.error(`Error fetching balance for token ${tokenAddress}:`, error);
				return {
					tokenAddress,
					balance: BigInt(0),
					formattedBalance: 0,
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		});

		const results = await Promise.all(balancePromises);
		return results;
	} catch (error) {
		console.error(`Error fetching payment token balances:`, error);
		return paymentTokenAddresses.map((tokenAddress) => ({
			tokenAddress,
			balance: BigInt(0),
			formattedBalance: 0,
			error: error instanceof Error ? error.message : 'Unknown error',
		}));
	}
}
