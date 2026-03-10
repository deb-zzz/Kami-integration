import { getBlockchainInfo, getPlatformInfo, setKamiNFTPrice, validateChainId } from '@/lib/gasless-nft';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 90;

/**
 * API route handler for setting the price of a KAMI NFT token.
 *
 * Expects a JSON POST request with the following fields in the body:
 * - chainId: the blockchain network ID (number or string).
 * - contractAddress: the address of the ERC721/ERC1155 contract (string).
 * - contractType: the type of contract, e.g. 'ERC721' or 'ERC1155' (string).
 * - tokenId: the NFT token ID whose price will be updated (number or string).
 * - price: the new price for the NFT (number or string, depending on implementation).
 *
 * Utilizes credentials from environment variables:
 * - process.env.PRIVATE_KEY: the owner's private key.
 * - process.env.SIMPLE_ACCOUNT_ADDRESS: the corresponding account address.
 *
 * Calls the setKamiNFTPrice function to update the price on-chain.
 *
 * @param request {NextRequest} - The incoming API route request object (must contain JSON body).
 * @returns {NextResponse<{success: boolean}>} - JSON response indicating whether the price was successfully set.
 */
export async function POST(request: NextRequest) {
	const { chainId, contractAddress, contractType, tokenId, price } = await request.json();
	try {
		const cid = `0x${Number(chainId).toString(16)}` as `0x${string}`;
		
		// Validate chainId exists in blockchain table
		const isValidChainId = await validateChainId(cid);
		if (!isValidChainId) {
			const errorMsg = `Invalid chainId: ${cid}. ChainId must exist in the blockchain table.`;
			console.error(errorMsg);
			return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
		}
		
		const blockchainInfo = await getBlockchainInfo(cid);
		if (!blockchainInfo) {
			throw new Error(`Blockchain not found: ${cid}`);
		}
		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			throw new Error(`Platform info not found: ${cid}`);
		}

		const success = await setKamiNFTPrice(cid, contractAddress as `0x${string}`, contractType, Number(tokenId), price, {
			ownerPrivateKey: process.env.PRIVATE_KEY as `0x${string}`,
			simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
		});
		return NextResponse.json({ success });
	} catch (error) {
		console.error('Error setting token price:', error instanceof Error ? error.message : error);
		return NextResponse.json(
			{ success: false, error: `Error setting token price: ${(error as Error).message ?? error}` },
			{ status: 500 }
		);
	}
}
