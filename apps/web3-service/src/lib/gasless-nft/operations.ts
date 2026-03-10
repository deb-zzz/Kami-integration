import { KamiSponsoredOperations, type RoyaltyData } from '@paulstinchcombe/gasless-nft-tx';
import type { SponsoredOperationsConfig } from '@paulstinchcombe/gasless-nft-tx/dist/kami-sponsored-operations';
import {
	ENTRY_POINT_V07_ADDRESS,
	submitExecuteViaEntryPoint,
} from '@paulstinchcombe/gasless-nft-tx/dist/SmartContractWallet/simpleAccountUserOp';
import { ContractType, Web3TransactionType } from '@prisma/client';
import { getPrivateKeyByChainId } from '@/app/utils/secrets';
import type { Account, Chain } from 'viem';
import { decodeErrorResult, encodeFunctionData, http, keccak256, toHex } from 'viem';
import { createPublicClient, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Creates a transport that wraps http(rpcUrl) and intercepts personal_sign and eth_sendTransaction
 * so the account signs locally. Many public RPCs don't support these; the gasless-nft-tx library
 * uses signMessage({ account: address }) and writeContract({ account: address }), which cause
 * viem to use personal_sign / eth_sendTransaction. This transport handles both locally.
 */
function createHttpTransportWithLocalSign(rpcUrl: string, account: Account) {
	const baseTransport = http(rpcUrl);
	return (config: { chain?: Chain; retryCount?: number; timeout?: number }) => {
		const inner = baseTransport(config);
		const originalRequest = inner.request;
		const chain = config.chain;
		return {
			...inner,
			request: (async (args: { method: string; params?: unknown }) => {
				if (args.method === 'personal_sign' && Array.isArray(args.params)) {
					const [messageHex, address] = args.params as [`0x${string}`, string];
					if (address?.toLowerCase() === account.address.toLowerCase()) {
						const sign = account.signMessage;
						if (!sign) throw new Error('Account does not support signMessage');
						return await sign({ message: { raw: messageHex } });
					}
				}
				// writeContract with account: address causes viem to use eth_sendTransaction; intercept and sign locally
				if (
					(args.method === 'eth_sendTransaction' || args.method === 'wallet_sendTransaction') &&
					Array.isArray(args.params) &&
					args.params.length > 0
				) {
					const txRequest = args.params[0] as Record<string, unknown> & { from?: string };
					if (txRequest?.from?.toLowerCase() === account.address.toLowerCase()) {
						const signTx = account.signTransaction;
						if (!signTx) throw new Error('Account does not support signTransaction');
						if (!originalRequest) throw new Error('Transport request not available');
						const chainId = chain?.id ?? 0;
						// fetch current nonce so we don't sign with nonce 0 when account has used many txs
						const nonceHex = await originalRequest({
							method: 'eth_getTransactionCount',
							params: [account.address, 'pending'],
						});
						const nonce = BigInt(nonceHex as string);
						// viem cannot infer tx type from { data, from, gas, to, chainId }; add EIP-1559 fields
						let maxFeePerGas = txRequest.maxFeePerGas as bigint | undefined;
						let maxPriorityFeePerGas = txRequest.maxPriorityFeePerGas as bigint | undefined;
						if (maxFeePerGas === undefined || maxPriorityFeePerGas === undefined) {
							const gasPriceHex = await originalRequest({
								method: 'eth_gasPrice',
								params: [],
							});
							const gasPrice = BigInt(gasPriceHex as string);
							maxFeePerGas = maxFeePerGas ?? gasPrice + (gasPrice * BigInt(20)) / BigInt(100);
							maxPriorityFeePerGas = maxPriorityFeePerGas ?? maxFeePerGas;
						}
						const request = {
							...txRequest,
							chainId,
							nonce,
							type: 'eip1559' as const,
							maxFeePerGas,
							maxPriorityFeePerGas,
						};
						const serialized = await signTx(request as unknown as Parameters<typeof signTx>[0], {
							serializer: chain?.serializers?.transaction,
						});
						return originalRequest({
							method: 'eth_sendRawTransaction',
							params: [serialized],
						});
					}
				}
				if (!originalRequest) throw new Error('Transport request not available');
				return originalRequest(args);
			}) as typeof inner.request,
		};
	};
}
import { getDefaultPaymentToken, getBlockchainInfo, getHexChainId, getPlatformInfo, validatePaymentTokens } from './config';
import {
	ensureEntryPointDeposit,
	ENTRY_POINT_GAS_LIMIT_OPERATION,
	USER_OP_CALL_GAS_LIMIT_OPERATION,
} from './entrypoint-deposit';
import {
	defaultDeadlineSeconds,
	generateOperationSignature,
	normalizePrivateKey,
	recoverSetSalePriceSigner,
	recoverSetTokenURISigner,
} from './signatures';
import { createTransaction } from './transaction';
import { getPaymentTokenDecimals, toTokenUnits } from './tokens';

const ACCESS_CONTROL_GRANT_ROLE_ABI = [
	{
		inputs: [
			{ name: 'role', type: 'bytes32' },
			{ name: 'account', type: 'address' },
		],
		name: 'grantRole',
		outputs: [],
		stateMutability: 'nonpayable' as const,
		type: 'function' as const,
	},
] as const;

const SIMPLE_ACCOUNT_EXECUTE_ABI = [
	{
		inputs: [
			{ name: 'dest', type: 'address' },
			{ name: 'value', type: 'uint256' },
			{ name: 'func', type: 'bytes' },
		],
		name: 'execute',
		outputs: [],
		stateMutability: 'nonpayable' as const,
		type: 'function' as const,
	},
] as const;

/** ABI to read SimpleAccount.owner() - used to validate caller can call execute() */
const SIMPLE_ACCOUNT_OWNER_ABI = [
	{
		inputs: [],
		name: 'owner',
		outputs: [{ internalType: 'address', name: '', type: 'address' }],
		stateMutability: 'view' as const,
		type: 'function' as const,
	},
] as const;

/** Minimal ABI for setTokenURI(tokenId, newTokenURI) - OWNER_ROLE only (KAMI721AC/KAMI721C) */
const SET_TOKEN_URI_OWNER_ABI = [
	{
		inputs: [
			{ name: 'tokenId', type: 'uint256' },
			{ name: 'newTokenURI', type: 'string' },
		],
		name: 'setTokenURI',
		outputs: [],
		stateMutability: 'nonpayable' as const,
		type: 'function' as const,
	},
] as const;

/** KAMI721AC setSalePriceWithSignature(tokenId, newSalePrice, deadline, signature) - used for direct send so deadline matches signed value */
const SET_SALE_PRICE_WITH_SIGNATURE_ABI = [
	{
		inputs: [
			{ name: 'tokenId', type: 'uint256' },
			{ name: 'newSalePrice', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
			{ name: 'signature', type: 'bytes' },
		],
		name: 'setSalePriceWithSignature',
		outputs: [],
		stateMutability: 'nonpayable' as const,
		type: 'function' as const,
	},
] as const;

/** Custom errors that KAMI721AC.setSalePriceWithSignature can revert with (for decodeErrorResult) */
const KAMI721AC_SET_PRICE_ERRORS_ABI = [
	{ type: 'error' as const, name: 'SignatureExpired', inputs: [] },
	{ type: 'error' as const, name: 'InvalidSigner', inputs: [] },
	{ type: 'error' as const, name: 'TokenDoesNotExist', inputs: [] },
] as const;

/** OWNER_ROLE = keccak256("OWNER_ROLE") - matches KamiNFTCore */
const OWNER_ROLE_BYTES = keccak256(toHex('OWNER_ROLE'));

/** Decode revert data from KAMI721AC setSalePriceWithSignature (or inner execute) to a readable error name. */
function decodeSetSalePriceRevertReason(data: string | undefined): string | null {
	if (!data || typeof data !== 'string' || !data.startsWith('0x')) return null;
	try {
		const decoded = decodeErrorResult({
			abi: KAMI721AC_SET_PRICE_ERRORS_ABI,
			data: data as `0x${string}`,
		});
		return decoded.errorName ?? null;
	} catch {
		return null;
	}
}

/** Extract raw revert data from viem error chain (RpcRequestError.data or RawContractError.data). */
function getRevertDataFromError(err: unknown): string | undefined {
	let e: unknown = err;
	while (e && typeof e === 'object') {
		if ('data' in e && e.data !== undefined) {
			const d = (e as { data: unknown }).data;
			if (typeof d === 'string' && d.startsWith('0x')) return d;
			if (d && typeof d === 'object' && 'data' in d && typeof (d as { data: unknown }).data === 'string') {
				const inner = (d as { data: string }).data;
				if (inner.startsWith('0x')) return inner;
			}
		}
		e = 'cause' in e ? (e as { cause?: unknown }).cause : undefined;
	}
	return undefined;
}

type BlockchainInfo = NonNullable<Awaited<ReturnType<typeof getBlockchainInfo>>>;

/**
 * Execute setSalePriceWithSignature on KAMI721AC via SimpleAccount with the exact deadline we signed.
 * Bypasses the library's setPrice so the contract receives the same deadline as in the EIP-712 signature.
 * When entryPointOptions is set, submits via EntryPoint.handleOps (UserOperation) instead of direct EOA → execute().
 */
async function executeSetSalePriceWithSignatureDirect(
	blockchainInfo: BlockchainInfo,
	simpleAccountAddress: `0x${string}`,
	contractAddress: `0x${string}`,
	tokenId: bigint,
	newSalePrice: bigint,
	deadline: number,
	signature: `0x${string}`,
	platformPrivateKey: `0x${string}`,
	entryPointOptions?: { useEntryPointForExecute: boolean; entryPointAddress: `0x${string}` }
): Promise<{ success: boolean; error?: string; transactionHash?: string }> {
	console.log(`   [Direct] setSalePriceWithSignature deadline=${deadline} (0x${deadline.toString(16)})`);
	try {
		const account = privateKeyToAccount(platformPrivateKey);
		const chain = blockchainInfo.blockchain as unknown as Chain;
		const publicClient = createPublicClient({
			chain,
			transport: http(blockchainInfo.rpcUrl),
		});
		const walletClient = createWalletClient({
			account,
			chain,
			transport: http(blockchainInfo.rpcUrl),
		});
		// When using EntryPoint path, the library calls signMessage with account=address, so viem uses personal_sign on RPC (which many RPCs reject). Use a transport that signs locally.
		const walletClientForEntryPoint =
			entryPointOptions?.useEntryPointForExecute && entryPointOptions?.entryPointAddress
				? createWalletClient({
						account,
						chain,
						transport: createHttpTransportWithLocalSign(blockchainInfo.rpcUrl, account),
				  })
				: walletClient;
		// SimpleAccount.execute() only allows owner or EntryPoint; validate owner so we fail fast with a clear error
		const simpleAccountOwner = await publicClient.readContract({
			address: simpleAccountAddress,
			abi: SIMPLE_ACCOUNT_OWNER_ABI,
			functionName: 'owner',
		});
		const ownerMatches = String(simpleAccountOwner).toLowerCase() === account.address.toLowerCase();
		if (!ownerMatches) {
			const msg =
				`SimpleAccount owner mismatch: SimpleAccount at ${simpleAccountAddress} has owner ${simpleAccountOwner}, but the Platform Funding EOA is ${account.address}. ` +
				`Sponsored setPrice requires the SimpleAccount to be deployed with the Platform Funding EOA as owner. ` +
				`Redeploy the SimpleAccount with owner=${account.address} or point platform.simpleAccountAddress to an account whose owner is ${account.address}.`;
			console.error(`   [Direct] ${msg}`);
			return { success: false, error: msg };
		}
		console.log(`   [Direct] SimpleAccount owner matches Platform Funding EOA (${account.address})`);
		const nftCalldata = encodeFunctionData({
			abi: SET_SALE_PRICE_WITH_SIGNATURE_ABI,
			functionName: 'setSalePriceWithSignature',
			args: [tokenId, newSalePrice, BigInt(deadline), signature],
		});
		const executeCalldata = encodeFunctionData({
			abi: SIMPLE_ACCOUNT_EXECUTE_ABI,
			functionName: 'execute',
			args: [contractAddress, BigInt(0), nftCalldata],
		});
		// Simulate first to get revert reason (InvalidSigner, SignatureExpired, TokenDoesNotExist, etc.)
		try {
			await publicClient.call({
				to: simpleAccountAddress,
				data: executeCalldata,
				account: account.address,
			});
		} catch (simErr: unknown) {
			let revertData = getRevertDataFromError(simErr);
			// Many RPCs don't return revert data for nested calls; simulate NFT directly to get reason
			if (!revertData) {
				try {
					await publicClient.call({
						to: contractAddress,
						data: nftCalldata,
						account: simpleAccountAddress,
					});
				} catch (directErr: unknown) {
					revertData = getRevertDataFromError(directErr);
				}
			}
			const isEmptyRevert = !revertData || revertData === '0x';
			const decodedName = !isEmptyRevert ? decodeSetSalePriceRevertReason(revertData) : null;
			const err = simErr as { shortMessage?: string; message?: string };
			const reason = decodedName
				? `Contract reverted with: ${decodedName}`
				: isEmptyRevert
				? 'Execution reverted with no data. SimpleAccount may only allow the EntryPoint (not the owner) to call execute(). If owner was confirmed above, use UserOperations via EntryPoint for this flow, or deploy a SimpleAccount that allows owner to call execute().'
				: revertData ?? err?.shortMessage ?? err?.message ?? String(simErr);
			console.error(`   [Direct] Simulate failed (revert reason): ${reason}`);
			if (revertData && !decodedName && !isEmptyRevert)
				console.error(`   [Direct] Raw revert data (unrecognized selector): ${revertData}`);
			// When direct path fails because SimpleAccount only allows EntryPoint, try EntryPoint path if configured
			if (isEmptyRevert && entryPointOptions?.useEntryPointForExecute && entryPointOptions?.entryPointAddress) {
				console.log(`   [EntryPoint] Direct simulate failed (owner not allowed to call execute); submitting via EntryPoint v0.7`);
				const chainIdNum = Number(blockchainInfo.chainId);
				const epResult = await submitExecuteViaEntryPoint({
					publicClient,
					walletClient: walletClientForEntryPoint,
					ownerAccount: account.address,
					simpleAccountAddress,
					entryPointAddress: entryPointOptions.entryPointAddress,
					executeCalldata,
					beneficiary: account.address,
					chainId: chainIdNum,
				});
				return {
					success: epResult.success,
					error: epResult.error,
					transactionHash: epResult.transactionHash,
				};
			}
			return { success: false, error: reason };
		}
		// When useEntryPointForExecute is true, submit via EntryPoint.handleOps instead of direct sendTransaction
		if (entryPointOptions?.useEntryPointForExecute && entryPointOptions?.entryPointAddress) {
			const chainIdNum = Number(blockchainInfo.chainId);
			console.log(`   [EntryPoint] Submitting setSalePriceWithSignature via EntryPoint v0.7`);
			const epResult = await submitExecuteViaEntryPoint({
				publicClient,
				walletClient: walletClientForEntryPoint,
				ownerAccount: account.address,
				simpleAccountAddress,
				entryPointAddress: entryPointOptions.entryPointAddress,
				executeCalldata,
				beneficiary: account.address,
				chainId: chainIdNum,
			});
			return {
				success: epResult.success,
				error: epResult.error,
				transactionHash: epResult.transactionHash,
			};
		}
		// Match library: explicit gas limit for SimpleAccount.execute() + inner call
		const hash = await walletClient.sendTransaction({
			to: simpleAccountAddress,
			data: executeCalldata,
			account,
			chain,
			gas: BigInt(1000000),
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== 'success') {
			const txRevertReason = receipt.status === 'reverted' ? ` (tx hash: ${hash})` : '';
			return {
				success: false,
				error: `Transaction reverted${txRevertReason}. Run simulation to see decoded reason.`,
				transactionHash: hash,
			};
		}
		return { success: true, transactionHash: hash };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const revertData = getRevertDataFromError(err);
		const decodedName = revertData ? decodeSetSalePriceRevertReason(revertData) : null;
		const errorMsg = decodedName ? `Contract reverted with: ${decodedName}. ${message}` : message;
		return { success: false, error: errorMsg };
	}
}

/**
 * Set token URI by calling the contract's setTokenURI(tokenId, newTokenURI) as the platform.
 * The platform SimpleAccount has OWNER_ROLE on the contract, so no user signature is required.
 * Used as fallback when setTokenURIWithSignature fails (e.g. signer != token owner).
 */
async function setTokenURIAsPlatformOwner(
	blockchainInfo: NonNullable<Awaited<ReturnType<typeof getBlockchainInfo>>>,
	platformInfo: NonNullable<Awaited<ReturnType<typeof getPlatformInfo>>>,
	contractAddress: `0x${string}`,
	tokenId: number,
	metadataURI: string
): Promise<{ success: boolean; transactionHash?: string }> {
	const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));
	const account = privateKeyToAccount(platformPrivateKey as `0x${string}`);
	const chain = blockchainInfo.blockchain as unknown as Chain;
	const publicClient = createPublicClient({
		chain,
		transport: http(blockchainInfo.rpcUrl),
	});
	const walletClient = createWalletClient({
		account,
		chain,
		transport: http(blockchainInfo.rpcUrl),
	});

	const setTokenURICalldata = encodeFunctionData({
		abi: SET_TOKEN_URI_OWNER_ABI,
		functionName: 'setTokenURI',
		args: [BigInt(tokenId), metadataURI],
	});
	const executeCalldata = encodeFunctionData({
		abi: SIMPLE_ACCOUNT_EXECUTE_ABI,
		functionName: 'execute',
		args: [contractAddress, BigInt(0), setTokenURICalldata],
	});

	console.log('   🔄 Fallback: setting token URI as platform (OWNER_ROLE)...');
	const hash = await walletClient.sendTransaction({
		to: platformInfo.simpleAccountAddress as `0x${string}`,
		data: executeCalldata,
		account,
		chain,
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== 'success') {
		console.error('   ❌ Fallback setTokenURI (platform) reverted:', hash);
		return { success: false, transactionHash: hash };
	}
	console.log('   ✅ Token URI set via platform OWNER_ROLE:', hash);
	return { success: true, transactionHash: hash };
}

/**
 * Sets the token URI for a given NFT using sponsored operations.
 * Tries signature-based setTokenURIWithSignature first; on failure, falls back to
 * platform setTokenURI (OWNER_ROLE) for KAMI721AC/KAMI721C.
 * @internal Used by mint module.
 */
export async function setTokenURI(
	chainId: `0x${string}`,
	contractAddress: `0x${string}`,
	contractType: ContractType,
	tokenId: number,
	metadataURI: string,
	options: {
		ownerPrivateKey?: `0x${string}`;
		simpleAccountAddress?: `0x${string}`;
		/** If true, use platform OWNER_ROLE only (no user signature). Use for post-mint to avoid signature revert. */
		usePlatformOnly?: boolean;
	} = {},
	checkoutId?: string
): Promise<{ success: boolean; transactionHash?: string; checkoutId?: string }> {
	try {
		const cid = getHexChainId(chainId);

		const blockchainInfo = await getBlockchainInfo(cid);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${cid}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(cid);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${cid}`);
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
					`   [EntryPoint] Topped up deposit: ${depositResult.previousBalance.toString()} -> ${
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

		const contractTypeMapping: Record<ContractType, 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C'> = {
			ERC721C: 'KAMI721C',
			ERC721AC: 'KAMI721AC',
			ERC1155C: 'KAMI1155C',
			ERC20: 'KAMI721C',
		};

		const mappedContractType = contractTypeMapping[contractType];
		if (!mappedContractType) {
			throw new Error(`URI setting not supported for contract type: ${contractType}`);
		}

		const usePlatformFallback = mappedContractType === 'KAMI721AC' || mappedContractType === 'KAMI721C';
		let ownerAddress: `0x${string}` | undefined;

		if (options.ownerPrivateKey) {
			const owner = privateKeyToAccount(options.ownerPrivateKey as `0x${string}`);
			ownerAddress = owner.address;
		}

		console.log(
			`Setting token URI for contractType=${contractType.replace(
				'ERC',
				'KAMI'
			)}, contractAddress=${contractAddress}, tokenId=${tokenId}, metadataURI=${metadataURI}`
		);

		let result: { success: boolean; transactionHash?: string; error?: string };

		if (options.usePlatformOnly && usePlatformFallback) {
			result = { success: false, error: 'Using platform-only path' };
		} else if (options.ownerPrivateKey && ownerAddress) {
			const owner = privateKeyToAccount(options.ownerPrivateKey as `0x${string}`);
			const deadline = defaultDeadlineSeconds();
			const uriParamsWithDeadline = {
				tokenId: BigInt(tokenId),
				newTokenURI: metadataURI,
				deadline,
			};
			// EIP-712 domain must match contract: chainId as number (e.g. 84532), verifyingContract = NFT address
			const chainIdNum =
				typeof blockchainInfo.chainId === 'string' && blockchainInfo.chainId.startsWith('0x')
					? parseInt(blockchainInfo.chainId, 16)
					: Number(blockchainInfo.chainId);
			const userSignature = await generateOperationSignature(
				options.ownerPrivateKey as `0x${string}`,
				owner.address,
				'setTokenURI',
				contractAddress as `0x${string}`,
				uriParamsWithDeadline,
				blockchainInfo.rpcUrl,
				chainIdNum,
				mappedContractType
			);
			// Verify signature recovers to token owner (contract requires ownerOf(tokenId) == signer)
			const recovered = await recoverSetTokenURISigner(
				mappedContractType,
				chainIdNum,
				contractAddress as `0x${string}`,
				BigInt(tokenId),
				metadataURI,
				deadline,
				userSignature.signature as `0x${string}`
			);
			if (recovered.toLowerCase() !== owner.address.toLowerCase()) {
				console.warn(
					`[setTokenURI] Signature recovers to ${recovered}, expected token owner ${owner.address} - using platform fallback`
				);
				result = { success: false, error: 'Recovered signer does not match token owner' };
			} else {
				const uriParams = { tokenId: BigInt(tokenId), newTokenURI: metadataURI };
				result = await handler.setTokenURI(contractAddress as `0x${string}`, mappedContractType, uriParams, userSignature);
			}
		} else {
			result = { success: false, error: 'No ownerPrivateKey provided for signature' };
		}

		if (result.success) {
			if (result.transactionHash && ownerAddress) {
				await createTransaction(Web3TransactionType.SetTokenURI, result.transactionHash, blockchainInfo, ownerAddress, checkoutId);
			}
			return { success: true, transactionHash: result.transactionHash, checkoutId: checkoutId };
		}

		if (usePlatformFallback) {
			console.warn('Failed to set token URI with signature, trying platform OWNER_ROLE:', result.error);
			const fallback = await setTokenURIAsPlatformOwner(
				blockchainInfo,
				platformInfo,
				contractAddress as `0x${string}`,
				tokenId,
				metadataURI
			);
			if (fallback.success && fallback.transactionHash) {
				await createTransaction(
					Web3TransactionType.SetTokenURI,
					fallback.transactionHash,
					blockchainInfo,
					platformInfo.simpleAccountAddress as `0x${string}`,
					checkoutId
				);
				return { success: true, transactionHash: fallback.transactionHash, checkoutId: checkoutId };
			}
		}

		console.error('Failed to set token URI:', result.error);
		return { success: false, transactionHash: result.transactionHash, checkoutId: checkoutId };
	} catch (error) {
		console.error('Error setting token URI:', error);
		return { success: false, transactionHash: undefined, checkoutId: checkoutId };
	}
}

/**
 * Set royalty information for a gasless KAMI NFT contract using sponsored operations
 */
export async function setKamiNFTRoyalty(
	chainId: `0x${string}`,
	contractAddress: string,
	contractType: ContractType,
	tokenId: number,
	royalties: RoyaltyData | RoyaltyData[],
	options: {
		rpcUrl?: string;
		ownerPrivateKey?: string;
		simpleAccountAddress?: string;
		chain?: Chain;
	} = {}
): Promise<boolean> {
	try {
		if (!contractAddress || !royalties) {
			throw new Error('Invalid parameters. Must provide a contract address and royalty data.');
		}

		let hexChainId = getHexChainId(options.chain ? options.chain.id.toString() : chainId);
		if (!hexChainId.startsWith('0x')) hexChainId = `0x${hexChainId}` as `0x${string}`;

		const blockchainInfo = await getBlockchainInfo(hexChainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${hexChainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(hexChainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${hexChainId}`);
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
					`   [EntryPoint] Topped up deposit: ${depositResult.previousBalance.toString()} -> ${
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

		const contractTypeMapping: Record<ContractType, 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C'> = {
			ERC721C: 'KAMI721C',
			ERC721AC: 'KAMI721AC',
			ERC1155C: 'KAMI1155C',
			ERC20: 'KAMI721C',
		};

		const mappedContractType = contractTypeMapping[contractType];
		if (!mappedContractType) {
			throw new Error(`Royalty setting not supported for contract type: ${contractType}`);
		}

		if (royalties) {
			const royaltiesArray = Array.isArray(royalties) ? royalties : [royalties];

			const owner = privateKeyToAccount(options.ownerPrivateKey as `0x${string}`);
			const userSignature = await generateOperationSignature(
				options.ownerPrivateKey as `0x${string}`,
				owner.address,
				'setTokenTransferRoyalties',
				contractAddress as `0x${string}`,
				{
					tokenId: BigInt(tokenId),
					royalties: royaltiesArray,
				},
				blockchainInfo.rpcUrl
			);

			const royaltyParams = {
				tokenId: BigInt(tokenId),
				royalties: royaltiesArray,
			};

			const result = await handler.setTokenTransferRoyalties(
				contractAddress as `0x${string}`,
				mappedContractType,
				royaltyParams,
				userSignature
			);

			if (!result.success) {
				console.error('Failed to set primary royalties:', result.error);
				return false;
			}

			for (const royaltyInfo of royaltiesArray) {
				console.log(
					`Royalty info set: recipient=${royaltyInfo.receiver}, feeNumerator=${royaltyInfo.feeNumerator} for contract=${contractAddress} with tokenId=${tokenId}`
				);
			}
		}

		return true;
	} catch (error) {
		console.error('Error setting royalty info:', error);
		return false;
	}
}

/**
 * Set the price of a KAMI NFT token using sponsored operations.
 * - KAMI721C: uses setPrice (OWNER_ROLE only); SimpleAccount must have OWNER_ROLE.
 * - KAMI721AC: uses setSalePriceWithSignature (gasless); the signer must be the token owner
 *   (ownerOf(tokenId)), not OWNER_ROLE. Ensure the signing wallet owns the token on-chain.
 */
export async function setKamiNFTPrice(
	chainId: `0x${string}`,
	contractAddress: `0x${string}`,
	contractType: ContractType,
	tokenId: number,
	price: number | string | bigint,
	options: {
		ownerPrivateKey?: `0x${string}`;
		simpleAccountAddress?: `0x${string}`;
	} = {}
): Promise<boolean> {
	try {
		if (!options.ownerPrivateKey) {
			throw new Error('setKamiNFTPrice requires ownerPrivateKey for the operation signature');
		}

		const cid = getHexChainId(chainId);
		const blockchainInfo = await getBlockchainInfo(cid);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${cid}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform does not exist for chain ${chainId}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(cid);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${cid}`);
		}

		const simpleAccountAddress = platformInfo.simpleAccountAddress as `0x${string}`;

		// KAMI721C setPrice is OWNER_ROLE-only; ensure SimpleAccount has the role. KAMI721AC uses
		// setSalePriceWithSignature (token owner signs), so OWNER_ROLE is not required for that path.
		if (contractType === 'ERC721C') {
			const hasRole = await hasOwnerRole(chainId, contractAddress, 'ERC721C', simpleAccountAddress);
			if (!hasRole) {
				console.log(`SimpleAccount does not have OWNER_ROLE on ${contractAddress}; attempting to grant...`);
				const granted = await grantOwnerRoleViaDeployerSimpleAccount(chainId, contractAddress, 'ERC721C', simpleAccountAddress);
				if (!granted) {
					console.error(
						'Failed to grant OWNER_ROLE to SimpleAccount. The contract may have been deployed with a different admin. ' +
							'Ensure the contract was deployed via the platform or grant OWNER_ROLE to the SimpleAccount manually.'
					);
					return false;
				}
			}
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		if (process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true') {
			const depositResult = await ensureEntryPointDeposit({
				chainId: blockchainInfo.chainId,
				simpleAccountAddress,
				gasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
			});
			if (depositResult.funded) {
				console.log(
					`   [EntryPoint] Topped up deposit: ${depositResult.previousBalance.toString()} -> ${
						depositResult.newBalance?.toString() ?? '?'
					} wei`
				);
			}
		}

		const useEntryPoint = process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true';
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: simpleAccountAddress,
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

		const contractTypeMapping: Record<ContractType, 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C'> = {
			ERC721C: 'KAMI721C',
			ERC721AC: 'KAMI721AC',
			ERC1155C: 'KAMI1155C',
			ERC20: 'KAMI1155C',
		};

		const mappedContractType = contractTypeMapping[contractType];
		if (!mappedContractType) {
			throw new Error(`Price setting not supported for contract type: ${contractType}`);
		}

		const parsedPrice = typeof price === 'bigint' ? price.toString() : String(price);
		const paymentTokenAddress = paymentToken.contractAddress;
		const decimals = await getPaymentTokenDecimals(paymentTokenAddress as `0x${string}`, blockchainInfo.rpcUrl);
		const tokenPrice = toTokenUnits(parsedPrice, decimals);

		const owner = privateKeyToAccount(options.ownerPrivateKey);
		// For KAMI721AC setSalePriceWithSignature, the signer must be the on-chain token owner; verify before signing
		if (contractType === 'ERC721AC') {
			const publicClient = createPublicClient({
				chain: blockchainInfo.blockchain as unknown as Chain,
				transport: http(blockchainInfo.rpcUrl),
			});
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
			const ownerAddressLower = owner.address.toLowerCase();
			const onChainOwnerLower = String(onChainOwner).toLowerCase();
			if (ownerAddressLower !== onChainOwnerLower) {
				console.error(
					`setSalePriceWithSignature requires the signer to own the token. Signing wallet ${owner.address} is not the on-chain owner of tokenId ${tokenId} (owner: ${onChainOwner}).`
				);
				return false;
			}
		}
		const operationName = contractType === 'ERC721AC' ? 'setSalePrice' : 'setPrice';
		const priceParamsBase = {
			tokenId: BigInt(tokenId),
			newPrice: tokenPrice,
		};
		const deadlineForSignature = defaultDeadlineSeconds();
		const priceParamsForSignature =
			contractType === 'ERC721AC' ? { ...priceParamsBase, deadline: deadlineForSignature } : priceParamsBase;
		const chainIdNum = Number(blockchainInfo.chainId);
		if (contractType === 'ERC721AC') {
			console.log(
				`   SetSalePrice EIP-712: chainId=${chainIdNum}, contract=${contractAddress}, tokenId=${tokenId}, newSalePrice=${tokenPrice}, deadline=${deadlineForSignature}`
			);
		}
		const userSignature = await generateOperationSignature(
			options.ownerPrivateKey,
			owner.address,
			operationName,
			contractAddress as `0x${string}`,
			priceParamsForSignature,
			blockchainInfo.rpcUrl,
			contractType === 'ERC721AC' ? chainIdNum : undefined,
			contractType === 'ERC721AC' ? 'KAMI721AC' : undefined
		);

		const priceParams = {
			tokenId: BigInt(tokenId),
			newPrice: tokenPrice,
		};

		const operationDescription = contractType === 'ERC721AC' ? 'sale price (setSalePrice)' : 'price (setPrice)';
		console.log(
			`Setting ${operationDescription} for contractType=${contractType.replace(
				'ERC',
				'KAMI'
			)}, contractAddress=${contractAddress}, tokenId=${tokenId}, price=${parsedPrice} (decimals=${decimals}, tokenUnits=${tokenPrice.toString()})`
		);

		// KAMI721AC: send setSalePriceWithSignature ourselves so the deadline we signed is used (library ignores parameters.deadline)
		let result: { success: boolean; error?: string; transactionHash?: string };
		if (contractType === 'ERC721AC') {
			console.log(`   [Direct] Using direct setSalePriceWithSignature path (signed deadline=${deadlineForSignature})`);
			const sig = userSignature as { signature: `0x${string}` };
			// Diagnose: recover signer and compare to on-chain owner (contract checks ownerOf(tokenId) == signer)
			try {
				const recoveredSigner = await recoverSetSalePriceSigner(
					chainIdNum,
					contractAddress,
					BigInt(tokenId),
					tokenPrice,
					deadlineForSignature,
					sig.signature
				);
				const publicClient = createPublicClient({
					chain: blockchainInfo.blockchain as unknown as Chain,
					transport: http(blockchainInfo.rpcUrl),
				});
				const onChainOwner = await publicClient.readContract({
					address: contractAddress,
					abi: [
						{
							inputs: [{ name: 'tokenId', type: 'uint256' }],
							name: 'ownerOf',
							outputs: [{ type: 'address' }],
							stateMutability: 'view',
							type: 'function',
						},
					],
					functionName: 'ownerOf',
					args: [BigInt(tokenId)],
				});
				const match = recoveredSigner.toLowerCase() === String(onChainOwner).toLowerCase();
				console.log(`   [Direct] Recovered signer=${recoveredSigner}, ownerOf(${tokenId})=${onChainOwner}, match=${match}`);
			} catch (e) {
				console.warn('   [Direct] Could not recover signer for diagnostic:', e instanceof Error ? e.message : e);
			}
			result = await executeSetSalePriceWithSignatureDirect(
				blockchainInfo,
				simpleAccountAddress,
				contractAddress,
				BigInt(tokenId),
				tokenPrice,
				deadlineForSignature,
				sig.signature,
				platformPrivateKey,
				// Always allow EntryPoint fallback when direct execute() reverts (e.g. SimpleAccount only allows EntryPoint)
				{ useEntryPointForExecute: true, entryPointAddress: ENTRY_POINT_V07_ADDRESS }
			);
		} else {
			result = await handler.setPrice(contractAddress as `0x${string}`, mappedContractType, priceParams, userSignature);
		}

		if (!result.success) {
			console.error('Failed to set NFT price:', result.error);
			if (contractType === 'ERC721C') {
				const stillHasRole = await hasOwnerRole(chainId, contractAddress, 'ERC721C', simpleAccountAddress).catch(() => false);
				if (!stillHasRole) {
					console.error(
						'The platform SimpleAccount does not have OWNER_ROLE on this contract. setPrice requires OWNER_ROLE. ' +
							'Grant OWNER_ROLE to the SimpleAccount or deploy the contract with adminAddress=SimpleAccount.'
					);
				}
			}
			if (contractType === 'ERC721AC') {
				console.error(
					'KAMI721AC setSalePriceWithSignature requires the signer to be the on-chain owner of the token. ' +
						'Verify: (1) signing wallet owns tokenId on this contract, (2) signature deadline is still valid, ' +
						'(3) collection chainId in DB matches the chain the contract is deployed on (EIP-712 domain uses chainId).'
				);
			}
			return false;
		}

		if (result.transactionHash) {
			await createTransaction(Web3TransactionType.SetPrice, result.transactionHash, blockchainInfo, owner.address);
		}

		return true;
	} catch (error) {
		console.error('Error setting NFT price:', error);
		return false;
	}
}

/**
 * Set the global mint price for a KAMI721AC contract using sponsored operations
 */
export async function setMintPrice(
	chainId: `0x${string}`,
	contractAddress: `0x${string}`,
	contractType: ContractType,
	mintPrice: number | string | bigint,
	options: {
		ownerPrivateKey?: `0x${string}`;
		simpleAccountAddress?: `0x${string}`;
	} = {}
): Promise<boolean> {
	try {
		if (contractType !== 'ERC721AC') {
			throw new Error(`setMintPrice() is only available for KAMI721AC contracts. Got: ${contractType}`);
		}

		const cid = getHexChainId(chainId);
		const blockchainInfo = await getBlockchainInfo(cid);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${cid}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform does not exist for chain ${cid}`);
		}

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
					`   [EntryPoint] Topped up deposit: ${depositResult.previousBalance.toString()} -> ${
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

		const parsedPrice = typeof mintPrice === 'bigint' ? mintPrice.toString() : String(mintPrice);
		const paymentTokenAddress = paymentToken.contractAddress;
		const decimals = await getPaymentTokenDecimals(paymentTokenAddress as `0x${string}`, blockchainInfo.rpcUrl);
		const priceInTokenUnits = toTokenUnits(parsedPrice, decimals);

		const owner = privateKeyToAccount(options.ownerPrivateKey as `0x${string}`);
		const userSignature = await generateOperationSignature(
			options.ownerPrivateKey as `0x${string}`,
			owner.address,
			'setMintPrice',
			contractAddress as `0x${string}`,
			{
				newMintPrice: priceInTokenUnits,
			},
			blockchainInfo.rpcUrl
		);

		const mintPriceParams = {
			newMintPrice: priceInTokenUnits,
		};

		console.log(`Setting global mint price for KAMI721AC contractAddress=${contractAddress}, mintPrice=${parsedPrice}`);

		const result = await handler.setMintPrice(contractAddress as `0x${string}`, 'KAMI721AC', mintPriceParams, userSignature);

		if (!result.success) {
			console.error('Failed to set mint price:', result.error);
			return false;
		}

		if (result.transactionHash) {
			await createTransaction(Web3TransactionType.SetPrice, result.transactionHash, blockchainInfo, owner.address);
		}

		return true;
	} catch (error) {
		console.error('Error setting mint price:', error);
		return false;
	}
}

/**
 * Set the maximum quantity (maxSupply) for a KAMI721AC contract.
 * Requires: collection owner's signature (ownerPrivateKey) and that the platform SimpleAccount
 * has OWNER_ROLE on the contract (it does by default when deployed via the platform).
 */
export async function setMaxQuantity(
	chainId: `0x${string}`,
	contractAddress: `0x${string}`,
	maxQuantity: number,
	options: {
		ownerPrivateKey?: `0x${string}`;
		simpleAccountAddress?: `0x${string}`;
	} = {}
): Promise<boolean> {
	try {
		if (!options.ownerPrivateKey) {
			throw new Error('setMaxQuantity requires ownerPrivateKey for the operation signature');
		}

		const cid = getHexChainId(chainId);
		const blockchainInfo = await getBlockchainInfo(cid);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${cid}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform does not exist for chain ${cid}`);
		}

		validatePaymentTokens(blockchainInfo);
		const paymentToken = await getDefaultPaymentToken(chainId);
		if (!paymentToken) {
			throw new Error(`No payment token available for chainId ${chainId}`);
		}

		const simpleAccountAddress = platformInfo.simpleAccountAddress as `0x${string}`;

		// setTotalSupply is OWNER_ROLE-only; the sponsored tx is executed by the SimpleAccount, so it must have OWNER_ROLE
		const hasRole = await hasOwnerRole(chainId, contractAddress, 'ERC721AC', simpleAccountAddress);
		if (!hasRole) {
			console.log(`SimpleAccount does not have OWNER_ROLE on ${contractAddress}; attempting to grant...`);
			const granted = await grantOwnerRoleViaDeployerSimpleAccount(chainId, contractAddress, 'ERC721AC', simpleAccountAddress);
			if (!granted) {
				console.error(
					'Failed to grant OWNER_ROLE to SimpleAccount. The contract may have been deployed with a different admin. ' +
						'Ensure the contract was deployed via the platform (adminAddress=SimpleAccount) or grant OWNER_ROLE to the SimpleAccount manually.'
				);
				return false;
			}
		}

		const platformPrivateKey = normalizePrivateKey(await getPrivateKeyByChainId(blockchainInfo.chainId));

		if (process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true') {
			const depositResult = await ensureEntryPointDeposit({
				chainId: blockchainInfo.chainId,
				simpleAccountAddress,
				gasLimit: ENTRY_POINT_GAS_LIMIT_OPERATION,
			});
			if (depositResult.funded) {
				console.log(
					`   [EntryPoint] Topped up deposit: ${depositResult.previousBalance.toString()} -> ${
						depositResult.newBalance?.toString() ?? '?'
					} wei`
				);
			}
		}

		const useEntryPoint = process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true';
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey,
			platformSimpleAccountAddress: simpleAccountAddress,
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

		const maxQty = BigInt(maxQuantity);

		const owner = privateKeyToAccount(options.ownerPrivateKey);
		const userSignature = await generateOperationSignature(
			options.ownerPrivateKey,
			owner.address,
			'setTotalSupply',
			contractAddress as `0x${string}`,
			{
				maxSupply: maxQty,
			},
			blockchainInfo.rpcUrl
		);

		const totalSupplyParams = {
			maxSupply: maxQty,
		};

		console.log(`Setting max quantity (totalSupply) for KAMI721AC contractAddress=${contractAddress}, maxQuantity=${maxQuantity}`);

		const result = await handler.setTotalSupply(contractAddress as `0x${string}`, 'KAMI721AC', totalSupplyParams, userSignature);

		if (!result.success) {
			console.error('Failed to set max quantity:', result.error);
			// Hint: re-check role in case of permission revert (e.g. CallerNotOwner)
			const stillHasRole = await hasOwnerRole(chainId, contractAddress, 'ERC721AC', simpleAccountAddress).catch(() => false);
			if (!stillHasRole) {
				console.error(
					'The platform SimpleAccount does not have OWNER_ROLE on this contract. setTotalSupply requires OWNER_ROLE. ' +
						'Grant OWNER_ROLE to the SimpleAccount or deploy the contract with adminAddress=SimpleAccount.'
				);
			}
			return false;
		}

		if (result.transactionHash) {
			await createTransaction(Web3TransactionType.SetPrice, result.transactionHash, blockchainInfo, owner.address);
		}

		return true;
	} catch (error) {
		console.error('Error setting max quantity:', error);
		return false;
	}
}

/**
 * Check if an address has OWNER_ROLE on a KAMI contract using library method
 * @internal
 */
export async function hasOwnerRole(
	chainId: `0x${string}`,
	contractAddress: `0x${string}`,
	contractType: 'ERC721C' | 'ERC721AC',
	accountAddress: `0x${string}`
): Promise<boolean> {
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

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
					`   [EntryPoint] Topped up deposit: ${depositResult.previousBalance.toString()} -> ${
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

		const mappedContractType = contractType === 'ERC721C' ? 'KAMI721C' : 'KAMI721AC';

		const result = await handler.hasOwnerRole(contractAddress, mappedContractType, accountAddress);

		if (!result.success || result.hasRole === undefined) {
			console.error(`Failed to check OWNER_ROLE: ${result.error}`);
			return false;
		}

		return result.hasRole;
	} catch (error) {
		console.error(`Error checking OWNER_ROLE for ${accountAddress}:`, error);
		return false;
	}
}

/**
 * Grant OWNER_ROLE to the SimpleAccount using the deployer (SimpleAccount) as executor.
 * Used after sponsored deployment: the contract's admin is the SimpleAccount, so we send
 * SimpleAccount.execute(contract, 0, grantRole(OWNER_ROLE, simpleAccount)) from the Platform Funding EOA.
 * Does not require the collection owner's private key.
 */
export async function grantOwnerRoleViaDeployerSimpleAccount(
	chainId: `0x${string}`,
	contractAddress: `0x${string}`,
	contractType: 'ERC721C' | 'ERC721AC',
	simpleAccountAddress: `0x${string}`
): Promise<boolean> {
	try {
		const cid = getHexChainId(chainId);
		const blockchainInfo = await getBlockchainInfo(cid);
		if (!blockchainInfo) {
			console.error(`grantOwnerRoleViaDeployerSimpleAccount: Blockchain not found: ${cid}`);
			return false;
		}
		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			console.error(`grantOwnerRoleViaDeployerSimpleAccount: Platform not found`);
			return false;
		}

		const alreadyHasRole = await hasOwnerRole(chainId, contractAddress, contractType, simpleAccountAddress);
		if (alreadyHasRole) {
			console.log(`✅ Simple account ${simpleAccountAddress} already has OWNER_ROLE`);
			return true;
		}

		const platformPrivateKey = await getPrivateKeyByChainId(blockchainInfo.chainId);
		if (!platformPrivateKey) {
			console.error(`grantOwnerRoleViaDeployerSimpleAccount: No platform private key for chain`);
			return false;
		}
		const account = privateKeyToAccount(normalizePrivateKey(platformPrivateKey) as `0x${string}`);
		const chain = blockchainInfo.blockchain as unknown as Chain;
		const publicClient = createPublicClient({
			chain,
			transport: http(blockchainInfo.rpcUrl),
		});
		const walletClient = createWalletClient({
			account,
			chain,
			transport: http(blockchainInfo.rpcUrl),
		});

		const grantCalldata = encodeFunctionData({
			abi: ACCESS_CONTROL_GRANT_ROLE_ABI,
			functionName: 'grantRole',
			args: [OWNER_ROLE_BYTES, simpleAccountAddress],
		});
		const executeCalldata = encodeFunctionData({
			abi: SIMPLE_ACCOUNT_EXECUTE_ABI,
			functionName: 'execute',
			args: [contractAddress, BigInt(0), grantCalldata],
		});

		const hash = await walletClient.sendTransaction({
			to: simpleAccountAddress,
			data: executeCalldata,
			account,
			chain,
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== 'success') {
			console.error(`grantOwnerRoleViaDeployerSimpleAccount: Transaction reverted: ${hash}`);
			return false;
		}
		console.log(`✅ OWNER_ROLE granted via deployer SimpleAccount. Tx: ${hash}`);
		return true;
	} catch (error) {
		console.error(`grantOwnerRoleViaDeployerSimpleAccount:`, error);
		return false;
	}
}

/**
 * Grant OWNER_ROLE to the simple account after contract deployment
 */
export async function grantOwnerRoleToSimpleAccount(
	chainId: `0x${string}`,
	contractAddress: `0x${string}`,
	contractType: ContractType,
	ownerPrivateKey: `0x${string}`,
	simpleAccountAddress: `0x${string}`
): Promise<boolean> {
	try {
		if (contractType !== 'ERC721C' && contractType !== 'ERC721AC') {
			console.log(`Skipping OWNER_ROLE grant for ${contractType} - only needed for ERC721C and ERC721AC`);
			return true;
		}

		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${chainId}`);
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
		}

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
					`   [EntryPoint] Topped up deposit: ${depositResult.previousBalance.toString()} -> ${
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

		const mappedContractType = contractType === 'ERC721C' ? 'KAMI721C' : 'KAMI721AC';

		const hasRoleResult = await handler.hasOwnerRole(contractAddress, mappedContractType, simpleAccountAddress);
		if (hasRoleResult.success && hasRoleResult.hasRole) {
			console.log(`✅ Simple account ${simpleAccountAddress} already has OWNER_ROLE`);
			return true;
		}

		console.log(`🔐 Granting OWNER_ROLE to simple account ${simpleAccountAddress}...`);

		const owner = privateKeyToAccount(ownerPrivateKey);
		const userSignature = await generateOperationSignature(
			ownerPrivateKey,
			owner.address,
			'grantOwnerRole',
			contractAddress,
			{
				account: simpleAccountAddress,
			},
			blockchainInfo.rpcUrl
		);

		const result = await handler.grantOwnerRole(contractAddress, mappedContractType, simpleAccountAddress, userSignature);

		if (!result.success) {
			console.error(`❌ Failed to grant OWNER_ROLE: ${result.error}`);
			return false;
		}

		if (result.transactionHash) {
			console.log(`✅ OWNER_ROLE granted successfully to ${simpleAccountAddress}`);
			console.log(`   Transaction: ${result.transactionHash}`);

			const verifyResult = await handler.hasOwnerRole(contractAddress, mappedContractType, simpleAccountAddress);
			if (verifyResult.success && verifyResult.hasRole) {
				console.log(`✅ Verified: Simple account now has OWNER_ROLE`);
				return true;
			} else {
				console.warn(`⚠️  Warning: Role grant transaction succeeded but verification failed`);
				return false;
			}
		} else {
			console.error(`❌ Failed to grant OWNER_ROLE: No transaction hash returned`);
			return false;
		}
	} catch (error) {
		console.error(`Error granting OWNER_ROLE to simple account:`, error);
		return false;
	}
}
