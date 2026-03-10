import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getBlockchainInfo, getOwnerPrivateKey, getPlatformInfo, setKamiNFTPrice } from '@/lib/gasless-nft';
import { createPublicClient, http, type Chain } from 'viem';

export const maxDuration = 90;

export async function POST(request: NextRequest, { params }: { params: { productId: string } }) {
	const { productId } = params;
	const { price, currency } = await request.json();

	try {
		const product = await prisma.product.findUnique({
			where: { id: Number(productId) },
			include: {
				collection: true,
				voucher: true,
				asset: true,
			},
		});
		if (!product) {
			console.error(`Set Price: Product not found: ${productId}`);
			return NextResponse.json({ error: 'Product not found' }, { status: 404 });
		}

		if (!product.collection) {
			console.error(`Set Price: Product ${productId} is not associated with a collection`);
			return NextResponse.json({ error: 'Product is not associated with a collection' }, { status: 400 });
		}

		if (!product.asset && !product.voucher) {
			console.error(`Set Price: Product ${productId} is not associated with an asset or voucher`);
			return NextResponse.json({ error: 'Product is not associated with an asset or voucher' }, { status: 400 });
		}

		const updatedProduct = await prisma.product.update({
			where: { id: Number(productId) },
			data: { price: price, currencySymbol: currency },
		});

		if (!updatedProduct) {
			console.error(`Set Price: Failed to update product ${productId}`);
			return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
		}

		const blockchainInfo = await getBlockchainInfo(product.collection.chainId);
		if (!blockchainInfo) {
			console.error(`Set Price: Blockchain not found: ${product.collection.chainId}`);
			return NextResponse.json({ error: 'Blockchain not found' }, { status: 404 });
		}

		const platformInfo = await getPlatformInfo(blockchainInfo.chainId);
		if (!platformInfo) {
			console.error(`Set Price: Platform not found: ${blockchainInfo.chainId}`);
			return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
		}

		// For KAMI721C (single asset per product), set on-chain price
		// For KAMI721AC (multiple assets), price is set at product level only
		// For KAMI721AC, we need to verify token ownership before setting price
		const firstAsset = product.asset?.[0];
		if (firstAsset && product.asset.length === 1) {
			// For KAMI721AC, verify that the wallet actually owns the token on-chain
			if (firstAsset.contractType === 'ERC721AC') {
				try {
					const client = createPublicClient({
						chain: blockchainInfo.blockchain as unknown as Chain,
						transport: http(blockchainInfo.rpcUrl),
					});

					const onChainOwner = await client.readContract({
						address: firstAsset.contractAddress as `0x${string}`,
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
						args: [BigInt(Number(firstAsset.tokenId))],
					});

					const ownerAddress = String(onChainOwner).toLowerCase();
					const assetWalletAddress = firstAsset.walletAddress.toLowerCase();

					if (ownerAddress !== assetWalletAddress) {
						console.warn(
							`Set Price: Wallet ${firstAsset.walletAddress} does not own token ${firstAsset.tokenId} on-chain. On-chain owner: ${onChainOwner}. Skipping on-chain price update.`
						);
						// For KAMI721AC, if the wallet doesn't own the token, we skip setting the on-chain price
						// The product price is still updated in the database
						return NextResponse.json(
							{ success: true, product: updatedProduct, warning: 'On-chain price not set: wallet does not own token' },
							{ status: 200 }
						);
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					console.error(`Set Price: Error verifying token ownership: ${message}`);
					const isNonexistentToken =
						typeof message === 'string' &&
						(message.includes('0x7e273289') || (message.includes('reverted') && message.includes('ownerOf')));
					const warning = isNonexistentToken
						? 'On-chain price not set: token does not exist on-chain (not minted or invalid token id)'
						: 'On-chain price not set: could not verify token ownership';
					return NextResponse.json({ success: true, product: updatedProduct, warning }, { status: 200 });
				}
			}

			const ownerPrivateKey = await getOwnerPrivateKey(firstAsset.walletAddress);
			if (!ownerPrivateKey) {
				console.error(`Set Price: Owner private key not found: ${firstAsset.walletAddress}`);
				return NextResponse.json({ error: 'Owner private key not found' }, { status: 404 });
			}
			const success = await setKamiNFTPrice(
				blockchainInfo.chainId as `0x${string}`,
				firstAsset.contractAddress as `0x${string}`,
				firstAsset.contractType,
				Number(firstAsset.tokenId),
				price,
				{
					ownerPrivateKey: ownerPrivateKey as `0x${string}`,
					simpleAccountAddress: platformInfo.simpleAccountAddress as `0x${string}`,
				}
			);
			if (!success) {
				console.error(`Set Price: Failed to set price for product ${productId}`);
				return NextResponse.json({ error: 'Failed to set price' }, { status: 500 });
			}
		}

		return NextResponse.json({ success: true, product: updatedProduct }, { status: 200 });
	} catch (error) {
		console.error(`Set Price: Error: ${error instanceof Error ? error.message : error}`);
		return NextResponse.json({ error: `Failed to set price: ${error instanceof Error ? error.message : error}` }, { status: 500 });
	}
}
