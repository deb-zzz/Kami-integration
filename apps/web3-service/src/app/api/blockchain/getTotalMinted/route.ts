import {
	getBlockchainInfo,
	getPlatformInfo,
	getDefaultPaymentToken,
	validatePaymentTokens,
	ENTRY_POINT_GAS_LIMIT_OPERATION,
	USER_OP_CALL_GAS_LIMIT_OPERATION,
} from '@/lib/gasless-nft';
import { ContractType } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { KamiSponsoredOperations } from '@paulstinchcombe/gasless-nft-tx';
import type { SponsoredOperationsConfig } from '@paulstinchcombe/gasless-nft-tx/dist/kami-sponsored-operations';
import { ENTRY_POINT_V07_ADDRESS } from '@paulstinchcombe/gasless-nft-tx/dist/SmartContractWallet/simpleAccountUserOp';

export const maxDuration = 90;

export async function GET(
	request: NextRequest
): Promise<NextResponse<{ success: true; totalMinted: number } | { success: false; error: string }>> {
	const contractAddress = request.nextUrl.searchParams.get('contractAddress');
	if (!contractAddress) {
		return NextResponse.json({ success: false, error: 'Contract address is required' }, { status: 400 });
	}

	const tokenId = request.nextUrl.searchParams.get('tokenId');

	const type = request.nextUrl.searchParams.get('type');
	if (!type) {
		return NextResponse.json({ success: false, error: 'Type is required' }, { status: 400 });
	}

	const chainId = request.nextUrl.searchParams.get('chainId')
		? (`0x${Number(request.nextUrl.searchParams.get('chainId')).toString(16)}` as `0x${string}`)
		: undefined;
	if (!chainId) {
		return NextResponse.json({ success: false, error: 'Chain ID is required' }, { status: 400 });
	}

	const totalMinted = await getTotalMinted(chainId, contractAddress, tokenId, type as ContractType);
	return NextResponse.json({ success: true, totalMinted: totalMinted }, { status: 200 });
}

/**
 * Fetches the NFT totalMinted from the blockchain using KamiSponsoredOperations.
 *
 * @param {string} chainId - ID of chain to connect to.
 * @param {string} contractAddress - The NFT contract address.
 * @param {string | null} tokenId - The NFT token ID (required for ERC1155C, optional for ERC721C/ERC721AC).
 * @param {ContractType} type - Contract type.
 * @returns {Promise<number>} Total minted count of the NFT.
 */
async function getTotalMinted(chainId: string, contractAddress: string, tokenId: string | null, type: ContractType): Promise<number> {
	const blockchainInfo = await getBlockchainInfo(chainId);
	if (!blockchainInfo) {
		throw new Error(`Blockchain not found: ${chainId}`);
	}

	const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
	if (!platformInfo) {
		throw new Error(`Platform info not found: ${blockchainInfo.chainId}`);
	}

	// Get payment token with validation
	validatePaymentTokens(blockchainInfo);
	const paymentToken = await getDefaultPaymentToken(chainId);
	if (!paymentToken) {
		throw new Error(`No payment token available for chainId ${chainId}`);
	}

	try {
		const useEntryPoint = process.env.USE_ENTRY_POINT_FOR_EXECUTE === 'true';
		// Setup sponsored operations configuration
		const operationsConfig: SponsoredOperationsConfig = {
			rpcUrl: blockchainInfo.rpcUrl,
			platformPrivateKey: platformInfo.platformFundingWalletPrivateKey as `0x${string}`,
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

		// Create sponsored operations handler
		const handler = new KamiSponsoredOperations(operationsConfig);

		// Convert contract type to the format expected by the library
		const contractTypeMapping: Record<ContractType, 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C'> = {
			ERC721C: 'KAMI721C',
			ERC721AC: 'KAMI721AC',
			ERC1155C: 'KAMI1155C',
			ERC20: 'KAMI721C', // ERC20 not supported, default to KAMI721C
		};

		const mappedContractType = contractTypeMapping[type];
		if (!mappedContractType) {
			throw new Error(`Unsupported contractType: ${type}`);
		}

		// For ERC1155C, tokenId is required
		if (type === 'ERC1155C' && !tokenId) {
			throw new Error('Token ID is required for ERC1155C');
		}

		// Call getTotalMinted - tokenId is optional for ERC721C/ERC721AC, required for ERC1155C
		const result = await handler.getTotalMinted(
			contractAddress as `0x${string}`,
			mappedContractType,
			tokenId ? BigInt(tokenId) : undefined
		);

		if (!result.success || result.totalMinted === undefined) {
			console.error('Failed to get total minted:', result.error);
			return 0;
		}

		return typeof result.totalMinted === 'bigint' ? Number(result.totalMinted) : result.totalMinted;
	} catch (error) {
		console.error(`Error fetching totalMinted for ${type}:`, error);
		return 0;
	}
}
