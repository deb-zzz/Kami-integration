'use client';

import { useEffect } from 'react';

import Image from 'next/image';
import { BundleType } from '@/types';
import { convertIPFSUrl } from '@/lib/Util';
export default function Bundle({
	data,
	chooseBundle,
}: {
	data: BundleType[];
	chooseBundle: (bundle: BundleType) => void;
}) {
	useEffect(() => {}, []);
	// const data = [
	// 	'/product/sticker.png',
	// 	'/product/baju.png',
	// 	'/product/cover.png',
	// 	'/product/doll.png',
	// 	'/product/ticket.png',
	// ];
	return (
		<div>
			<p className='uppercase text-[15px] font-bold text-[#A79755] my-4'>
				: In the box
			</p>
			<div className=' flex flex-row  items-baseline gap-4'>
				{/* <Image
					src={'/product/first.png'}
					alt={'card1'}
					width={170}
					height='0'
					// sizes="100vw"
					className=' object-contain'
				/> */}
				<div className='flex flex-row flex-wrap items-end gap-2'>
					{data.map((item, i) => (
						<Image
							key={i}
							src={
								item?.coverUrl
									? convertIPFSUrl(item.coverUrl) ?? ''
									: convertIPFSUrl(item.url) ?? ''
							}
							alt={item?.name}
							width={170}
							height='0'
							// sizes="100vw"
							className='object-contain max-h-[200px] cursor-pointer hover:scale-105 transition-all duration-300 ease-in-out hover:border-[0.5px] hover:border-[#04FF2C]'
							onClick={() => chooseBundle(item)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
