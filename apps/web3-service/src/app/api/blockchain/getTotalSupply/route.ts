import { getBlockchainInfo } from '@/lib/gasless-nft';
import { ContractType } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { Chain } from 'viem';

export const maxDuration = 90;

export async function GET(
	request: NextRequest
): Promise<NextResponse<{ success: true; totalSupply: number } | { success: false; error: string }>> {
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

	const totalSupply = await getTotalSupply(chainId, contractAddress, tokenId, type as ContractType);
	return NextResponse.json({ success: true, totalSupply: totalSupply }, { status: 200 });
}

/**
 * Fetches the NFT totalSupply from the blockchain.
 *
 * @param {string} chainId - ID of chain to connect to.
 * @param {string} contractAddress - The NFT contract address.
 * @param {string} tokenId - The NFT token ID.
 * @param {ContractType} type - Contract type.
 * @returns {Promise<number>} Total supply of the NFT.
 */
async function getTotalSupply(chainId: string, contractAddress: string, tokenId: string, type: ContractType): Promise<number> {
	const blockchainInfo = await getBlockchainInfo(chainId);
	if (!blockchainInfo) throw new Error('Blockchain info not found for chainId: ' + chainId);

	try {
		const { createPublicClient, http, encodeFunctionData } = await import('viem');
		const client = createPublicClient({
			chain: blockchainInfo.blockchain as unknown as Chain,
			transport: http(blockchainInfo.rpcUrl),
		});

		let abi: any[] = [];
		let functionName: string;
		let args: any[] | undefined = undefined;

		if (type === 'ERC721C' || type === 'ERC721AC') {
			// Use totalSupply() for ERC721/721AC
			functionName = 'totalSupply';
			abi = [
				{
					inputs: [],
					name: 'totalSupply',
					outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
					stateMutability: 'view',
					type: 'function',
				},
			];
			args = [];
		} else if (type === 'ERC1155C') {
			// Use totalSupply(uint256 id) for ERC1155
			functionName = 'totalSupply';
			abi = [
				{
					inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
					name: 'totalSupply',
					outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
					stateMutability: 'view',
					type: 'function',
				},
			];
			args = [BigInt(tokenId)];
		} else {
			throw new Error(`Unknown contract type: ${type}`);
		}

		const data = encodeFunctionData({
			abi,
			functionName,
			args,
		});
		const result = await client.call({
			to: contractAddress as `0x${string}`,
			data,
		});
		// result.data is Bytes - parse as BigInt from hex string
		if (result && result.data) {
			let totalSupply: number = 0;
			const hex = Buffer.from(result.data).toString('hex');
			if (hex) {
				totalSupply = Number(BigInt('0x' + hex));
			}
			return isNaN(totalSupply) ? 0 : totalSupply;
		}
		return 0;
	} catch (err) {
		console.warn('Failed to query totalSupply with viem:', err instanceof Error ? err.message : String(err));
		return 0;
	}
}
