import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { getWalletBalance, formatBalance } from '../services/balanceService.js';
import { normalizeChainId } from '../utils/chainId.js';
import { fundingWallet, FundingWalletType } from '@prisma/client';

interface CreateFundingWalletDto {
	type: FundingWalletType;
	chainId: string;
	walletAddress: string;
	name: string;
	description?: string;
	isActive?: boolean;
}

interface UpdateFundingWalletDto {
	type?: FundingWalletType;
	chainId?: string;
	walletAddress?: string;
	name?: string;
	description?: string;
	isActive?: boolean;
}

/**
 * Get all funding wallets with optional filters
 */
export async function getAllFundingWallets(req: Request, res: Response): Promise<void> {
	try {
		const { chainId, type, isActive = 'true' } = req.query;

		const where: any = {};
		if (chainId) {
			// Normalize chainId to hex format for query
			const normalizedChainId = normalizeChainId(chainId as string);
			if (!normalizedChainId) {
				res.status(400).json({ error: 'Invalid chainId format. Must be a hex string (e.g., 0x1) or decimal number' });
				return;
			}
			where.chainId = normalizedChainId;
		}
		if (type) where.type = type as FundingWalletType;
		if (isActive !== undefined) where.isActive = isActive === 'true';

		const wallets = await prisma.fundingWallet.findMany({
			where,
			orderBy: { createdAt: 'desc' },
		});

		// Fetch balances for all wallets
		const walletsWithBalances = await Promise.all(
			wallets.map(async (wallet: fundingWallet) => {
				const { balance, error } = await getWalletBalance(wallet.walletAddress, wallet.chainId);

				return {
					...wallet,
					balance: balance !== null ? balance.toString() : null,
					balanceFormatted: balance !== null ? formatBalance(balance) : null,
					balanceError: error,
				};
			})
		);

		res.json(walletsWithBalances);
	} catch (error) {
		console.error('Error fetching funding wallets:', error);
		res.status(500).json({
			error: 'Failed to fetch funding wallets',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Get a single funding wallet by ID
 */
export async function getFundingWalletById(req: Request, res: Response): Promise<void> {
	try {
		const id = parseInt(req.params.id, 10);

		if (isNaN(id)) {
			res.status(400).json({ error: 'Invalid wallet ID' });
			return;
		}

		const wallet = await prisma.fundingWallet.findUnique({
			where: { id, isActive: true },
		});

		if (!wallet) {
			res.status(404).json({ error: 'Funding wallet not found' });
			return;
		}

		// Fetch balance
		const { balance, error } = await getWalletBalance(wallet.walletAddress, wallet.chainId);

		res.json({
			...wallet,
			balance: balance !== null ? balance.toString() : null,
			balanceFormatted: balance !== null ? formatBalance(balance) : null,
			balanceError: error,
		});
	} catch (error) {
		console.error('Error fetching funding wallet:', error);
		res.status(500).json({
			error: 'Failed to fetch funding wallet',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Create a new funding wallet
 */
export async function createFundingWallet(req: Request, res: Response): Promise<void> {
	try {
		const data: CreateFundingWalletDto = req.body;

		// Validate required fields
		if (!data.type || !data.chainId || !data.walletAddress || !data.name) {
			res.status(400).json({
				error: 'Missing required fields: type, chainId, walletAddress, name',
			});
			return;
		}

		// Validate and normalize chainId to hex format
		const normalizedChainId = normalizeChainId(data.chainId);
		if (!normalizedChainId) {
			res.status(400).json({
				error: 'Invalid chainId format. Must be a hex string (e.g., 0x1) or decimal number',
			});
			return;
		}

		// Validate wallet address format
		if (!/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) {
			res.status(400).json({ error: 'Invalid wallet address format' });
			return;
		}

		// Validate FundingWalletType enum
		const validTypes = Object.values(FundingWalletType);
		if (!validTypes.includes(data.type)) {
			res.status(400).json({
				error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
			});
			return;
		}

		// Check if blockchain exists
		const blockchain = await prisma.blockchain.findUnique({
			where: { chainId: normalizedChainId },
		});

		if (!blockchain) {
			res.status(400).json({ error: `Blockchain with chainId ${normalizedChainId} not found` });
			return;
		}

		// Create wallet
		const wallet = await prisma.fundingWallet.create({
			data: {
				type: data.type,
				chainId: normalizedChainId,
				walletAddress: data.walletAddress,
				name: data.name,
				description: data.description,
				isActive: data.isActive ?? true,
			},
		});

		res.status(201).json(wallet);
	} catch (error: any) {
		console.error('Error creating funding wallet:', error);

		// Handle Prisma unique constraint violations
		if (error.code === 'P2002') {
			const field = error.meta?.target?.[0] || 'field';
			res.status(409).json({
				error: `A funding wallet with this ${field} already exists`,
			});
			return;
		}

		res.status(500).json({
			error: 'Failed to create funding wallet',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Update a funding wallet (full update)
 */
export async function updateFundingWallet(req: Request, res: Response): Promise<void> {
	try {
		const id = parseInt(req.params.id, 10);

		if (isNaN(id)) {
			res.status(400).json({ error: 'Invalid wallet ID' });
			return;
		}

		const data: UpdateFundingWalletDto = req.body;

		// Validate and normalize chainId to hex format if provided
		let normalizedChainId: string | undefined;
		if (data.chainId) {
			const normalized = normalizeChainId(data.chainId);
			if (!normalized) {
				res.status(400).json({
					error: 'Invalid chainId format. Must be a hex string (e.g., 0x1) or decimal number',
				});
				return;
			}
			normalizedChainId = normalized;
		}

		// Validate wallet address format if provided
		if (data.walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) {
			res.status(400).json({ error: 'Invalid wallet address format' });
			return;
		}

		// Validate FundingWalletType enum if provided
		if (data.type) {
			const validTypes = Object.values(FundingWalletType);
			if (!validTypes.includes(data.type)) {
				res.status(400).json({
					error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
				});
				return;
			}
		}

		// Check if blockchain exists if chainId is being updated
		if (normalizedChainId) {
			const blockchain = await prisma.blockchain.findUnique({
				where: { chainId: normalizedChainId },
			});

			if (!blockchain) {
				res.status(400).json({ error: `Blockchain with chainId ${normalizedChainId} not found` });
				return;
			}
		}

		// Check if wallet exists
		const existingWallet = await prisma.fundingWallet.findUnique({
			where: { id },
		});

		if (!existingWallet) {
			res.status(404).json({ error: 'Funding wallet not found' });
			return;
		}

		// Update wallet
		const updateData: any = { ...data };
		if (normalizedChainId) {
			updateData.chainId = normalizedChainId;
		}
		updateData.updatedAt = Math.floor(Date.now() / 1000);

		const wallet = await prisma.fundingWallet.update({
			where: { id },
			data: updateData,
		});

		res.json(wallet);
	} catch (error: any) {
		console.error('Error updating funding wallet:', error);

		// Handle Prisma unique constraint violations
		if (error.code === 'P2002') {
			const field = error.meta?.target?.[0] || 'field';
			res.status(409).json({
				error: `A funding wallet with this ${field} already exists`,
			});
			return;
		}

		res.status(500).json({
			error: 'Failed to update funding wallet',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Partially update a funding wallet
 */
export async function patchFundingWallet(req: Request, res: Response): Promise<void> {
	try {
		const id = parseInt(req.params.id, 10);

		if (isNaN(id)) {
			res.status(400).json({ error: 'Invalid wallet ID' });
			return;
		}

		const data: UpdateFundingWalletDto = req.body;

		// Validate and normalize chainId to hex format if provided
		let normalizedChainId: string | undefined;
		if (data.chainId) {
			const normalized = normalizeChainId(data.chainId);
			if (!normalized) {
				res.status(400).json({
					error: 'Invalid chainId format. Must be a hex string (e.g., 0x1) or decimal number',
				});
				return;
			}
			normalizedChainId = normalized;
		}

		// Validate wallet address format if provided
		if (data.walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) {
			res.status(400).json({ error: 'Invalid wallet address format' });
			return;
		}

		// Validate FundingWalletType enum if provided
		if (data.type) {
			const validTypes = Object.values(FundingWalletType);
			if (!validTypes.includes(data.type)) {
				res.status(400).json({
					error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
				});
				return;
			}
		}

		// Check if blockchain exists if chainId is being updated
		if (normalizedChainId) {
			const blockchain = await prisma.blockchain.findUnique({
				where: { chainId: normalizedChainId },
			});

			if (!blockchain) {
				res.status(400).json({ error: `Blockchain with chainId ${normalizedChainId} not found` });
				return;
			}
		}

		// Check if wallet exists
		const existingWallet = await prisma.fundingWallet.findUnique({
			where: { id },
		});

		if (!existingWallet) {
			res.status(404).json({ error: 'Funding wallet not found' });
			return;
		}

		// Update wallet
		const updateData: any = { ...data };
		if (normalizedChainId) {
			updateData.chainId = normalizedChainId;
		}
		updateData.updatedAt = Math.floor(Date.now() / 1000);

		const wallet = await prisma.fundingWallet.update({
			where: { id },
			data: updateData,
		});

		res.json(wallet);
	} catch (error: any) {
		console.error('Error patching funding wallet:', error);

		// Handle Prisma unique constraint violations
		if (error.code === 'P2002') {
			const field = error.meta?.target?.[0] || 'field';
			res.status(409).json({
				error: `A funding wallet with this ${field} already exists`,
			});
			return;
		}

		res.status(500).json({
			error: 'Failed to update funding wallet',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Delete a funding wallet (soft delete by setting isActive=false)
 */
export async function deleteFundingWallet(req: Request, res: Response): Promise<void> {
	try {
		const id = parseInt(req.params.id, 10);

		if (isNaN(id)) {
			res.status(400).json({ error: 'Invalid wallet ID' });
			return;
		}

		// Check if wallet exists
		const existingWallet = await prisma.fundingWallet.findUnique({
			where: { id },
		});

		if (!existingWallet) {
			res.status(404).json({ error: 'Funding wallet not found' });
			return;
		}

		let wallet: fundingWallet | null = null;
		if (existingWallet.isActive === true) {
			// Soft delete if wallet is active
			wallet = await prisma.fundingWallet.update({
				where: { id },
				data: { isActive: false },
			});
		} else {
			// Hard delete if wallet is not active
			wallet = await prisma.fundingWallet.delete({
				where: { id },
			});
		}

		res.json(wallet);
	} catch (error) {
		console.error('Error deleting funding wallet:', error);
		res.status(500).json({
			error: 'Failed to delete funding wallet',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}
