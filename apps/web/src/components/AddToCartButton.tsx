'use client';

import Image from 'next/image';
import { validateProduct } from '@/apihandler/Product';
import { useCartState } from '@/hooks/useCartState';
import { ToastMessage } from '@/components/ToastMessage';
import { useGlobalState } from '@/lib/GlobalContext';

interface AddToCartButtonProps {
	productId: number;
	walletAddress: string;
	showOnlyIcon?: boolean;
	assetId?: number;
}

export default function AddToCartButton({
	productId,
	walletAddress,
	showOnlyIcon = false,
	assetId,
}: AddToCartButtonProps) {
	const [gs] = useGlobalState();
	const { addToCartWithSync } = useCartState(walletAddress);

	const addToCartApi = async (productId: number) => {
		if (walletAddress) {
			const data = {
				walletAddress,
				productId,
				quantity: 1,
				checkoutAction: 'None',
				assetId: assetId,
			};
			const res = await addToCartWithSync(data);
			if (res.success) {
				ToastMessage('success', 'Added to cart');
			} else {
				if (res.error) {
					ToastMessage('error', res.error);
				} else {
					ToastMessage('error', 'Failed to add to cart');
				}
			}
		}
	};

	const validateProductApi = async (productId: number) => {
		if (walletAddress) {
			const res = await validateProduct(walletAddress, productId);
			if (res.canAdd) {
				addToCartApi(productId);
			} else {
				if (res.availableQuantity === 0) {
					ToastMessage('warning', 'Sold out');
				} else if (res.cartQuantity === res.availableQuantity) {
					ToastMessage('warning', 'Already in cart!');
				} else if (res.reason) {
					ToastMessage('warning', res.reason);
				}
			}
		}
	};

	return (
		<>
			{showOnlyIcon ? (
				<div
					className='cursor-pointer'
					onClick={() => {
						if (productId) {
							validateProductApi(productId);
						}
					}}
				>
					<Image
						src='/product/whiteCart.svg'
						alt='menu'
						width={20}
						height={20}
						className='text-white'
					/>
				</div>
			) : (
				<div className='flex flex-row w-full gap-4 mt-2 justify-end'>
					<div
						className='flex flex-row cursor-pointer'
						onClick={() => {
							if (productId) {
								validateProductApi(productId);
							}
						}}
					>
						<div
							className={`rounded-l-md  px-5 flex-1 py-[6px] flex items-center justify-center bg-transparent border border-[#F1F0EB] `}
						>
							<p className='font-semibold text-[#F1F0EB]'>
								Add to Cart
							</p>
						</div>

						<div className='bg-[#F1F0EB] px-2 flex items-center justify-center rounded-r-md border border-white border-l-0'>
							<Image
								src='/product/blackCart.svg'
								alt='menu'
								width={20}
								height={20}
								className='text-white'
							/>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
