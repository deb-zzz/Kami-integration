import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getBlockchainInfo, getOwnerPrivateKey, getPlatformInfo, setKamiNFTPrice } from '@/lib/gasless-nft';
import { recordActivity } from '@/lib/record-activity';
import { createPublicClient, http, type Chain } from 'viem';

export const maxDuration = 90;

export async function POST(request: NextRequest, { params }: { params: { assetId: string } }) {
	const { assetId } = params;
	const { price } = await request.json();

	try {
		const asset = await prisma.asset.findUnique({
			where: { id: Number(assetId) },
			include: { collection: true },
		});
		if (!asset) {
			console.error(`Set Price: Asset not found: ${assetId}`);
			return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
		}

		if (!asset.collection) {
			console.error(`Set Price: Asset ${assetId} is not associated with a collection`);
			return NextResponse.json({ error: 'Asset is not associated with a collection' }, { status: 400 });
		}

		const chainId = asset.collection.chainId;
		const blockchainInfo = await getBlockchainInfo(chainId);
		if (!blockchainInfo) {
			console.error(`Set Price: Blockchain not found: ${chainId}`);
			return NextResponse.json({ error: 'Blockchain not found' }, { status: 404 });
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			console.error(`Set Price: Platform not found: ${blockchainInfo.chainId}`);
			return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
		}

		// For ERC721C and ERC721AC, verify the wallet owns the token on-chain before updating DB or setting price.
		if (asset.contractType === 'ERC721C' || asset.contractType === 'ERC721AC') {
			try {
				const client = createPublicClient({
					chain: blockchainInfo.blockchain as unknown as Chain,
					transport: http(blockchainInfo.rpcUrl),
				});

				const onChainOwner = await client.readContract({
					address: asset.contractAddress as `0x${string}`,
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
					args: [BigInt(Number(asset.tokenId))],
				});

				const ownerAddress = String(onChainOwner).toLowerCase();
				const assetWalletAddress = asset.walletAddress.toLowerCase();

				if (ownerAddress !== assetWalletAddress) {
					console.warn(
						`Set Price: Wallet ${asset.walletAddress} does not own token ${asset.tokenId} on-chain. On-chain owner: ${onChainOwner}.`
					);
					return NextResponse.json({ error: 'Wallet does not own this NFT on-chain' }, { status: 403 });
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				console.error(`Set Price: Error verifying token ownership: ${message}`);
				// ownerOf reverts with 0x7e273289 (QueryForNonexistentToken / ERC721NonexistentToken) when token doesn't exist
				const isNonexistentToken =
					typeof message === 'string' &&
					(message.includes('0x7e273289') || (message.includes('reverted') && message.includes('ownerOf')));
				return NextResponse.json(
					{
						error: isNonexistentToken
							? 'Token does not exist on-chain (not minted or invalid token id)'
							: 'Could not verify token ownership',
					},
					{ status: 403 }
				);
			}
		}

		const updatedAsset = await prisma.asset.update({
			where: { id: Number(assetId) },
			data: { price },
		});

		if (!updatedAsset) {
			console.error(`Set Price: Failed to update asset ${assetId}`);
			return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
		}

		const ownerPrivateKey = await getOwnerPrivateKey(asset.walletAddress);
		if (!ownerPrivateKey) {
			console.error(`Set Price: Owner private key not found: ${asset.walletAddress}`);
			return NextResponse.json({ error: 'Owner private key not found' }, { status: 404 });
		}

		const success = await setKamiNFTPrice(
			blockchainInfo.chainId as `0x${string}`,
			asset.contractAddress as `0x${string}`,
			asset.contractType,
			Number(asset.tokenId),
			price,
			{
				ownerPrivateKey: ownerPrivateKey as `0x${string}`,
				simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
			}
		);

		if (!success) {
			console.error(`Set Price: Failed to set price for asset ${assetId}, rolling back DB`);
			await prisma.asset.update({
				where: { id: Number(assetId) },
				data: { price: asset.price },
			});
			return NextResponse.json({ error: 'Failed to set price' }, { status: 500 });
		}

		await recordActivity({
			walletAddress: asset.walletAddress,
			entityType: 'Asset',
			entityId: asset.productId != null ? String(asset.productId) : String(assetId),
			entitySubType: 'SetPrice',
			payload: { assetId: Number(assetId), price: updatedAsset.price?.toString() },
		});

		return NextResponse.json({ success: true, asset: updatedAsset }, { status: 200 });
	} catch (error) {
		console.error(`Set Price: Error: ${error instanceof Error ? error.message : error}`);
		return NextResponse.json({ error: `Failed to set price: ${error instanceof Error ? error.message : error}` }, { status: 500 });
	}
}
