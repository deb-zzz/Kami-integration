import { Metadata } from 'next';
import ProfilePageComponent from './ProfilePageComponent';
import { cachedGetProfile } from '@/apihandler/Profile';

export async function generateMetadata({
	params,
}: {
	params: { wallet: string };
}) {
	if (params && params.wallet) {
		const prf = await cachedGetProfile(params?.wallet);
		// console.log(JSON.stringify(post, null, 2));
		if (prf.success) {
			const data: Metadata = {
				title: prf.profile.userName,
				description: (prf.profile.tagLine ?? '').replace(
					/<[^>]+>/g,
					''
				),
				openGraph: {
					title: prf.profile.userName,
					description: (prf.profile.tagLine ?? '').replace(
						/<[^>]+>/g,
						''
					),
					images: [
						{
							url: prf.profile.avatarUrl ?? '',
							alt: prf.profile.userName,
							secureUrl: prf.profile.avatarUrl ?? '',
						},
					],
					type: 'website',
				},
			};
			return data;
		}
	}
}

export default function ProfilePage({
	params,
}: {
	params: { wallet: string };
}) {
	return <ProfilePageComponent walletAddress={params.wallet} />;
}
