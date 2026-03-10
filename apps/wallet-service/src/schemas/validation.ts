import { z } from 'zod';

// Wallet address validation schema
export const walletAddressSchema = z.string().refine((address) => /^0x[a-fA-F0-9]{40}$/.test(address), {
	message: 'Invalid wallet address format. Must be a valid Ethereum address starting with 0x and 40 hex characters.',
});

// Balance query validation schema
export const querySchema = z.object({
	address: walletAddressSchema,
	chainId: z.string().min(1, 'Chain ID is required'),
});

export const chainIdSchema = z.object({
	chainId: z.string().min(1, 'Chain ID is required'),
});

// USDC transfer request validation schema
export const usdcTransferSchema = z.object({
	fromAddress: walletAddressSchema,
	chainId: z.string().min(1, 'Chain ID is required'),
	toAddress: walletAddressSchema,
	amount: z
		.string()
		.min(1, 'Amount is required')
		.refine(
			(val) => {
				const num = parseFloat(val);
				return !isNaN(num) && num > 0;
			},
			{
				message: 'Amount must be a positive number',
			}
		),
});

// Gas estimation request validation schema
export const gasEstimationSchema = z.object({
	fromAddress: walletAddressSchema,
	toAddress: walletAddressSchema,
	amount: z
		.string()
		.min(1, 'Amount is required')
		.refine(
			(val) => {
				const num = parseFloat(val);
				return !isNaN(num) && num > 0;
			},
			{
				message: 'Amount must be a positive number',
			}
		),
});

// Type exports for use in route handlers
export type BalanceQuery = z.infer<typeof querySchema>;
export type UsdcTransferRequest = z.infer<typeof usdcTransferSchema>;
export type GasEstimationRequest = z.infer<typeof gasEstimationSchema>;
