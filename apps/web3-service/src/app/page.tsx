'use client';

// import { ConnectWallet, useAddress, useDisconnect } from '@thirdweb-dev/react';
import { useEffect } from 'react';

export default function Home() {
	// const address = useAddress();
	// // const contract = useContract()
	// const disconnect = useDisconnect();
	// useEffect(() => {
	// 	disconnect();
	// }, [disconnect]);

	return (
		<div className='grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]'>
			<main className='flex flex-col gap-8 row-start-2 items-center sm:items-start'>
				{/* <ConnectWallet /> */}
				{/* {address} */}
			</main>
		</div>
	);
}
