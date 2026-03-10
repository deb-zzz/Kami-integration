import type { SponsoredOperationSignature } from '@paulstinchcombe/gasless-nft-tx';
import { createSponsoredOperationSignature } from '@paulstinchcombe/gasless-nft-tx';
import { createWalletClient, getAddress, http, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type KamiContractType = 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C';

/**
 * Normalize and validate a private key from the database
 * @throws Error if private key is invalid, empty, or malformed
 */
export function normalizePrivateKey(privateKey: string | null | undefined): `0x${string}` {
	if (!privateKey) {
		throw new Error('Private key is null or undefined');
	}

	const trimmed = privateKey.trim();
	if (trimmed.length === 0) {
		throw new Error('Private key is empty');
	}

	const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

	if (normalized.length !== 66) {
		throw new Error(`Invalid private key length: expected 66 characters (0x + 64 hex), got ${normalized.length}`);
	}

	if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
		throw new Error('Invalid private key format: must be a valid hex string');
	}

	return normalized as `0x${string}`;
}

/**
 * Default deadline for EIP-712 gasless operations (10 minutes from now, Unix seconds).
 */
export function defaultDeadlineSeconds(): number {
	return Math.floor(Date.now() / 1000) + 600;
}

/**
 * EIP-712 domain for KAMI NFT contracts (PRD FR-1).
 * Must match the contract exactly: KAMI721AC/KAMI721C/KAMI1155C use EIP712(name, "1")
 * and domain separator EIP712Domain(name, version, chainId, verifyingContract).
 * chainId must be the numeric chain id (e.g. 84532 for Base Sepolia).
 */
export function getEip712Domain(
	contractType: KamiContractType,
	chainId: number,
	verifyingContract: `0x${string}`
): { name: string; version: string; chainId: number; verifyingContract: `0x${string}` } {
	return {
		name: contractType,
		version: '1',
		chainId: Number(chainId) >>> 0,
		verifyingContract: getAddress(verifyingContract) as `0x${string}`,
	};
}

const EIP712_OPERATIONS = new Set(['sell', 'setTokenURI', 'setSalePrice']);

const SET_TOKEN_URI_TYPES = {
	SetTokenURI: [
		{ name: 'tokenId', type: 'uint256' },
		{ name: 'newTokenURI', type: 'string' },
		{ name: 'deadline', type: 'uint256' },
	],
} as const;

const SET_SALE_PRICE_TYPES = {
	SetSalePrice: [
		{ name: 'tokenId', type: 'uint256' },
		{ name: 'newSalePrice', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
} as const;

/**
 * Recover the signer address from a SetSalePrice EIP-712 signature (same domain/message as contract).
 */
export async function recoverSetSalePriceSigner(
	chainId: number,
	contractAddress: `0x${string}`,
	tokenId: bigint,
	newSalePrice: bigint,
	deadline: number,
	signature: `0x${string}`
): Promise<`0x${string}`> {
	const domain = getEip712Domain('KAMI721AC', chainId, contractAddress);
	return recoverTypedDataAddress({
		domain,
		types: SET_SALE_PRICE_TYPES,
		primaryType: 'SetSalePrice',
		message: { tokenId, newSalePrice, deadline: BigInt(deadline) },
		signature,
	});
}

/**
 * Recover the signer address from a SetTokenURI EIP-712 signature.
 * Used to verify that the signature would be accepted by the contract (signer must equal token owner).
 */
export async function recoverSetTokenURISigner(
	contractType: KamiContractType,
	chainId: number,
	contractAddress: `0x${string}`,
	tokenId: bigint,
	newTokenURI: string,
	deadline: number,
	signature: `0x${string}`
): Promise<`0x${string}`> {
	const domain = getEip712Domain(contractType, chainId, contractAddress);
	return recoverTypedDataAddress({
		domain,
		types: SET_TOKEN_URI_TYPES,
		primaryType: 'SetTokenURI',
		message: { tokenId, newTokenURI, deadline: BigInt(deadline) },
		signature,
	});
}

/**
 * Generate user signature for deployment operations
 * @internal
 */
export async function generateUserSignature(
	userPrivateKey: `0x${string}`,
	contractName: string,
	contractSymbol: string,
	baseTokenURI: string,
	initialMintPrice: bigint,
	platformCommissionPercentage: number,
	rpcUrl: string
): Promise<`0x${string}`> {
	try {
		const account = privateKeyToAccount(userPrivateKey);

		const message = `Deploy ${contractName} (${contractSymbol}) with URI ${baseTokenURI}, price ${initialMintPrice.toString()}, commission ${platformCommissionPercentage}%`;

		const walletClient = createWalletClient({
			account,
			transport: http(rpcUrl),
		});

		const signature = await walletClient.signMessage({
			account,
			message,
		});

		return signature;
	} catch (error) {
		console.error('Error generating user signature for deployment:', error);
		throw new Error(`Failed to generate user signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Generate user signature for sponsored operations (mint, sell, setPrice, etc.)
 * For gasless ops (sell, setTokenURI, setSalePrice) uses EIP-712 with deadline when chainId and contractType are provided.
 * @internal
 */
export async function generateOperationSignature(
	userPrivateKey: `0x${string}`,
	userAddress: `0x${string}`,
	operation: string,
	contractAddress: `0x${string}`,
	parameters: Record<string, unknown>,
	rpcUrl: string,
	chainId?: number,
	contractType?: KamiContractType
): Promise<SponsoredOperationSignature> {
	const useEip712 =
		EIP712_OPERATIONS.has(operation) &&
		chainId !== undefined &&
		contractType !== undefined &&
		(operation !== 'setSalePrice' || contractType === 'KAMI721AC');

	if (useEip712) {
		const deadline = (parameters.deadline as number | undefined) ?? defaultDeadlineSeconds();
		const paramsWithDeadline = { ...parameters, deadline };

		const account = privateKeyToAccount(userPrivateKey);
		const walletClient = createWalletClient({
			account,
			transport: http(rpcUrl),
		});

		const domain = getEip712Domain(contractType, chainId, contractAddress);

		if (operation === 'sell') {
			if (contractType === 'KAMI1155C') {
				const tokenId = BigInt(parameters.tokenId as string | number | bigint);
				const amount = BigInt(Number(parameters.amount ?? 1));
				const seller = parameters.seller as `0x${string}`;
				const to = parameters.to as `0x${string}`;
				const types = {
					SellToken1155: [
						{ name: 'to', type: 'address' },
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'amount', type: 'uint256' },
						{ name: 'seller', type: 'address' },
						{ name: 'deadline', type: 'uint256' },
					],
				};
				const signature = await walletClient.signTypedData({
					account,
					domain,
					types,
					primaryType: 'SellToken1155',
					message: {
						to,
						tokenId,
						amount,
						seller,
						deadline: BigInt(deadline),
					},
				});
				return createSponsoredOperationSignature(userAddress, operation, contractAddress, paramsWithDeadline, signature);
			} else {
				const to = parameters.to as `0x${string}`;
				const tokenId = BigInt(parameters.tokenId as string | number | bigint);
				const types = {
					SellToken: [
						{ name: 'to', type: 'address' },
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' },
					],
				};
				const signature = await walletClient.signTypedData({
					account,
					domain,
					types,
					primaryType: 'SellToken',
					message: {
						to,
						tokenId,
						deadline: BigInt(deadline),
					},
				});
				return createSponsoredOperationSignature(userAddress, operation, contractAddress, paramsWithDeadline, signature);
			}
		}

		if (operation === 'setTokenURI') {
			// Contract: SET_TOKEN_URI_TYPEHASH = keccak256("SetTokenURI(uint256 tokenId,string newTokenURI,uint256 deadline)")
			const tokenId = BigInt(parameters.tokenId as string | number | bigint);
			const newTokenURI = parameters.newTokenURI as string;
			if (contractType === 'KAMI1155C') {
				const types = {
					SetTokenURI1155: [
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'newTokenURI', type: 'string' },
						{ name: 'deadline', type: 'uint256' },
					],
				};
				const signature = await walletClient.signTypedData({
					account,
					domain,
					types,
					primaryType: 'SetTokenURI1155',
					message: {
						tokenId,
						newTokenURI,
						deadline: BigInt(deadline),
					},
				});
				return createSponsoredOperationSignature(userAddress, operation, contractAddress, paramsWithDeadline, signature);
			} else {
				const signature = await walletClient.signTypedData({
					account,
					domain,
					types: SET_TOKEN_URI_TYPES,
					primaryType: 'SetTokenURI',
					message: {
						tokenId,
						newTokenURI,
						deadline: BigInt(deadline),
					},
				});
				return createSponsoredOperationSignature(userAddress, operation, contractAddress, paramsWithDeadline, signature);
			}
		}

		if (operation === 'setSalePrice' && contractType === 'KAMI721AC') {
			const tokenId = BigInt(parameters.tokenId as string | number | bigint);
			const newSalePrice = BigInt(parameters.newPrice as string | number | bigint);
			const deadlineBigInt = BigInt(deadline);
			const message = { tokenId, newSalePrice, deadline: deadlineBigInt };
			const signature = await walletClient.signTypedData({
				account,
				domain,
				types: SET_SALE_PRICE_TYPES,
				primaryType: 'SetSalePrice',
				message,
			});
			// Verify recovery so we fail fast if domain/message don't match the contract
			const recovered = await recoverTypedDataAddress({
				domain,
				types: SET_SALE_PRICE_TYPES,
				primaryType: 'SetSalePrice',
				message,
				signature,
			});
			const expected = getAddress(userAddress);
			if (recovered.toLowerCase() !== expected.toLowerCase()) {
				throw new Error(
					`SetSalePrice signature recovery mismatch: recovered ${recovered}, expected ${expected}. ` +
						`Check EIP-712 domain (chainId=${chainId}, verifyingContract=${contractAddress}) matches the contract.`
				);
			}
			return createSponsoredOperationSignature(userAddress, operation, contractAddress, paramsWithDeadline, signature);
		}
	}

	// Legacy path: personal_sign
	try {
		const account = privateKeyToAccount(userPrivateKey);

		const bigIntReplacer = (key: string, value: unknown) => {
			if (typeof value === 'bigint') {
				return value.toString();
			}
			return value;
		};

		const message = `Execute ${operation} on ${contractAddress} with params: ${JSON.stringify(parameters, bigIntReplacer)}`;

		const walletClient = createWalletClient({
			account,
			transport: http(rpcUrl),
		});

		const signature = await walletClient.signMessage({
			account,
			message,
		});

		return createSponsoredOperationSignature(userAddress, operation, contractAddress, parameters, signature);
	} catch (error) {
		console.error('Error generating operation signature:', error);
		throw new Error(`Failed to generate operation signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
