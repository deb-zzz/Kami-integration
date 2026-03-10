import { Metadata } from 'next';
import SigilPageComponent from './SigilPageComponent';
import { cachedGetSigilById } from '@/apihandler/Profile';
import { convertIPFSUrl } from '@/lib/Util';

export async function generateMetadata({
	params,
}: {
	params: { sigil_id: string };
}) {
	console.log(params);
	if (params && params.sigil_id) {
		const sigil = await cachedGetSigilById(params?.sigil_id);
		const response = await fetch(convertIPFSUrl(sigil.data.uri)!);
		let sigilData = await response.json();
		const data: Metadata = {
			title: sigilData.name,
			description: sigilData.name,
			openGraph: {
				title: sigilData.name,
				description: sigilData.description,
				type: 'website',
			},
		};

		// console.log(JSON.stringify(data, null, 2));
		return data;
	}
}

export default function SigilPage({
	params,
}: {
	params: { sigil_id: string };
}) {
	return <SigilPageComponent sigilId={params.sigil_id} />;
}
