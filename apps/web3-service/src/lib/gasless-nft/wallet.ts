import { getPrivateKeyForWalletAddress } from '@/app/utils/secrets';
import { getHexChainId } from './config';
import { validateGaslessConfig } from '@/lib/gasless-config';

/**
 * Get owner private key for a wallet address
 */
export async function getOwnerPrivateKey(walletAddress: string): Promise<`0x${string}` | null> {
	try {
		const ownerPrivateKey = await getPrivateKeyForWalletAddress(walletAddress);
		if (!ownerPrivateKey) {
			console.error(`Owner private key not found for wallet address: ${walletAddress}`);
			return null;
		}
		return ownerPrivateKey;
	} catch (error) {
		console.error('Error fetching owner private key:', error);
		return null;
	}
}

/**
 * Validate wallet access for gasless operations
 */
export async function validateWalletAccess(chainId: string, walletAddress: string): Promise<boolean> {
	try {
		await validateGaslessConfig(getHexChainId(chainId));

		if (!walletAddress || walletAddress.length !== 42 || !walletAddress.startsWith('0x')) {
			console.error(`Invalid wallet address format: ${walletAddress}`);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error validating wallet access:', error);
		return false;
	}
}
