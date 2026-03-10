#!/usr/bin/env ts-node

/**
 * @fileoverview Utility script to encrypt and store private keys in the quest_pk database table.
 * @description This script helps users encrypt their plaintext private keys and store them in the database.
 * @usage ts-node scripts/encrypt-key.ts <chainId> <privateKey>
 * @example ts-node scripts/encrypt-key.ts 84532 0x1234567890abcdef...
 */

import dotenv from 'dotenv';
import { encryptPrivateKey, storePrivateKey } from '../src/utils/secrets';

dotenv.config();

async function main() {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error('Usage: ts-node scripts/encrypt-key.ts <chainId> <privateKey>');
		console.error('');
		console.error('Arguments:');
		console.error('  chainId    - The chain ID in decimal or hex format');
		console.error('              Examples: 84532 (decimal) or 0x14a34 (hex) or 14a34 (hex)');
		console.error('              Base Sepolia: 84532 or 0x14a34');
		console.error('              Base: 8453 or 0x2105');
		console.error('  privateKey - The plaintext private key (with or without 0x prefix)');
		console.error('');
		console.error('Examples:');
		console.error('  ts-node scripts/encrypt-key.ts 84532 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
		console.error('  ts-node scripts/encrypt-key.ts 0x14a34 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
		console.error('');
		console.error('Environment variables required:');
		console.error('  ENCRYPTION_KEY - 32-byte hex string (64 hex characters)');
		console.error('  DATABASE_URL    - PostgreSQL connection string');
		process.exit(1);
	}

	const [chainIdStr, privateKey] = args;

	// Validate and convert chain ID to hex
	// Accept both decimal and hex (with or without 0x prefix)
	let chainId: number;
	if (chainIdStr.startsWith('0x') || /^[0-9a-fA-F]+$/.test(chainIdStr)) {
		// Check if it's hex format (contains a-f or A-F, or starts with 0x)
		const isHex = chainIdStr.startsWith('0x') || /[a-fA-F]/.test(chainIdStr);
		if (isHex) {
			const cleanHex = chainIdStr.startsWith('0x') ? chainIdStr.slice(2) : chainIdStr;
			chainId = parseInt(cleanHex, 16);
		} else {
			// Pure numeric string - treat as decimal
			chainId = parseInt(chainIdStr, 10);
		}
	} else {
		// Decimal format
		chainId = parseInt(chainIdStr, 10);
	}

	if (isNaN(chainId) || chainId <= 0) {
		console.error(`Error: Invalid chain ID "${chainIdStr}". Must be a positive integer (decimal or hex).`);
		console.error('Examples: 84532 (decimal) or 0x14a34 (hex) or 14a34 (hex without prefix)');
		process.exit(1);
	}

	// Validate ENCRYPTION_KEY
	if (!process.env.ENCRYPTION_KEY) {
		console.error('Error: ENCRYPTION_KEY environment variable is required.');
		console.error('Generate one with: openssl rand -hex 32');
		process.exit(1);
	}

	if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
		console.error('Error: ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
		console.error('Generate one with: openssl rand -hex 32');
		process.exit(1);
	}

	// Validate DATABASE_URL
	if (!process.env.DATABASE_URL) {
		console.error('Error: DATABASE_URL environment variable is required.');
		process.exit(1);
	}

	// Validate private key format
	const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
	if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
		console.error('Error: Invalid private key format. Must be 64 hex characters (32 bytes).');
		console.error('Private key should be 64 hex characters, with or without 0x prefix.');
		process.exit(1);
	}

	try {
		const chainIdHex = `0x${chainId.toString(16)}`;
		console.log(`Chain ID: ${chainId} (decimal) = ${chainIdHex} (will be stored as hex with 0x prefix)`);
		console.log(`Encrypting private key for chain ID ${chainIdHex}...`);

		// Encrypt the private key
		const encryptedKey = await encryptPrivateKey(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);

		console.log('Private key encrypted successfully.');

		// Store in database (chainId will be converted to hex with 0x prefix internally)
		console.log(`Storing encrypted private key in quest_pk table...`);
		await storePrivateKey(chainId, encryptedKey);

		console.log(`✅ Successfully stored encrypted private key for chain ID ${chainIdHex} in database.`);
		console.log('');
		console.log('The private key is now stored securely in the quest_pk table.');
		console.log('You can remove the PRIVATE_KEY environment variable if it was set.');
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

