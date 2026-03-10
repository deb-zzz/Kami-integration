'use client';
import Image from 'next/image';
import Logo from '../../public/kamiLogo.svg';
import Cube from '../../public/cube.svg';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Onboarding() {
	const router = useRouter();
	return (
		<main className='flex min-h-screen flex-col  bg-black py-14'>
			<div className='px-14'>
				<Image src={Logo} alt={'logo'} className='w-[10%]' />
				<p className='text-white text-[40px] font-normal mt-5'>Create. Collaborate. Monetize.</p>
			</div>
			<div className='flex flex-col lg:flex-row  h-full px-10 '>
				<div className=' lg:flex-1 '>
					<div className='w-full flex justify-center'>
						<Image src={Cube} alt={'logo'} />
					</div>
				</div>
				<div className='lg:flex-[1.2]'>
					<p className='text-white text-[30px]  font-semibold  mt-5'>Login / Signup</p>
					<div className='pt-5 hidden md:block'>{/* <KamiWalletComponent /> */}</div>
					<div className='pt-5 md:hidden'>{/* <KamiWalletComponent isMobile={true} /> */}</div>
					<div className='w-full flex justify-end '>
						<button type='button' className='p-3 rounded-md mt-5 bg-white ' onClick={() => router.push('/home')}>
							{'Home --->'}
						</button>
					</div>
				</div>
			</div>
		</main>
	);
}
