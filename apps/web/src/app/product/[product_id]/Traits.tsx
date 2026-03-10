import { MetaDataParser } from '@/lib/Util';
import { VoucherMetadata } from '@/types';
import React from 'react';
import { json } from 'stream/consumers';

function Traits({ data }: { data: string }) {
	const traitData = MetaDataParser(data);

	const longestText = traitData.attributes?.toSorted(
		(a, b) => b.trait_type.length - a.trait_type.length,
	)[0]?.trait_type;

	return (
		<div>
			{/* <h1 className='mb-4 text-sm font-semibold'>Traits</h1> */}
			<div className=''>
				{traitData.attributes?.map((d, _) => (
					<div
						key={_}
						className='flex border-separate border px-2 m-2 rounded-e-[4px] resize-y w-full justify-between font-light'
					>
						<div className='flex p-1'>
							<span
								className={`justify-center flex text-center px-4 uppercase text-[10px] align-middle items-center pt-[3px]`}
								style={{
									width: `${
										longestText && longestText.length * 7.5
									}pt`,
								}}
							>
								{d.trait_type}
							</span>
							{/* <span className='flex'>|</span> */}
							<div className='h-full py-[2px]'>
								<div className='w-px h-full bg-[#F1F0EB] shrink-0' aria-hidden />
							</div>
							<span className='justify-start flex px-4 text-[13px]'>
								{d.value}
							</span>
						</div>
						<span className='flex text-end justify-end m-1 text-[13px]'>
							{'100%'}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

export default Traits;

export type Trait = {
	trait_type: string;
	value: string | number;
	display_type: 'string';
};

export type MetaDataType = {
	description: string;
	external_url: string;
	image: string;
	name: string;
	attributes: Trait[];
};
