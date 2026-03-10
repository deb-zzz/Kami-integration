'use client';
import { getProfile } from '@/apihandler/Profile';
import ProfileTab from '@/app/profile/[wallet]/profile';
import { useGlobalState } from '@/lib/GlobalContext';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import useKamiWallet from '@/lib/KamiWalletHook';

function Onboarding() {
	const wallet = useKamiWallet();
	const router = useRouter();

	useEffect(() => {
		const w = wallet?.getAccount();
		if (w?.address) data(w.address);
	}, [wallet?.getAccount()]);

	const data = async (address: string) => {
		const data = await getProfile(address);
		if (data.success && data.profile) {
			router.replace('/profile/' + address);
		}
	};

	return (
		<div className='p-5'>
			<ProfileTab walletAddress={wallet?.getAccount()?.address} onProfileChange={(edit) => {}} bannerFile={undefined} />
		</div>
	);
}

export default Onboarding;
