import { Modal, ModalBody, ModalContent, Spinner } from '@nextui-org/react';
import { useEffect, useState } from 'react';
import { ToastMessage } from '../ToastMessage';
import {
	getPlatformFeeForPublish,
	sponsoredTransferUsdcApi,
} from '@/apihandler/Project';

import { getWalletBalanceApi } from '@/apihandler/Project';
import Image from 'next/image';

const PublishFeeModal = ({
	showUSDCModal,
	setShowUSDCModal,
	walletAddress,
	onClickPublish,
}: {
	showUSDCModal: boolean;
	setShowUSDCModal: (show: boolean) => void;
	walletAddress: string;
	onClickPublish: () => Promise<void>;
}) => {
	const [publishFee, setPublishFee] = useState<{
		amount: string;
		currency: string;
	}>();
	const [usdcBalance, setUsdcBalance] = useState<string>('0');
	const [hasInsufficientFunds, setHasInsufficientFunds] =
		useState<boolean>(false);
	const [isCheckingBalance, setIsCheckingBalance] = useState<boolean>(false);

	useEffect(() => {
		if (walletAddress && showUSDCModal) {
			getPlatformFee();
		}
	}, [walletAddress, showUSDCModal]);

	const getPlatformFee = async () => {
		try {
			const data = await getPlatformFeeForPublish();
			const publishFeeData = data.find(
				(fee) => fee.chargeType.name.toLowerCase() === 'publish fee'
			);
			if (publishFeeData) {
				setPublishFee({
					amount: String(publishFeeData.fixedAmount),
					currency: publishFeeData.currency || 'USDC',
				});
			}
		} catch (error) {
			console.error('Error fetching platform fees:', error);
		}
	};

	const getWalletBalance = async () => {
		setIsCheckingBalance(true);
		try {
			if (walletAddress) {
				const res = await getWalletBalanceApi(walletAddress);
				if (res.success) {
					const usdcBalanceFormatted = res.data.usdcBalanceFormatted;
					setUsdcBalance(usdcBalanceFormatted);

					// Check if balance is sufficient
					const balanceNum = parseFloat(usdcBalanceFormatted);
					const feeNum = parseFloat(publishFee?.amount || '0');

					if (balanceNum <= feeNum) {
						setHasInsufficientFunds(true);
						ToastMessage('error', 'Insufficient funds');
					} else {
						// transfer usdc to the contract
						setHasInsufficientFunds(false);
					}
				} else {
					ToastMessage('error', 'Failed to fetch wallet balance');
				}
			}
		} catch (error) {
			console.error('Error fetching wallet balance:', error);
			ToastMessage('error', 'Failed to fetch wallet balance');
		} finally {
			setIsCheckingBalance(false);
		}
	};
	const transferUsdc = async () => {
		if (walletAddress) {
			try {
				const res = await sponsoredTransferUsdcApi({
					fromAddress: walletAddress,
					toAddress: walletAddress,
					amount: publishFee?.amount?.toString() ?? '0',
				});
				if (res.success) {
					// do publish
					//onClickPublish();
				} else {
					ToastMessage('error', 'Failed to transfer USDC');
				}
			} catch (error) {
				console.error('Error transferring USDC:', error);
				ToastMessage('error', 'Failed to transfer USDC');
			}
		}
	};
	return (
		<Modal
			isOpen={showUSDCModal}
			onClose={() => setShowUSDCModal(false)}
			closeButton={false}
			classNames={{
				base: 'bg-[#454343]',
				closeButton: 'hidden',
			}}
			backdrop='blur'
			size='sm'
		>
			<ModalContent className='bg-[#454343] text-white rounded-2xl'>
				<ModalBody className='p-8 flex flex-col items-center gap-4'>
					{/* Close button */}
					<button
						onClick={() => setShowUSDCModal(false)}
						className='absolute top-4 right-4 text-gray-400 hover:text-white'
					>
						<svg
							width='24'
							height='24'
							viewBox='0 0 24 24'
							fill='none'
							xmlns='http://www.w3.org/2000/svg'
						>
							<path
								d='M18 6L6 18M6 6L18 18'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'
							/>
						</svg>
					</button>

					{/* Hand icon */}
					<div className='w-20 h-20 rounded-full flex items-center justify-center'>
						<Image
							src={'/publish/hand.svg'}
							alt={'back'}
							width={100}
							height={100}
							className='cursor-pointer mx-10 '
						/>
					</div>

					{/* Title */}
					<div className='text-center font-extralight text-[#F1F0EB] text-[15px]'>
						<p className='mb-1'>A nominal fee of</p>
						<p className='text-2xl font-light mb-3 border-b border-white pb-1 w-fit mx-auto'>
							{publishFee?.amount} {publishFee?.currency}
						</p>
						<p>will be required to publish your product.</p>
						{/* <p className='font-medium italic mt-2'>
							A small price for immortality.
						</p> */}
					</div>

					{/* Balance Display */}
					{/* <div className='w-full text-center mb-2'>
						<p className='text-[13px] text-[#F1F0EB] font-extralight'>
							Your USDC Balance:{' '}
							<span className='font-medium'>
								{usdcBalance} USDC
							</span>
						</p>
					</div> */}

					{/* Warning box */}
					<div
						className={`border rounded-lg px-2 py-2 w-full text-center border-[#F1F0EB] `}
					>
						<p
							className={`text-[15px] font-extralight text-[#F1F0EB]`}
						>
							Thank you for being an early supporter. <br />
							KAMI will be sponsoring your listing fee <br /> of{' '}
							<span className='font-semibold'>USDC 0.20</span>.
						</p>
					</div>

					{/* Buttons */}
					<div className='flex flex-col gap-3 w-full'>
						<button
							onClick={async () => {
								// await getWalletBalance();
								// API call logic commented out for now
								onClickPublish();

								// setShowUSDCModal(false);
							}}
							disabled={isCheckingBalance}
							className={`text-[15px] py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
								isCheckingBalance
									? 'bg-gray-400 cursor-not-allowed opacity-70'
									: 'bg-[#9E9E9D] hover:bg-[#F1F0EB] active:bg-[#11FF49]'
							} text-[#1A1A1A]`}
						>
							{isCheckingBalance ? (
								<>
									<Spinner size='sm' color='default' />
									<span>Checking...</span>
								</>
							) : (
								'Proceed!'
							)}
						</button>
						{/* <button
                onClick={() => {
                    // Handle top up logic
                    console.log('Top Up clicked');
                }}
                className='bg-[#9E9E9D] text-[15px] hover:bg-[#F1F0EB] active:bg-[#11FF49] text-[#1A1A1A] py-3 rounded-lg transition-colors'
            >
                Top Up
            </button> */}
						<button
							onClick={() => setShowUSDCModal(false)}
							className='bg-[#9E9E9D] text-[15px] hover:bg-[#F1F0EB] active:bg-[#11FF49] text-[#1A1A1A] py-3 rounded-lg transition-colors'
						>
							Cancel
						</button>
					</div>

					{/* Help link . Hide for now*/}
					{/* <button
						onClick={() => {
							window.open(
								'https://transak.com/buy/usdc/malaysia',
								'_blank',
								'noopener,noreferrer'
							);
						}}
						className='mt-2 text-[#AFAB99] text-[13px] font-light border-b border-[#AFAB99] hover:text-[#F1F0EB] hover:border-[#F1F0EB]  active:text-[#11FF49] active:border-[#11FF49]'
					>
						I need help buying USDC
					</button> */}
				</ModalBody>
			</ModalContent>
		</Modal>
	);
};

export default PublishFeeModal;
