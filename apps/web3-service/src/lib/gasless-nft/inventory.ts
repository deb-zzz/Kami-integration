import { prisma } from '@/lib/db';
import type { ContractQuantityValidationResult } from './types';
import { kamiMaxQuantity, kamiTotalMinted } from './contract-reads';

/**
 * Update product quantities in the database
 * @internal
 */
export async function updateProductQuantities(productId: number, availableQuantity: number, maxQuantity: number): Promise<void> {
	await prisma.product.update({
		where: { id: productId },
		data: { availableQuantity, maxQuantity },
	});
}

/**
 * Update voucher quantities in the database
 * @internal
 */
export async function updateVoucherQuantities(voucherId: number, maxQuantity: number): Promise<void> {
	await prisma.voucher.update({
		where: { id: voucherId },
		data: { maxQuantity },
	});
}

/**
 * Validate and correct contract quantity state against database values.
 * If mismatches are detected, automatically corrects database values to match contract state.
 */
export async function validateAndCorrectContractQuantityState(
	chainId: `0x${string}`,
	contractAddress: string,
	productId: number,
	collectionId: number,
	voucherId?: number,
): Promise<ContractQuantityValidationResult> {
	const result: ContractQuantityValidationResult = {
		isValid: true,
		wasCorrected: false,
		contractTotalSupply: 0,
		contractMaxQuantity: 0,
		contractTotalMinted: 0,
		contractAvailableQuantity: 0,
		productAvailableQuantityBefore: 0,
		productAvailableQuantityAfter: 0,
		productMaxQuantityBefore: null,
		productMaxQuantityAfter: null,
		voucherMaxQuantityBefore: null,
		voucherMaxQuantityAfter: null,
		difference: 0,
	};

	try {
		const contractMaxQuantity = await kamiMaxQuantity(chainId, contractAddress);
		const contractTotalMinted = await kamiTotalMinted(chainId, contractAddress);
		const contractAvailableQuantity = contractMaxQuantity > 0 ? contractMaxQuantity - contractTotalMinted : 0;

		result.contractMaxQuantity = contractMaxQuantity;
		result.contractTotalMinted = contractTotalMinted;
		result.contractAvailableQuantity = contractAvailableQuantity;

		if (contractMaxQuantity === 0) {
			result.isValid = true;
			return result;
		}

		const product = await prisma.product.findUnique({
			where: { id: productId },
		});

		if (!product) {
			console.warn(`Product not found: ${productId}. Skipping validation.`);
			return result;
		}

		result.productAvailableQuantityBefore = product.availableQuantity;
		result.productMaxQuantityBefore = (product as any).maxQuantity ?? null;

		let voucher = null;
		if (voucherId) {
			voucher = await prisma.voucher.findUnique({
				where: { id: voucherId },
			});
			if (voucher) {
				result.voucherMaxQuantityBefore = (voucher as any).maxQuantity ?? null;
			}
		}

		await updateProductQuantities(productId, contractAvailableQuantity, contractMaxQuantity ?? 0);
		if (voucherId) await updateVoucherQuantities(voucherId, contractMaxQuantity ?? 0);

		const maxQuantityMismatch = result.productMaxQuantityBefore !== contractMaxQuantity;
		const availableQuantityMismatch = product.availableQuantity !== contractAvailableQuantity;

		if (maxQuantityMismatch || availableQuantityMismatch) {
			result.isValid = false;
			result.difference = Math.abs(product.availableQuantity - contractAvailableQuantity);

			try {
				result.productAvailableQuantityAfter = contractAvailableQuantity;
				result.productMaxQuantityAfter = contractMaxQuantity;
				result.wasCorrected = true;

				if (voucher && maxQuantityMismatch) {
					result.voucherMaxQuantityAfter = contractMaxQuantity;
				}

				console.warn('\n' + '='.repeat(80));
				console.warn('⚠️  QUANTITY MISMATCH DETECTED AND CORRECTED ⚠️');
				console.warn('='.repeat(80));
				console.warn(`Contract Address: ${contractAddress}`);
				console.warn(`Collection ID: ${collectionId}`);
				console.warn(`Product ID: ${productId}`);
				if (voucherId) {
					console.warn(`Voucher ID: ${voucherId}`);
				}
				console.warn('');
				console.warn('Smart Contract Values (Source of Truth):');
				console.warn(`  - maxQuantity: ${contractMaxQuantity}`);
				console.warn(`  - totalMinted: ${contractTotalMinted}`);
				console.warn(`  - availableQuantity (calculated): ${contractAvailableQuantity}`);
				console.warn('');
				console.warn('Product Table Values (Before Correction):');
				console.warn(`  - maxQuantity: ${result.productMaxQuantityBefore ?? 'null'}`);
				console.warn(`  - availableQuantity: ${result.productAvailableQuantityBefore}`);
				if (voucher) {
					console.warn(`  - voucher.maxQuantity: ${result.voucherMaxQuantityBefore ?? 'null'}`);
				}
				console.warn('');
				console.warn('Product Table Values (After Correction):');
				console.warn(`  - maxQuantity: ${result.productMaxQuantityAfter} ✅`);
				console.warn(`  - availableQuantity: ${result.productAvailableQuantityAfter} ✅`);
				if (voucher && result.voucherMaxQuantityAfter !== null) {
					console.warn(`  - voucher.maxQuantity: ${result.voucherMaxQuantityAfter} ✅`);
				}
				console.warn('');
				console.warn('Corrections Applied:');
				if (maxQuantityMismatch) {
					console.warn(
						`  - Updated product.maxQuantity: ${result.productMaxQuantityBefore ?? 'null'} → ${result.productMaxQuantityAfter}`,
					);
					if (voucher) {
						console.warn(
							`  - Updated voucher.maxQuantity: ${result.voucherMaxQuantityBefore ?? 'null'} → ${result.voucherMaxQuantityAfter}`,
						);
					}
				}
				if (availableQuantityMismatch) {
					console.warn(
						`  - Updated product.availableQuantity: ${result.productAvailableQuantityBefore} → ${result.productAvailableQuantityAfter}`,
					);
				}
				console.warn('');
				console.warn('Database values have been synchronized with smart contract state.');
				console.warn('='.repeat(80) + '\n');
			} catch (dbError) {
				console.error('Error correcting database values:', dbError);
			}
		} else {
			result.productAvailableQuantityAfter = product.availableQuantity;
			result.productMaxQuantityAfter = result.productMaxQuantityBefore;
			result.voucherMaxQuantityAfter = result.voucherMaxQuantityBefore;
		}
	} catch (error) {
		console.error('Error validating contract quantity state:', error);
		result.isValid = false;
	}

	return result;
}
