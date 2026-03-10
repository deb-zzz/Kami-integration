import { prisma } from '@/lib/db';
import type { BlockchainInfo } from '@/lib/types';
import { transaction as transactionType, Web3TransactionType } from '@prisma/client';
import type { Chain } from 'viem';
import { createPublicClient, formatEther, http } from 'viem';

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Receipt from viem getTransactionReceipt (status is 'success' | 'reverted') */
type ReceiptLike = { status?: string } | null;

/**
 * Throws if the receipt indicates the transaction reverted on-chain.
 * Used so callers (e.g. sell) do not update ownership in the DB when the transfer failed.
 * @internal Exported for unit tests.
 */
export function assertTransactionSucceeded(receipt: ReceiptLike, transactionHash?: string): void {
	const succeeded = receipt?.status === 'success';
	if (receipt != null && !succeeded) {
		console.error(`❌ Transaction reverted on-chain: ${transactionHash ?? 'unknown'}`);
		throw new Error('Transaction reverted on-chain');
	}
}

/**
 * Wait for transaction to be mined and block to be available
 * Retries with exponential backoff if block is not immediately available
 * @internal
 */
export async function waitForTransactionBlock(
	transactionHash: string,
	blockchainInfo: BlockchainInfo,
	maxRetries: number = 10,
	initialDelayMs: number = 1000,
): Promise<{ tx: any; block: any; receipt: any } | null> {
	const client = createPublicClient({
		chain: blockchainInfo.blockchain as unknown as Chain,
		transport: http(blockchainInfo.rpcUrl),
	});

	let delayMs = initialDelayMs;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const tx = await client.getTransaction({
				hash: transactionHash as `0x${string}`,
			});

			if (!tx) {
				if (attempt < maxRetries - 1) {
					console.log(`Transaction not found yet, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
					await sleep(delayMs);
					delayMs *= 2;
					continue;
				}
				throw new Error(`Transaction not found after ${maxRetries} attempts: ${transactionHash}`);
			}

			if (!tx.blockNumber) {
				if (attempt < maxRetries - 1) {
					console.log(`Transaction not mined yet, waiting ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
					await sleep(delayMs);
					delayMs *= 2;
					continue;
				}
				console.warn(`Transaction ${transactionHash} not mined after ${maxRetries} attempts, storing without block info`);
				return { tx, block: null, receipt: null };
			}

			try {
				const block = await client.getBlock({
					blockNumber: tx.blockNumber,
				});
				const receipt = await client.getTransactionReceipt({
					hash: transactionHash as `0x${string}`,
				});
				return { tx, block, receipt };
			} catch (blockError) {
				if (attempt < maxRetries - 1) {
					const errorMsg = blockError instanceof Error ? blockError.message : String(blockError);
					console.log(
						`Block ${tx.blockNumber} not available yet: ${errorMsg}, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`,
					);
					await sleep(delayMs);
					delayMs *= 2;
					continue;
				}
				console.warn(`Block ${tx.blockNumber} not available after ${maxRetries} attempts, storing transaction without block info`);
				return { tx, block: null, receipt: null };
			}
		} catch (error) {
			if (attempt < maxRetries - 1) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.log(`Error fetching transaction, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries}): ${errorMsg}`);
				await sleep(delayMs);
				delayMs *= 2;
				continue;
			}
			throw error;
		}
	}

	return null;
}

/**
 * Create a transaction record in the database after waiting for the tx to be mined
 */
export async function createTransaction(
	type: Web3TransactionType,
	transactionHash: string,
	blockchainInfo: BlockchainInfo,
	ownerAddress: string,
	checkoutId?: string,
): Promise<transactionType | null> {
	try {
		console.log(`📝 Creating transaction record for ${type}: ${transactionHash}`);

		const result = await waitForTransactionBlock(transactionHash, blockchainInfo);

		if (!result) {
			const errorMsg = `Failed to fetch transaction after retries: ${transactionHash}`;
			console.error(`❌ ${errorMsg}`);
			throw new Error(errorMsg);
		}

		const { tx, block, receipt } = result;
		let timestamp = block?.timestamp ? BigInt(block.timestamp) : BigInt(Date.now());
		if (timestamp < BigInt(1000000000000)) timestamp = timestamp * BigInt(1000);

		const txSucceeded = receipt?.status === 'success';
		const transactionData: any = {
			type,
			hash: transactionHash,
			from: ownerAddress,
			to: tx.to as `0x${string}`,
			chainId: blockchainInfo.chainId,
			value: tx.value.toString(),
			valueFormatted: formatEther(tx.value as bigint),
			gasLimit: tx.gas?.toString() || '0',
			gasPrice: tx.gasPrice?.toString() || '0',
			gasUsed: receipt?.gasUsed?.toString() || '0',
			blockNumber: tx.blockNumber ? Number(tx.blockNumber) : null,
			blockHash: block?.hash ? (block.hash as `0x${string}`) : null,
			transactionIndex: tx.transactionIndex ?? null,
			nonce: tx.nonce,
			data: tx.input,
			status: txSucceeded ? 1 : 0,
			timestamp: timestamp,
			checkoutId: checkoutId || null,
		};

		console.log(`💾 Saving transaction to database: ${type} on chain ${blockchainInfo.chainId}`);
		const transaction = await prisma.transaction.create({
			data: transactionData,
		});

		// If the transaction reverted on-chain, throw so callers (e.g. sell) do not update
		// ownership in the DB. Otherwise we'd have buyer in DB but seller still owner on-chain.
		assertTransactionSucceeded(receipt, transactionHash);

		console.log(`✅ Transaction record created successfully: Type=${type}, Hash=${transaction.hash}`);
		return transaction;
	} catch (error) {
		const errorDetails = error instanceof Error ? error.message : String(error);
		console.error(`❌ Error creating transaction record for ${type}:`, {
			transactionHash,
			chainId: blockchainInfo.chainId,
			ownerAddress,
			checkoutId,
			error: errorDetails,
			stack: error instanceof Error ? error.stack : undefined,
		});
		return null;
	}
}
