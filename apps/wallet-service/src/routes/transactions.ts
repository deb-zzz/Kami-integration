import { Router, Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { ApiResponse, ErrorResponse, TransactionDetails, ListingPaginationQueryParams, TransactionSummary } from '../types';
import { serializePrisma } from '../utils/common';
import { Web3TransactionType } from '@prisma/client';
import { TokenData } from '../services/WalletService';

const router: Router = Router();

/**
 * GET /api/transactions
 * Get all transactions with pagination, filters, and sorting
 * 
 * @route GET /api/transactions
 * @param {Request} req - Express request object
 * @param {Request.query} req.query - Query parameters:
 *   - page?: string - Page number (default: "1")
 *   - perPage?: string - Items per page (default: "10")
 *   - sort?: string - Sort field and order, format: "field,order" (default: "timestamp,desc")
 *   - hash?: string - Filter by transaction hash
 *   - chainId?: string - Filter by chain ID
 *   - addressFrom?: string - Filter by sender address
 *   - addressTo?: string - Filter by recipient address
 *   - blockHash?: string - Filter by block hash
 *   - type?: string - Filter by transaction type (Transfer, Mint721C, etc.)
 *   - checkoutId?: string - Filter by checkout ID
 *   - blockNumber?: string - Filter by block number
 *   - transactionIndex?: string - Filter by transaction index
 *   - nonce?: string - Filter by nonce
 *   - status?: string - Filter by transaction status
 *   - timestampFrom?: string - Filter by start timestamp (ISO format)
 *   - timestampTo?: string - Filter by end timestamp (ISO format)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - data: Array of transaction objects
 *   - meta: Metadata object containing:
 *     - pagination: Pagination info (page, perPage, total, totalPages)
 *     - filters: Applied filters
 *     - sort: Sort configuration
 * 
 * @example
 * // Request: GET /api/transactions?page=1&perPage=20&chainId=0x14a34&type=Transfer
 * // Response:
 * {
 *   "data": [...],
 *   "meta": {
 *     "pagination": { "page": 1, "perPage": 20, "total": 100, "totalPages": 5 },
 *     "filters": { "chainId": "0x14a34", "type": "Transfer" },
 *     "sort": { "by": "timestamp", "order": "desc" }
 *   }
 * }
 */
router.get('/', async (req: Request, res: Response) => {
	// Pagination
	const page = parseInt((req.query.page as string) || '1', 10);
	const perPage = parseInt((req.query.perPage as string) || '10', 10);

	// Sorting
	const sortParam = (req.query.sort as string) || 'timestamp,desc';
	const [sortBy, orderRaw] = sortParam.split(',');
	const order = (orderRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

	// Filtering
	const hash = (req.query.hash as string) || undefined;
	const chainId = (req.query.chainId as string) || undefined;
	const addressFrom = (req.query.addressFrom as string) || undefined;
	const addressTo = (req.query.addressTo as string) || undefined;
	const blockHash = (req.query.blockHash as string) || undefined;
	const typeParam = (req.query.type as string) || undefined;
	const checkoutId = (req.query.checkoutId as string) || undefined;
	const blockNumber = (req.query.blockNumber as string) || undefined;
	const transactionIndex = (req.query.transactionIndex as string) || undefined;
	const nonce = (req.query.nonce as string) || undefined;
	const status = (req.query.status as string) || undefined;
	const timestampFrom = (req.query.timestampFrom as string) || undefined;
	const timestampTo = (req.query.timestampTo as string) || undefined;

	let type: Web3TransactionType | undefined = undefined;
	if (typeParam) {
		if (!(typeParam in Web3TransactionType)) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_TYPE',
				message: `Invalid transaction type. Must be one of: ${Object.values(Web3TransactionType).join(', ')}`,
			};
			res.status(400).json(errorResponse);
		}
		type = typeParam as Web3TransactionType;
	}

	const queryParams: ListingPaginationQueryParams = {
		page,
		perPage,
		sortBy,
		order,
		filters: {
			hash,
			chainId,
			addressFrom,
			addressTo,
			blockNumber,
			blockHash,
			transactionIndex,
			nonce,
			type,
			status,
			checkoutId,
			timestampFrom,
			timestampTo,
		},
	};

	try {
		const { transactions, total } = await WalletService.getAllWalletTransactions(queryParams);
		const response = {
			data: serializePrisma(transactions),
			meta: {
				pagination: {
					page,
					perPage,
					total,
					totalPages: Math.ceil(total / perPage),
				},
				filters: {
					chainId,
					addressFrom,
					addressTo,
					blockNumber,
					transactionIndex,
					nonce,
					type,
					status,
					timestampFrom,
					timestampTo,
				},
				sort: {
					by: sortBy,
					order,
				},
			},
		};
		res.json(response);
	} catch (error) {
		console.error('Error getting transactions:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'TRANSACTIONS_ERROR',
			message: error instanceof Error ? error.message : 'Failed to get transactions',
		};

		res.status(500).json(errorResponse);
	}
});

/**
 * GET /api/transactions/:chainId/transaction/:txHash
 * Get detailed transaction information by hash with token transfer data
 * 
 * @route GET /api/transactions/:chainId/transaction/:txHash
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34")
 *   - txHash: string - Transaction hash (0x format, 64 hex characters)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data?: TransactionDetails - Transaction details with token data:
 *     - All standard transaction fields (hash, from, to, value, gas, etc.)
 *     - tokenData?: TokenData[] - Array of parsed token transfer data (ERC20/ERC721/ERC1155)
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 * 
 * @example
 * // Request: GET /api/transactions/0x14a34/transaction/0x...
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "hash": "0x...",
 *     "from": "0x...",
 *     "to": "0x...",
 *     "value": "0",
 *     "tokenData": [
 *       {
 *         "contractAddress": "0x...",
 *         "tokenType": "ERC20",
 *         "tokenSymbol": "USDC",
 *         "tokenAmountFormatted": "100.0"
 *       }
 *     ]
 *   },
 *   "message": "Transaction details retrieved successfully"
 * }
 */
router.get('/:chainId/transaction/:txHash', async (req: Request, res: Response) => {
	try {
		const { chainId, txHash } = req.params;

		// Validate transaction hash format
		if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_TX_HASH',
				message: 'Invalid transaction hash format',
			};
			return res.status(400).json(errorResponse);
		}

		const blockchain = await WalletService.getBlockchain(chainId);
		if (!blockchain) throw new Error('Blockchain not found');
		const USDC = blockchain.paymentTokens.find((token) => token.symbol === 'USDC');
		if (!USDC) throw new Error('USDC token contract address not found');
		const walletService = new WalletService(chainId, blockchain.rpcUrl, USDC.contractAddress);
		const transactionDetails = await walletService.getTransactionDetails(txHash);
		const tokenData = await walletService.parseReceipt(txHash);
		const sanitizedTokenData: TokenData[] = tokenData.map((token) => ({
			...token,
			tokenDecimals: Number(token.tokenDecimals),
		}));

		const response: ApiResponse<TransactionDetails> = {
			success: true,
			data: {
				...transactionDetails,
				tokenData: sanitizedTokenData as TokenData[],
			},
			message: 'Transaction details retrieved successfully',
		};

		res.json(response);
	} catch (error) {
		console.error('Error getting transaction details:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'TRANSACTION_DETAILS_ERROR',
			message: error instanceof Error ? error.message : 'Failed to get transaction details',
		};

		res.status(500).json(errorResponse);
	}
});

/**
 * GET /api/transactions/:chainId?walletAddress=0x...
 * Get all transactions for a wallet address with optional filtering
 * 
 * Supports three modes:
 * 1. Get all transactions: ?walletAddress=0x...
 * 2. Get filtered transactions (checkout or transfers only): ?walletAddress=0x...&filtered=true
 * 3. Get recent transfer recipients (max 5): ?walletAddress=0x...&type=Transfer
 * 
 * @route GET /api/transactions/:chainId
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34")
 * @param {Request.query} req.query - Query parameters:
 *   - walletAddress: string (required) - Wallet address to get transactions for (0x format)
 *   - filtered?: string - If "true", only returns transactions with checkoutId or Transfer type
 *   - type?: string - If "Transfer", returns only Transfer type transactions (limited to 5 unique recipients)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data?: TransactionDetails[] - Array of transaction objects with:
 *     - All standard transaction fields
 *     - tokenData: TokenData[] - Parsed token transfer data
 *     - type: string - Transaction type (may be transformed: Purchase, Sent, Receive)
 *     - total_amount?: number - Total amount for checkout transactions
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 * 
 * @example
 * // Get all transactions
 * // Request: GET /api/transactions/0x14a34?walletAddress=0x...
 * 
 * // Get filtered transactions
 * // Request: GET /api/transactions/0x14a34?walletAddress=0x...&filtered=true
 * 
 * // Get recent transfer recipients
 * // Request: GET /api/transactions/0x14a34?walletAddress=0x...&type=Transfer
 */
router.get('/:chainId', async (req: Request, res: Response) => {
	try {
		const { chainId } = req.params;
		const { walletAddress, filtered, type } = req.query;
		const isFiltered = filtered === "true";
		const isTransfer = type === "Transfer";

		// Validate wallet address parameter
		if (!walletAddress || typeof walletAddress !== 'string') {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'MISSING_WALLET_ADDRESS',
				message: 'walletAddress parameter is required',
			};
			return res.status(400).json(errorResponse);
		}

		// Validate address format
		if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_ADDRESS',
				message: 'Invalid wallet address format',
			};
			return res.status(400).json(errorResponse);
		}

		const blockchain = await WalletService.getBlockchain(chainId);
		if (!blockchain) throw new Error('Blockchain not found');

		const USDC = blockchain.paymentTokens.find((token) => token.symbol === 'USDC');
		if (!USDC) throw new Error('USDC token contract address not found');
		const walletService = new WalletService(chainId, blockchain.rpcUrl, USDC.contractAddress);
		let transactions = await walletService.getWalletTransactions(walletAddress, chainId, isFiltered, isTransfer);

		const formattedTransactions = await Promise.all(
			transactions
				.map(async (tx) => {
					const updatedTx: any = { ...tx };
					const isSender = tx.from === walletAddress;
					if (isFiltered) {
						const isMintType = ["Mint721C", "Mint721AC", "Mint1155C"].includes(tx.type);
						const isTransferType = ["Transfer"].includes(tx.type);

						if (tx.checkoutId) {
							// Update amount for Mint/Sell
							const checkoutAmount = await walletService.getCheckoutAmount(tx.checkoutId);
							updatedTx.total_amount = Number(checkoutAmount);
						}

						if (isMintType && isSender) {
							// Update tx type from Mint to Purchase
							updatedTx.type = "Purchase";
						}

						if (isTransferType) {
							// Update amount and type for Payment Token Transfer
							const erc20Token = updatedTx.tokenData.find((token: any) => token.tokenType === "ERC20");
							updatedTx.total_amount = erc20Token?.tokenAmountFormatted;
							if (isSender) {
								updatedTx.type = "Sent";
							} else {
								updatedTx.type = "Receive";
							}
						}
					}

					return {
						...updatedTx,
						gasUsed: updatedTx.gasUsed || undefined,
						blockHash: updatedTx.blockHash || undefined,
						blockNumber: updatedTx.blockNumber || undefined,
						transactionIndex: updatedTx.transactionIndex || undefined,
						status: updatedTx.status || undefined,
					};
				})
		);

		const response: ApiResponse<TransactionDetails[]> = {
			success: true,
			data: formattedTransactions,
			message: 'Wallet transactions retrieved successfully',
		};

		res.json(response);
	} catch (error) {
		console.error('Error getting wallet transactions:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'TRANSACTIONS_ERROR',
			message: error instanceof Error ? error.message : 'Failed to get wallet transactions',
		};

		res.status(500).json(errorResponse);
	}
});

/**
 * GET /api/transactions/:chainId/transaction/:txHash/summary
 * Get detailed transaction summary with checkout order information
 * 
 * @route GET /api/transactions/:chainId/transaction/:txHash/summary
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34")
 *   - txHash: string - Transaction hash (0x format, 64 hex characters)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data?: TransactionSummary - Transaction summary object:
 *     - transaction: TransactionDetails - Complete transaction details with token data
 *     - checkout: object | null - Checkout object with related orders, order items, and products (if linked)
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 * 
 * @example
 * // Request: GET /api/transactions/0x14a34/transaction/0x.../summary
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "transaction": {
 *       "hash": "0x...",
 *       "from": "0x...",
 *       "to": "0x...",
 *       "tokenData": [...]
 *     },
 *     "checkout": {
 *       "id": "checkout-123",
 *       "totalAmount": "100.0",
 *       "orders": [...]
 *     }
 *   },
 *   "message": "Transaction summary retrieved successfully"
 * }
 */
router.get('/:chainId/transaction/:txHash/summary', async (req: Request, res: Response) => {
	try {
		const { chainId, txHash } = req.params;

		// Validate transaction hash format
		if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'INVALID_TX_HASH',
				message: 'Invalid transaction hash format',
			};
			return res.status(400).json(errorResponse);
		}

		// Get blockchain & transaction details
		const blockchain = await WalletService.getBlockchain(chainId);
		if (!blockchain) throw new Error('Blockchain not found');
		const USDC = blockchain.paymentTokens.find((token) => token.symbol === 'USDC');
		if (!USDC) throw new Error('USDC token contract address not found');
		const walletService = new WalletService(chainId, blockchain.rpcUrl, USDC.contractAddress);
		const transactionDetails = await walletService.getWalletTransaction(txHash);

		// Parse blockchain token transfer data (based on receipt logs)
		const tokenData = await walletService.parseReceipt(txHash);

		// Sanitize token data (remove BigInt, convert decimals)
		const sanitizedTokenData = tokenData.map((token) => ({
			...token,
			tokenDecimals: Number(token.tokenDecimals),
		}));

		// Merge tokenData into transaction details
		const transactionWithTokenData = {
			...transactionDetails,
			tokenData: sanitizedTokenData,
		};

		// Get orders linked to this transaction by paymentId
		const checkoutRaw = await walletService.getCheckoutOrders(txHash);
		const checkout = serializePrisma(checkoutRaw);

		const response: ApiResponse<TransactionSummary> = {
			success: true,
			data: {
				transaction: transactionWithTokenData,
				checkout: checkout,
			},
			message: 'Transaction summary retrieved successfully',
		};

		res.json(response);
	} catch (error) {
		console.error('Error getting transaction summary:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'TRANSACTION_SUMMARY_ERROR',
			message: error instanceof Error ? error.message : 'Failed to get transaction summary',
		};

		res.status(500).json(errorResponse);
	}
});

export default router;
