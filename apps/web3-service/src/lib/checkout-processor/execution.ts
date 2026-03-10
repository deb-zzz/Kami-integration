import { prisma } from '@/lib/db';
import {
	deployGaslessCollection,
	DeployResponse,
	MintResponse,
	sellKamiToken,
	validateAndCorrectContractQuantityState,
	getHexChainId,
	getChainIdWithDefault,
	kamiTotalMinted,
	kamiMaxQuantity,
} from '@/lib/gasless-nft';
import { ConsumerAction, ContractType } from '@prisma/client';
import { getPrivateKeyForWalletAddress } from '@/app/utils/secrets';
import { CheckoutService, SupplyService } from '@/services';
import type { ToDeploy, ToMint, ToBuy, MintedTokenEntry, DeployedCollectionResult, PurchasedAssetResult } from './types';
import type { CheckoutError } from '@/services';
import type { ProgressCallback } from './types';
import type { CheckoutJobStage } from '../checkout-job';
import { reportProgress, transferChargesForItem } from './helpers';

const getVoucher = CheckoutService.getVoucher.bind(CheckoutService);

function isUnlimitedSupply(product: { maxQuantity: number | null }): boolean {
	return SupplyService.isUnlimited(product.maxQuantity);
}

async function getPrivateKey(walletAddress: string): Promise<`0x${string}` | null> {
	return (await getPrivateKeyForWalletAddress(walletAddress)) || null;
}

async function deployCollection(collectionId: number, checkoutId?: string, voucherId?: number): Promise<DeployResponse> {
	return await deployGaslessCollection(collectionId, checkoutId, voucherId);
}

async function mintVoucher(toMint: ToMint, buyerWalletAddress: string, checkoutId?: string): Promise<MintResponse | null> {
	const { mintGaslessNFT } = await import('@/lib/gasless-nft');
	return await mintGaslessNFT(toMint.voucher.id, buyerWalletAddress, checkoutId, toMint.quantity);
}

async function buyAsset(
	toBuy: ToBuy,
	buyerWalletAddress: string,
	checkoutId: string
): Promise<{ success: boolean; transactionHash?: string; checkoutId?: string }> {
	try {
		if (!toBuy.asset.collection) {
			console.error(`❌ buyAsset: Asset collection is missing for asset ID ${toBuy.asset.id}`);
			return { success: false, transactionHash: undefined, checkoutId: checkoutId };
		}

		const sellerPrivateKey = await getPrivateKey(toBuy.asset.walletAddress);
		if (!sellerPrivateKey) {
			console.error(`❌ buyAsset: Seller private key not found for wallet address: ${toBuy.asset.walletAddress}`);
			return { success: false, transactionHash: undefined, checkoutId: checkoutId };
		}

		const buyerPrivateKey = await getPrivateKey(buyerWalletAddress);
		if (!buyerPrivateKey) {
			console.error(`❌ buyAsset: Buyer private key not found for wallet address: ${buyerWalletAddress}`);
			return { success: false, transactionHash: undefined, checkoutId: checkoutId };
		}

		const addressesMatch = toBuy.asset.walletAddress.toLowerCase() === buyerWalletAddress.toLowerCase();
		if (addressesMatch) {
			console.error(`⚠️  buyAsset: ADDRESS MISMATCH DETECTED! Asset walletAddress (seller) matches buyerWalletAddress:`);
			console.error(`   Asset walletAddress (should be seller): ${toBuy.asset.walletAddress}`);
			console.error(`   Buyer walletAddress: ${buyerWalletAddress}`);
		}

		const result = await sellKamiToken(
			toBuy.asset.collection.chainId as `0x${string}`,
			toBuy.asset.collection.contractType as 'ERC721C' | 'ERC721AC' | 'ERC1155C',
			toBuy.contractAddress as `0x${string}`,
			toBuy.tokenId,
			buyerWalletAddress as `0x${string}`,
			sellerPrivateKey as `0x${string}`,
			checkoutId,
			buyerPrivateKey
		);

		if (result.success) {
			const product = await prisma.product.findUnique({
				where: {
					id: toBuy.asset.collection.projectId,
				},
			});
			if (product) {
				await prisma.product.update({
					where: { id: product.id },
					data: {
						ownerWalletAddress: buyerWalletAddress,
						consumerAction: ConsumerAction.None,
					},
				});
			}
		}

		return result;
	} catch (error) {
		console.error(`❌ buyAsset error:`, error);
		return { success: false, transactionHash: undefined, checkoutId: checkoutId };
	}
}

export type ExecutionContext = {
	errors: CheckoutError[];
	deployedCollections: DeployedCollectionResult[];
	mintedTokens: MintedTokenEntry[];
	purchasedAssets: PurchasedAssetResult[];
	toMint: ToMint[]; // Mutated by deploy phase when adding first voucher
};

/**
 * Execute buy phase: transfer charges (if any), then buy each asset
 */
export async function executeBuyPhase(
	toBuy: ToBuy[],
	buyerWalletAddress: string,
	checkoutId: string,
	ctx: ExecutionContext,
	onProgress?: ProgressCallback
): Promise<void> {
	const totalOps = toBuy.length;
	let completedOps = 0;

	await reportProgress(onProgress, 60, 'buying');

	for (const item of toBuy) {
		const asset = item.asset;

		if (!asset || !asset.collection || !asset.tokenId) {
			ctx.errors.push({
				collectionId: asset?.collectionId ?? 0,
				tokenId: asset?.tokenId ? Number(asset.tokenId) : item.tokenId,
				quantity: item.quantity ?? 1,
				assetId: asset?.id,
				error: `Asset data incomplete: missing collection or tokenId`,
			});
			completedOps++;
			await reportProgress(onProgress, 60 + Math.floor((completedOps / totalOps) * 30), 'buying');
			continue;
		}

		try {
			// Transfer charges if applicable
			if (item.charges) {
				const chargeError = await transferChargesForItem(item, asset.collection.chainId as `0x${string}`, buyerWalletAddress);
				if (chargeError) {
					ctx.errors.push({
						collectionId: asset.collectionId!,
						tokenId: Number(asset.tokenId),
						quantity: item.quantity ?? 1,
						assetId: asset.id,
						error: chargeError,
					});
					completedOps++;
					await reportProgress(onProgress, 60 + Math.floor((completedOps / totalOps) * 30), 'buying');
					continue;
				}
			}

			const buyResult = await buyAsset(item, buyerWalletAddress, checkoutId);
			if (buyResult?.success) {
				ctx.purchasedAssets.push({
					collectionId: asset.collectionId!,
					tokenId: Number(asset.tokenId),
					checkoutId: checkoutId,
				});
			} else {
				ctx.errors.push({
					collectionId: asset.collectionId!,
					tokenId: Number(asset.tokenId),
					quantity: item.quantity ?? 1,
					assetId: asset.id,
					error: `Failed to buy asset: ${buyResult?.transactionHash ? 'Transaction may have failed' : 'Unknown error'}`,
				});
			}
		} catch (error) {
			ctx.errors.push({
				collectionId: asset.collectionId!,
				tokenId: Number(asset.tokenId),
				quantity: item.quantity ?? 1,
				assetId: asset.id,
				error: `Error buying asset: ${(error as Error).message ?? error}`,
			});
		}

		completedOps++;
		await reportProgress(onProgress, 60 + Math.floor((completedOps / totalOps) * 30), 'buying');
	}
}

/**
 * Execute deploy phase: deploy each collection and queue first voucher for minting
 */
export async function executeDeployPhase(
	toDeploy: ToDeploy[],
	checkoutId: string,
	ctx: ExecutionContext,
	onProgress?: ProgressCallback
): Promise<void> {
	await reportProgress(onProgress, 10, 'deploying');

	let completedOps = 0;
	for (const item of toDeploy) {
		let deployResponse: DeployResponse | undefined;

		try {
			// Use the voucher we're about to mint so contract totalSupply matches its maxQuantity (avoids mismatch when collection has multiple vouchers with different maxQuantity)
			const voucherIdForDeploy = item.collection.vouchers.length > 0 ? item.collection.vouchers[0].id : undefined;
			deployResponse = await deployCollection(item.collectionId, checkoutId, voucherIdForDeploy);
			if (!deployResponse) throw new Error(`Failed to deploy collection`);
			item.collection.contractAddress = deployResponse.contractAddress;
		} catch {
			ctx.errors.push({
				collectionId: item.collectionId,
				tokenId: null,
				quantity: item.quantity,
				error: `Failed to deploy collection`,
			});
		}

		if (deployResponse) {
			ctx.deployedCollections.push({
				collectionId: item.collectionId,
				contractAddress: deployResponse.contractAddress,
				checkoutId: checkoutId,
			});
		}

		if (item.collection.vouchers.length > 0) {
			const voucher = await getVoucher(item.collection.vouchers[0].id);
			if (voucher) {
				ctx.toMint.push({
					voucherId: voucher.id,
					quantity: Number(item.quantity),
					voucher: voucher,
					charges: item.charges ?? 0,
				});
			}
		}

		completedOps++;
		await reportProgress(onProgress, 10 + Math.floor((completedOps / toDeploy.length) * 20), 'deploying');
	}
}

/**
 * Execute mint phase: transfer charges (if any), mint each voucher, update product state
 */
export async function executeMintPhase(
	toMint: ToMint[],
	buyerWalletAddress: string,
	checkoutId: string,
	ctx: ExecutionContext,
	onProgress?: ProgressCallback
): Promise<void> {
	await reportProgress(onProgress, 30, 'minting');

	let completedOps = 0;
	for (const item of toMint) {
		try {
			if (!item.voucher.collection) {
				ctx.errors.push({
					collectionId: item.voucher.collectionId!,
					tokenId: null,
					quantity: item.quantity,
					voucherId: item.voucherId,
					error: `Collection not found`,
				});
				completedOps++;
				await reportProgress(onProgress, 30 + Math.floor((completedOps / toMint.length) * 30), 'minting');
				continue;
			}

			// Transfer charges if applicable
			if (item.charges) {
				const chargeError = await transferChargesForItem(
					item,
					item.voucher.collection.chainId as `0x${string}`,
					buyerWalletAddress
				);
				if (chargeError) {
					ctx.errors.push({
						collectionId: item.voucher.collectionId!,
						tokenId: null,
						quantity: item.quantity,
						voucherId: item.voucherId,
						error: chargeError,
					});
					completedOps++;
					await reportProgress(onProgress, 30 + Math.floor((completedOps / toMint.length) * 30), 'minting');
					continue;
				}
			}

			const minted = await mintVoucher(item, buyerWalletAddress, checkoutId);
			if (minted) {
				const mintedTokenEntry: MintedTokenEntry = {
					voucherId: item.voucherId,
					tokenId: Number(minted.tokenId),
					assetId: minted.assetId,
					contractAddress: item.voucher.collection.contractAddress || undefined,
					checkoutId: checkoutId,
				};

				if (item.voucher.collection.contractType === ContractType.ERC721AC && item.quantity > 1) {
					mintedTokenEntry.quantity = item.quantity;
					if (minted.tokenIds && Array.isArray(minted.tokenIds)) {
						mintedTokenEntry.tokenIds = minted.tokenIds.map((id: unknown) => Number(id));
					} else if (minted.startTokenId !== undefined) {
						const startTokenId = Number(minted.startTokenId);
						mintedTokenEntry.tokenIds = Array.from({ length: item.quantity }, (_, i) => startTokenId + i);
					}
				}

				ctx.mintedTokens.push(mintedTokenEntry);

				// Update product state if voucher has productId
				if (item.voucher.productId) {
					const product = await prisma.product.findUnique({
						where: { id: item.voucher.productId },
					});
					if (product) {
						const unlimitedSupply = isUnlimitedSupply(product);
						let newAvailableQuantity = 1;

						if (item.voucher.contractType !== ContractType.ERC721C && item.voucher.collection.contractAddress) {
							const contractTotalMinted = await kamiTotalMinted(
								item.voucher.collection.chainId as `0x${string}`,
								item.voucher.collection.contractAddress
							);
							const contractMaxQuantity = await kamiMaxQuantity(
								item.voucher.collection.chainId as `0x${string}`,
								item.voucher.collection.contractAddress
							);
							const contractAvailableQuantity = contractMaxQuantity > 0 ? contractMaxQuantity - contractTotalMinted : 0;
							newAvailableQuantity = unlimitedSupply ? 0 : contractAvailableQuantity;
						}

						const updateData: Record<string, unknown> = {
							...(item.voucher.collection.contractType !== ContractType.ERC721AC && {
								ownerWalletAddress: buyerWalletAddress,
							}),
							availableQuantity: newAvailableQuantity,
							// Only set consumerAction when transitioning to None (ERC721C); omit otherwise so existing value is preserved (Product.consumerAction is required, cannot be null).
							...(item.voucher.contractType === ContractType.ERC721C && {
								consumerAction: ConsumerAction.None,
							}),
						};

						await prisma.product.update({
							where: { id: product.id },
							data: updateData,
						});

						if (item.voucher.collection.contractType === ContractType.ERC721AC && item.voucher.collection.contractAddress) {
							try {
								const chainIdValue = getChainIdWithDefault(item.voucher.collection.chainId);
								if (chainIdValue) {
									const chainId = getHexChainId(chainIdValue);
									await validateAndCorrectContractQuantityState(
										chainId,
										item.voucher.collection.contractAddress,
										product.id,
										item.voucher.collection.collectionId,
										item.voucher.id
									);
								}
							} catch (validationError) {
								console.error('Error validating contract quantity state:', validationError);
							}
						}
					}
				}
			} else {
				ctx.errors.push({
					collectionId: item.voucher.collectionId!,
					tokenId: null,
					quantity: item.quantity,
					voucherId: item.voucherId,
					error: `Failed to mint voucher`,
				});
			}
		} catch (error) {
			ctx.errors.push({
				collectionId: item.voucher.collectionId!,
				tokenId: null,
				quantity: item.quantity,
				voucherId: item.voucherId,
				error: `Failed to mint voucher: ${(error as Error).message ?? error}`,
			});
		}

		completedOps++;
		await reportProgress(onProgress, 30 + Math.floor((completedOps / toMint.length) * 30), 'minting');
	}
}
