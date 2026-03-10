import { listForSale, setProductPrice } from '@/apihandler/Product';
import { Modal, ModalBody, ModalContent } from '@nextui-org/react';
import { ToastMessage } from './ToastMessage';
import { getProduct } from '@/apihandler/Post';
import { useEffect, useState } from 'react';
import { ProductType, PlatformFeeType } from '@/types';
import Image from 'next/image';
import { getPlatformFeeForPublish } from '@/apihandler/Project';
import { convertIPFSUrl } from '@/lib/Util';
import { setAssetPrice } from '@/apihandler/Asset';

const ListForSalesModal = ({
	isOpenListForSales,
	setIsOpenListForSales,
	productId,
	walletAddress,
	updateListForSale,
	onPriceUpdated,
	isAsset = false,
	assetId,
}: {
	isOpenListForSales: boolean;
	setIsOpenListForSales: (isOpen: boolean) => void;
	productId?: number;
	walletAddress?: string;
	updateListForSale: (isListForSale: boolean) => void;
	onPriceUpdated?: (productId: number, newPrice: string) => void;
	isAsset?: boolean;
	assetId?: number;
}) => {
	const [royaltyPercentage, setRoyaltyPercentage] = useState<number | null>(
		null,
	);
	const [productData, setProductData] = useState<ProductType | null>(null);
	const [salePrice, setSalePrice] = useState<string>('');
	const [currency] = useState<string>('USDC');
	const [platformFees, setPlatformFees] = useState<PlatformFeeType[]>([]);
	const [priceError, setPriceError] = useState<string>('');
	const [isLoading, setIsLoading] = useState<boolean>(false);

	useEffect(() => {
		if (isOpenListForSales) {
			getProductInfo();
			getPlatformFee();
			setPriceError('');
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [productId, isOpenListForSales]);

	const getPlatformFee = async () => {
		try {
			const data = await getPlatformFeeForPublish();
			const filteredFees = data.filter(
				(fee) =>
					fee.chargeType.name.toLowerCase() !== 'publish fee' &&
					fee.currency?.toLowerCase() === 'usdc',
			);
			setPlatformFees(filteredFees);
		} catch (error) {
			console.error('Error fetching platform fees:', error);
		}
	};

	const getProductInfo = async () => {
		if (productId && walletAddress) {
			try {
				const res = await getProduct(walletAddress, productId);
				setProductData(res);
				if (res.project) {
					setRoyaltyPercentage(res.project.royaltyPercentage ?? null);
				}
				// Set initial sale price: if product has assets, use price from asset whose tokenId matches productId
				let priceToUse = res.price;
				if (assetId) {
					const matchingAsset = res.asset?.find(
						(asset) => assetId === asset.id,
					);
					if (matchingAsset?.price) {
						priceToUse = matchingAsset.price;
					}
				}
				if (priceToUse) {
					const sanitizedPrice =
						parseFloat(priceToUse) < 0.1 ? '0.10' : priceToUse;

					setSalePrice(sanitizedPrice);
				}
			} catch (error) {
				console.log('error', error);
			}
		}
	};

	// Calculate fees
	const calculateFees = () => {
		const price = parseFloat(salePrice) || 0;

		// Calculate platform fee from all fees in the array
		const platformFee = platformFees.reduce((total, fee) => {
			let feeAmount = fee.fixedAmount || 0;
			if (fee.percentage) {
				feeAmount += (price * fee.percentage) / 100;
			}
			return total + feeAmount;
		}, 0);

		const creatorRoyalty = royaltyPercentage
			? (price * royaltyPercentage) / 100
			: 0;
		const totalReceivable = price - platformFee - creatorRoyalty;

		return {
			platformFee: platformFee.toFixed(2),
			creatorRoyalty: creatorRoyalty.toFixed(2),
			totalReceivable: totalReceivable.toFixed(2),
		};
	};

	const fees = calculateFees();

	const handleApprove = async () => {
		// Validate price before submission
		if (!validatePrice(salePrice)) {
			return;
		}
		const priceToUse =
			isAsset && assetId
				? productData?.asset?.find((asset) => assetId === asset.id)
						?.price
				: productData?.price;
		if (salePrice === priceToUse) {
			// Update list for sale status
			updateListForSale(true);
			setIsOpenListForSales(false);
			return;
		}
		setIsLoading(true);
		try {
			let res;
			if (isAsset) {
				if (assetId) {
					res = await setAssetPrice(assetId, salePrice);
				}
			} else {
				if (productData?.id) {
					res = await setProductPrice(productData?.id, salePrice);
				}
			}

			if (res && res.success) {
				// ToastMessage('success', 'Price set successfully');
				// Call the callback to update parent components
				if (onPriceUpdated) {
					if (isAsset) {
						if (assetId) {
							onPriceUpdated(assetId, salePrice);
						}
					} else {
						if (productData?.id) {
							onPriceUpdated(productData.id, salePrice);
						}
					}
					// Update list for sale status
					updateListForSale(true);
				}

				// Close the modal
				setIsOpenListForSales(false);
			} else {
				ToastMessage('error', 'Failed to set price');
			}
		} catch (error) {
			console.error('Error setting price:', error);
			ToastMessage('error', 'Failed to set price');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		setIsOpenListForSales(false);
	};

	const handleSetPrice = async (productId: number, price: string) => {
		const res = await setProductPrice(productId, price);
		if (res.success) {
			ToastMessage('success', 'Price set successfully');
		} else {
			ToastMessage('error', 'Failed to set price');
		}
	};

	const handlePriceChange = (value: string) => {
		// Allow free typing - don't validate during input
		setSalePrice(value);
		// Clear error when user starts typing
		if (priceError) {
			setPriceError('');
		}
	};

	const validatePrice = (value: string): boolean => {
		if (value === '' || value === null || value === undefined) {
			setPriceError('Price is required');
			return false;
		}

		const parsedValue = parseFloat(value);

		if (Number.isNaN(parsedValue)) {
			setPriceError('Please enter a valid number');
			return false;
		}

		if (parsedValue < 0.1) {
			setPriceError('Minimum price is 0.10 USDC');
			return false;
		}

		setPriceError('');
		return true;
	};

	const handlePriceBlur = () => {
		// Validate when user leaves the input field
		if (salePrice === '') {
			return; // Don't do anything if empty
		}

		const parsedValue = parseFloat(salePrice);
		validatePrice(parsedValue.toString());
		// If value is below minimum, automatically correct to 0.10
		if (!Number.isNaN(parsedValue) && parsedValue < 0.1) {
			setSalePrice('0.10');
			// setPriceError('');
			return;
		}

		// Validate for other cases
		validatePrice(salePrice);
	};
	return (
		<Modal
			isOpen={isOpenListForSales}
			onClose={() => setIsOpenListForSales(false)}
			size='sm'
			closeButton={false}
			classNames={{
				closeButton: 'hidden',
			}}
			backdrop='blur'
			className=' p-0 m-0  '
		>
			<ModalContent className='bg-[#D6D5D0] text-[#1A1A1A] rounded-lg'>
				<ModalBody>
					{/* Header with title and close button */}
					<div className='flex justify-between items-center mt-4 mb-2'>
						<h2 className='text-[16px] text-[#1A1A1A] font-semibold'>
							List for Sale
						</h2>
						<button
							onClick={handleCancel}
							className='text-[#1A1A1A] hover:text-gray-700'
						>
							<Image
								src='/close.svg'
								alt='close'
								width={20}
								height={20}
							/>
						</button>
					</div>
					<div className='px-6 pb-5'>
						{/* Product Image and Info */}
						{productData && (
							<div className='flex flex-col w-[250px] m-auto gap-2'>
								<div className='w-[250px] h-[250px] '>
									<Image
										src={
											(productData?.voucher?.mediaUrl ??
												convertIPFSUrl(
													productData?.asset?.[0]
														?.mediaUrl,
												)) ||
											productData.imageUrl
										}
										alt={productData.name}
										width='200'
										height='200'
										// sizes="100vw"
										className='w-full h-[250px] bg-black  z-10  object-cover '
									/>
								</div>

								<div className='mb-4 font-medium text-[#1A1A1A]'>
									<p>{productData.name}</p>
									<p>
										#
										{isAsset
											? productData?.asset?.find(
													(asset) =>
														assetId === asset.id,
												)?.tokenId
											: productData.id}
									</p>
								</div>
							</div>
						)}

						{/* Set Sale Price */}
						<div className='mb-2'>
							<p className='font-semibold mb-2'>Set Sale Price</p>
							<div className='flex items-end gap-2'>
								<input
									type='number'
									step='0.01'
									value={salePrice}
									onChange={(e) =>
										handlePriceChange(e.target.value)
									}
									onBlur={handlePriceBlur}
									className='flex-1 bg-white border-none text-right rounded-lg px-3 py-2 text-[#1A1A1A] focus:outline-none'
									placeholder='0'
								/>
								<p className='text-[#1A1A1A] font-medium'>
									{currency}
								</p>
							</div>
							{priceError && (
								<p className='text-red-500 text-[11px] mt-1'>
									{priceError}
								</p>
							)}
						</div>

						{/* Fee Breakdown */}
						<div className=' mb-6'>
							{platformFees.length > 0 &&
								platformFees.map((fee, index) => (
									<div
										key={index}
										className='flex justify-between  py-2 border-y border-[#9E9E9D]'
									>
										<span className='text-[#1A1A1A] font-light'>
											{fee.chargeType.name}
										</span>
										<span className='text-[#1A1A1A] font-light'>
											~{' '}
											{fee.fixedAmount > 0 &&
											fee.percentage > 0
												? `${fee.fixedAmount} ${currency} + ${fee.percentage}%`
												: fee.fixedAmount > 0
													? `${fee.fixedAmount} ${currency}`
													: `${fee.percentage}%`}
										</span>
									</div>
								))}

							<div className='flex justify-between py-2'>
								<span className='text-[#1A1A1A] font-light'>
									Creator royalties
								</span>
								<span className='text-[#1A1A1A] font-light'>
									~ {fees.creatorRoyalty} {currency}
								</span>
							</div>
							<div className='text-[#1A1A1A] flex justify-between font-semibold py-2 border-y border-[#9E9E9D]'>
								<span>Total Receivable</span>
								<span>
									{fees.totalReceivable} {currency}
								</span>
							</div>
						</div>

						{/* Action Buttons */}
						<div className='flex gap-3 text-[13px]'>
							<button
								onClick={handleCancel}
								className='flex-1 rounded-lg bg-[#AFAB99] text-[#1A1A1A] py-2 font-semibold hover:bg-[#F1F0EB] active:bg-[#11FF49]'
							>
								Cancel
							</button>
							<button
								onClick={handleApprove}
								disabled={isLoading}
								className='flex-1 rounded-lg bg-[#AFAB99] text-[#1A1A1A] py-2 font-semibold hover:bg-[#F1F0EB] active:bg-[#11FF49] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
							>
								{isLoading && (
									<svg
										className='animate-spin h-4 w-4'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
									>
										<circle
											className='opacity-25'
											cx='12'
											cy='12'
											r='10'
											stroke='currentColor'
											strokeWidth='4'
										></circle>
										<path
											className='opacity-75'
											fill='currentColor'
											d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
										></path>
									</svg>
								)}
								Approve
							</button>
						</div>
					</div>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
};

export default ListForSalesModal;
