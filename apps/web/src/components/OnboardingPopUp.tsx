'use client';
import { createProfile, followProfile, getProfile, getUsernames } from '@/apihandler/Profile';
import ProfileTab from '@/app/profile/[wallet]/profile';
import { useGlobalState } from '@/lib/GlobalContext';
import { Modal, ModalContent, ModalBody, useDisclosure, Input, Button, ModalHeader, ModalFooter, Checkbox } from '@nextui-org/react';
import { useRouter } from 'next/navigation';
import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import useKamiWallet from '@/lib/KamiWalletHook';
import Image from 'next/image';
import { ProfileCreate } from '@/types';
import { ToastMessage } from './ToastMessage';
function OnboardingPopUp({
	isOpenOnboarding,
	setIsOpenOnboarding,
}: {
	isOpenOnboarding: boolean;
	setIsOpenOnboarding: Dispatch<SetStateAction<boolean>>;
}) {
	const wallet = useKamiWallet();
	const router = useRouter();
	const [gs, setGs] = useGlobalState();
	const [username, setUsername] = useState<string>('');
	const [onboarded, setOnboarded] = useState<boolean>(false);
	const [warning, setWarning] = useState<string>('');
	const [usernameTaken, setUsernameTaken] = useState<string[]>([]);
	const [isInvalid, setIsInvalid] = useState<boolean>(true);
	const [errors, setErrors] = useState<string[]>([]);
	const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

	useEffect(() => {
		const w = wallet?.getAccount();
		if (w?.address) getProfileData(w.address);
	}, []);

	const getProfileData = async (address: string) => {
		const data = await getProfile(address);
		if (data.success) {
			setGs({
				isLoggedIn: true,
				profile: data.profile,
				walletAddress: data.profile.walletAddress,
				userId: data.profile.userName,
			});
			await followProfile('0x6D16F7930888Ec42f5dc3841564139C13423Ce63', data.profile.walletAddress);
		}
		// 	router.replace('/profile/' + address);
		// }
	};
	const checkUsername = async (un: string) => {
		const res = await getUsernames(un);
		if (res.usernames.length > 0) {
			setUsernameTaken(res.usernames);
		}
	};

	// Username validation using useEffect
	useEffect(() => {
		const USERNAME_REGEX = /^[a-zA-Z0-9._@$#!]+$/;

		const validationErrors: string[] = [];

		// Only validate if there's input
		if (username.length === 0) {
			setErrors([]);
			setIsInvalid(true);
			return;
		}

		// Length checks
		if (username.length < 3) {
			validationErrors.push('Username must be 3 characters or more.');
		}

		if (username.length > 20) {
			validationErrors.push('Username must not exceed 20 characters.');
		}

		// Character pattern check
		if (!USERNAME_REGEX.test(username)) {
			validationErrors.push('Username contains invalid characters. Only letters, numbers, and . _ @ $ # ! are allowed.');
		}

		const lowered = username.toLowerCase();

		// Duplicate check (case-insensitive)
		const lowerCaseUsernames = usernameTaken.map((name) => name.toLowerCase());
		const isDuplicate = lowerCaseUsernames.some((u) => u === lowered);

		if (isDuplicate) {
			validationErrors.push('Username already exists.');
		}

		setErrors(validationErrors);
		setIsInvalid(validationErrors.length > 0);
	}, [username, usernameTaken]);
	return (
		<Modal
			isOpen={isOpenOnboarding}
			onOpenChange={() => {
				if (onboarded) {
					setIsOpenOnboarding(!isOpenOnboarding);
				}
			}}
			className='bg-[#1A1A1A] rounded-[8px] p-0 m-0 h-fit'
			backdrop='blur'
			classNames={{
				closeButton: 'hover:bg-black text-[#F1F0EB]',
				// backdrop: 'bg-[#D9D9D9]/40',
				// base: 'overflow-y-visible bg-[#D9D9D9]',
			}}
			size='md'
		>
			<ModalContent>
				{(onClose) => (
					<>
						<ModalHeader className='text-[#F1F0EB]'>Welcome to KAMI.</ModalHeader>
						<ModalBody className='p-0 m-0 h-fit gap-0 w-full'>
							<div className='w-full  h-[270px]  relative'>
								<Image src={'/onboarding.gif'} unoptimized alt='Like' layout='fill' objectFit='contain' draggable='false' />
							</div>
							<div className='px-6 w-full text-[#F1F0EB] mt-4'>
								<div>
									<p>
										Please choose a username (required).
										{/* <span className='text-red-500'>*</span> */}
									</p>
									<Input
										value={username}
										errorMessage={() => (
											<ul>
												{errors.map((error, i) => (
													<li key={i}>{error}</li>
												))}
											</ul>
										)}
										isInvalid={errors.length > 0}
										onValueChange={async (v) => {
											setUsername(v);
											// Fetch existing usernames when user starts typing
											if (v.length === 1) {
												await checkUsername(v);
											}
										}}
										classNames={{
											base: 'bg-transparent',
											input: 'group-data-[has-value=true]:text-[#F1F0EB] pr-0 placeholder:text-[#6E6E6E] placeholder:italic text-[12px]',
											inputWrapper:
												'group-data-[hover=true]:bg-transparent h-[15px] p-0  group-data-[focus=true]:bg-transparent border-t-none  rounded-none group-data-[focus=true]:border-b group-data-[focus=true]:border-b-[#FFFFFF] border-b border-b-[#FFFFFF]  bg-transparent',
										}}
										placeholder='Enter username'
										description=''
									/>
									<p className='text-[#6E6E6E] text-[12px]'>
										Username must be 3 to 20 characters long and may include letters, numbers, and the following
										symbols: underscore (_), period (.), at (@), dollar ($), hash (#), and exclamation mark (!).
									</p>
								</div>
								<div className='mt-4 flex items-center gap-1'>
									<Checkbox
										isSelected={termsAccepted}
										onValueChange={setTermsAccepted}
										classNames={{
											label: 'text-[#F1F0EB] text-[12px]',
											wrapper: 'after:bg-[#11FF49] text-[#1A1A1A] ',
										}}
									></Checkbox>
									<span>
										I agree to the
										<a
											href='/TermsAndConditions.pdf'
											target='_blank'
											rel='noopener noreferrer'
											className='underline hover:text-[#D1D1D1] ml-1 cursor-pointer'
											onClick={(e) => e.stopPropagation()}
										>
											terms and conditions
										</a>
									</span>
								</div>
							</div>
						</ModalBody>
						<ModalFooter className='px-6 w-full block mt-3'>
							<p className='font-light text-center text-[11px] mb-1'>
								* Note: You cannot change your username once it&apos;s set.
							</p>
							<button
								disabled={isInvalid || !termsAccepted}
								className={`${
									isInvalid || !termsAccepted
										? 'opacity-50 border-[#F1F0EB] text-[#F1F0EB] cursor-not-allowed'
										: 'border-[#11FF49] text-[#11FF49]'
								} py-[6px] bg-transparent border  w-full  px-10 text-[13px] rounded-md font-light m-1 italic`}
								onClick={async () => {
									const walletAddress = wallet?.getAccount()?.address ?? undefined;

									// Double-check: only proceed if NOT already onboarded (gs?.profile doesn't exist) AND user must have a wallet address
									if (!gs?.profile && walletAddress) {
										// Validate button state
										if (isInvalid) {
											// Optionally set a warning here if desired
											// setWarning('Please enter a valid username.');
											return;
										}

										// Defensive: Make sure username meets backend rules (3-20 chars, valid chars)
										const usernamePattern = /^[A-Za-z0-9_.@\$#!]{3,20}$/;
										if (!usernamePattern.test(username)) {
											ToastMessage('error', 'Invalid username format.');
											return;
										}

										const cdata: ProfileCreate = {
											userName: username,
											walletAddress: walletAddress,
										};

										try {
											const { success, profile, error } = await createProfile(cdata);
											if (success) {
												setIsOpenOnboarding(false);
												setOnboarded(true);
												await getProfileData(walletAddress);
											} else {
												ToastMessage('error', error ?? 'Failed to create profile');
												setIsOpenOnboarding(false);
											}
										} catch (err) {
											ToastMessage('error', 'An unexpected error occurred during profile creation.');
											setIsOpenOnboarding(false);
										}
									}
								}}
							>
								Let&apos;s Go!
							</button>
						</ModalFooter>
					</>
				)}
			</ModalContent>
		</Modal>
	);
}

export default OnboardingPopUp;
