'use client';
import { getProfile } from '@/apihandler/Profile';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	Modal,
	ModalContent,
	ModalBody,
	Input,
	Button,
	ModalHeader,
	ModalFooter,
} from '@nextui-org/react';
import React, {
	Dispatch,
	SetStateAction,
	useEffect,
	useRef,
	useState,
} from 'react';
import Image from 'next/image';
import { generateOTP, validateOTP } from '@/apihandler/signin';
import useKamiWallet from '@/lib/KamiWalletHook';
import { ToastMessage } from '@/components/ToastMessage';
import { useRouter } from 'next/navigation';
import { getBlockchains } from '@/apihandler/Wallet';
import { Blockchain, BlockchainResponse } from '@/types';

function LoginModal({
	isOpenLogin,
	setIsOpenLogin,
	onWhiteListFailed,
}: {
	isOpenLogin: boolean;
	setIsOpenLogin: Dispatch<SetStateAction<boolean>>;
	onWhiteListFailed: () => void;
}) {
	const [gs, setGs] = useGlobalState();
	const [email, setEmail] = useState<string>('');
	const [isOTP, setIsOTP] = useState<boolean>(false);
	const router = useRouter();

	const updateWallet = (walletAddress: string, email?: string) => {
		setGs({
			...gs,
			walletAddress: walletAddress,
			email: email ?? gs?.email,
		});
		getProfile(walletAddress).then((data) => {
			if (data.success && data.profile) {
				setGs({
					profile: data.profile,
				});
			}
		});
		getBlockchains().then((data) => {
			if (data.success && data.data) {
				setGs({
					chainIcons: data.data.reduce(
						(
							acc: { [chainId: string]: string },
							chain: Blockchain
						) => {
							acc[chain.chainId] = chain.logoUrl;
							return acc;
						},
						{}
					),
				});
			}
		});
	};

	const wallet = useKamiWallet();

	useEffect(() => {
		if (wallet?.getAccount()) {
			const w = wallet.getAccount();
			if (w.address) data(w.address);
		}
	}, [wallet?.getAccount()]);

	const data = async (address: string) => {
		const data = await getProfile(address);
		// if (data.success && data.profile) {
		// 	router.replace('/profile/' + address);
		// }
	};

	const getOTP = async (v: string) => {
		if (v.length < 6) return;
		try {
			const data = await validateOTP(email, v);
			if (data.success) {
				if (data.walletAddress) updateWallet(data.walletAddress, email);
				router.replace(`/profile/${data.walletAddress}`);
				setIsOTP(false);
				setIsOpenLogin(false);
				setEmail('');
			}
		} catch (e) {
			console.error('Invalid OTP:', e);
			ToastMessage('error', 'Invalid OTP. Please try again.');
		}
	};

	useEffect(() => {
		if (isOTP && email) {
			generateOTP(email).then((data) => {
				if (!data.success && data.error.includes('428')) {
					setIsOTP(false);
					setEmail('');
					setIsOpenLogin(false);
					onWhiteListFailed();
				}
			});
		}
	}, [isOTP]);

	return (
		<Modal
			isOpen={isOpenLogin}
			onOpenChange={() => {
				setIsOpenLogin(!isOpenLogin);
				setEmail('');
				setIsOTP(false);
			}}
			className='bg-[#1A1A1A] rounded-[8px] p-0 m-0 h-fit'
			backdrop='blur'
			classNames={{
				closeButton: 'hover:bg-black text-[#F1F0EB]',
				body: 'z-[1000]',
				backdrop: 'z-[1000]',
				wrapper: 'z-[1000]',
				// backdrop: 'bg-[#D9D9D9]/40',
				// base: 'overflow-y-visible bg-[#D9D9D9]',
			}}
			size='md'
		>
			<ModalContent>
				{(onClose) => (
					<>
						<ModalHeader className='text-[#F1F0EB] pb-0'>
							{isOTP ? 'Login' : 'Sign up / Login'}
						</ModalHeader>
						<ModalBody className='p-0 m-0 h-fit gap-0 w-full px-6 '>
							{/* <div className='w-full  h-[270px]  relative'>
								<Image
									src={'/onboarding.gif'}
									unoptimized
									alt='Like'
									layout='fill'
									objectFit='contain'
									draggable='false'
								/>
							</div> */}

							<div className=' w-full text-[#F1F0EB] mt-4'>
								{isOTP ? (
									<OTP getOTP={getOTP} email={email} />
								) : (
									<Email
										email={email}
										setEmail={setEmail}
										setIsOTP={setIsOTP}
									/>
								)}
							</div>
						</ModalBody>
						<ModalFooter>
							<div className='release-note pb-4 flex-col w-full'>
								<div className='pb-3 mb-3 border-b border-[#AFAB99]'>
									<p className='font-medium'>
										17 November 2025
									</p>
								</div>
								<div className='header font-light pb-3 mb-3 border-b border-[#AFAB99]'>
									<h1 className='text-2xl text-[#F1F0EB]'>
										v1.00-beta.2 release
									</h1>
									<p className='text-xs italic text-[#AFAB99]'>
										This version is currently in beta
									</p>
								</div>
								<div className='body text-[#F1F0EB] font-extralight'>
									<div className='mb-3'>
										<p className='font-medium'>
											{'// New Features'}
										</p>
										<ul className='list-disc list-inside pl-2 space-y-1 text-xs'>
											<li>
												Buy / Sell enabled in wallet
											</li>
											<li>
												Show / Hide products from
												Gallery
											</li>
											<li>List for Sale enabled</li>
										</ul>
									</div>
									<div className='mb-3'>
										<p className='font-medium'>
											{'// Improvements'}
										</p>
										<ul className='list-disc list-inside pl-2 space-y-1 text-xs'>
											<li>
												Product and price display in
												Shopping Cart and Checkout
											</li>
											<li>
												Social Integration via Profile
												page
											</li>
											<li>
												Cart order to show Grand Total
												in more details
											</li>
											<li>
												Currency selection during
												Publish
											</li>
											<li>
												Display max. file size limit for
												upload to scrapbook for clarity
											</li>
										</ul>
									</div>
									<div className='mb-3'>
										<p className='font-medium'>
											{'// Bug Fixes'}
										</p>
										<ul className='list-disc list-inside pl-2 space-y-1 text-xs'>
											<li>
												Fixed wallet order status
												checking
											</li>
											<li>
												Fixed missing decimal format in
												wallet display
											</li>
											<li>
												Updated acceptable file formats
												for upload
											</li>
											<li>
												Fixed project name display when
												inviting collaborators
											</li>
										</ul>
									</div>
									<div className='mb-3'>
										<p className='font-medium'>
											{'// Technical Notes'}
										</p>
										<ul className='list-disc list-inside pl-2 space-y-1 text-xs'>
											<li>
												Fixed erros displaying
												currencies
											</li>
											<li>
												Refined backend logic for
												usernam registration
											</li>
											<li>
												Smart contract patch applied
											</li>
											<li>
												Fixed display for wallet
												transaction history
											</li>
										</ul>
									</div>
								</div>
								<div className='footer pt-3 mt-4 border-t border-[#AFAB99]'>
									<p className='text-[#AFAB99] text-xs'>
										Need help? Get in touch at&nbsp;
										<a
											href='mailto:support@kamiunlimited.com'
											className='hover:text-[#F1F0EB] underline transition-colors'
										>
											support@kamiunlimited.com
										</a>
									</p>
								</div>
							</div>
						</ModalFooter>
						{/*{isOTP && (
							<ModalFooter className='px-6 w-full block mt-4 pb-6'>
								 <Button
									// isDisabled={isWarning}
									onClick={() => {
										validateOTP(email, otp);
										setIsOTP(!isOTP);
										setIsOpenLogin(!isOTP);
									}}
									size='md'
									variant='solid'
									className='w-full bg-[#11FF49] font-bold text-[#1a1a1a] uppercase rounded-md'
								>
									Verify
								</Button>
							</ModalFooter>
						)}*/}
					</>
				)}
			</ModalContent>
		</Modal>
	);
}

export default LoginModal;

const OTP = ({
	getOTP,
	email,
}: {
	getOTP: (val: string) => void;
	email: string;
}) => {
	const [otp, setOtp] = useState(['', '', '', '', '', '']);
	const inputRefs = useRef<HTMLInputElement[]>([]);

	useEffect(() => {
		if (otp.every((digit) => digit !== '')) {
			getOTP(otp.join(''));
		}
	}, [otp, getOTP]);

	const handleChange = (index: number, value: string) => {
		const digit = value.replace(/\D/g, '').slice(0, 1); // only one digit
		const newOtp = [...otp];
		newOtp[index] = digit;
		setOtp(newOtp);

		if (digit && index < 5) {
			inputRefs.current[index + 1]?.focus();
		}
	};

	const handlePaste = (
		index: number,
		event: React.ClipboardEvent<HTMLInputElement>
	) => {
		event.preventDefault();
		const paste = event.clipboardData
			.getData('text')
			.replace(/\D/g, '')
			.slice(0, 6);
		if (!paste) return;

		const newOtp = [...otp];
		paste.split('').forEach((digit, i) => {
			if (index + i < 6) {
				newOtp[index + i] = digit;
			}
		});
		setOtp(newOtp);

		// focus the next empty input
		const nextIndex = Math.min(index + paste.length, 5);
		inputRefs.current[nextIndex]?.focus();
	};

	const handleKeyDown = (
		index: number,
		event: React.KeyboardEvent<HTMLInputElement>
	) => {
		if (event.key === 'Backspace' && !otp[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
		}
	};

	return (
		<div>
			<div className='text-center mb-6'>
				<p className='text-[#6E6E6E] text-[16px]'>
					Enter the verification code sent to
				</p>
				<p className='text-[16px] font-bold mt-2'>{email}</p>
			</div>
			<div className='flex flex-row items-center justify-center gap-5'>
				{otp.map((digit, index) => (
					<Input
						autoFocus={index === 0}
						key={index}
						type='text'
						maxLength={1} // Only 1 char per input element
						value={digit}
						onChange={(e) => handleChange(index, e.target.value)}
						onPaste={(e) => handlePaste(index, e)}
						onKeyDown={(e) => handleKeyDown(index, e)}
						ref={(ref) => {
							if (ref) inputRefs.current[index] = ref;
						}}
						classNames={{
							mainWrapper: 'items-center',
							base: 'bg-transparent',
							input: 'group-data-[has-value=true]:text-[#F1F0EB] pr-0 placeholder:text-[#6E6E6E] text-center text-[13px]',
							inputWrapper:
								'group-data-[hover=true]:bg-transparent rounded-lg group-data-[focus=true]:bg-transparent group-data-[focus=true]:border-[#11FF49] group-data-[focus=true]:border-1 border-[0.5px] border-[#6E6E6E] bg-transparent',
						}}
					/>
				))}
			</div>
		</div>
	);
};

const Email = ({
	email,
	setEmail,
	setIsOTP,
}: {
	email: string;
	setEmail: Dispatch<SetStateAction<string>>;
	setIsOTP: Dispatch<SetStateAction<boolean>>;
}) => {
	const emailRegex =
		/^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
	const [isValidEmail, setIsValidEmail] = useState<boolean>(true);

	return (
		<div className='pb-6'>
			<Input
				autoFocus
				defaultValue={email}
				onValueChange={(val) => {
					// if (val !== '') {
					// 	const valid = emailRegex.test(val);
					// 	setIsValidEmail(valid);
					// 	if (!valid) {
					// 		return;
					// 	}
					// } else {
					// 	setIsValidEmail(true);
					// }
					setEmail(val.toLocaleLowerCase());
				}}
				classNames={{
					base: 'bg-transparent',
					input: 'group-data-[has-value=true]:text-[#F1F0EB] pr-0 placeholder:text-[#6E6E6E]  text-[13px]',
					inputWrapper:
						'group-data-[hover=true]:bg-transparent h-[20px] rounded-md  group-data-[focus=true]:bg-transparent  group-data-[focus=true]:border-[#11FF49] group-data-[focus=true]:border-1 border-[0.5px] border-[#6E6E6E]  bg-transparent',
				}}
				placeholder='Email address'
				endContent={
					<Image
						className='cursor-pointer '
						alt='enter'
						draggable='false'
						width={20}
						height={20}
						src={'/arrow-right.svg'}
						onClick={() => {
							const valid = emailRegex.test(email);
							setIsValidEmail(valid);
							if (email && valid) {
								setIsOTP(true);
							}
						}}
					/>
				}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						if (email !== '') {
							const valid = emailRegex.test(email);

							if (valid) {
								setIsOTP(true);
							}
							setIsValidEmail(valid);
						} else {
							setIsValidEmail(false);
						}
					}
				}}
			/>
			{!isValidEmail && (
				<p className='text-[11px] italic text-red-600 mt-2 font-medium ml-1'>
					Invalid email address
				</p>
			)}
		</div>
	);
};
