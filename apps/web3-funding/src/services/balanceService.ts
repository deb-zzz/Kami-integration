import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { prisma } from '../utils/prisma.js';

// Cache for RPC clients per chainId
const rpcClientCache = new Map<string, PublicClient>();

/**
 * Get or create a viem public client for a given chainId
 */
async function getRpcClient(chainId: string): Promise<PublicClient | null> {
  // Check cache first
  if (rpcClientCache.has(chainId)) {
    return rpcClientCache.get(chainId)!;
  }

  try {
    // Query blockchain table for RPC URL
    const blockchain = await prisma.blockchain.findUnique({
      where: { chainId },
      select: { rpcUrl: true },
    });

    if (!blockchain || !blockchain.rpcUrl) {
      console.error(`No RPC URL found for chainId: ${chainId}`);
      return null;
    }

    // Create viem public client
    const client = createPublicClient({
      transport: http(blockchain.rpcUrl),
    });

    // Cache the client
    rpcClientCache.set(chainId, client);

    return client;
  } catch (error) {
    console.error(`Error getting RPC client for chainId ${chainId}:`, error);
    return null;
  }
}

/**
 * Fetch the native token balance for a wallet address on a specific chain
 * @param walletAddress - The wallet address to check
 * @param chainId - The chain ID
 * @returns Balance as BigInt, or null if fetch fails
 */
export async function getWalletBalance(
  walletAddress: string,
  chainId: string
): Promise<{ balance: bigint | null; error: string | null }> {
  try {
    const client = await getRpcClient(chainId);

    if (!client) {
      return {
        balance: null,
        error: `No RPC client available for chainId: ${chainId}`,
      };
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return {
        balance: null,
        error: `Invalid wallet address format: ${walletAddress}`,
      };
    }

    // Fetch balance using viem
    const balance = await client.getBalance({
      address: walletAddress as Address,
    });

    return {
      balance,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `Error fetching balance for ${walletAddress} on chain ${chainId}:`,
      errorMessage
    );
    return {
      balance: null,
      error: errorMessage,
    };
  }
}

/**
 * Format balance from Wei to a readable string
 * @param balance - Balance in Wei (BigInt)
 * @param decimals - Number of decimals (default 18 for most chains)
 * @returns Formatted balance string
 */
export function formatBalance(balance: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  const fractionalString = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalString.replace(/0+$/, '');
  
  return `${wholePart}.${trimmedFractional}`;
}
