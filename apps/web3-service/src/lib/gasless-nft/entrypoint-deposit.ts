/**
 * EntryPoint v0.7 deposit helpers.
 *
 * When USE_ENTRY_POINT_FOR_EXECUTE or USE_ENTRYPOINT_FOR_DEPLOYMENT is true,
 * the SimpleAccount pays gas from its EntryPoint deposit (not native ETH).
 * The Platform Funding EOA should fund that deposit by calling
 * EntryPoint.depositTo(simpleAccountAddress) with ETH.
 */

import {
	encodeFunctionData,
	createPublicClient,
	createWalletClient,
	http,
	type Address,
	type Chain,
	type WalletClient,
	type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ENTRY_POINT_V07_ADDRESS } from '@paulstinchcombe/gasless-nft-tx/dist/SmartContractWallet/simpleAccountUserOp';
import { getBlockchainInfo } from './config';
import { getPrivateKeyByChainId } from '@/app/utils/secrets';
import { normalizePrivateKey } from './signatures';

/** Default minimum deposit (0.005 ETH) below which we top up when gasLimit not provided */
const DEFAULT_MIN_DEPOSIT_WEI = BigInt('5000000000000000');
/** Default top-up amount (0.01 ETH) when deposit is below minimum and gasLimit not provided */
const DEFAULT_TOP_UP_WEI = BigInt('10000000000000000');
/** Default buffer (20%) added to estimated gas cost when gasLimit is provided */
const DEFAULT_BUFFER_PERCENT = 20;

/** Conservative UserOp gas limits for cost estimation (used when gasLimit param not passed per-call) */
export const ENTRY_POINT_GAS_LIMIT_DEPLOY = BigInt(12000000);
export const ENTRY_POINT_GAS_LIMIT_MINT = BigInt(800000);
/** Gas limit for sell/setPrice/etc. (EntryPoint path). Kept high so deposit top-up and UserOp callGasLimit are sufficient on all chains. */
export const ENTRY_POINT_GAS_LIMIT_OPERATION = BigInt(4000000);
/** callGasLimit for UserOp inner execute (sell, setPrice, etc.). AA95 = out of gas; raised for chains (e.g. Soneium Minato) that need more. */
export const USER_OP_CALL_GAS_LIMIT_OPERATION = BigInt(3500000);

/** EntryPoint v0.7 (StakeManager) ABI for deposit and balance */
const ENTRY_POINT_DEPOSIT_ABI = [
	{
		inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
		name: 'depositTo',
		outputs: [],
		stateMutability: 'payable',
		type: 'function',
	},
	{
		inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
		name: 'balanceOf',
		outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
		name: 'getDepositInfo',
		outputs: [
			{
				components: [
					{ name: 'deposit', type: 'uint256', internalType: 'uint256' },
					{ name: 'staked', type: 'bool', internalType: 'bool' },
					{ name: 'stake', type: 'uint112', internalType: 'uint112' },
					{ name: 'unstakeDelaySec', type: 'uint32', internalType: 'uint32' },
					{ name: 'withdrawTime', type: 'uint48', internalType: 'uint48' },
				],
				type: 'tuple',
				internalType: 'struct IStakeManager.DepositInfo',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

/**
 * Fund the SimpleAccount's EntryPoint deposit by sending ETH from the Platform Funding EOA
 * to EntryPoint.depositTo(account). Call this when using the EntryPoint path so UserOps can pay gas.
 *
 * @param params.entryPointAddress - EntryPoint v0.7 address (e.g. ENTRY_POINT_V07_ADDRESS)
 * @param params.accountAddress - SimpleAccount address to credit (depositTo target)
 * @param params.valueWei - Amount of wei to deposit
 * @param params.walletClient - Wallet client (Platform Funding EOA) that sends the tx
 * @param params.chain - Chain for the transaction (required by viem sendTransaction)
 * @returns Transaction hash
 */
export async function fundEntryPointDeposit(params: {
	entryPointAddress: `0x${string}`;
	accountAddress: `0x${string}`;
	valueWei: bigint;
	walletClient: WalletClient;
	chain: Chain;
}): Promise<`0x${string}`> {
	const { entryPointAddress, accountAddress, valueWei, walletClient, chain } = params;
	if (!walletClient.account) {
		throw new Error('fundEntryPointDeposit: walletClient must have an account');
	}
	const data = encodeFunctionData({
		abi: ENTRY_POINT_DEPOSIT_ABI,
		functionName: 'depositTo',
		args: [accountAddress],
	});
	const hash = await walletClient.sendTransaction({
		chain,
		to: entryPointAddress,
		data,
		value: valueWei,
		account: walletClient.account,
	});
	return hash;
}

/**
 * Get the EntryPoint deposit balance for an account (used for UserOp gas).
 *
 * @param entryPointAddress - EntryPoint v0.7 address
 * @param accountAddress - SimpleAccount (or any address) to query
 * @param publicClient - Viem public client
 */
export async function getEntryPointDepositBalance(
	entryPointAddress: `0x${string}`,
	accountAddress: Address,
	publicClient: PublicClient
): Promise<bigint> {
	return publicClient.readContract({
		address: entryPointAddress,
		abi: ENTRY_POINT_DEPOSIT_ABI,
		functionName: 'balanceOf',
		args: [accountAddress],
	});
}

export type EnsureEntryPointDepositParams = {
	/** Chain ID (hex string, e.g. from request) */
	chainId: `0x${string}` | string;
	/** SimpleAccount (or other paymaster account) address */
	simpleAccountAddress: Address;
	/** EntryPoint address (default: ENTRY_POINT_V07_ADDRESS) */
	entryPointAddress?: Address;
	/**
	 * Estimated UserOp gas limit for this transaction. When set, we compute required wei =
	 * gasLimit * maxFeePerGas * (1 + bufferPercent/100) and top up only the shortfall.
	 * Use ENTRY_POINT_GAS_LIMIT_* constants or operation-specific limits.
	 */
	gasLimit?: bigint;
	/** Buffer added to estimated cost when gasLimit is set (default 20 = 20%) */
	bufferPercent?: number;
	/** Only used when gasLimit is not set: minimum deposit below which we top up (default 0.005 ETH) */
	minBalanceWei?: bigint;
	/** Only used when gasLimit is not set: fixed amount to add when topping up (default 0.01 ETH) */
	topUpWei?: bigint;
};

export type EnsureEntryPointDepositResult = {
	/** True if we called fundEntryPointDeposit */
	funded: boolean;
	/** Deposit balance before any top-up */
	previousBalance: bigint;
	/** Deposit balance after top-up (only set when funded is true) */
	newBalance?: bigint;
	/** When gasLimit was provided: estimated required wei (cost + buffer) */
	requiredWei?: bigint;
};

/**
 * Ensure the SimpleAccount has enough EntryPoint deposit for this transaction.
 * - When gasLimit is set: required = gasLimit * maxFeePerGas * (1 + bufferPercent/100); top up only the shortfall.
 * - When gasLimit is not set: if balance < minBalanceWei, top up by topUpWei (legacy behavior).
 */
export async function ensureEntryPointDeposit(params: EnsureEntryPointDepositParams): Promise<EnsureEntryPointDepositResult> {
	const {
		chainId,
		simpleAccountAddress,
		entryPointAddress = ENTRY_POINT_V07_ADDRESS,
		gasLimit,
		bufferPercent = DEFAULT_BUFFER_PERCENT,
		minBalanceWei = DEFAULT_MIN_DEPOSIT_WEI,
		topUpWei = DEFAULT_TOP_UP_WEI,
	} = params;

	const chainIdStr = typeof chainId === 'string' ? chainId : String(chainId);
	const blockchainInfo = await getBlockchainInfo(chainIdStr);
	if (!blockchainInfo) {
		throw new Error(`Blockchain not found for chainId ${chainId}`);
	}
	const chain = blockchainInfo.blockchain;
	const rpcUrl = blockchainInfo.rpcUrl;
	if (!chain || !rpcUrl) {
		throw new Error(`Missing chain or RPC URL for chainId ${chainId}`);
	}

	const publicClient = createPublicClient({
		chain,
		transport: http(rpcUrl),
	});

	const previousBalance = await getEntryPointDepositBalance(entryPointAddress, simpleAccountAddress, publicClient);

	let requiredWei: bigint;
	if (gasLimit != null && gasLimit > BigInt(0)) {
		const gasPrice = await publicClient.getGasPrice();
		// maxFeePerGas with buffer; cost = gasLimit * maxFeePerGas
		const maxFeePerGas = (gasPrice * BigInt(100 + bufferPercent)) / BigInt(100);
		requiredWei = gasLimit * maxFeePerGas;
		if (previousBalance >= requiredWei) {
			return { funded: false, previousBalance, requiredWei };
		}
	} else {
		requiredWei = minBalanceWei;
		if (previousBalance >= minBalanceWei) {
			return { funded: false, previousBalance };
		}
	}

	const topUpAmount = gasLimit != null && gasLimit > BigInt(0) ? requiredWei - previousBalance : topUpWei;

	const privateKey = await getPrivateKeyByChainId(blockchainInfo.chainId);
	const account = privateKeyToAccount(normalizePrivateKey(privateKey) as `0x${string}`);
	const walletClient = createWalletClient({
		account,
		chain,
		transport: http(rpcUrl),
	});

	const txHash = await fundEntryPointDeposit({
		entryPointAddress,
		accountAddress: simpleAccountAddress,
		valueWei: topUpAmount,
		walletClient,
		chain,
	});

	await publicClient.waitForTransactionReceipt({ hash: txHash });

	const newBalance = await getEntryPointDepositBalance(entryPointAddress, simpleAccountAddress, publicClient);
	return {
		funded: true,
		previousBalance,
		newBalance,
		...(gasLimit != null && gasLimit > BigInt(0) && { requiredWei }),
	};
}

export { ENTRY_POINT_DEPOSIT_ABI };
