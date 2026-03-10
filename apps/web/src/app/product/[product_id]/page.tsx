import { Metadata } from 'next';
import { cachedGetProduct } from '@/apihandler/Post';
import ProductPageComponent from './ProductPageComponent';

export async function generateMetadata({
	params,
}: {
	params: { product_id: string };
}) {
	if (params && params.product_id) {
		const product = await cachedGetProduct(Number(params?.product_id));
		// console.log(JSON.stringify(post, null, 2));
		const data: Metadata = {
			title: product.name,
			description: product.description,
			openGraph: {
				title: product.name,
				description: product.description,
				images: [
					{
						url: product.voucher?.mediaUrl ?? '',
						alt: product.name,
						secureUrl: product.voucher?.mediaUrl ?? '',
					},
				],
				type: 'website',
			},
		};

		// console.log(JSON.stringify(data, null, 2));
		return data;
	}
}

export default function Product({
	params,
	searchParams,
}: {
	params: { product_id: string };
	searchParams?: { asset?: string };
}) {
	return (
		<ProductPageComponent
			productId={params.product_id}
			assetId={searchParams?.asset}
		/>
	);
}
