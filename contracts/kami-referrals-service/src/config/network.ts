import { Chain, createPublicClient, createWalletClient, http, type Address, type WalletClient } from 'viem';
import { baseSepolia, base, soneium, soneiumMinato } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import { getPrivateKeyByChainId } from '../utils/secrets';

dotenv.config();

const chains = new Map<string, Chain>();
chains.set('baseSepolia', baseSepolia);
chains.set('base', base);
chains.set('soneium', soneium);
chains.set('soneiumMinato', soneiumMinato);

// Chain must always come from environment variable, never hardcoded
if (!process.env.CHAIN) {
	throw new Error('CHAIN environment variable is required. Set CHAIN to one of: baseSepolia, base, soneium, soneiumMinato');
}

const chain = chains.get(process.env.CHAIN);
if (!chain) {
	throw new Error(`Chain "${process.env.CHAIN}" not found. Supported chains: baseSepolia, base, soneium, soneiumMinato`);
}

// Initialize wallet client asynchronously
// Since we can't use top-level await in CommonJS, we'll initialize eagerly and cache
let walletClientInstance: WalletClient | null = null;
let accountInstance: ReturnType<typeof privateKeyToAccount> | null = null;
let walletClientInitError: Error | null = null;

// Start initialization immediately (don't await, but start the process)
const walletClientInitPromise = (async () => {
	try {
		// Validate ENCRYPTION_KEY is set before attempting to decrypt
		if (!process.env.ENCRYPTION_KEY) {
			throw new Error(
				'ENCRYPTION_KEY environment variable is not set. ' +
				'This is required to decrypt private keys from the database. ' +
				'Generate with: openssl rand -hex 32'
			);
		}
		
		const privateKey = await getPrivateKeyByChainId(chain.id);
		accountInstance = privateKeyToAccount(privateKey);
		// RPC_URL must always come from environment variable, never hardcoded
		if (!process.env.RPC_URL) {
			throw new Error('RPC_URL environment variable is required');
		}
		walletClientInstance = createWalletClient({
			account: accountInstance,
			chain: chain,
			transport: http(process.env.RPC_URL),
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		walletClientInitError = new Error(
			`Failed to retrieve private key for chain ${chain.name} (ID: ${chain.id}): ${errorMessage}`
		);
		// Log the error immediately so it's visible even if the promise isn't awaited
		console.error('❌ Wallet client initialization failed:', walletClientInitError.message);
		console.error('   This will cause the service to fail when wallet operations are attempted.');
		console.error('   Ensure ENCRYPTION_KEY is set correctly and matches the key used for encryption.');
	}
})();

// Prevent unhandled promise rejection from crashing the process
// The error will still be thrown when the wallet client is actually used
walletClientInitPromise.catch((error) => {
	// Error is already handled above, but this prevents Node.js from treating it as unhandled
	// The actual error is stored in walletClientInitError and will be thrown when needed
});

// Helper to ensure wallet client is initialized before use
async function ensureWalletClientInitialized(): Promise<WalletClient> {
	await walletClientInitPromise;
	if (walletClientInitError) {
		throw walletClientInitError;
	}
	if (!walletClientInstance) {
		throw new Error('WalletClient initialization failed');
	}
	return walletClientInstance;
}

// RPC_URL must always come from environment variable, never hardcoded
if (!process.env.RPC_URL) {
	throw new Error('RPC_URL environment variable is required');
}

export const publicClient = createPublicClient({
	chain: chain,
	transport: http(process.env.RPC_URL),
});

// Export async getter for wallet client
// Services should use: const client = await getWalletClient();
export async function getWalletClient(): Promise<WalletClient> {
	return ensureWalletClientInitialized();
}

// Export async getter for account
export async function getAccount(): Promise<ReturnType<typeof privateKeyToAccount>> {
	await walletClientInitPromise;
	if (walletClientInitError) {
		throw walletClientInitError;
	}
	if (!accountInstance) {
		throw new Error('Account not initialized');
	}
	return accountInstance;
}

// For backward compatibility, export walletClient as a promise
// This will be initialized when the module loads
export const walletClient = ensureWalletClientInitialized();

export { chain };

export const contractAddress = process.env.CONTRACT_ADDRESS as Address | undefined;
