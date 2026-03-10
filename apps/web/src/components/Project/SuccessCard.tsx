'use client';

import { useLazyNFT } from '@/lib/VoucherContext';
import { Modal, ModalBody, ModalContent } from '@nextui-org/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Dispatch, SetStateAction } from 'react';

const SuccessCard = ({
	projectId,
	collectionId,
	isOpen,
	setIsOpen,
	reset,
	setCreateIsOpen,
}: {
	projectId: number;
	collectionId: number;
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	reset: () => void;
	setCreateIsOpen: Dispatch<SetStateAction<boolean>>;
}) => {
	const [voucher, setVoucher, newItemVoucher] = useLazyNFT();
	const data = [
		{
			backgroundImage: '/publish/success1.png',
			message: 'You are legendary...',
			signature: '/publish/moo.png',
			designation: 'FOUNDER',
		},
		{
			backgroundImage: '/publish/success2.png',
			message: 'I have a good feeling about that piece...',
			signature: '/publish/moo.png',
			designation: 'FOUNDER',
		},
		{
			backgroundImage: '/publish/success3.png',
			message: 'That was an absolute masterpiece...',
			signature: '/publish/kheng.png',
			designation: 'CO-FOUNDER',
		},
		{
			backgroundImage: '/publish/success4.png',
			message: 'Time to pop the champagne...',
			signature: '/publish/kheng.png',
			designation: 'CO-FOUNDER',
		},
	];
	const index = Math.floor(Math.random() * 4);

	const router = useRouter();

	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={() => {
				setIsOpen(!isOpen);
			}}
			onClose={() => {
				newItemVoucher();
			}}
			backdrop='opaque'
			className='bg-transparent shadow-none rounded-none p-0 m-0 min-h-[60dvh] h-[80dvh] w-[80vw] '
			classNames={{
				closeButton:
					'top-0 -right-4 border-white border-2 text-white hover:bg-black hidden',
				body: '',
				backdrop: '',
				wrapper: 'w-full p-0',
				base: ' overflow-y-visible',
			}}
			size='full'
			isDismissable={false}
		>
			<ModalContent>
				<ModalBody className=''>
					<div
						className='h-full w-full flex flex-row p-2'
						style={{
							backgroundImage: `url(${data[index].backgroundImage})`,
							backgroundSize: 'cover',
							backgroundPosition: 'top',
						}}
					>
						{/* <Image
							src={data[index].backgroundImage}
							alt='success'
							layout='fill'
							objectFit='cover'
						/> */}
						<div className='w-2/4' />
						<div className='w-2/4 flex flex-col justify-center items-center'>
							<div className='w-[400px] h-[100px] relative'>
								<Image
									className='object-contain'
									alt='mute'
									draggable='false'
									layout='fill'
									src={'/publish/congrats.png'}
								/>
							</div>
							<p className='text-[20px] italic'>
								{data[index].message}
							</p>
							<div className='flex flex-row items-end my-10'>
								<div className='w-[100px] h-[50px] relative'>
									<Image
										className='object-contain'
										alt='mute'
										draggable='false'
										layout='fill'
										src={data[index].signature}
									/>
								</div>
								<p>{data[index].designation}</p>
							</div>
							<div className='flex flex-col gap-4 w-3/4 mt-10'>
								<div
									className='w-full p-2 rounded-lg bg-[#11FF49] cursor-pointer animate-pulse'
									onClick={() => {
										setIsOpen(false);
										setCreateIsOpen(true);
										newItemVoucher();
										// router.push(
										// 	`/collection/${collectionId}`
										// );
									}}
								>
									<p className='text-[18px] text-[#1A1A1A] font-semibold text-center select-none '>
										Now, share it with the world!
									</p>
								</div>
								{/* <div className='w-full p-2 rounded-lg border border-[#F1F0EB]'>
									<p
										className='text-[18px] font-semibold text-center select-none cursor-pointer'
										onClick={() => {
											newItemVoucher();

											reset();
										}}
									>
										Publish another product
									</p>
								</div> */}
							</div>
						</div>
					</div>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
};

export default SuccessCard;
