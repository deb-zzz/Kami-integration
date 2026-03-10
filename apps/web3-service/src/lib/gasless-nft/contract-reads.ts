import { KamiSponsoredOperations } from '@paulstinchcombe/gasless-nft-tx';
import type { SponsoredOperationsConfig } from '@paulstinchcombe/gasless-nft-tx/dist/kami-sponsored-operations';
import { ENTRY_POINT_V07_ADDRESS } from '@paulstinchcombe/gasless-nft-tx/dist/SmartContractWallet/simpleAccountUserOp';
import { getPrivateKeyByChainId } from '@/app/utils/secrets';
import type { Chain } from 'viem';
import { createPublicClient, http } from 'viem';
import { getBlockchainInfo, getDefaultPaymentToken, getPlatformInfo, validatePaymentTokens } from './config';
import {
	ENTRY_POINT_GAS_LIMIT_OPERATION,
	USER_OP_CALL_GAS_LIMIT_OPERATION,
} from './entrypoint-deposit';
import { normalizePrivateKey } from './signatures';

/**
 * Get the balance of a wallet for a specific contract and tokenId.
 * Supports KAMI721AC and KAMI1155C contract types.
 */
export async function kamiBalanceOf(
	chainId: `0x${string}`,
	contractType: 'ERC721AC' | 'ERC1155C',
	contractAddress: string,
	walletAddress: string,
	tokenId?: number | string
): Promise<number> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const client = createPublicClient({
			chain: blockchainInfo.blockchain as unknown as Chain,
			transport: http(blockchainInfo.rpcUrl),
		});

		if (contractType === 'ERC721AC') {
			const balance = await client.readContract({
				address: contractAddress as `0x${string}`,
				abi: [
					{
						inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
						name: 'balanceOf',
						outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
						stateMutability: 'view',
						type: 'function',
					},
				],
				functionName: 'balanceOf',
				args: [walletAddress as `0x${string}`],
			});
			return typeof balance === 'bigint' ? Number(balance) : balance;
		} else if (contractType === 'ERC1155C') {
			if (tokenId === undefined || tokenId === null) {
				throw new Error('tokenId is required for ERC1155C balanceOf');
			}
			const balance = await client.readContract({
				address: contractAddress as `0x${string}`,
				abi: [
					{
						inputs: [
							{ internalType: 'address', name: 'account', type: 'address' },
							{ internalType: 'uint256', name: 'id', type: 'uint256' },
						],
						name: 'balanceOf',
						outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
						stateMutability: 'view',
						type: 'function',
					},
				],
				functionName: 'balanceOf',
				args: [walletAddress as `0x${string}`, BigInt(tokenId)],
			});
			return typeof balance === 'bigint' ? Number(balance) : balance;
		} else {
			throw new Error(`Unsupported contractType: ${contractType}`);
		}
	} catch (error) {
		console.error(`Error fetching balanceOf for ${contractType}:`, error);
		return 0;
	}
}

/**
 * Get the total supply of a KAMI NFT contract.
 * Supports ERC721AC and ERC1155C contract types.
 */
export async function kamiTotalSupply(
	chainId: `0x${string}`,
	contractType: 'ERC721AC' | 'ERC1155C',
	contractAddress: string,
	tokenId?: number | string
): Promise<number> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const client = createPublicClient({
			chain: blockchainInfo.blockchain as unknown as Chain,
			transport: http(blockchainInfo.rpcUrl),
		});

		if (contractType === 'ERC721AC') {
			const totalSupply = await client.readContract({
				address: contractAddress as `0x${string}`,
				abi: [
					{
						inputs: [],
						name: 'totalSupply',
						outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
						stateMutability: 'view',
						type: 'function',
					},
				],
				functionName: 'totalSupply',
			});
			return typeof totalSupply === 'bigint' ? Number(totalSupply) : totalSupply;
		} else if (contractType === 'ERC1155C') {
			if (tokenId === undefined || tokenId === null) {
				throw new Error('tokenId is required for ERC1155C totalSupply');
			}
			const totalSupply = await client.readContract({
				address: contractAddress as `0x${string}`,
				abi: [
					{
						inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
						name: 'totalSupply',
						outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
						stateMutability: 'view',
						type: 'function',
					},
				],
				functionName: 'totalSupply',
				args: [BigInt(tokenId)],
			});
			return typeof totalSupply === 'bigint' ? Number(totalSupply) : totalSupply;
		} else {
			throw new Error(`Unsupported contractType: ${contractType}`);
		}
	} catch (error) {
		console.error(`Error fetching totalSupply for ${contractType}:`, error);
		return 0;
	}
}

/**
 * Get the max quantity (maxSupply) of a KAMI721AC NFT contract.
 */
export async function kamiMaxQuantity(chainId: `0x${string}`, contractAddress: string): Promise<number> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(chainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${chainId}`);
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		const useEntryPoint = process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true';
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
			useEntryPointForExecute: useEntryPoint,
			...(useEntryPoint && {
				callGasLimit: USER_OP_CALL_GAS_LIMIT_OPERATION,
				handleOpsGasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
			}),
		};

		const handler = new KamiSponsoredOperations(operationsConfig);

		const result = await handler.getMaxQuantity(contractAddress as `0x${string}`, 'KAMI721AC');

		if (!result.success || result.maxTotalSupply === undefined) {
			console.error('Failed to get max quantity:', result.error);
			return 0;
		}

		return Number(result.maxTotalSupply ?? 0);
	} catch (error) {
		console.error(`Error fetching maxQuantity for ERC721AC:`, error);
		return 0;
	}
}

/**
 * Get the total number of tokens minted from a KAMI721AC NFT contract.
 */
export async function kamiTotalMinted(chainId: `0x${string}`, contractAddress: string): Promise<number> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(chainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${chainId}`);
		}

		const useEntryPoint = process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true';
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey: await getPrivateKeyByChainId(blockchainInfo.chainId),
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
			useEntryPointForExecute: useEntryPoint,
			...(useEntryPoint && {
				callGasLimit: USER_OP_CALL_GAS_LIMIT_OPERATION,
				handleOpsGasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
			}),
		};

		const handler = new KamiSponsoredOperations(operationsConfig);

		const result = await handler.getTotalMinted(contractAddress as `0x${string}`, 'KAMI721AC', undefined);

		if (!result.success || result.totalMinted === undefined) {
			console.error('Failed to get total minted:', result.error);
			return 0;
		}

		return typeof result.totalMinted === 'bigint' ? Number(result.totalMinted) : result.totalMinted;
	} catch (error) {
		console.error(`Error fetching totalMinted for ERC721AC:`, error);
		return 0;
	}
}
