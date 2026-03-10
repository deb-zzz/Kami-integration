/**
 * @fileoverview Secure secrets management utility for private key storage and retrieval.
 * @description Handles encrypted private key storage in database with AES-256-GCM encryption.
 * @module utils/secrets
 */

import { createDecipheriv, createCipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { prisma } from '@/lib/db';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getPlatformInfo } from '@/lib/gasless-nft';
import { EthereumAccountService } from '@/services/EthereumAccountService';

const scryptAsync = promisify(scrypt);

/**
 * Mask a private key for safe logging (shows only first 4 and last 4 characters)
 */
function maskKey(key: string): string {
	if (key.length <= 8) return '****';
	return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Get the encryption key from environment variable or AWS KMS
 * @returns Buffer containing the encryption key (32 bytes) with bytes reversed
 * @throws Error if encryption key is not available
 */
async function getEncryptionKey(): Promise<Buffer> {
	const encryptionKey = process.env.ENCRYPTION_KEY;
	if (!encryptionKey) {
		throw new Error('ENCRYPTION_KEY environment variable is required. Generate a 32-byte hex string (64 hex characters).');
	}

	// Trim whitespace that might come from docker-compose or environment files
	const trimmedKey = encryptionKey.trim();

	// Validate hex format and length (64 hex chars = 32 bytes)
	if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
		const keyLength = trimmedKey.length;
		const isValidHex = /^[0-9a-fA-F]+$/.test(trimmedKey);
		throw new Error(
			`ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ` +
				`Received: ${keyLength} characters, ${isValidHex ? 'valid hex' : 'invalid hex format'}. ` +
				`First 4 chars: "${trimmedKey.slice(0, 4)}", Last 4 chars: "${trimmedKey.slice(-4)}". ` +
				`Generate with: openssl rand -hex 32`
		);
	}

	// Convert to buffer and reverse all bytes for obfuscation
	// Create a copy to avoid mutating the original
	const keyBuffer = Buffer.from(trimmedKey, 'hex');
	const reversed = Buffer.alloc(keyBuffer.length);
	for (let i = 0; i < keyBuffer.length; i++) {
		reversed[i] = keyBuffer[keyBuffer.length - 1 - i];
	}
	return reversed;
}

/**
 * Derive a key from the encryption key using scrypt (for additional security)
 * This is a simplified version - in production, consider using a key derivation function
 * with a salt stored separately
 */
async function deriveKey(encryptionKey: Buffer, salt: Buffer): Promise<Buffer> {
	return (await scryptAsync(encryptionKey, salt, 32)) as Buffer;
}

/**
 * Encrypt a plaintext private key using AES-256-GCM
 * @param plaintext - The plaintext private key to encrypt
 * @returns Base64-encoded string containing: salt (16 bytes) + iv (12 bytes) + encrypted data + auth tag (16 bytes)
 */
export async function encryptPrivateKey(plaintext: string): Promise<string> {
	const encryptionKey = await getEncryptionKey();
	const salt = randomBytes(16);
	const derivedKey = await deriveKey(encryptionKey, salt);
	const iv = randomBytes(12); // 12 bytes for GCM

	const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
	cipher.setAAD(Buffer.from('quest_pk')); // Additional authenticated data

	let encrypted = cipher.update(plaintext, 'utf8');
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	const authTag = cipher.getAuthTag();

	// Combine: salt (16) + iv (12) + encrypted data + authTag (16)
	const combined = Buffer.concat([salt, iv, encrypted, authTag]);
	return combined.toString('base64');
}

/**
 * Decrypt an encrypted private key using AES-256-GCM
 * @param encryptedData - Base64-encoded encrypted data
 * @returns Decrypted plaintext private key
 * @throws Error if decryption fails
 */
export async function decryptPrivateKey(encryptedData: string): Promise<string> {
	try {
		const encryptionKey = await getEncryptionKey();
		const combined = Buffer.from(encryptedData, 'base64');

		// Extract components
		const salt = combined.slice(0, 16);
		const iv = combined.slice(16, 28);
		const authTag = combined.slice(-16);
		const encrypted = combined.slice(28, -16);

		const derivedKey = await deriveKey(encryptionKey, salt);
		const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
		decipher.setAAD(Buffer.from('quest_pk'));
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encrypted);
		decrypted = Buffer.concat([decrypted, decipher.final()]);

		return decrypted.toString('utf8');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Failed to decrypt private key: ${errorMessage}`);
	}
}

/**
 * Validate private key format (hex, with or without 0x prefix)
 * @param privateKey - The private key to validate
 * @returns Validated private key with 0x prefix
 * @throws Error if private key format is invalid
 */
function validatePrivateKeyFormat(privateKey: string): `0x${string}` {
	// Remove 0x prefix if present
	const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

	// Validate hex format and length (64 hex chars = 32 bytes for private key)
	if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
		throw new Error('Invalid private key format. Must be 64 hex characters (32 bytes).');
	}

	return `0x${cleanKey}` as `0x${string}`;
}

/**
 * Get encrypted private key from AWS Secrets Manager (fallback)
 * @param secretName - Name of the secret in AWS Secrets Manager
 * @returns Encrypted private key string
 */
async function getPrivateKeyFromAWS(secretName: string): Promise<string | null> {
	try {
		// Dynamically import AWS SDK to avoid requiring it if not used
		const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

		const client = new SecretsManagerClient({});
		const command = new GetSecretValueCommand({ SecretId: secretName });
		const response = await client.send(command);

		if (response.SecretString) {
			return response.SecretString;
		}

		if (response.SecretBinary) {
			return Buffer.from(response.SecretBinary).toString('base64');
		}

		return null;
	} catch (error) {
		// AWS SDK not available or secret not found - return null to try next source
		if (process.env.NODE_ENV !== 'production') {
			console.warn(`AWS Secrets Manager not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
		return null;
	}
}

/**
 * Get private key from environment variable (fallback, deprecated)
 * @returns Encrypted private key string or null
 */
function getPrivateKeyFromEnv(): string | null {
	const privateKey = process.env.PRIVATE_KEY;
	if (!privateKey) {
		return null;
	}

	// Warn about deprecated usage
	if (process.env.NODE_ENV !== 'test') {
		console.warn('⚠️  Using PRIVATE_KEY environment variable is deprecated. Use quest_pk database table instead.');
	}

	return privateKey;
}

/**
 * Convert chain ID to hex format for storage (with 0x prefix)
 * @param chainId - Chain ID as number or string (decimal or hex)
 * @returns Hex string with 0x prefix (e.g., "0x14a34")
 */
function chainIdToHex(chainId: number | string): string {
	let hexValue: string;

	// If it's already a hex string (with or without 0x), parse it
	if (typeof chainId === 'string') {
		const cleanHex = chainId.startsWith('0x') ? chainId.slice(2) : chainId;
		// Check if it's valid hex
		if (/^[0-9a-fA-F]+$/.test(cleanHex)) {
			// Convert to number and back to hex to normalize (remove leading zeros)
			const num = parseInt(cleanHex, 16);
			hexValue = num.toString(16);
		} else {
			// If not hex, treat as decimal
			const num = parseInt(chainId, 10);
			if (isNaN(num)) {
				throw new Error(`Invalid chain ID format: ${chainId}`);
			}
			hexValue = num.toString(16);
		}
	} else {
		// If it's a number, convert to hex
		hexValue = chainId.toString(16);
	}

	// Prepend 0x prefix
	return `0x${hexValue}`;
}

/**
 * Get private key from database by chain ID (stored as hex)
 * @param chainId - Chain ID as number or string
 * @returns Encrypted private key string or null
 */
async function getPrivateKeyFromDatabase(chainId: number | string): Promise<string | null> {
	try {
		const chainIdHex = chainIdToHex(chainId);
		const platformInfo = await getPlatformInfo(chainIdHex);

		return platformInfo?.platformFundingWalletPrivateKey as `0x${string}` | null;
	} catch (error) {
		// Database error - log but don't throw, allow fallback
		if (process.env.NODE_ENV !== 'test') {
			console.error(
				`Database error retrieving private key for chain ${chainId}:`,
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
		return null;
	}
}

/**
 * Get and decrypt private key by chain ID
 * Tries sources in priority order: Database → AWS Secrets Manager → Environment Variable
 * @param chainId - Chain ID as number or string (decimal or hex)
 * @returns Decrypted private key with 0x prefix
 * @throws Error if no private key found or decryption fails
 */
export async function getPrivateKeyByChainId(chainId: number | string | `0x${string}`): Promise<`0x${string}`> {
	const chainIdHex = chainIdToHex(chainId);

	// Try database first (primary source)
	let encryptedKey = await getPrivateKeyFromDatabase(chainIdHex);

	// Try AWS Secrets Manager (fallback)
	if (!encryptedKey && process.env.AWS_SECRET_NAME) {
		encryptedKey = await getPrivateKeyFromAWS(process.env.AWS_SECRET_NAME);
	}

	// Try environment variable (deprecated fallback)
	if (!encryptedKey) {
		encryptedKey = getPrivateKeyFromEnv();
	}

	if (!encryptedKey) {
		throw new Error(
			`Private key not found for chain ID ${chainIdHex}. ` +
				`Ensure a record exists in quest_pk table, or set AWS_SECRET_NAME, or set PRIVATE_KEY (deprecated).`
		);
	}

	// Decrypt the private key
	let decryptedKey: string;
	try {
		decryptedKey = await decryptPrivateKey(encryptedKey);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(
			`Failed to decrypt private key for chain ID ${chainIdHex}: ${errorMessage}. ` +
				`Ensure ENCRYPTION_KEY is correct and matches the key used for encryption.`
		);
	}

	// Validate and format the decrypted key
	try {
		return validatePrivateKeyFormat(decryptedKey);
	} catch (error) {
		const maskedKey = maskKey(decryptedKey);
		throw new Error(
			`Invalid private key format after decryption for chain ID ${chainIdHex} (${maskedKey}): ${
				error instanceof Error ? error.message : 'Unknown error'
			}`
		);
	}
}

/**
 * Store encrypted private key in database (chain ID stored as hex)
 * @param chainId - Chain ID as number or string (decimal or hex)
 * @param encryptedKey - Encrypted private key (base64 string)
 */
export async function storePrivateKey(chainId: number | string, encryptedKey: string): Promise<void> {
	const chainIdHex = chainIdToHex(chainId);
	
	// Check if platform record exists
	const existingPlatform = await prisma.platform.findUnique({
		where: { chainId: chainIdHex },
	});
	
	if (!existingPlatform) {
		throw new Error(
			`Platform record not found for chainId ${chainIdHex}. ` +
			`Please run the setup script first: pnpm setup:gasless ${chainIdHex} ` +
			`to create the platform record with all required fields.`
		);
	}
	
	await prisma.platform.update({
		where: { chainId: chainIdHex },
		data: { platformFundingWalletPrivateKey: encryptedKey },
	});
}

/**
 * Get private key for an identifier
 * @param identifier - Identifier for the account
 * @returns Private key with 0x prefix
 */
export function getPrivateKeyForIdentifier(identifier: string): `0x${string}` {
	const salt = process.env.ETHEREUM_SALT || '0000000000000000000000000000000000000000000000000000000000000000';
	const account = new EthereumAccountService().generateAccount(identifier, salt);
	return account.privateKey as `0x${string}`;
}

/**
 * Get private key for a wallet address
 * @param walletAddress - Wallet address to get private key for
 * @returns Private key with 0x prefix
 * @throws Error if account not found or email not found
 */
export async function getPrivateKeyForWalletAddress(walletAddress: string): Promise<`0x${string}`> {
	const account = await prisma.account.findFirst({
		where: {
			walletAddress: {
				equals: walletAddress,
				mode: 'insensitive',
			},
		},
	});
	if (!account) throw new Error(`Account not found for wallet address ${walletAddress}`);
	if (!account.email) throw new Error(`Email not found for account ${walletAddress}`);
	return getPrivateKeyForIdentifier(account.email);
}
