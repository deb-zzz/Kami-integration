'use client';

import { useLazyNFT } from '@/lib/VoucherContext';
import { Input } from '@nextui-org/react';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { set } from 'date-fns';
import PlatformFeeCalculator from '@/components/PlatformFeeCalculator';
export default function SalesStep({
	onVerify,
	isActionDisabled,
	chainId,
	published = false,
}: {
	onVerify: (verified: boolean) => void;
	isActionDisabled: boolean;
	chainId: string;
	published: boolean;
}) {
	const [voucher, setVoucher] = useLazyNFT();
	const schema = yup.object().shape({
		price: yup
			.number()
			.required('Selling price is required')
			.min(0, 'Selling price cannot be less than 0 dollars')
			.default(0),
		quantity: yup
			.number()
			.nullable()
			.min(0, 'Quantity cannot be less than 0')
			.default(0),
		currency: yup.string(),
		chainId: yup.string().required('Chain ID is required'),
	});
	const {
		register,
		handleSubmit,
		control,
		setValue,
		trigger,
		formState: { errors },
	} = useForm({ resolver: yupResolver(schema) });

	const validate = () => {
		trigger().then((val) => {
			onVerify(val);
		});
	};

	useEffect(() => {
		validate();
	}, [voucher]);

	return (
		<div className='h-full w-1/2 '>
			<PlatformFeeCalculator
				mode={isActionDisabled ? 'display' : 'input'}
				sellingPrice={voucher?.price ?? 0.1}
				quantity={voucher?.quantity ?? 1}
				chainId={chainId}
				onSellingPriceChange={async (price: number) => {
					const v = Number(price);
					if (!Number.isNaN(v)) {
						setVoucher({ price: v });
						setValue('price', v ?? 0);
					}
				}}
				onCurrencyChange={async (currency: string) => {
					setVoucher({ currency: currency });
					setValue('currency', currency ?? '');
				}}
				onChainIdChange={async (chainId: string) => {
					setVoucher({ chainId: chainId });
					setValue('chainId', chainId ?? '');
				}}
				onQuantityChange={async (qty) => {
					// 0 = unlimited quantity
					if (qty == null || qty === 0) {
						setVoucher({ quantity: 0 });
						setValue('quantity', 0);
					} else {
						const v = Number(qty);
						if (!Number.isNaN(v)) {
							setVoucher({ quantity: v });
							setValue('quantity', v);
						}
					}
				}}
				type={
					(voucher?.contractType as
						| 'ERC721C'
						| 'ERC721AC'
						| 'ERC1155C'
						| 'ERC20') ?? voucher?.collection?.type
				}
				published={published}
			/>
			{/* {voucher?.type === 'Series' ||
				(voucher?.type === 'Claimable' && (
					<div className='mb-5'>
						<div className='flex'>
							<Input
								size='md'
								variant='bordered'
								className='flex-1 mt-2 w-full'
								placeholder='eg: 1000'
								label='Quantity'
								labelPlacement='outside'
								value={voucher?.quantity?.toString() ?? ''}
								disabled={isActionDisabled}
								classNames={{
									base: 'bg-transparent',
									label: 'text-black font-semibold text-[16px]',
									input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold input[type=number]',
									inputWrapper: `${
										isActionDisabled
											? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
											: ' border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] '
									}  rounded-lg border `,
								}}
								onValueChange={async (val) => {
									const v = Number(val);
									if (!Number.isNaN(v)) {
										setVoucher({ quantity: v });
										setValue('price', v ?? 0);
									}
								}}
								{...register('quantity')}
								defaultValue={
									voucher?.quantity?.toString() ?? '0'
								}
							/>
						</div>
						<p className=' text-end w-full text-[#532929]'>
							Leave 0 if supply is unlimited
						</p>
					</div>
				))}
			<p className='text-black font-semibold text-[16px] '>
				Selling Price
			</p>
			<div className='flex'>
				<Input
					size='md'
					variant='bordered'
					className='flex-1 mt-2 w-full'
					placeholder='10 USD'
					disabled={isActionDisabled}
					value={voucher?.price?.toString() ?? '0'}
					classNames={{
						base: 'bg-transparent',
						input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold input[type=number]',
						inputWrapper: `${
							isActionDisabled
								? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
								: ' border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] '
						}  rounded-lg border `,
					}}
					onValueChange={async (val) => {
						const v = Number(val);
						if (!Number.isNaN(v)) {
							setVoucher({ price: v });
							setValue('price', v ?? 0);
						}
					}}
					{...register('price')}
					defaultValue={voucher?.price?.toString() ?? '0'}
				/>
				<span className='text-[#1A1A1A] text-[16px] font-semibold place-content-end ml-2'>
					USD
				</span>
			</div>

			<p className='text-red-500 capitalize text-[11px] mt-1 ml-1'>
				{errors.price?.message ?? ''}
			</p> */}
		</div>
	);
}
