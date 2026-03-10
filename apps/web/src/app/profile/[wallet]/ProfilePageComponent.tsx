'use client';
import { Button, Spinner, Tab, Tabs } from '@nextui-org/react';
import Image from 'next/image';

import ProfileTab from './profile';
import GalleryTab from './gallery';
import SocialTab from './social';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
	NotificationEntitySubType,
	NotificationEntityType,
	Profile,
	ProfileEdit,
} from '@/types';
import { editProfile, getProfile, uploadBanner } from '@/apihandler/Profile';
import axios from 'axios';
import useKamiWallet from '@/lib/KamiWalletHook';
import { useGlobalState } from '@/lib/GlobalContext';
import { ToastMessage } from '@/components/ToastMessage';
import { createActivity } from '@/apihandler/Activity';
import { TourProvider, useTour } from '@reactour/tour';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';

function TourNavigation({
	currentStep,
	setCurrentStep,
	setIsOpen,
	steps,
}: any) {
	const [gs] = useGlobalState();
	const isLastStep = currentStep === steps.length - 1;
	const isFirstStep = currentStep === 0;

	const handleNext = () => {
		if (isLastStep) {
			localStorage.setItem('hasSeenProfileTour', 'true');
			setIsOpen(false);
		} else {
			setCurrentStep(currentStep + 1);
		}
	};

	const handlePrev = () => {
		if (!isFirstStep) {
			setCurrentStep(currentStep - 1);
		}
	};

	return (
		<div className='flex justify-between items-center mt-4 pt-4 border-t border-gray-700'>
			<button
				onClick={handlePrev}
				disabled={isFirstStep}
				className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
					isFirstStep
						? 'text-gray-500 text-opacity-0 cursor-not-allowed'
						: 'text-[#f1f0eb] hover:text-white'
				}`}
			>
				Previous
			</button>
			<div className='flex gap-2'>
				{isLastStep ? (
					<button
						onClick={() => {
							handleNext();
							// router.push('/profile/' + gs?.walletAddress);
						}}
						className='bg-[#11FF49] text-black px-6 py-2 rounded-lg font-medium hover:bg-[#0EEF44] transition-colors'
					>
						Done
					</button>
				) : (
					<button
						onClick={handleNext}
						className='bg-[#11FF49] text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0EEF44] transition-colors'
					>
						Next
					</button>
				)}
			</div>
		</div>
	);
}

// Tour component that will be used inside the layout
function AppTour() {
	const { setIsOpen, currentStep } = useTour();
	const [gs, setGs] = useGlobalState();

	// Auto-start tour for new users (you can modify this logic)
	useEffect(() => {
		const hasSeenTour = localStorage.getItem('hasSeenProfileTour');
		if (!hasSeenTour && gs?.walletAddress) {
			setTimeout(() => {
				setIsOpen(true);
			}, 1000);
		}
	}, [gs?.walletAddress, setIsOpen]);

	const handleStartTour = () => {
		setIsOpen(true);
	};

	const handleCompleteTour = () => {
		localStorage.setItem('hasSeenProfileTour', 'true');
		setIsOpen(false);
	};

	return (
		<div className='fixed bottom-4 right-4 z-50'>
			{/* <button
				onClick={handleStartTour}
				className='bg-[#11FF49] text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0EEF44] transition-colors'>
				Start Tour
			</button> */}
		</div>
	);
}

export default function ProfilePage({
	walletAddress,
}: {
	walletAddress: string;
}) {
	// const params = useParams<{ wallet: string }>();
	const [profile, setProfile] = useState<Profile>();
	const [img2Upload, setImg2Upload] = useState<
		{ file: any; uploadLink?: string; destination?: string } | undefined
	>(undefined);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [bannerImageError, setBannerImageError] = useState<boolean>(false);
	const hiddenFileInput = useRef<HTMLInputElement | null>(null);
	const wallet = useKamiWallet();
	const [gs, setGs] = useGlobalState();
	const router = useRouter();
	useEffect(() => {
		if (walletAddress) {
			data(walletAddress);
		}
	}, [walletAddress]);

	useEffect(() => {
		// Reset banner image error state when profile changes
		setBannerImageError(false);
	}, [profile?.bannerUrl]);

	const data = async (wallet: string) => {
		const prf = await getProfile(wallet);
		if (prf.success) setProfile(prf.profile);
	};

	const handleImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const img = e.target.files;
		if (!img) return;
		const file = img[0];

		// Validate file type explicit to allow only jpg, jpeg, png, gif
		const validExtensions = /\.(jpg|jpeg|png|gif)$/i;
		if (!validExtensions.test(file.name)) {
			ToastMessage('warning', 'Please use jpg, jpeg, png or gif only');
			// Clear the input
			e.target.value = '';
			return;
		}

		if (file) {
			// setImg2Upload({ file });
			saveBanner(file);
		}
	};

	const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
		// e.preventDefault();

		if (!hiddenFileInput || !hiddenFileInput.current) return;
		if (hiddenFileInput.current) {
			hiddenFileInput.current.value = '';
			hiddenFileInput.current.click();
		}
	};
	const saveBanner = async (file: File) => {
		setIsLoading(true);
		// let file = img2Upload?.file;
		let bannerUrl = undefined;
		if (file && profile) {
			try {
				const { path, url } = await uploadBanner(
					file.name,
					file.type,
					profile.userName
				);

				var formData = new FormData();

				if (file) {
					formData.append('body', file);
					const { status } = await axios.put(url, file, {
						headers: {
							'Content-Type': file.type,
						},
					});
					if (status >= 200 && status < 300) bannerUrl = path;
				}
			} catch (e) {
				console.log(e);
				setIsLoading(false);
				ToastMessage(
					'error',
					'Profile Update Failed. Please try again later.'
				);
				return;
			}
		}

		const data: ProfileEdit = {
			bannerUrl,
		};
		const { success, profile: resProfile } = await editProfile(
			walletAddress ?? wallet?.getAccount()?.address,
			data
		);
		if (success && resProfile) {
			await createActivity(
				wallet?.getAccount()?.address!,
				`You've updated your profile banner.`,
				undefined,
				NotificationEntityType.User,
				NotificationEntitySubType.Updated,
				wallet?.getAccount()?.address!
			);
			setImg2Upload({ file });
			setGs({ profile: resProfile });
			setProfile(resProfile);
			ToastMessage('success', 'Profile Updated');
		}
		setIsLoading(false);
	};

	const tourSteps = [
		{
			selector: '[data-tour="banner"]',
			content:
				'This is your profile banner. You can upload a banner image here.',
		},
		{
			selector: '[data-tour="tabs"]',
			content:
				'Switch between profile, gallery, and social tabs to view your content.',
		},
		{
			selector: '[data-tour="avatar"]',
			content:
				'This is your profile avatar. You can upload an avatar image here.',
		},
		{
			selector: '[data-tour="edit-profile"]',
			content:
				'Click here to edit your profile information such as name, bio, and other details.',
		},
		{
			selector: '[data-tour="today"]',
			content: 'Update your daily updates here.',
		},
		{
			selector: '[data-tour="skills"]',
			content: 'Showcase your skills and expertise here.',
		},
		{
			selector: '[data-tour="interest"]',
			content: 'Here you can add your interests and hobbies.',
		},
		{
			selector: '[data-tour="social"]',
			content: 'Update your network by showing your connections here.',
		},
		{
			selector: 'body',
			content: (
				<div className='text-center'>
					<h3 className='text-lg font-semibold mb-3'>
						🎉 You&apos;re all set!
					</h3>
					<p className='mb-4'>
						You&apos;ve completed the KAMI Profile tour. You&apos;re
						now ready to create amazing content!
					</p>
				</div>
			),
		},
	];

	return (
		<main className='flex flex-col h-full w-full px-10 py-5'>
			<div className=' mb-4 flex flex-row gap-8'>
				<BackButton />
			</div>

			<TourProvider
				steps={tourSteps}
				styles={{
					maskWrapper: (base) => ({
						...base,
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
					}),
					popover: (base) => ({
						...base,
						backgroundColor: '#1a1a1a',
						color: '#f1f0eb',
						borderRadius: '12px',
						padding: '20px',
						boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
						border: '1px solid #333',
					}),
					dot: (base) => ({
						...base,
						backgroundColor: '#11FF49',
						border: '2px solid #f1f0eb',
					}),
					arrow: (base) => ({
						...base,
						color: '#ffffff',
					}),
					button: (base) => {
						return {
							...base,
							color:
								base.cursor === 'not-allowed'
									? '#00000000'
									: '#FFF',
							visibility:
								base.cursor === 'not-allowed'
									? 'hidden'
									: 'visible',
						};
					},
				}}
				showNavigation={true}
				showBadge={true}
				showCloseButton={false}
				disableInteraction={true}
				onClickMask={({ setIsOpen }) => {
					setIsOpen(false);
					localStorage.setItem('hasSeenTour', 'true');
				}}
				onClickClose={({ setIsOpen }) => {
					setIsOpen(false);
					localStorage.setItem('hasSeenTour', 'true');
				}}
				components={{
					Navigation: TourNavigation,
				}}
			>
				<div className='flex h-[300px] min-h-[200px] w-full relative'>
					<>
						<div
							className={`${
								walletAddress === wallet?.getAccount()?.address
									? 'cursor-pointer bannerContainer w-full'
									: 'w-full'
							}`}
						>
							{(profile?.bannerUrl || img2Upload !== undefined) &&
							!bannerImageError ? (
								<Image
									src={
										img2Upload && img2Upload.file
											? URL.createObjectURL(
													img2Upload!.file
											  )
											: profile?.bannerUrl +
											  '?' +
											  new Date().getTime()
									}
									alt={'banner'}
									width={2000}
									data-tour='banner'
									height={300}
									className={`bannerImg w-[100%] h-full object-top object-cover
								`}
									onError={() => {
										setBannerImageError(true);
									}}
									// onMouseEnter={() => {
									// 	setHoverBanner(true);
									// }}
									// onMouseLeave={() => {
									// 	setHoverBanner(false);
									// }}
								/>
							) : (
								<div
									className={`w-full h-full  bg-gradient-to-b from-[#C4C4C4] to-[#5E5E5E] 
							`}
									data-tour='banner'
								/>
							)}
							{isLoading && (
								<div className='loadingOverlay w-full h-full'>
									<div className=' w-full h-full '>
										<Spinner
											color='default'
											className='justify-self-center valign '
										/>
									</div>
								</div>
							)}
							{walletAddress ===
								wallet?.getAccount()?.address && (
								<div
									className='imgOverlay w-full h-full'
									onClick={(e) => {
										handleImageClick(e);
										// hiddenFileInput &&
										// 	hiddenFileInput.current &&
										// 	hiddenFileInput.current.click();
									}}
								>
									<div className=' w-full h-full '>
										<Image
											src={'/editWhite.svg'}
											alt={'heart'}
											width={35}
											height={35}
											className='justify-self-center valign '
										/>
										<p className='mt-3 valign'>
											1340 x 300 pixels
										</p>
									</div>
								</div>
							)}
						</div>

						<input
							ref={hiddenFileInput}
							hidden
							className=''
							type='file'
							accept='image/*'
							onChange={handleImageUpload}
						/>
					</>
					{/* {imgEdit && (
					<div
						className='overlay  cursor-pointer content-center relative'
						onClick={(e) => {
							imgEdit === true &&
								hiddenFileInput &&
								hiddenFileInput.current &&
								hiddenFileInput.current.click();
						}}
					>
						<Image
							src={'/editWhite.svg'}
							alt={'heart'}
							width={35}
							height={35}
							className='justify-self-center '
						/>
						<p className='mt-3'>1340 x 300 pixels</p>
					</div>
				)} */}
				</div>
				<div className='h-full mt-10 flex-[2]'>
					<Tabs
						variant='underlined'
						data-tour='tabs'
						aria-label='Tabs variants'
						fullWidth
						classNames={{
							tabList:
								'w-full relative rounded-none p-0 border-b border-b-[0.5] text-[#F1F0EB]',
							cursor: 'w-full bg-[#F1F0EB] text-[#F1F0EB]',
							tabContent:
								'text-[#F1F0EB] tracking-[1px] text-[15px] font-[300] group-data-[selected=true]:text-[#F1F0EB] group-data-[selected=true]:font-semibold uppercase',
						}}
						// onSelectionChange={(index) => {
						// 	if (index.toString() !== 'profile') {
						// 		setImgEdit(false);
						// 		setImg2Upload(undefined);
						// 	}
						// }}
					>
						<Tab key='profile' title='Profile'>
							<ProfileTab
								walletAddress={walletAddress}
								// onEdit={(edit) => {
								// 	setImgEdit(edit);
								// }}
								bannerFile={img2Upload?.file}
								onProfileChange={(prf) => {
									setProfile(prf);
								}}
							/>
						</Tab>
						<Tab key='gallery' title='Gallery'>
							<GalleryTab
								walletAddress={walletAddress}
								banner={profile?.bannerUrl}
							/>
						</Tab>
						<Tab key='social' title='Social'>
							<SocialTab walletAddress={walletAddress} />
						</Tab>
					</Tabs>
					{/* <AppTour /> */}
				</div>
			</TourProvider>
		</main>
	);
}
