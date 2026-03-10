import { prisma } from '@/lib/db';
import { getBlockchainInfo } from '@/lib/gasless-nft';
import { ContractType, KamiNFT, Metadata } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { Chain, formatUnits } from 'viem';

export const maxDuration = 90;

/**
 * GET API handler to retrieve a KamiNFT by collection ID and token ID.
 * Also accepts optional walletAddress to fetch balance for that wallet.
 *
 * Steps:
 *  - Validates input parameters.
 *  - Fetches collection and asset from DB.
 *  - Loads metadata (from IPFS if needed).
 *  - Builds and returns the KamiNFT object in the response.
 *
 * @param {NextRequest} request - HTTP request containing collectionId, tokenId, walletAddress.
 * @returns {Promise<NextResponse>} KamiNFT object or error details.
 */
export async function GET(request: NextRequest): Promise<NextResponse<KamiNFT | { success: false; error: string }>> {
	const collectionId = request.nextUrl.searchParams.get('collectionId');
	const tokenId = request.nextUrl.searchParams.get('tokenId');
	const walletAddress = request.nextUrl.searchParams.get('walletAddress');

	if (!collectionId || isNaN(Number(collectionId))) {
		return NextResponse.json({ success: false, error: 'Collection ID is required and must be a number' }, { status: 400 });
	}
	if (!tokenId || isNaN(Number(tokenId))) {
		return NextResponse.json({ success: false, error: 'Token ID is required and must be a number' }, { status: 400 });
	}

	try {
		const collection = await prisma.collection.findUnique({
			where: { collectionId: Number(collectionId) },
		});
		if (!collection) {
			return NextResponse.json({ success: false, error: 'Collection not found' }, { status: 404 });
		}

		const asset = await prisma.asset.findFirst({
			where: { collectionId: Number(collectionId), tokenId: tokenId.trim() },
		});
		if (!asset) {
			return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
		}
		if (asset.contractAddress !== collection.contractAddress) {
			return NextResponse.json(
				{ success: false, error: 'Asset contract address does not match collection contract address' },
				{ status: 400 }
			);
		}

		let metadata = asset.metadata;
		if (asset.metadataURI && asset.metadataURI.startsWith('ipfs://')) {
			metadata = await getMetadataFromIPFS(asset.metadataURI);
		}

		return NextResponse.json(
			await getNFT(
				collection.chainId,
				collection.contractType,
				collection.contractAddress,
				metadata as Metadata,
				asset.availableQuantity,
				walletAddress || undefined
			)
		);
	} catch (error) {
		console.error('Error getting metadata from IPFS:', error);
		return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
	}
}

/**
 * Retrieves NFT metadata JSON from IPFS via fetch.
 * Accepts only 'ipfs://' URIs and converts them to HTTP gateway URLs.
 *
 * @param {string} metadataURI - The IPFS URI to fetch.
 * @returns {Promise<Metadata>} The parsed metadata object.
 */
async function getMetadataFromIPFS(metadataURI: string) {
	// Convert ipfs:// URL to HTTP gateway URL
	const httpURL = metadataURI.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${metadataURI.replace('ipfs://', '')}` : metadataURI;

	const response = await fetch(httpURL);
	if (!response.ok) {
		throw new Error(`Failed to fetch metadata from IPFS: ${response.status} ${response.statusText}`);
	}
	const metadata = await response.json();
	return metadata;
}

/**
 * Assembles a KamiNFT object from database metadata, formatting IPFS links and querying on-chain balance if a wallet address is provided.
 *
 * - Ensures required contract_address and token_id present.
 * - Optionally fetches balance from blockchain for the provided wallet.
 * - Fixes up IPFS image/animation/bundle URLs to public gateways.
 *
 * @param {string} chainId - Blockchain chain ID.
 * @param {ContractType} type - Contract type ("ERC721C", etc).
 * @param {string} contractAddress - The NFT contract address.
 * @param {Metadata} metadata - NFT metadata.
 * @param {number} totalSupply - Total token supply (from database).
 * @param {string} [walletAddress] - Wallet for which to fetch balance.
 * @returns {Promise<KamiNFT>} The formatted KamiNFT object.
 */
async function getNFT(
	chainId: string,
	type: ContractType,
	contractAddress: string,
	metadata: Metadata,
	totalSupply: number,
	walletAddress?: string
): Promise<KamiNFT> {
	if (!contractAddress) throw new Error('Contract address is required');
	if (!metadata.token_id) throw new Error('Token ID is required');
	const balance = walletAddress ? await getBalance(chainId, contractAddress, metadata.token_id, type, walletAddress) : 0;
	const nftTotalSupply = await getTotalSupply(chainId, contractAddress, metadata.token_id, type);
	const nft: KamiNFT = {
		type,
		name: metadata.name,
		description: metadata.description || '',
		image: metadata.image.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${metadata.image.replace('ipfs://', '')}` : metadata.image,
		token_id: metadata.token_id,
		contract_address: contractAddress,
		chain_id: chainId,
		total_supply: nftTotalSupply ? formatUnits(BigInt(nftTotalSupply), 0) : totalSupply ? formatUnits(BigInt(totalSupply), 0) : '0',
		balance: balance ? formatUnits(BigInt(balance), 0) : '0',
		animation_url: metadata.animation_url?.startsWith('ipfs://')
			? `https://ipfs.io/ipfs/${metadata.animation_url.replace('ipfs://', '')}`
			: metadata.animation_url,
		attributes: metadata.attributes || [],
		properties: metadata.properties
			? {
					...metadata.properties,
					bundle: metadata.properties.bundle?.map((b) => ({
						uri: b.uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${b.uri.replace('ipfs://', '')}` : b.uri,
						type: b.type,
						name: b.name,
						description: b.description,
						cover_url: b.cover_url?.startsWith('ipfs://')
							? `https://ipfs.io/ipfs/${b.cover_url.replace('ipfs://', '')}`
							: b.cover_url,
						owner_description: b.owner_description,
						category: b.category,
					})),
			  }
			: undefined,
	};
	return nft;
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
	if (!blockchainInfo) throw new Error('Blockchain info not found');

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
