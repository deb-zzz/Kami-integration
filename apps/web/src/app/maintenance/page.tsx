'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function MaintenancePage() {
	const [dots, setDots] = useState('');

	// Animated dots effect
	useEffect(() => {
		const interval = setInterval(() => {
			setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
		}, 500);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className='min-h-screen w-full bg-[#1a1a1a] flex items-center justify-center p-4'>
			<div className='max-w-2xl w-full text-center space-y-8'>
				{/* Logo */}
				<div className='flex justify-center mb-8'>
					<Image src='maintenance/kamiLogo.svg' alt='KAMI Logo' width={120} height={120} priority />
				</div>

				{/* Main Heading */}
				<div className='space-y-4'>
					<h1 className='text-4xl md:text-5xl font-bold text-[#f1f0eb]'>We&apos;ll Be Back Soon</h1>
					<div className='flex items-center justify-center gap-2'>
						<div className='h-1 w-12 bg-[#11FF49] rounded-full'></div>
						<div className='h-1 w-12 bg-[#11FF49] rounded-full opacity-50'></div>
						<div className='h-1 w-12 bg-[#11FF49] rounded-full opacity-25'></div>
					</div>
				</div>

				{/* Description */}
				<div className='space-y-4 text-[#f1f0eb] opacity-80'>
					<p className=' flex items-center justify-center flex-wrap'>
						<span className='text-[22px]'>KAMI is currently undergoing scheduled maintenance</span>
						<span className='inline-block w-6 text-left text-[22px]'>{dots}</span>
					</p>
					<p className='text-sm md:text-base text-[#afab99]'>
						We&apos;re working hard to improve your experience. We&apos;ll be back up and running shortly.
					</p>
				</div>

				{/* Status Badge */}
				<div className='flex justify-center'>
					<div className='inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#11FF49] bg-opacity-10 border border-[#11FF49] border-opacity-30'>
						<div className='relative flex h-3 w-3'>
							<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-[#11FF49] opacity-75'></span>
							<span className='relative inline-flex rounded-full h-3 w-3 bg-[#11FF49]'></span>
						</div>
						<span className='text-[#11FF49] font-medium text-sm'>Maintenance in Progress</span>
					</div>
				</div>

				{/* Information Cards */}
				<div className='grid md:grid-cols-3 gap-4 mt-12 pt-8 border-t border-[#333]'>
					<div className='space-y-2 p-4 rounded-lg bg-[#222] border border-[#333]  transition-colors'>
						<div className='text-2xl'>⏱️</div>
						<h3 className='text-[#f1f0eb] font-semibold text-sm'>Estimated Time</h3>
						<p className='text-[#afab99] text-xs'>1-2 hours</p>
					</div>

					<div className='space-y-2 p-4 rounded-lg bg-[#222] border border-[#333]  transition-colors'>
						<div className='text-2xl'>🔧</div>
						<h3 className='text-[#f1f0eb] font-semibold text-sm'>What We&apos;re Doing</h3>
						<p className='text-[#afab99] text-xs'>System upgrades</p>
					</div>

					<div className=' space-y-2 p-4 rounded-lg bg-[#222] border border-[#333]  transition-colors'>
						<div className='text-2xl'>💬</div>
						<h3 className='text-[#f1f0eb] font-semibold text-sm'>Need Help?</h3>
						<a href='mailto:support@kamiunlimited.com' className='text-[#afab99] text-xs hover:underline inline-block'>
							Contact support
						</a>
					</div>
				</div>

				{/* Footer Message */}
				<div className='mt-8 pt-8 border-t border-[#333]'>
					<p className='text-[#afab99] text-xs'>Thank you for your patience. Follow us on social media for updates.</p>
				</div>
			</div>
		</div>
	);
}
