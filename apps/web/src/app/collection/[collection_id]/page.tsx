import { Metadata } from 'next';
import { cachedGetProduct } from '@/apihandler/Post';
import CollectionPageComponent from './CollectionPageComponent';
import { cachedGetACollection } from '@/apihandler/Collections';

export async function generateMetadata({
	params,
}: {
	params: { collection_id: string };
}) {
	if (params && params.collection_id) {
		const collection = await cachedGetACollection(
			Number(params?.collection_id)
		);
		const data: Metadata = {
			title: collection.name,
			description: collection.description,
			openGraph: {
				title: collection.name,
				description: collection.description,
				images: [
					{
						url: collection.avatarUrl ?? '',
						alt: collection.name,
						secureUrl: collection.avatarUrl ?? '',
					},
				],
				type: 'website',
			},
		};

		// console.log(JSON.stringify(data, null, 2));
		return data;
	}
}

export default function Collection({
	params,
}: {
	params: { collection_id: string };
}) {
	return <CollectionPageComponent colelctionId={params.collection_id} />;
}
