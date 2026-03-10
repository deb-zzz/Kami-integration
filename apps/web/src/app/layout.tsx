'use client';
import { Inter } from 'next/font/google';
import './globals.css';
import SideBar from '@/components/SideBar';
import { NextUIProvider } from '@nextui-org/react';
import GlobalStateContextProvider from '@/lib/GlobalContext';
import LazyNFTContextProvider from '@/lib/VoucherContext';
import SearchContextProvider from '@/lib/SearchContextProvider';
import { Suspense, useState, useEffect } from 'react';
import NavBar from '@/components/NavBar';
import 'tldraw/tldraw.css';
import ReactQueryProvider from '@/app/profile/[wallet]/ReactQueryProvider';
import Image from 'next/image';
import { PostHogProvider } from './providers';
import { TourProvider, useTour } from '@reactour/tour';
import { useGlobalState } from '@/lib/GlobalContext';
import { ToastContainer } from 'react-toastify';
import { useRouter, usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });
// clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID};

// export const metadata: Metadata = {
// 	title: 'KAMI - Creator Platform',
// 	description: 'Creativity at your fingertips',
// };

// Custom navigation component for the tour
function TourNavigation({
	currentStep,
	setCurrentStep,
	setIsOpen,
	steps,
}: any) {
	const [gs] = useGlobalState();
	const router = useRouter();
	const isLastStep = currentStep === steps.length - 1;
	const isFirstStep = currentStep === 0;

	const handleNext = () => {
		if (isLastStep) {
			localStorage.setItem('hasSeenTour', 'true');
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
							router.push('/profile/' + gs?.walletAddress);
						}}
						className='bg-[#11FF49] text-black px-6 py-2 rounded-lg font-medium hover:bg-[#0EEF44] transition-colors'
					>
						Continue
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
		const hasSeenTour = localStorage.getItem('hasSeenTour');
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
		localStorage.setItem('hasSeenTour', 'true');
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

// Tour steps configuration
const tourSteps = [
	{
		selector: '[data-tour="navbar"]',
		content:
			'Welcome to KAMI! This is your main navigation bar where you can search, view notifications, and access your profile.',
	},
	{
		selector: '[data-tour="sidebar"]',
		content:
			'This is your sidebar navigation. Here you can access Home, Explore, Profile, Activity, and other features.',
	},
	{
		selector: '[data-tour="create-button"]',
		content:
			'Click here to create new posts, projects, or content. This is where your creativity begins!',
	},
	{
		selector: '[data-tour="profile-section"]',
		content:
			'Access your profile, settings, and manage your account from here.',
	},
	{
		selector: 'body',
		content: (
			<div className='text-center'>
				<h3 className='text-lg font-semibold mb-3'>
					🎉 You&apos;re all set!
				</h3>
				<p className='mb-4'>
					You&apos;ve completed the KAMI platform tour. You&apos;re
					now ready to explore profile and create amazing content!
				</p>
			</div>
		),
	},
];

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const pathname = usePathname();
	return (
		<html lang='en'>
			<PostHogProvider>
				<GlobalStateContextProvider>
					<Suspense fallback={null}>
						<SearchContextProvider>
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
										boxShadow:
											'0 10px 30px rgba(0, 0, 0, 0.3)',
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
								<body
									className={`${inter.className} min-h-screen  `}
								>
									<div className='hidden md:flex flex-row '>
										{pathname !== '/maintenance' && (
											<div data-tour='sidebar'>
												<SideBar />
											</div>
										)}
										<NextUIProvider className='w-full'>
											<ToastContainer
												position='top-right'
												className={'mt-20'}
												autoClose={2000}
												// hideProgressBar={true}
												theme='dark'
											/>
											<LazyNFTContextProvider>
												<ReactQueryProvider>
													<div className='flex flex-col w-full h-screen overflow-hidden'>
														<div
															className='flex-shrink-0 shadow-sm '
															data-tour='navbar'
														>
															{pathname !==
																'/maintenance' && (
																<NavBar />
															)}
														</div>
														<div className='overflow-hidden'>
															<div className=' max-h-full overflow-y-auto  no-scrollbar'>
																{children}
															</div>
														</div>
													</div>
												</ReactQueryProvider>
											</LazyNFTContextProvider>
										</NextUIProvider>
									</div>
									<div className='bg-[#1a1a1a] flex md:hidden  min-h-screen w-full flex-col justify-center items-center gap-4 '>
										<Image
											src={'/kamiLogo.svg'}
											alt={'logo'}
											width={100}
											height={100}
										/>
										<p className='text-[#f1f0eb] text-[13px]'>
											For the best experience, please view
											on desktop.
										</p>
									</div>
									{/* <AppTour /> */}
								</body>
							</TourProvider>
						</SearchContextProvider>
					</Suspense>
				</GlobalStateContextProvider>
			</PostHogProvider>
		</html>
	);
}
