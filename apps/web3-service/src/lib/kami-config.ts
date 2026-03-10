// lib/kami-config.ts
import type { LibraryDeploymentResult } from '@paulstinchcombe/gasless-nft-tx';
import { prisma } from '@/lib/db';
import { getHexChainId } from './gasless-nft';

/**
 * Load KAMI library addresses from platform table using chainId
 * Falls back to environment variables for backward compatibility
 * Safe for Next.js API routes (server-side only)
 * 
 * @param chainId - The chain ID as a hex string (e.g., "0x14a34" for Base Sepolia, "0x2105" for Base Mainnet)
 * @returns Promise<LibraryDeploymentResult> - Library addresses for the specified chain
 */
export async function getKamiLibraries(chainId: string): Promise<LibraryDeploymentResult> {
	const cid = getHexChainId(chainId);
	
	// Try to fetch from platform table first
	try {
		const platform = await prisma.platform.findUnique({
			where: { chainId: cid },
		});

		if (platform) {
			const libraries: LibraryDeploymentResult = {
				kamiNFTCore: platform.kamiNFTCoreLibraryAddress as `0x${string}`,
				kamiPlatform: platform.kamiPlatformLibraryAddress as `0x${string}`,
				kamiRoyalty: platform.kamiRoyaltyLibraryAddress as `0x${string}`,
				kamiRental: platform.kamiRentalLibraryAddress as `0x${string}`,
				kamiTransfer: platform.kamiTransferLibraryAddress as `0x${string}`,
			};

			// Validate all addresses are present
			const missing = Object.entries(libraries)
				.filter(([_, addr]) => !addr || addr === 'undefined')
				.map(([name]) => name);

			if (missing.length > 0) {
				console.warn(
					`Missing KAMI library addresses in platform table for chainId ${cid}: ${missing.join(', ')}. ` +
					`Falling back to environment variables.`
				);
			} else {
				// Validate address format
				const invalid = Object.entries(libraries)
					.filter(([_, addr]) => !addr.startsWith('0x') || addr.length !== 42)
					.map(([name]) => name);

				if (invalid.length > 0) {
					console.warn(
						`Invalid address format in platform table for chainId ${cid}: ${invalid.join(', ')}. ` +
						`Falling back to environment variables.`
					);
				} else {
					return libraries;
				}
			}
		}
	} catch (error) {
		console.warn(
			`Error fetching KAMI libraries from platform table for chainId ${cid}: ${error instanceof Error ? error.message : String(error)}. ` +
			`Falling back to environment variables.`
		);
	}

	// Fallback to environment variables (backward compatibility)
	console.warn(
		`DEPRECATED: Using environment variables for KAMI library addresses. ` +
		`This is deprecated and will be removed in a future version. ` +
		`Please configure library addresses in the platform table for chainId ${cid}.`
	);

	const libraries: LibraryDeploymentResult = {
		kamiNFTCore: process.env.KAMI_NFT_CORE! as `0x${string}`,
		kamiPlatform: process.env.KAMI_PLATFORM! as `0x${string}`,
		kamiRoyalty: process.env.KAMI_ROYALTY! as `0x${string}`,
		kamiRental: process.env.KAMI_RENTAL! as `0x${string}`,
		kamiTransfer: process.env.KAMI_TRANSFER! as `0x${string}`,
	};

	// Validate all addresses are present
	const missing = Object.entries(libraries)
		.filter(([_, addr]) => !addr || addr === 'undefined')
		.map(([name]) => name);

	if (missing.length > 0) {
		throw new Error(
			`Missing KAMI library addresses in environment: ${missing.join(', ')}. ` +
				`Deploy libraries first and add addresses to environment variables or platform table.`
		);
	}

	// Validate address format
	const invalid = Object.entries(libraries)
		.filter(([_, addr]) => !addr.startsWith('0x') || addr.length !== 42)
		.map(([name]) => name);

	if (invalid.length > 0) {
		throw new Error(`Invalid address format for: ${invalid.join(', ')}`);
	}

	return libraries;
}

/**
 * Verify libraries are deployed (call once on startup)
 * 
 * @param chainId - The chain ID as a hex string (e.g., "0x14a34" for Base Sepolia, "0x2105" for Base Mainnet)
 * @param rpcUrl - Optional RPC URL. If not provided, will be fetched from blockchain table
 */
export async function verifyKamiLibraries(chainId: string, rpcUrl?: string): Promise<boolean> {
	const { ethers } = await import('ethers');
	const { verifyLibraryAddresses } = await import('@paulstinchcombe/gasless-nft-tx');
	const { getBlockchainInfo } = await import('./gasless-nft');

	const libraries = await getKamiLibraries(chainId);
	
	// Get RPC URL from blockchain table if not provided
	let finalRpcUrl = rpcUrl;
	if (!finalRpcUrl) {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found for chainId: ${chainId}`);
		}
		finalRpcUrl = blockchainInfo.rpcUrl;
	}

	const provider = new ethers.JsonRpcProvider(finalRpcUrl);

	return verifyLibraryAddresses(libraries, provider);
}
