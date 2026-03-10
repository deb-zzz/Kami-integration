import { Router, Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { ApiResponse, WalletBalance, ErrorResponse } from '../types';

const router: Router = Router();

/**
 * POST /api/balances
 * Fetch ETH and USDC balances for multiple wallets across different chains
 * 
 * @route POST /api/balances
 * @param {Request} req - Express request object
 * @param {Request.body} req.body - Array of wallet objects, each containing:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34")
 *   - walletAddress: string - Ethereum wallet address (0x format, 40 hex chars)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data: Array of results, each containing:
 *     - chainId: string - The chain ID
 *     - walletAddress: string - The wallet address
 *     - balances?: WalletBalance - Balance object if successful
 *     - error?: string - Error code if failed
 *     - message?: string - Error message if failed
 *   - message: string - Success message
 * 
 * @example
 * // Request body:
 * [
 *   { chainId: "0x14a34", walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
 *   { chainId: "0x14a34", walletAddress: "0x..." }
 * ]
 * 
 * // Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "chainId": "0x14a34",
 *       "walletAddress": "0x...",
 *       "balances": {
 *         "address": "0x...",
 *         "ethBalance": "5445442084146222187",
 *         "usdcBalance": "140649632",
 *         "ethBalanceFormatted": "5.445442084146222187",
 *         "usdcBalanceFormatted": "140.649632"
 *       }
 *     }
 *   ],
 *   "message": "Wallet balances retrieved successfully"
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const wallets = req.body;

    // Validate input
    if (!Array.isArray(wallets) || wallets.length === 0) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "INVALID_REQUEST",
        message: "Request body must be a non-empty array of { chainId, walletAddress }",
      };
      return res.status(400).json(errorResponse);
    }

    // Validate each wallet
    const invalid = wallets.find(
      (w) =>
        !w.chainId ||
        !w.walletAddress ||
        typeof w.chainId !== "string" ||
        typeof w.walletAddress !== "string" ||
        !/^0x[a-fA-F0-9]{40}$/.test(w.walletAddress)
    );

    if (invalid) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "INVALID_WALLET",
        message: "Each wallet must include valid chainId and walletAddress",
      };
      return res.status(400).json(errorResponse);
    }

    // Fetch balances concurrently
    const results = await Promise.all(
      wallets.map(async ({ chainId, walletAddress }) => {
        try {
          const blockchain = await WalletService.getBlockchain(chainId);
          if (!blockchain) throw new Error("Blockchain not found");

          const USDC = blockchain.paymentTokens.find((t) => t.symbol === "USDC");
          if (!USDC) throw new Error("USDC token contract address not found");

          const walletService = new WalletService(
            chainId,
            blockchain.rpcUrl,
            USDC.contractAddress
          );

          const balances = await walletService.getWalletBalances(walletAddress);

          return {
            chainId,
            walletAddress,
            balances,
          };
        } catch (err) {
          return {
            chainId,
            walletAddress,
            error: "FETCH_ERROR",
            message: err instanceof Error ? err.message : "Failed to fetch balance",
          };
        }
      })
    );

    const response: ApiResponse<typeof results> = {
      success: true,
      data: results,
      message: "Wallet balances retrieved successfully",
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching balances:", error);

    const errorResponse: ErrorResponse = {
      success: false,
      error: "BALANCE_FETCH_ERROR",
      message: error instanceof Error ? error.message : "Failed to fetch wallet balances",
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/balances/:chainId?address=0x...
 * Get wallet balances for ETH and USDC on a specific chain
 * 
 * @route GET /api/balances/:chainId
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34" for Base Sepolia)
 * @param {Request.query} req.query - Query parameters:
 *   - address: string (required) - Ethereum wallet address (0x format, 40 hex chars)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data?: WalletBalance - Balance object containing:
 *     - address: string - The wallet address
 *     - ethBalance: string - ETH balance in Wei (raw format)
 *     - usdcBalance: string - USDC balance in smallest unit (raw format)
 *     - ethBalanceFormatted: string - ETH balance formatted as Ether
 *     - usdcBalanceFormatted: string - USDC balance formatted with decimals
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 * 
 * @example
 * // Request: GET /api/balances/0x14a34?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
 *     "ethBalance": "5445442084146222187",
 *     "usdcBalance": "140649632",
 *     "ethBalanceFormatted": "5.445442084146222187",
 *     "usdcBalanceFormatted": "140.649632"
 *   },
 *   "message": "Wallet balances retrieved successfully"
 * }
 */
router.get('/:chainId', async (req: Request, res: Response) => {
	try {
		const { chainId } = req.params;
		const { address } = req.query;

		// Validate address parameter
		if (!address || typeof address !== 'string') {
			const errorResponse: ErrorResponse = {
				success: false,
				error: 'MISSING_ADDRESS',
				message: 'address parameter is required',
			};
			return res.status(400).json(errorResponse);
		}

		// Validate address format
		if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
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
		const balances = await walletService.getWalletBalances(address);

		const response: ApiResponse<WalletBalance> = {
			success: true,
			data: balances,
			message: 'Wallet balances retrieved successfully',
		};

		res.json(response);
	} catch (error) {
		console.error('Error getting wallet balances:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'BALANCE_FETCH_ERROR',
			message: error instanceof Error ? error.message : 'Failed to fetch wallet balances',
		};

		res.status(500).json(errorResponse);
	}
});

/**
 * GET /api/balances/:chainId/usdc-info
 * Get USDC token contract information for a specific chain
 * 
 * @route GET /api/balances/:chainId/usdc-info
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34" for Base Sepolia)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data?: object - USDC contract info containing:
 *     - symbol: string - Token symbol (e.g., "USDC")
 *     - decimals: string - Number of decimals (e.g., "6")
 *     - contractAddress: string - USDC contract address on the chain
 *     - name: string - Token name (e.g., "USDC" or "USD Coin")
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 * 
 * @example
 * // Request: GET /api/balances/0x14a34/usdc-info
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "symbol": "USDC",
 *     "decimals": "6",
 *     "contractAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
 *     "name": "USDC"
 *   },
 *   "message": "USDC contract info retrieved successfully"
 * }
 */
router.get('/:chainId/usdc-info', async (req: Request, res: Response) => {
	try {
		const { chainId } = req.params;

		// For Base Sepolia, use hardcoded values if blockchain data not available
		let rpcUrl = process.env.RPC_URL;
		let usdcContractAddress = process.env.USDC_CONTRACT_ADDRESS;

		// Try to get from database first
		try {
			const blockchain = await WalletService.getBlockchain(chainId);
			if (blockchain) {
				rpcUrl = blockchain.rpcUrl;
				const USDC = blockchain.paymentTokens.find((token) => token.symbol === 'USDC');
				if (USDC) {
					usdcContractAddress = USDC.contractAddress;
				}
			}
		} catch (dbError) {
			// Fall back to environment variables
			console.log('Using environment variables for USDC info');
		}

		if (!rpcUrl || !usdcContractAddress) {
			throw new Error('RPC URL or USDC contract address not configured');
		}

		const walletService = new WalletService(chainId, rpcUrl, usdcContractAddress);
		const usdcInfo = await walletService.getUSDCInfo();

		const response: ApiResponse<typeof usdcInfo> = {
			success: true,
			data: usdcInfo,
			message: 'USDC contract info retrieved successfully',
		};

		res.json(response);
	} catch (error) {
		console.error('Error getting USDC info:', error);

		const errorResponse: ErrorResponse = {
			success: false,
			error: 'USDC_INFO_ERROR',
			message: error instanceof Error ? error.message : 'Failed to fetch USDC contract info',
		};

		res.status(500).json(errorResponse);
	}
});

export default router;
