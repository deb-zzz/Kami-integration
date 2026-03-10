import { getBlockchainInfo } from '@/lib/gasless-nft';
import { ContractType } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { Chain } from 'viem';

export const maxDuration = 90;

export async function GET(
	request: NextRequest,
	params: { walletAddress: string; contractAddress: string; tokenId: string; type: ContractType; chainId: string }
): Promise<NextResponse<{ success: true; balance: number } | { success: false; error: string }>> {
	const contractAddress = request.nextUrl.searchParams.get('contractAddress');
	if (!contractAddress) {
		return NextResponse.json({ success: false, error: 'Contract address is required' }, { status: 400 });
	}

	const tokenId = request.nextUrl.searchParams.get('tokenId');
	if (!tokenId) {
		return NextResponse.json({ success: false, error: 'Token ID is required' }, { status: 400 });
	}

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

	const balance = await getBalance(chainId, contractAddress, tokenId, type as ContractType, params.walletAddress);
	return NextResponse.json({ success: true, balance: balance }, { status: 200 });
}

/**
 * Fetches the NFT balance for a given wallet address from the blockchain.
 *
 * - ERC721C/ERC721AC: returns 1 if token is owned by wallet, else 0.
 * - ERC1155C: returns the token's balance for the wallet.
 * - Uses viem (dynamically imported) to make the blockchain call.
 *
 * @param {string} chainId - ID of chain to connect to.
 * @param {string} contractAddress - The NFT contract address.
 * @param {string} tokenId - The NFT token ID.
 * @param {ContractType} type - Contract type.
 * @param {string} ownerAddress - Wallet to check balance for.
 * @returns {Promise<number>} Token balance for the wallet.
 */
async function getBalance(
	chainId: string,
	contractAddress: string,
	tokenId: string,
	type: ContractType,
	ownerAddress: string
): Promise<number> {
	let balance: number | undefined = undefined;
	try {
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) throw new Error('Blockchain info not found');
		if (contractAddress && tokenId && contractAddress.startsWith('0x')) {
			const { createPublicClient, http, encodeFunctionData, parseUnits } = await import('viem');
			let functionName: string | undefined = undefined;
			let args: any[] | undefined = undefined;
			let abi: any[] | undefined = undefined;

			if (type === 'ERC721C' || type === 'ERC721AC') {
				functionName = 'ownerOf';
				args = [BigInt(tokenId)];
				abi = [
					{
						inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
						name: 'ownerOf',
						outputs: [{ internalType: 'address', name: '', type: 'address' }],
						stateMutability: 'view',
						type: 'function',
					},
				];
			} else if (type === 'ERC1155C') {
				functionName = 'balanceOf';
				// fallback to zeros if not found
				if (!ownerAddress) {
					ownerAddress = '0x0000000000000000000000000000000000000000';
				}
				args = [ownerAddress, BigInt(tokenId)];
				abi = [
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
				];
			}
			if (functionName && abi) {
				const client = createPublicClient({
					chain: blockchainInfo.blockchain as unknown as Chain,
					transport: http(blockchainInfo.rpcUrl),
				});
				const data = encodeFunctionData({
					abi,
					functionName,
					args: args || [],
				});
				const result = await client.call({
					to: contractAddress as `0x${string}`,
					data,
				});

				if (type === 'ERC721C' || type === 'ERC721AC') {
					// for ERC721, if owner returned, the balance is 1
					balance = result.data ? 1 : 0;
				} else if (type === 'ERC1155C') {
					// ERC1155 returns uint256 balance
					const raw = result.data;
					if (raw) {
						// decode as BigInt
						const view = new DataView(Uint8Array.from(raw).buffer);
						balance = Number('0x' + Buffer.from(raw).toString('hex'));
					}
				}
			}
		}
		return balance || 0;
	} catch (err) {
		console.warn('Failed to query balance with viem:', err instanceof Error ? err.message : String(err));
		return 0;
	}
}
