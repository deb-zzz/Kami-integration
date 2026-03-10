import { Router, Request, Response } from 'express';
import { deployContract } from '../services/deployment';
import { getUri, setTokenURI, mint, getTotalSupply, getBalance, transferOwnership, getContractOwner } from '../services/contract';
import { DeployRequest, SetTokenURIRequest, MintRequest, TransferOwnershipRequest, ApiResponse } from '../types';
import { Address, isAddress } from 'viem';

const router: Router = Router();

// POST /deploy - Deploy new contract instance
router.post('/deploy', async (req: Request, res: Response<ApiResponse<{ address: string }>>) => {
	try {
		const { initialUri }: DeployRequest = req.body;

		if (!initialUri || typeof initialUri !== 'string') {
			return res.status(400).json({
				success: false,
				error: 'initialUri is required and must be a string',
			});
		}

		const address = await deployContract(initialUri);
		res.json({
			success: true,
			data: { address },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to deploy contract',
		});
	}
});

// GET /uri/:tokenId - Get URI for token ID
router.get('/uri/:tokenId', async (req: Request, res: Response<ApiResponse<{ uri: string }>>) => {
	try {
		let tokenId: bigint;
		try {
			tokenId = BigInt(req.params.tokenId);
		} catch {
			return res.status(400).json({
				success: false,
				error: 'Invalid token ID format',
			});
		}

		const contractAddress = req.query.contractAddress as string | undefined;

		if (tokenId < 1n || tokenId > 6n) {
			return res.status(400).json({
				success: false,
				error: 'Token ID must be between 1 and 6',
			});
		}

		const uri = await getUri(tokenId, contractAddress as `0x${string}` | undefined);
		res.json({
			success: true,
			data: { uri },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to get URI',
		});
	}
});

// POST /set-token-uri - Set token URI (owner only)
router.post('/set-token-uri', async (req: Request, res: Response<ApiResponse<{ txHash: string }>>) => {
	try {
		const { tokenId, newUri }: SetTokenURIRequest = req.body;
		const contractAddress = req.query.contractAddress as string | undefined;

		if (typeof tokenId !== 'number' || tokenId < 1 || tokenId > 6) {
			return res.status(400).json({
				success: false,
				error: 'Token ID must be between 1 and 6',
			});
		}

		if (!newUri || typeof newUri !== 'string') {
			return res.status(400).json({
				success: false,
				error: 'newUri is required and must be a string',
			});
		}

		const txHash = await setTokenURI(BigInt(tokenId), newUri, contractAddress as `0x${string}` | undefined);
		res.json({
			success: true,
			data: { txHash },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to set token URI',
		});
	}
});

// POST /mint - Mint tokens (owner only)
router.post('/mint', async (req: Request, res: Response<ApiResponse<{ txHash: string }>>) => {
	try {
		const { tokenId, amount, recipient }: MintRequest = req.body;
		const contractAddress = req.query.contractAddress as string | undefined;

		if (typeof tokenId !== 'number' || tokenId < 1 || tokenId > 6) {
			return res.status(400).json({
				success: false,
				error: 'Token ID must be between 1 and 6',
			});
		}

		if (typeof amount !== 'number' || amount <= 0) {
			return res.status(400).json({
				success: false,
				error: 'Amount must be a positive number',
			});
		}

		if (!recipient || !isAddress(recipient)) {
			return res.status(400).json({
				success: false,
				error: 'Recipient must be a valid Ethereum address',
			});
		}

		const txHash = await mint(
			BigInt(tokenId),
			BigInt(amount),
			recipient as `0x${string}`,
			contractAddress as `0x${string}` | undefined
		);
		res.json({
			success: true,
			data: { txHash },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to mint tokens',
		});
	}
});

// GET /total-supply/:tokenId - Get total supply for token ID
router.get('/total-supply/:tokenId', async (req: Request, res: Response<ApiResponse<{ totalSupply: string }>>) => {
	try {
		let tokenId: bigint;
		try {
			tokenId = BigInt(req.params.tokenId);
		} catch {
			return res.status(400).json({
				success: false,
				error: 'Invalid token ID format',
			});
		}

		const contractAddress = req.query.contractAddress as string | undefined;

		if (tokenId < 1n || tokenId > 6n) {
			return res.status(400).json({
				success: false,
				error: 'Token ID must be between 1 and 6',
			});
		}

		const totalSupply = await getTotalSupply(tokenId, contractAddress as `0x${string}` | undefined);
		res.json({
			success: true,
			data: { totalSupply: totalSupply.toString() },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to get total supply',
		});
	}
});

// GET /balance/:owner/:tokenId - Get balance for owner and token ID
router.get('/balance/:owner/:tokenId', async (req: Request, res: Response<ApiResponse<{ balance: string }>>) => {
	try {
		const owner = req.params.owner;
		let tokenId: bigint;
		try {
			tokenId = BigInt(req.params.tokenId);
		} catch {
			return res.status(400).json({
				success: false,
				error: 'Invalid token ID format',
			});
		}

		const contractAddress = req.query.contractAddress as string | undefined;

		if (!isAddress(owner)) {
			return res.status(400).json({
				success: false,
				error: 'Owner must be a valid Ethereum address',
			});
		}

		if (tokenId < 1n || tokenId > 6n) {
			return res.status(400).json({
				success: false,
				error: 'Token ID must be between 1 and 6',
			});
		}

		const balance = await getBalance(owner as `0x${string}`, tokenId, contractAddress as `0x${string}` | undefined);
		res.json({
			success: true,
			data: { balance: balance.toString() },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to get balance',
		});
	}
});

// GET /owner - Get current contract owner (uses CONTRACT_ADDRESS from environment)
router.get('/owner', async (req: Request, res: Response<ApiResponse<{ owner: string }>>) => {
	try {
		const owner = await getContractOwner();
		res.json({
			success: true,
			data: { owner },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to get contract owner',
		});
	}
});

// POST /transfer-ownership - Transfer contract ownership (owner only, uses CONTRACT_ADDRESS from environment)
router.post('/transfer-ownership', async (req: Request, res: Response<ApiResponse<{ txHash: string }>>) => {
	try {
		const { newOwner }: TransferOwnershipRequest = req.body;

		if (!newOwner || !isAddress(newOwner)) {
			return res.status(400).json({
				success: false,
				error: 'newOwner is required and must be a valid Ethereum address',
			});
		}

		const txHash = await transferOwnership(newOwner as `0x${string}`);
		res.json({
			success: true,
			data: { txHash },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || 'Failed to transfer ownership',
		});
	}
});

export default router;
