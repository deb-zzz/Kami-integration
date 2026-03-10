'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';
import { getACollection } from '@/apihandler/Collections';
import { useGlobalState } from '@/lib/GlobalContext';
import { CollectionType } from '@/types';
import { FallbackImage } from '@/components/FallbackImage';
import Link from 'next/link';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { numberFormat } from '@/lib/Util';

type DataType = {
	id: string;
	price: string | null;
	isRent: boolean;
	isBuy: boolean;
	image: string;
};
export default function CollectionSuggestion({
	collectionData,
	router,
	currentId,
}: {
	collectionData: CollectionType;
	router: AppRouterInstance;
	currentId: string;
}) {
	//checkout how to solve this
	const imgError = (i: number) => {
		if (collectionData?.products && collectionData.products[i]) {
			collectionData.products[i].imageUrl = '/emptyState/emptyimg1.svg';
		}
	};

	return (
		<div className='flex flex-col h-full  '>
			<p className='capitalize text-[16px] font-bold  mb-4'>
				More from this Collection:
			</p>
			<div className='flex-1 scrollbar-thumb-rounded-3xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-600  overflow-auto'>
				{collectionData?.products &&
					collectionData.products
						.filter((val) => val.productId !== Number(currentId))

						.map((item, i) => (
							<div
								key={i}
								className='flex flex-row  mb-5 gap-6 cursor-pointer'
								onClick={() =>
									router.push('/product/' + item.productId)
								}
							>
								<Image
									key={i}
									src={item.imageUrl!}
									alt={item.name}
									width='80'
									height='80'
									className='w-[80px] h-[80px] object-cover'
									onError={() => imgError(i)}

									// sizes="100vw"
								/>

								{/* 
							do we want this 
							<FallbackImage
								key={i}
								src={item.imageUrl!}
								alt={item.name}
								width={80}
								height={80}
								className='w-[80px] h-[80px] object-cover'
							/> */}
								<div className='w-[50%] flex flex-col gap-2'>
									<p className='line-clamp-2'> {item.name}</p>
									<p className='font-bold'>
										{numberFormat(Number(item.price), 2)}{' '}
										USDC
									</p>
									{/* {(item.isBuy || item.isRent) && (
								<div className='flex flex-row w-full border border-[#F1F0EB] rounded-md '>
									<div
										className='flex-[0.7] flex items-center justify-center bg-transparent cursor-pointer py-[3px] '
										onClick={() => console.log('buy now')}
									>
										<p className='text-[14px] font-bold'>
											{item.isBuy
												? 'Buy Now'
												: item.isRent
												? 'Rent Now'
												: ''}
										</p>
									</div>
									<div
										className='bg-[#F1F0EB] cursor-pointer  flex-[0.3] flex items-center justify-center'
										onClick={() =>
											console.log('add to cart')
										}
									>
										<Image
											src={'/cartBlack.svg'}
											alt={'cart'}
											width={18}
											height={18}
										/>
									</div>
								</div>
							)} */}
								</div>
							</div>
						))}
			</div>

			<Link href={'/collection/' + collectionData.collectionId}>
				<div className=' bg-transparent cursor-pointer py-2 mt-2 rounded-md w-full border border-[#F1F0EB]'>
					<p className=' text-center  text-[#F1F0EB]'>
						View Collection
					</p>
				</div>
			</Link>
		</div>
	);
}
