import { base, baseSepolia, mainnet, sepolia, soneium, soneiumMinato } from 'viem/chains';
import { prisma } from '@/lib/db';
import type { BlockchainInfo, PlatformInfo, PaymentTokenInfo } from '@/lib/types';
import type { Chain } from 'viem';

/**
 * Normalize chainId to hex format with 0x prefix
 *
 * Converts chain IDs from various formats (decimal string, hex string with/without 0x)
 * to a standardized hex format with 0x prefix. This ensures consistency across the codebase.
 */
export const getHexChainId = (chainId: string): `0x${string}` => {
	return chainId.startsWith('0x') ? (chainId as `0x${string}`) : (`0x${Number.parseInt(chainId).toString(16)}` as `0x${string}`);
};

/**
 * Get chainId from collection or fall back to DEFAULT_CHAIN_ID environment variable
 */
export function getChainIdWithDefault(collectionChainId: string | null | undefined): string | null {
	if (collectionChainId) {
		return collectionChainId;
	}
	return process.env.DEFAULT_CHAIN_ID || null;
}

/**
 * Get blockchain viem Chain object by chain ID
 */
export function getBlockchainViemObject(chainId: number | `0x${string}`): Chain | null {
	const numChainId = Number(getHexChainId(chainId.toString())) || 0;
	const blockchains = new Map<number, Chain>([
		[baseSepolia.id, baseSepolia],
		[base.id, base],
		[soneiumMinato.id, soneiumMinato],
		[soneium.id, soneium],
		[sepolia.id, sepolia],
		[mainnet.id, mainnet],
	]);
	return blockchains.get(numChainId) || null;
}

/**
 * Get blockchain configuration from database
 */
export async function getBlockchainInfo(chainId: string): Promise<BlockchainInfo | null> {
	try {
		const cid = getHexChainId(chainId);
		const info = await prisma.blockchain.findUnique({
			where: { chainId: cid },
			include: {
				paymentTokens: true,
			},
		});
		if (!info) {
			console.error(
				`[getBlockchainInfo] Blockchain not found for chainId: ${cid}. Ensure the chainId exists in the blockchain table.`,
			);
			return null;
		}
		const chainIdNumber = Number(info.chainId);
		return {
			...info,
			blockchain: getBlockchainViemObject(chainIdNumber) as Chain,
		} as BlockchainInfo;
	} catch (error) {
		console.error(`[getBlockchainInfo] Error fetching blockchain info for chainId ${chainId}:`, error);
		return null;
	}
}

/**
 * Get platform configuration information from database
 */
export async function getPlatformInfo(chainId: string): Promise<PlatformInfo | null> {
	try {
		const info = await prisma.platform.findUnique({
			where: { chainId },
		});
		if (!info) {
			console.error(
				`[getPlatformInfo] Platform info not found for chainId: ${chainId}. Ensure the chainId exists in the platform table.`,
			);
			return null;
		}
		return info;
	} catch (error) {
		console.error(`[getPlatformInfo] Error fetching platform info for chainId ${chainId}:`, error);
		return null;
	}
}

/**
 * Validate that payment tokens exist for a blockchain
 * @throws Error if no payment tokens are configured
 */
export function validatePaymentTokens(blockchainInfo: BlockchainInfo): void {
	if (!blockchainInfo.paymentTokens || blockchainInfo.paymentTokens.length === 0) {
		throw new Error(
			`No payment tokens configured for chainId ${blockchainInfo.chainId}. ` +
				`Please add at least one payment token to the payment_token table for this blockchain.`,
		);
	}
}

/**
 * Get default payment token for a blockchain
 * If preferredSymbol is provided, tries to find that token first
 */
export async function getDefaultPaymentToken(chainId: string, preferredSymbol?: string): Promise<PaymentTokenInfo | null> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			console.error(`[getDefaultPaymentToken] Blockchain not found for chainId: ${chainId}`);
			return null;
		}

		validatePaymentTokens(blockchainInfo);

		if (preferredSymbol) {
			const preferredToken = blockchainInfo.paymentTokens.find(
				(token) => token.symbol.toUpperCase() === preferredSymbol.toUpperCase(),
			);
			if (preferredToken) {
				return preferredToken;
			}
			if (blockchainInfo.paymentTokens.length > 0) {
				console.warn(
					`[getDefaultPaymentToken] Preferred payment token '${preferredSymbol}' not found for chainId ${chainId}. ` +
						`Using first available token: ${blockchainInfo.paymentTokens[0].symbol}`,
				);
			}
		}

		return blockchainInfo.paymentTokens[0];
	} catch (error) {
		console.error(`[getDefaultPaymentToken] Error fetching payment token for chainId ${chainId}:`, error);
		return null;
	}
}

/**
 * Validate that a chainId exists in the blockchain table
 */
export async function validateChainId(chainId: string): Promise<boolean> {
	try {
		const cid = getHexChainId(chainId);
		const blockchain = await prisma.blockchain.findUnique({
			where: { chainId: cid },
		});
		return blockchain !== null;
	} catch (error) {
		console.error('Error validating chainId:', error);
		return false;
	}
}
