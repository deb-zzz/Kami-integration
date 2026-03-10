/**
 * KAMI Sponsored NFT Transactions Example
 *
 * This example demonstrates how to use the KAMI sponsored NFT system
 * with ERC-4337 account abstraction for gasless transactions on Base.
 */

import { ethers } from 'ethers';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { privateKeyToSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoPaymasterClient } from 'permissionless/clients/pimlico';

// Configuration
const config = {
	// Base network configuration
	baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
	baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',

	// Contract addresses (set after deployment)
	factoryAddress: process.env.FACTORY_ADDRESS,
	paymasterAddress: process.env.PAYMASTER_ADDRESS,
	nftContractAddress: process.env.NFT_CONTRACT_ADDRESS,

	// Payment token (USDC on Base)
	paymentTokenAddress: process.env.USDC_BASE || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

	// Entry point for ERC-4337
	entryPoint: process.env.BASE_ENTRY_POINT || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',

	// User private key
	privateKey: process.env.PRIVATE_KEY,
};

/**
 * Initialize the sponsored transaction system
 */
async function initializeSponsoredSystem() {
	console.log('🚀 Initializing KAMI Sponsored NFT System...');

	// Create public client for Base
	const publicClient = createPublicClient({
		chain: base,
		transport: http(config.baseRpcUrl),
	});

	// Create Paymaster client for gas sponsorship
	const paymasterClient = createPimlicoPaymasterClient({
		chain: base,
		transport: http(config.baseRpcUrl),
		entryPoint: config.entryPoint,
	});

	// Create Smart Account from private key
	const smartAccount = await privateKeyToSimpleSmartAccount(publicClient, {
		privateKey: config.privateKey,
		factoryAddress: config.factoryAddress,
		entryPoint: config.entryPoint,
	});

	// Create Smart Account Client with Paymaster
	const smartAccountClient = createSmartAccountClient({
		account: smartAccount,
		chain: base,
		bundlerTransport: http(config.baseRpcUrl),
		middleware: {
			sponsorUserOperation: paymasterClient.sponsorUserOperation,
		},
	});

	console.log('✅ System initialized');
	console.log('Smart Account Address:', smartAccount.address);

	return {
		publicClient,
		paymasterClient,
		smartAccount,
		smartAccountClient,
	};
}

/**
 * Mint an NFT with sponsored gas
 */
async function mintSponsoredNFT(smartAccountClient) {
	console.log('🎨 Minting NFT with sponsored gas...');

	try {
		// Encode the mint function call
		const mintData = smartAccountClient.encodeContractFunctionCall({
			abi: [
				{
					name: 'mint',
					type: 'function',
					inputs: [],
					outputs: [],
					stateMutability: 'nonpayable',
				},
			],
			functionName: 'mint',
			args: [],
		});

		// Send the transaction (gas will be sponsored)
		const txHash = await smartAccountClient.sendTransaction({
			to: config.nftContractAddress,
			data: mintData,
			value: 0n,
		});

		console.log('✅ NFT minted successfully!');
		console.log('Transaction Hash:', txHash);
		console.log('View on BaseScan:', `https://basescan.org/tx/${txHash}`);

		return txHash;
	} catch (error) {
		console.error('❌ Failed to mint NFT:', error);
		throw error;
	}
}

/**
 * Mint an NFT to a specific address with sponsored gas
 */
async function mintToSponsoredNFT(smartAccountClient, recipientAddress) {
	console.log(`🎨 Minting NFT to ${recipientAddress} with sponsored gas...`);

	try {
		// Encode the mintTo function call
		const mintToData = smartAccountClient.encodeContractFunctionCall({
			abi: [
				{
					name: 'mintTo',
					type: 'function',
					inputs: [{ name: 'to', type: 'address' }],
					outputs: [],
					stateMutability: 'nonpayable',
				},
			],
			functionName: 'mintTo',
			args: [recipientAddress],
		});

		// Send the transaction (gas will be sponsored)
		const txHash = await smartAccountClient.sendTransaction({
			to: config.nftContractAddress,
			data: mintToData,
			value: 0n,
		});

		console.log('✅ NFT minted to recipient successfully!');
		console.log('Transaction Hash:', txHash);
		console.log('View on BaseScan:', `https://basescan.org/tx/${txHash}`);

		return txHash;
	} catch (error) {
		console.error('❌ Failed to mint NFT to recipient:', error);
		throw error;
	}
}

/**
 * Sell an NFT with sponsored gas
 */
async function sellSponsoredNFT(smartAccountClient, tokenId, buyerAddress, salePrice) {
	console.log(`💰 Selling NFT ${tokenId} to ${buyerAddress} for ${salePrice} USDC...`);

	try {
		// Encode the sellToken function call
		const sellData = smartAccountClient.encodeContractFunctionCall({
			abi: [
				{
					name: 'sellToken',
					type: 'function',
					inputs: [
						{ name: 'to', type: 'address' },
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'salePrice', type: 'uint256' },
					],
					outputs: [],
					stateMutability: 'nonpayable',
				},
			],
			functionName: 'sellToken',
			args: [buyerAddress, tokenId, salePrice],
		});

		// Send the transaction (gas will be sponsored)
		const txHash = await smartAccountClient.sendTransaction({
			to: config.nftContractAddress,
			data: sellData,
			value: 0n,
		});

		console.log('✅ NFT sold successfully!');
		console.log('Transaction Hash:', txHash);
		console.log('View on BaseScan:', `https://basescan.org/tx/${txHash}`);

		return txHash;
	} catch (error) {
		console.error('❌ Failed to sell NFT:', error);
		throw error;
	}
}

/**
 * Rent an NFT with sponsored gas
 */
async function rentSponsoredNFT(smartAccountClient, tokenId, duration, rentalPrice) {
	console.log(`🏠 Renting NFT ${tokenId} for ${duration} seconds at ${rentalPrice} USDC...`);

	try {
		// Encode the rentToken function call
		const rentData = smartAccountClient.encodeContractFunctionCall({
			abi: [
				{
					name: 'rentToken',
					type: 'function',
					inputs: [
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'duration', type: 'uint256' },
						{ name: 'rentalPrice', type: 'uint256' },
					],
					outputs: [],
					stateMutability: 'nonpayable',
				},
			],
			functionName: 'rentToken',
			args: [tokenId, duration, rentalPrice],
		});

		// Send the transaction (gas will be sponsored)
		const txHash = await smartAccountClient.sendTransaction({
			to: config.nftContractAddress,
			data: rentData,
			value: 0n,
		});

		console.log('✅ NFT rented successfully!');
		console.log('Transaction Hash:', txHash);
		console.log('View on BaseScan:', `https://basescan.org/tx/${txHash}`);

		return txHash;
	} catch (error) {
		console.error('❌ Failed to rent NFT:', error);
		throw error;
	}
}

/**
 * End a rental with sponsored gas
 */
async function endRentalSponsored(smartAccountClient, tokenId) {
	console.log(`🏠 Ending rental for NFT ${tokenId}...`);

	try {
		// Encode the endRental function call
		const endRentalData = smartAccountClient.encodeContractFunctionCall({
			abi: [
				{
					name: 'endRental',
					type: 'function',
					inputs: [{ name: 'tokenId', type: 'uint256' }],
					outputs: [],
					stateMutability: 'nonpayable',
				},
			],
			functionName: 'endRental',
			args: [tokenId],
		});

		// Send the transaction (gas will be sponsored)
		const txHash = await smartAccountClient.sendTransaction({
			to: config.nftContractAddress,
			data: endRentalData,
			value: 0n,
		});

		console.log('✅ Rental ended successfully!');
		console.log('Transaction Hash:', txHash);
		console.log('View on BaseScan:', `https://basescan.org/tx/${txHash}`);

		return txHash;
	} catch (error) {
		console.error('❌ Failed to end rental:', error);
		throw error;
	}
}

/**
 * Batch multiple operations in a single sponsored transaction
 */
async function batchSponsoredOperations(smartAccountClient, operations) {
	console.log(`🔄 Executing ${operations.length} operations in batch...`);

	try {
		const calls = operations.map((op) => ({
			to: config.nftContractAddress,
			data: op.data,
			value: 0n,
		}));

		// Send batch transaction (gas will be sponsored)
		const txHash = await smartAccountClient.sendTransactions({
			transactions: calls,
		});

		console.log('✅ Batch operations completed successfully!');
		console.log('Transaction Hash:', txHash);
		console.log('View on BaseScan:', `https://basescan.org/tx/${txHash}`);

		return txHash;
	} catch (error) {
		console.error('❌ Failed to execute batch operations:', error);
		throw error;
	}
}

/**
 * Check user's spending limits and remaining operations
 */
async function checkUserLimits(publicClient, userAddress) {
	console.log(`📊 Checking limits for user ${userAddress}...`);

	try {
		// Read from Paymaster contract
		const userSpending = await publicClient.readContract({
			address: config.paymasterAddress,
			abi: [
				{
					name: 'userSpending',
					type: 'function',
					inputs: [{ name: 'user', type: 'address' }],
					outputs: [{ name: '', type: 'uint256' }],
					stateMutability: 'view',
				},
			],
			functionName: 'userSpending',
			args: [userAddress],
		});

		const userOperationCount = await publicClient.readContract({
			address: config.paymasterAddress,
			abi: [
				{
					name: 'userOperationCount',
					type: 'function',
					inputs: [{ name: 'user', type: 'address' }],
					outputs: [{ name: '', type: 'uint256' }],
					stateMutability: 'view',
				},
			],
			functionName: 'userOperationCount',
			args: [userAddress],
		});

		const userSpendingLimit = await publicClient.readContract({
			address: config.paymasterAddress,
			abi: [
				{
					name: 'userSpendingLimit',
					type: 'function',
					inputs: [],
					outputs: [{ name: '', type: 'uint256' }],
					stateMutability: 'view',
				},
			],
			functionName: 'userSpendingLimit',
		});

		const userOperationLimit = await publicClient.readContract({
			address: config.paymasterAddress,
			abi: [
				{
					name: 'userOperationLimit',
					type: 'function',
					inputs: [],
					outputs: [{ name: '', type: 'uint256' }],
					stateMutability: 'view',
				},
			],
			functionName: 'userOperationLimit',
		});

		console.log('📊 User Limits:');
		console.log(`  Spending: ${formatEther(userSpending)} / ${formatEther(userSpendingLimit)} USDC`);
		console.log(`  Operations: ${userOperationCount} / ${userOperationLimit}`);
		console.log(`  Remaining Spending: ${formatEther(userSpendingLimit - userSpending)} USDC`);
		console.log(`  Remaining Operations: ${userOperationLimit - userOperationCount}`);

		return {
			userSpending,
			userOperationCount,
			userSpendingLimit,
			userOperationLimit,
		};
	} catch (error) {
		console.error('❌ Failed to check user limits:', error);
		throw error;
	}
}

/**
 * Main example function
 */
async function main() {
	try {
		console.log('🎯 KAMI Sponsored NFT System Example');
		console.log('=====================================');

		// Initialize the system
		const { smartAccountClient, publicClient } = await initializeSponsoredSystem();

		// Check user limits
		await checkUserLimits(publicClient, smartAccountClient.account.address);

		// Example 1: Mint an NFT
		console.log('\n📝 Example 1: Minting an NFT');
		await mintSponsoredNFT(smartAccountClient);

		// Example 2: Mint to a specific address
		console.log('\n📝 Example 2: Minting to specific address');
		const recipientAddress = '0x1234567890123456789012345678901234567890';
		await mintToSponsoredNFT(smartAccountClient, recipientAddress);

		// Example 3: Rent an NFT (token ID 0)
		console.log('\n📝 Example 3: Renting an NFT');
		const rentalDuration = 7 * 24 * 60 * 60; // 7 days in seconds
		const rentalPrice = parseEther('50'); // 50 USDC
		await rentSponsoredNFT(smartAccountClient, 0, rentalDuration, rentalPrice);

		// Example 4: End rental
		console.log('\n📝 Example 4: Ending rental');
		await endRentalSponsored(smartAccountClient, 0);

		// Example 5: Batch operations
		console.log('\n📝 Example 5: Batch operations');
		const batchOperations = [
			{
				data: smartAccountClient.encodeContractFunctionCall({
					abi: [{ name: 'mint', type: 'function', inputs: [], outputs: [] }],
					functionName: 'mint',
					args: [],
				}),
			},
			{
				data: smartAccountClient.encodeContractFunctionCall({
					abi: [{ name: 'mintTo', type: 'function', inputs: [{ name: 'to', type: 'address' }], outputs: [] }],
					functionName: 'mintTo',
					args: [recipientAddress],
				}),
			},
		];
		await batchSponsoredOperations(smartAccountClient, batchOperations);

		// Check final limits
		console.log('\n📊 Final User Limits:');
		await checkUserLimits(publicClient, smartAccountClient.account.address);

		console.log('\n✅ All examples completed successfully!');
	} catch (error) {
		console.error('❌ Example failed:', error);
		process.exit(1);
	}
}

// Export functions for use in other modules
export {
	initializeSponsoredSystem,
	mintSponsoredNFT,
	mintToSponsoredNFT,
	sellSponsoredNFT,
	rentSponsoredNFT,
	endRentalSponsored,
	batchSponsoredOperations,
	checkUserLimits,
};

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
