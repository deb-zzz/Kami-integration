import { Router, Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { ApiResponse, WalletBalance, ErrorResponse } from '../types';

const router: Router = Router();

export type PaymentToken = {
	id: number;
	chainId: string;
	contractAddress: string;
	name: string;
	symbol: string;
	decimals: number;
	logoUrl: string | null;
};

export type Blockchain = {
	chainId: string;
	name: string;
	logoUrl: string | null;
	rpcUrl: string;
	paymentTokens: PaymentToken[];
};

/**
 * GET /api/blockchain/:chainId
 * Get blockchain information for a specific chain ID
 * 
 * @route GET /api/blockchain/:chainId
 * @param {Request} req - Express request object
 * @param {Request.params} req.params - Route parameters:
 *   - chainId: string - Blockchain chain ID (e.g., "0x14a34" for Base Sepolia)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data?: Blockchain - Blockchain object containing:
 *     - chainId: string - The blockchain chain ID
 *     - name: string - Blockchain name (e.g., "Base Sepolia")
 *     - logoUrl: string | null - URL to blockchain logo
 *     - rpcUrl: string - RPC endpoint URL
 *     - paymentTokens: PaymentToken[] - Array of supported payment tokens
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 * 
 * @example
 * // Request: GET /api/blockchain/0x14a34
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "chainId": "0x14a34",
 *     "name": "Base Sepolia",
 *     "rpcUrl": "https://sepolia.base.org",
 *     "paymentTokens": [
 *       {
 *         "id": 1,
 *         "chainId": "0x14a34",
 *         "contractAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
 *         "name": "Circle USD",
 *         "symbol": "USDC",
 *         "decimals": 6
 *       }
 *     ]
 *   },
 *   "message": "Blockchain information retrieved successfully"
 * }
 */
router.get('/:chainId', async (req: Request, res: Response) => {
	const { chainId } = req.params;
	try {
		const blockchain = await WalletService.getBlockchain(chainId);
		if (!blockchain) throw new Error('Blockchain not found');
		const response: ApiResponse<Blockchain> = {
			success: true,
			data: blockchain,
			message: 'Blockchain information retrieved successfully',
		};
		res.json(response);
	} catch (error) {
		console.error('Error getting blockchain information:', error);
		const errorResponse: ErrorResponse = {
			success: false,
			error: 'BLOCKCHAIN_INFO_ERROR',
			message: error instanceof Error ? error.message : 'Failed to get blockchain information',
		};
		res.status(500).json(errorResponse);
	}
});

/**
 * GET /api/blockchain
 * Get all blockchain configurations with their payment tokens
 * 
 * @route GET /api/blockchain
 * @param {Request} _req - Express request object (unused)
 * @param {Response} res - Express response object
 * 
 * @returns {Response} JSON response with:
 *   - success: boolean - Whether the request was successful
 *   - data?: Blockchain[] - Array of blockchain objects, each containing:
 *     - chainId: string - The blockchain chain ID
 *     - name: string - Blockchain name
 *     - logoUrl: string | null - URL to blockchain logo
 *     - rpcUrl: string - RPC endpoint URL
 *     - paymentTokens: PaymentToken[] - Array of supported payment tokens
 *   - error?: string - Error code if failed
 *   - message: string - Success or error message
 * 
 * @example
 * // Request: GET /api/blockchain
 * // Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "chainId": "0x14a34",
 *       "name": "Base Sepolia",
 *       "rpcUrl": "https://sepolia.base.org",
 *       "paymentTokens": [...]
 *     }
 *   ],
 *   "message": "All blockchain information retrieved successfully"
 * }
 */
router.get('/', async (_req: Request, res: Response) => {
	try {
		const blockchains = await WalletService.getBlockchainList();

		const response: ApiResponse<Blockchain[]> = {
			success: true,
			data: blockchains ?? [],
			message: 'All blockchain information retrieved successfully',
		};

		res.json(response);
	} catch (error) {
		console.error('Error getting all blockchains:', error);
		const errorResponse: ErrorResponse = {
			success: false,
			error: 'BLOCKCHAIN_LIST_ERROR',
			message:
				error instanceof Error ? error.message : 'Failed to get blockchain list',
		};
		res.status(500).json(errorResponse);
	}
});


export default router;
