'use client';

import Image from 'next/image';
import { Button } from '@nextui-org/react';
import { useRouter } from 'next/navigation';

export default function UnauthorizedAccess() {
	const router = useRouter();

	return (
		<div className='flex flex-col items-center justify-center pt-24 bg-transparent px-10'>
			<div className='text-center max-w-md'>
				{/* Logo or Icon */}
				<div className='mb-8'>
					<Image
						src='/kamiLogo.svg'
						alt='Kami Logo'
						width={150}
						height={150}
						className='mx-auto '
					/>
				</div>

				{/* Main Message */}
				<h1 className='text-[32px] text-[#11FF49] font-bold mb-4'>
					Access Restricted
				</h1>

				<p className='text-[18px] text-[#9E9E9D] mb-6 leading-relaxed'>
					You don&apos;t have permission to view this project. Only
					the project creator and invited collaborators can access
					this content.
				</p>

				{/* Action Buttons */}
				<div className='flex flex-col gap-3'>
					<Button
						size='lg'
						className='bg-[#11FF49] text-[#1A1A1A] font-semibold px-8 py-3'
						onClick={() => router.push('/explore')}
					>
						Explore KAMI
					</Button>

					<Button
						size='lg'
						variant='bordered'
						className='border-[#11FF49] text-[#F1F0EB] font-semibold px-8 py-3'
						onClick={() => router.back()}
					>
						Go Back
					</Button>
				</div>

				{/* Additional Info */}
				<div className='mt-8 p-4 bg-[#E8E6E0] rounded-lg'>
					<p className='text-[14px] text-[#6E6E6E]'>
						If you believe you should have access to this project,
						please contact the project creator or check if
						you&apos;ve been invited as a collaborator.
					</p>
				</div>
			</div>
		</div>
	);
}
