import { Router, Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { ApiResponse, TransferRequest, TransferResponse, ErrorResponse, TransactionDetails } from '../types';
import { ethers } from 'ethers';
import { prisma } from '../utils/prisma';

const router: Router = Router();

// Initialize wallet service

/**
 * POST /api/transfer/:chainId/usdc
 * Transfer USDC tokens from one wallet to another on a specific chain
 *
 * @route POST /api/transfer/:chainId/usdc
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34" for Base Sepolia)
 * @param {Request.body} req.body - Transfer request body:
 *   - fromAddress: string (required) - Sender wallet address (0x format, 40 hex chars)
 *   - toAddress: string (required) - Recipient wallet address (0x format, 40 hex chars)
 *   - amount: string (required) - Amount to transfer as decimal string (e.g., "100.0")
 * @param {Response} res - Express response object
 *
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the transfer was successful
 *   - data?: TransactionDetails - Complete transaction details if successful:
 *     - hash: string - Transaction hash
 *     - from: string - Sender address
 *     - to: string - Recipient address
 *     - value: string - Transaction value in Wei
 *     - valueFormatted: string - Formatted transaction value
 *     - gasLimit: string - Gas limit
 *     - gasPrice: string - Gas price
 *     - gasUsed?: string - Gas used
 *     - blockNumber?: number - Block number
 *     - blockHash?: string - Block hash
 *     - transactionIndex?: number - Transaction index
 *     - status?: number - Transaction status (1 = success, 0 = failure)
 *     - nonce: number - Transaction nonce
 *     - data: string - Transaction data
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 *
 * @example
 * // Request: POST /api/transfer/0x14a34/usdc
 * // Request body:
 * {
 *   "fromAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
 *   "toAddress": "0x...",
 *   "amount": "100.0"
 * }
 *
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "hash": "0x...",
 *     "from": "0x...",
 *     "to": "0x...",
 *     "value": "0",
 *     "valueFormatted": "0.0",
 *     "gasLimit": "100000",
 *     "gasPrice": "20000000000",
 *     "gasUsed": "65000",
 *     "blockNumber": 12345678,
 *     "status": 1
 *   },
 *   "message": "USDC transfer completed successfully"
 * }
 */
router.post('/:chainId/usdc', async (req: Request, res: Response) => {
	try {
		const { chainId } = req.params;
		const { fromAddress, toAddress, amount } = req.body;

		// Validate required fields
		if (!fromAddress || !toAddress || !amount) {
			const missingFields = [
				!fromAddress && 'fromAddress',
				!toAddress && 'toAddress',
				!amount && 'amount',
			].filter(Boolean) as string[];
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'MISSING_FIELDS',
				message: 'fromAddress, toAddress, and amount are required',
				details: missingFields.length ? [{ field: 'body', message: `Missing: ${missingFields.join(', ')}. Received keys: ${Object.keys(req.body || {}).join(', ') || 'none (check Content-Type: application/json)'}` }] : undefined,
			};
			console.warn('Transfer validation failed:', { chainId, errorResponse, bodyKeys: Object.keys(req.body || {}) });
			return res.status(400).json(errorResponse);
		}

		// Validate address formats
		if (!/^0x[a-fA-F0-9]{40}$/.test(fromAddress) || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_ADDRESS',
				message: 'Invalid wallet address format',
			};
			return res.status(400).json(errorResponse);
		}

		// Validate amount
		const numAmount = parseFloat(amount);
		if (isNaN(numAmount) || numAmount <= 0) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_AMOUNT',
				message: 'Amount must be a positive number',
			};
			return res.status(400).json(errorResponse);
		}

		const blockchain = await WalletService.getBlockchain(chainId);
		if (!blockchain) throw new Error('Blockchain not found');
		const USDC = blockchain.paymentTokens.find((token) => token.symbol === 'USDC');
		if (!USDC) throw new Error('USDC token contract address not found');
		const walletService = new WalletService(chainId, blockchain.rpcUrl, USDC.contractAddress);
		const privateKey = await WalletService.getPrivateKey(chainId, fromAddress);
		if (!privateKey) throw new Error('Private key not found');

		const transferRequest: TransferRequest = {
			fromAddress,
			toAddress,
			amount,
			// privateKey,
			paymentToken: 'USDC',
		};

		// const result = await walletService.transferUSDC(transferRequest);
		const result = await walletService.sponsoredTransferPaymentToken(transferRequest);

		if (result.success && result.transactionHash) {
			// Get detailed transaction information for response (web3-service already saves to DB)
			const transactionDetails = await walletService.getTransactionDetails(result.transactionHash);

			// Send success notification
			await sendNotification(fromAddress, toAddress, amount, chainId, true, result.transactionHash);

			const response: ApiResponse<TransactionDetails> = {
				success: true,
				data: transactionDetails,
				message: 'USDC transfer completed successfully',
			};
			res.json(response);
		} else {
			// Send failure notification
			await sendNotification(fromAddress, toAddress, amount, chainId, false, undefined, result.error);

			console.warn('Transfer failed:', { chainId, fromAddress, toAddress, amount, error: result.error });
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'TRANSFER_FAILED',
				message: result.error || 'Transfer failed',
			};
			res.status(400).json(errorResponse);
		}
	} catch (error) {
		console.error('Error processing USDC transfer:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'TRANSFER_ERROR',
			message: error instanceof Error ? error.message : 'Failed to process USDC transfer',
		};

		res.status(500).json(errorResponse);
	}
});

/**
 * POST /api/transfer/:chainId/estimate-gas
 * Estimate gas cost for a USDC token transfer
 *
 * @route POST /api/transfer/:chainId/estimate-gas
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34" for Base Sepolia)
 * @param {Request.body} req.body - Gas estimation request body:
 *   - fromAddress: string (required) - Sender wallet address (0x format, 40 hex chars)
 *   - toAddress: string (required) - Recipient wallet address (0x format, 40 hex chars)
 *   - amount: string (required) - Amount to transfer as decimal string (e.g., "100.0")
 * @param {Response} res - Express response object
 *
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the estimation was successful
 *   - data?: object - Gas estimation data:
 *     - estimatedGas: string - Estimated gas units needed for the transfer
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 *
 * @example
 * // Request: POST /api/transfer/0x14a34/estimate-gas
 * // Request body:
 * {
 *   "fromAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
 *   "toAddress": "0x...",
 *   "amount": "100.0"
 * }
 *
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "estimatedGas": "62989"
 *   },
 *   "message": "Gas estimation completed"
 * }
 */
router.post('/:chainId/estimate-gas', async (req: Request, res: Response) => {
	try {
		const { chainId } = req.params;
		const { fromAddress, toAddress, amount } = req.body;

		// Validate required fields
		if (!fromAddress || !toAddress || !amount) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'MISSING_FIELDS',
				message: 'fromAddress, toAddress, and amount are required',
			};
			return res.status(400).json(errorResponse);
		}

		// Validate address formats
		if (!/^0x[a-fA-F0-9]{40}$/.test(fromAddress) || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_ADDRESS',
				message: 'Invalid wallet address format',
			};
			return res.status(400).json(errorResponse);
		}

		// Validate amount
		const numAmount = parseFloat(amount);
		if (isNaN(numAmount) || numAmount <= 0) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_AMOUNT',
				message: 'Amount must be a positive number',
			};
			return res.status(400).json(errorResponse);
		}

		// Get blockchain configuration
		const blockchain = await WalletService.getBlockchain(chainId);
		if (!blockchain) throw new Error('Blockchain not found');
		const USDC = blockchain.paymentTokens.find((token) => token.symbol === 'USDC');
		if (!USDC) throw new Error('USDC token contract address not found');

		// Use ethers v6 to estimate gas for USDC transfer
		const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);

		const usdcAbi = ['function transfer(address to, uint256 amount) returns (bool)'];
		const usdcAddress = USDC.contractAddress;

		const usdcContract = new ethers.Contract(usdcAddress!, usdcAbi, provider);

		// Convert amount to proper format (USDC has 6 decimals on Base Sepolia)
		const usdcDecimals = 6;
		const amountInWei = ethers.parseUnits(amount, usdcDecimals);

		// Ensure addresses are properly checksummed
		const checksummedFromAddress = ethers.getAddress(fromAddress);
		const checksummedToAddress = ethers.getAddress(toAddress);

		// Estimate gas for the transfer
		const estimatedGasBigInt = await usdcContract.transfer.estimateGas(checksummedToAddress, amountInWei, {
			from: checksummedFromAddress,
		});

		const estimatedGas = estimatedGasBigInt.toString();

		const response: ApiResponse<{ estimatedGas: string }> = {
			success: true,
			data: { estimatedGas },
			message: 'Gas estimation completed',
		};

		res.json(response);
	} catch (error) {
		console.error('Error estimating gas:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'GAS_ESTIMATION_ERROR',
			message: error instanceof Error ? error.message : 'Failed to estimate gas',
		};

		res.status(500).json(errorResponse);
	}
});

/**
 * Send notification to users about transfer status
 * @param {string} fromAddress - Sender wallet address
 * @param {string} toAddress - Recipient wallet address
 * @param {string} amount - Transfer amount
 * @param {string} chainId - Blockchain chain ID
 * @param {boolean} success - Whether the transfer was successful
 * @param {string} [transactionHash] - Transaction hash if successful
 * @param {string} [errorMessage] - Error message if failed
 * @returns {Promise<void>} Resolves when notifications are sent (or attempted)
 * @private
 */
async function sendNotification(
	fromAddress: string,
	toAddress: string,
	amount: string,
	chainId: string,
	success: boolean,
	transactionHash?: string,
	errorMessage?: string,
) {
	let sender = null;
	let recipient = null;

	// Fetch user data with error handling
	try {
		sender = await prisma.user.findUnique({
			where: { walletAddress: fromAddress },
			select: { userName: true, avatarUrl: true, description: true },
		});
	} catch (error) {
		console.error('Failed to fetch sender user data:', (error as Error).message);
	}

	try {
		recipient = await prisma.user.findUnique({
			where: { walletAddress: toAddress },
			select: { userName: true, avatarUrl: true, description: true },
		});
	} catch (error) {
		console.error('Failed to fetch recipient user data:', (error as Error).message);
	}

	const fromUsername = sender?.userName || fromAddress;
	const toUsername = recipient?.userName || toAddress;
	const currency = 'USDC';

	if (success && transactionHash) {
		// Success notification for sender
		const senderMessage = `Transfer of ${amount} ${currency} to @${toUsername} completed successfully`;
		const senderPayload = {
			walletAddress: toAddress,
			message: senderMessage,
			from: {
				avatarUrl: sender?.avatarUrl || '',
				userName: fromUsername,
				description: sender?.description || '',
				walletAddress: fromAddress,
			},
			amount,
			currency,
			transactionHash,
			chainId,
		};

		try {
			await fetch(`http://notifications-service:3000/api/web-push/send?walletAddress=${fromAddress}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic: 'transfer',
					payload: senderPayload,
					message: senderMessage,
				}),
			});
		} catch (error) {
			console.log('Failed to send notification to sender:', (error as Error).message);
		}

		// Success notification for recipient (only if they have a profile)
		if (recipient) {
			const recipientMessage = `Received ${amount} ${currency} from @${fromUsername}`;
			const recipientPayload = {
				walletAddress: fromAddress,
				message: recipientMessage,
				from: {
					avatarUrl: sender?.avatarUrl || '',
					userName: fromUsername,
					description: sender?.description || '',
					walletAddress: fromAddress,
				},
				amount,
				currency,
				transactionHash,
				chainId,
			};

			try {
				await fetch(`http://notifications-service:3000/api/web-push/send?walletAddress=${toAddress}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						topic: 'transfer',
						payload: recipientPayload,
						message: recipientMessage,
					}),
				});
			} catch (error) {
				console.log('Failed to send notification to recipient:', (error as Error).message);
			}
		}
	} else {
		// Failure notification (only for sender)
		const message = `Transfer of ${amount} ${currency} to @${toUsername} failed: ${errorMessage || 'Unknown error'}`;
		const payload = {
			walletAddress: toAddress,
			message,
			from: {
				avatarUrl: sender?.avatarUrl || '',
				userName: fromUsername,
				description: sender?.description || '',
				walletAddress: fromAddress,
			},
			amount,
			currency,
			error: errorMessage,
			chainId,
		};

		try {
			await fetch(`http://notifications-service:3000/api/web-push/send?walletAddress=${fromAddress}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic: 'transfer',
					payload: payload,
					message: message,
				}),
			});
		} catch (error) {
			console.log('Failed to send failure notification:', (error as Error).message);
		}
	}
}

export default router;
