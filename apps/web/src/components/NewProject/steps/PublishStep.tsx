'use client';
import { useState } from 'react';
import Image from 'next/image';
import PlatformFeeCalculator from '@/components/PlatformFeeCalculator';
import { useLazyNFT } from '@/lib/VoucherContext';
import { Button } from '@nextui-org/react';

type PublishStepProps = {
	isActionDisabled: boolean;
};

type ProductType = {
	id: number;
	title: string;
	description: string;
	examples: string[];
	cardCount: number;
	showIds: boolean;
	showText?: string;
};

const productTypes: ProductType[] = [
	{
		id: 1,
		title: 'Type - 1',
		description: `Single copy,\n single ID`,
		examples: ['Unique 1/1', 'First piece in the world', 'Generative Art'],
		cardCount: 1,
		showIds: false,
	},

	{
		id: 2,
		title: 'Type - 2',
		description: `Multiple copies,\n multiple IDs`,
		examples: ['VIP memberships', 'Event tickets', 'Limited editions'],
		cardCount: 3,
		showIds: true,
	},
];

export default function PublishStep({ isActionDisabled }: PublishStepProps) {
	const [selectedType, setSelectedType] = useState<number>(1);

	const handleTypeSelect = (typeId: number) => {
		if (!isActionDisabled) {
			setSelectedType(typeId);
		}
	};

	const [voucher, setVoucher] = useLazyNFT();

	return (
		<div className='w-full flex flex-col gap-8 -mt-2'>
			<div>
				<div className='mb-8'>
					<h2 className='text-[#F1F0EB] text-[20px] font-semibold'>
						Select Product Type
					</h2>
				</div>

				<div className='flex flex-row gap-6'>
					{productTypes.map((type) => {
						const isSelected = selectedType === type.id;
						return (
							<div
								key={type.id}
								onClick={() => handleTypeSelect(type.id)}
								className={`flex-1 flex flex-col gap-6 p-6 rounded-lg border-2 transition-all ${
									isSelected
										? 'border-[#11FF49] bg-[#11FF49]/5'
										: 'border-[#9E9E9D]/30 bg-transparent'
								} ${
									isActionDisabled
										? 'cursor-default opacity-50'
										: 'cursor-pointer hover:border-[#11FF49]/50'
								}`}
							>
								<div className='flex flex-row justify-between'>
									{/* Title */}
									<h3 className='text-2xl font-light text-[#F1F0EB]'>
										{type.title}
									</h3>

									{/* Description */}
									<p className='text-[#A79755] text-[16px] font-medium whitespace-pre-line'>
										{type.description}
									</p>
								</div>
								{/* For Products like */}
								<div className='flex flex-col gap-1'>
									<p className='text-[#F1F0EB] text-[14px] font-semibold'>
										For Products like:
									</p>
									<ul className='flex flex-col gap-1'>
										{type.examples.map((example, index) => (
											<li
												key={index}
												className='text-[#F1F0EB] text-[14px] font-extralight'
											>
												: {example}
											</li>
										))}
									</ul>
								</div>

								{/* Visual Sample */}
								<div className='flex flex-col items-center gap-4 mt-auto'>
									<div className='relative w-full flex  items-center '>
										{type.id === 1 ? (
											// Single card
											<div className='relative border-[1.5px] h-[100px] px-3 border-[#F1F0EB] rounded-md flex items-center justify-center bg-transparent'>
												<Image
													src='/publish/mask.svg'
													alt='Mask card'
													width={45}
													height={45}
													className='opacity-80'
												/>
											</div>
										) : (
											// Multiple cards side by side with IDs
											<div className='flex flex-row gap-4 items-end justify-center'>
												{Array.from({
													length: type.cardCount,
												}).map((_, index) => (
													<div
														key={index}
														className='flex flex-col items-center gap-2'
													>
														<div className='border-[1.5px] h-[100px] px-3 border-[#F1F0EB] rounded-md  flex flex-col gap-2 items-center justify-center bg-transparent'>
															<Image
																src='/publish/mask.svg'
																alt='Mask card'
																width={45}
																height={45}
																className='opacity-80'
															/>
															{type.showIds && (
																<p className='text-[#A79755] text-[12px] font-medium'>
																	#
																	{String(
																		index +
																			1
																	).padStart(
																		3,
																		'0'
																	)}
																</p>
															)}
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
			<div>
				<div className='mb-8'>
					<p className='text-[#9E9E9D] text-[10px]'>LAUNCH DETAILS</p>
					<h2 className='text-[#F1F0EB] text-[20px] font-semibold'>
						Sale Settings
					</h2>
				</div>
				<div className='flex flex-col p-10 border border-[#F1F0EB] rounded-md'>
					<div className='w-1/2'>
						<PlatformFeeCalculator
							mode={isActionDisabled ? 'display' : 'input'}
							sellingPrice={voucher?.price ?? 0.1}
							quantity={voucher?.quantity ?? 1}
							onSellingPriceChange={async (price: number) => {
								const v = Number(price);
								if (!Number.isNaN(v)) {
									setVoucher({ price: v });
								}
							}}
							darkMode={true}
						/>
					</div>
				</div>
			</div>
			{!isActionDisabled && (
				<div className='w-full justify-end mt-8'>
					<Button
						variant='flat'
						size='sm'
						className='bg-[#AFAB99] text-black rounded-lg font-medium w-full'
						disabled={isActionDisabled}
						type='submit'
					>
						Save as Draft
					</Button>
				</div>
			)}
		</div>
	);
}
