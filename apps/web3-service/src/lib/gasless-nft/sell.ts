import { KamiSponsoredOperations, SponsoredSalesParams } from '@paulstinchcombe/gasless-nft-tx';
import type { SponsoredOperationsConfig } from '@paulstinchcombe/gasless-nft-tx/dist/kami-sponsored-operations';
import { ENTRY_POINT_V07_ADDRESS } from '@paulstinchcombe/gasless-nft-tx/dist/SmartContractWallet/simpleAccountUserOp';
import { Web3TransactionType } from '@prisma/client';
import { getPrivateKeyByChainId } from '@/app/utils/secrets';
import { prisma } from '@/lib/db';
import { privateKeyToAccount } from 'viem/accounts';
import type { Chain } from 'viem';
import { createPublicClient, http } from 'viem';
import { getBlockchainInfo, getDefaultPaymentToken, getPlatformInfo, validatePaymentTokens } from './config';
import {
	ensureEntryPointDeposit,
	ENTRY_POINT_GAS_LIMIT_OPERATION,
	USER_OP_CALL_GAS_LIMIT_OPERATION,
} from './entrypoint-deposit';
import { defaultDeadlineSeconds, generateOperationSignature, normalizePrivateKey } from './signatures';
import { createTransaction } from './transaction';

/** Options for sellKamiToken (e.g. debug script: skip DB so on-chain sell can be tested without an Asset row). */
export type SellKamiTokenOptions = { skipDbUpdate?: boolean };

/**
 * Sell/transfer a KAMI token using sponsored operations
 */
export async function sellKamiToken(
	chainId: `0x${string}`,
	contractType: 'ERC721C' | 'ERC721AC' | 'ERC1155C',
	contractAddress: `0x${string}`,
	tokenId: number,
	to: `0x${string}`,
	sellerPrivateKey: `0x${string}`,
	checkoutId?: string,
	buyerPrivateKey?: `0x${string}`,
	options?: SellKamiTokenOptions
): Promise<{ success: boolean; transactionHash?: string; checkoutId?: string; error?: string }> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) throw new Error(`Blockchain not found: ${chainId}`);

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(chainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${chainId}`);
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		if (process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true') {
			const depositResult = await ensureEntryPointDeposit({
				chainId: blockchainInfo.chainId,
				simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
				gasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
			});
			if (depositResult.funded) {
				console.log(
					`   [EntryPoint] Topped up deposit for sell: ${depositResult.previousBalance.toString()} -> ${
						depositResult.newBalance?.toString() ?? '?'
					} wei`
				);
			}
		}

		const useEntryPoint = process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true';
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			paymentToken: paymentToken.contractAddress as `0x${string}`,
			chain: blockchainInfo.blockchain,
			entryPointAddress: ENTRY_POINT_V07_ADDRESS,
			useEntryPointForExecute: useEntryPoint,
			...(useEntryPoint && {
			callGasLimit: USER_OP_CALL_GAS_LIMIT_OPERATION,
			handleOpsGasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
		}),
		};
		const handler = new KamiSponsoredOperations(operationsConfig);

		const contractTypeMapping: Record<string, 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C'> = {
			ERC721C: 'KAMI721C',
			ERC721AC: 'KAMI721AC',
			ERC1155C: 'KAMI1155C',
		};
		const mappedContractType = contractTypeMapping[contractType];
		if (!mappedContractType) throw new Error(`Unsupported contract type: ${contractType}`);

		const sellerAccount = privateKeyToAccount(sellerPrivateKey);
		const skipDbUpdate = options?.skipDbUpdate === true;

		// Fail fast: ensure asset row exists with seller as owner so we can update it later (skip when skipDbUpdate e.g. debug script).
		if (!skipDbUpdate) {
			const assetKey = {
				walletAddress: sellerAccount.address,
				contractAddress: contractAddress,
				tokenId: tokenId.toString(),
				chainId: chainId,
			};
			const existingAsset = await prisma.asset.findUnique({
				where: { walletAddress_contractAddress_tokenId_chainId: assetKey },
			});
			if (!existingAsset) {
				console.error(
					`sellKamiToken: Asset not found for update (seller=${sellerAccount.address}, contract=${contractAddress}, tokenId=${tokenId}, chainId=${chainId}). Cannot complete sell.`
				);
				return { success: false, transactionHash: undefined, checkoutId: checkoutId };
			}
		}

		const addressesMatch = sellerAccount.address.toLowerCase() === to.toLowerCase();
		if (addressesMatch) {
			console.error(`⚠️  sellKamiToken: ADDRESS MISMATCH DETECTED! Seller address matches buyer address:`);
			console.error(`   Seller address (from sellerPrivateKey): ${sellerAccount.address}`);
			console.error(`   Buyer address (to parameter): ${to}`);
			console.error(`   This will cause payment to go to the wrong address!`);
		}

		const sellParams: SponsoredSalesParams = {
			tokenId: BigInt(tokenId),
			to: to,
			seller: sellerAccount.address,
			buyerPrivateKey: buyerPrivateKey,
			...(mappedContractType === 'KAMI1155C' && { amount: BigInt(1) }),
		};

		console.log(`🔍 sellKamiToken - Address Verification:`, {
			sellerAddress: sellerAccount.address,
			buyerAddress: to,
			addressesAreDifferent: !addressesMatch,
			sellParams: {
				tokenId: sellParams.tokenId.toString(),
				to: sellParams.to,
				seller: sellParams.seller,
				hasBuyerPrivateKey: !!sellParams.buyerPrivateKey,
			},
		});

		const chainIdNum = Number(blockchainInfo.chainId);
		const userSignature = await generateOperationSignature(
			sellerPrivateKey,
			sellerAccount.address,
			'sell',
			contractAddress as `0x${string}`,
			{ ...sellParams, deadline: defaultDeadlineSeconds() },
			blockchainInfo.rpcUrl,
			chainIdNum,
			mappedContractType
		);

		console.log(`🔍 sellKamiToken - Calling handler.sellToken with:`, {
			contractAddress,
			contractType: mappedContractType,
			sellerAddress: sellParams.seller,
			buyerAddress: sellParams.to,
			tokenId: sellParams.tokenId.toString(),
		});

		const result = await handler.sellToken(contractAddress as `0x${string}`, mappedContractType, sellParams, userSignature);

		if (!result.success) {
			const errorMsg = result.error || 'Unknown error';
			console.error('❌ Failed to sell NFT:', {
				error: errorMsg,
				transactionHash: result.transactionHash,
				contractAddress,
				tokenId,
				seller: sellerAccount.address,
				buyer: to,
				contractType,
			});
			// Log full result when EntryPoint path fails with no hash (helps debug handleOps submit/revert)
			if (process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true' && !result.transactionHash) {
				console.error('❌ EntryPoint sell failed (no tx hash). Full result:', JSON.stringify(result, null, 2));
				if (errorMsg === 'EntryPoint handleOps failed') {
					console.error(
						'❌ Tip: The library did not return the underlying error. Common causes: (1) Platform Funding EOA has no native ETH to pay for the handleOps tx. (2) handleOps tx was rejected or reverted by the chain. (3) RPC/simulation error. Check the Platform EOA balance on this chain and ensure the gasless-nft-tx library returns the real error (e.g. from writeContract/waitForTransactionReceipt or receipt.status) in result.error.'
					);
				}
				if (errorMsg === 'handleOps reverted') {
					console.error(
						'❌ handleOps reverted: the tx was mined but the inner UserOp/sell failed. Open the transactionHash above on the block explorer and check Internal txns / revert reason. If transactionHash is missing, ensure this service uses gasless-nft-tx that returns receipt.transactionHash on revert. Common causes: inner call out of gas, or sellTokenWithSignature reverted (e.g. SalePriceNotSet, SellerNotTokenOwner, payment/allowance).'
					);
				}
			}

			if (errorMsg.includes('Approval failed') || errorMsg.includes('allowance') || errorMsg.includes('still less than required')) {
				console.warn('⚠️  Approval timing issue detected. This may be due to:');
				console.warn('   1. The approval transaction was sent but not yet mined when checked');
				console.warn('   2. Network latency causing delay in transaction confirmation');
				console.warn('   3. A bug in the library that checks allowance too quickly');
				console.warn(`   Approval transaction hash (if available): ${result.transactionHash}`);
				console.warn('   Recommendation: Retry the operation after a few seconds');
			}

			return { success: false, transactionHash: result.transactionHash, error: result.error, checkoutId: checkoutId };
		}

		if (skipDbUpdate) {
			return { success: true, transactionHash: result.transactionHash, checkoutId: checkoutId };
		}

		try {
			await createTransaction(
				Web3TransactionType.Sell,
				result.transactionHash as string,
				blockchainInfo,
				sellerAccount.address,
				checkoutId
			);
			console.log(`Transaction saved: ${result.transactionHash}`);
		} catch (error) {
			console.error('Error saving transaction:', error instanceof Error ? error.message : 'Unknown error');
			// Do not update asset or return success until the transfer is confirmed on-chain.
			// Otherwise setPrice (and other owner checks) can run before the chain reflects the new owner.
			return { success: false, transactionHash: result.transactionHash, checkoutId: checkoutId };
		}

		// Verify on-chain that the buyer actually owns the token before updating the DB.
		// Handles UserOp wrappers where outer tx succeeds but inner transfer could differ.
		const publicClient = createPublicClient({
			chain: blockchainInfo.blockchain as unknown as Chain,
			transport: http(blockchainInfo.rpcUrl),
		});
		const buyerLower = to.toLowerCase();
		try {
			if (contractType === 'ERC1155C') {
				const balance = await publicClient.readContract({
					address: contractAddress,
					abi: [
						{
							inputs: [
								{ internalType: 'address', name: 'account', type: 'address' },
								{ internalType: 'uint256', name: 'id', type: 'uint256' },
							],
							name: 'balanceOf',
							outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
							stateMutability: 'view',
							type: 'function',
						},
					],
					functionName: 'balanceOf',
					args: [to, BigInt(tokenId)],
				});
				if (balance < BigInt(1)) {
					console.error(
						`sellKamiToken: On-chain verification failed — buyer ${to} does not own token ${tokenId} (balance: ${balance}). Not updating asset.`
					);
					return { success: false, transactionHash: result.transactionHash, checkoutId: checkoutId };
				}
			} else {
				// ERC721C / ERC721AC
				const onChainOwner = await publicClient.readContract({
					address: contractAddress,
					abi: [
						{
							inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
							name: 'ownerOf',
							outputs: [{ internalType: 'address', name: '', type: 'address' }],
							stateMutability: 'view',
							type: 'function',
						},
					],
					functionName: 'ownerOf',
					args: [BigInt(tokenId)],
				});
				if (String(onChainOwner).toLowerCase() !== buyerLower) {
					console.error(
						`sellKamiToken: On-chain verification failed — ownerOf(${tokenId}) is ${onChainOwner}, expected buyer ${to}. Not updating asset.`
					);
					return { success: false, transactionHash: result.transactionHash, checkoutId: checkoutId };
				}
			}
		} catch (verifyError) {
			console.error('Error verifying on-chain ownership after sell:', verifyError instanceof Error ? verifyError.message : verifyError);
			return { success: false, transactionHash: result.transactionHash, checkoutId: checkoutId };
		}

		console.log(`Verified on-chain: buyer ${to} owns token ${tokenId}`);

		// Only update asset ownership after the sell transaction is confirmed and on-chain owner is the buyer.
		await prisma.asset.update({
			where: {
				walletAddress_contractAddress_tokenId_chainId: {
					walletAddress: sellerAccount.address,
					contractAddress: contractAddress,
					tokenId: tokenId.toString(),
					chainId: chainId,
				},
			},
			data: {
				walletAddress: to,
			},
		});

		console.log(`Asset ownership updated to buyer ${to} for token ${tokenId}`);
		return { success: true, transactionHash: result.transactionHash, checkoutId: checkoutId };
	} catch (error) {
		console.error('Error listing token for sale:', error);
		return { success: false, transactionHash: undefined, checkoutId: checkoutId };
	}
}
