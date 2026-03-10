'use client';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	Badge,
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	Popover,
	PopoverContent,
	PopoverTrigger,
	useDisclosure,
} from '@nextui-org/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
	ReactElement,
	useEffect,
	useRef,
	useState,
	useCallback,
	useMemo,
} from 'react';
import { decodeJWT, login } from '@/apihandler/Login';
import { getProfile } from '@/apihandler/Profile';
import {
	clearNotification,
	getNotifications,
	markNotificationAsRead,
} from '@/apihandler/Notification';
import { NotificationMessage, NotificationType } from '@/types';
import InviteCollaborator from './Project/InviteCollaborator';
import MobileMenu from './MobileMenu';
import OnboardingPopUp from './OnboardingPopUp';
import LoginModal from './LoginModal';
import useKamiWallet from '@/lib/KamiWalletHook';
import { deleteCookie, getCookie, setCookie } from 'cookies-next';
import {
	parseVoucherMetadata,
	useCartCount,
	useCartPreview,
	useCartState,
} from '@/hooks/useCartState';
import Wallet from './Wallet/WalletComponent';
import {
	convertIPFSUrl,
	getChainIcons,
	numberFormat,
	replaceVoucherWithAsset,
} from '@/lib/Util';

/**
 * NavBar component that handles user authentication and displays navigation elements.
 *
 * @param {Object} props - Component properties.
 * @param {ReactElement} [props.children] - Optional children elements to be rendered inside the NavBar.
 *
 * @returns {ReactElement} The rendered NavBar component.
 */
export default function NavBar({ children }: { children?: ReactElement }) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const router = useRouter();
	const wallet = useKamiWallet();
	const [gs, setGs] = useGlobalState();
	const [notifications, setNotifications] = useState<NotificationType[]>([]);
	const [isOpenOnboarding, setIsOpenOnboarding] = useState<boolean>(false);
	const [isOpenNoti, setIsOpenNoti] = useState(false);
	const [isOpenLogin, setIsOpenLogin] = useState<boolean>(false);
	const [notificationId, setNotificationId] = useState<number | null>(null);
	const [notificationPayload, setNotificationPayload] =
		useState<NotificationMessage | null>(null);
	const {
		isOpen: isWhiteWarningOpen,
		onOpen: onWhiteWarningOpen,
		onOpenChange: onWhiteWarningOpenChange,
	} = useDisclosure();
	const [isWalletOpen, setIsWalletOpen] = useState(false);
	const [walletView, setWalletView] = useState<
		'dashboard' | 'transfer' | 'history' | 'settings'
	>('dashboard');
	const [isOpenCart, setIsOpenCart] = useState(false);
	const cartHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Always call hooks unconditionally - handle empty wallet address inside hooks
	const walletAddress = useMemo(
		() => gs?.walletAddress || '',
		[gs?.walletAddress],
	);
	const { count: cartCount } = useCartCount(walletAddress);
	const { items: cartPreviewItems, removeItem: removeCartItem } =
		useCartPreview(walletAddress, 5);
	const { syncWithServer } = useCartState(walletAddress || '');

	// Debounced cart hover handlers
	const handleCartMouseEnter = useCallback(() => {
		if (cartHoverTimeoutRef.current) {
			clearTimeout(cartHoverTimeoutRef.current);
		}
		cartHoverTimeoutRef.current = setTimeout(() => {
			syncWithServer();
			setIsOpenCart(true);
		}, 200); // 200ms delay to prevent excessive triggers
	}, []);

	const handleCartMouseLeave = useCallback(() => {
		if (cartHoverTimeoutRef.current) {
			clearTimeout(cartHoverTimeoutRef.current);
		}
		cartHoverTimeoutRef.current = setTimeout(() => {
			setIsOpenCart(false);
		}, 300); // 300ms delay to allow moving to popover
	}, []);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (cartHoverTimeoutRef.current) {
				clearTimeout(cartHoverTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const initWindow = async () => {
			if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
				// console.log('Setting up service worker communication...');

				// Register service worker
				try {
					const registration =
						await navigator.serviceWorker.register('/sw.js');
					// console.log('Service Worker registered:', registration);

					// Wait for service worker to be ready
					await navigator.serviceWorker.ready;
				} catch (error) {
					console.error('Service Worker registration failed:', error);
				}

				// Listen for messages from service worker
				const handleServiceWorkerMessage = (event: MessageEvent) => {
					// console.log('NavBar received message from service worker:', event.data);

					if (event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
						// console.log('Push notification received in NavBar:', event.data.payload);
						// Refresh notifications when a new push is received
						if (gs?.walletAddress) {
							getNotification(gs.walletAddress);
						}
					}

					if (event.data.type === 'NOTIFICATION_CLICKED') {
						// console.log('Notification clicked in NavBar:', event.data.payload);
						// Handle notification click navigation
					}

					if (event.data.type === 'TEST_RESPONSE') {
						// console.log('Test response received in NavBar:', event.data.payload);
					}
				};

				// Add message listener
				navigator.serviceWorker.addEventListener(
					'message',
					handleServiceWorkerMessage,
				);

				// Test service worker communication after a delay
				setTimeout(() => {
					// console.log('Testing service worker communication...');
					if (navigator.serviceWorker.controller) {
						// console.log('Service worker controller found, sending test message');
						navigator.serviceWorker.controller.postMessage({
							type: 'TEST_MESSAGE',
							payload: 'Hello from NavBar!',
						});
					} else {
						console.log('No service worker controller found');
					}
				}, 2000);

				// Add a manual test function to window for debugging
				(window as any).testServiceWorkerCommunication = () => {
					// console.log('Manual test triggered');
					if (navigator.serviceWorker.controller) {
						navigator.serviceWorker.controller.postMessage({
							type: 'TEST_MESSAGE',
							payload: 'Manual test from NavBar!',
						});
					} else {
						console.log(
							'No service worker controller found for manual test',
						);
					}
				};

				// Cleanup function
				return () => {
					navigator.serviceWorker.removeEventListener(
						'message',
						handleServiceWorkerMessage,
					);
				};
			}
		};
		initWindow();
	}, [gs?.walletAddress]);

	useEffect(() => {
		if (gs && gs.isLoggedIn) return;
		const token = getCookie('jwt');
		if (token) {
			// console.log('token', token);
			decodeJWT(token).then((decodedToken) => {
				// console.log('decodedToken', decodedToken);
				if (decodedToken) {
					setGs({
						isLoggedIn: true,
						walletAddress: decodedToken.walletAddress,
						categories: decodedToken.categories,
						email: decodedToken.email,
						userId: decodedToken.userName,
					});
				}
			});
		}
	}, []);

	// Cart state is now managed by optimized hooks - no manual event listeners needed

	// Effect to load profile data when wallet changes
	useEffect(() => {
		if (!wallet?.getAccount().address) return;
		loadProfileData();
	}, [wallet?.getAccount(), gs?.isLoggedIn]);

	useEffect(() => {
		if (gs?.walletAddress) getNotification(gs?.walletAddress);
	}, [gs]);

	const getNotification = async (walletAddress: string) => {
		try {
			let notifications = await getNotifications(walletAddress);
			notifications = notifications.sort(
				(a, b) => b.createdAt - a.createdAt,
			);
			setNotifications(
				notifications.filter((notification) => !notification.readAt),
			);
		} catch (error) {
			console.error('Error fetching notifications:', error);
			return;
		}
	};
	// thirdweb bypass
	// useEffect(() => {
	// 	// if (wallet) {
	// 	loadProfileData();
	// 	// }
	// }, []);

	/**
	 * Loads profile data for the active wallet and handles login.
	 *
	 * @returns {Promise<boolean>} A promise that resolves to a boolean indicating success or failure.
	 */
	const loadProfileData = async (): Promise<boolean> => {
		if (gs?.isLoggedIn || !wallet?.getAccount()?.address || !gs?.email)
			return false;

		const walletAddress = wallet.getAccount().address!;
		const email = gs.email;
		const loginData = { walletAddress, email };

		try {
			const loginResponse = await login(loginData);

			if (!loginResponse.success) {
				if (loginResponse.status === 404) {
					setIsOpenOnboarding(true);
				} else {
					setGs({
						isLoggedIn: false,
						walletAddress: undefined,
						email: undefined,
						userId: undefined,
					});
					onWhiteWarningOpenChange();
				}
				return false;
			}

			const profileData = await getProfile(walletAddress);

			setGs({
				categories: loginResponse.decodedToken?.categories,
				isLoggedIn: true,
				...(profileData.success &&
					profileData.profile && {
						profile: profileData.profile,
						userId: profileData.profile.userName,
						walletAddress,
					}),
			});

			return true;
		} catch (error) {
			console.error('Error loading profile data:', error);
			return false;
		}
	};
	const triggerButtonClick = () => {
		setIsOpenNoti(false);
		if (buttonRef.current) {
			buttonRef.current.click(); // Programmatically trigger the button click
		}
	};
	// Fetch chain icons on mount and store in global state
	useEffect(() => {
		if (gs?.chainIcons) {
			return;
		} else {
			getChainIcons().then((chain) => {
				if (chain) {
					setGs({
						chainIcons: chain,
					});
				}
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const getChainIcon = (chainId: string) => {
		if (chainId && gs?.chainIcons) {
			return gs.chainIcons[chainId];
		}
		return undefined;
	};

	return (
		<>
			<div className='flex flex-row w-full px-5 md:px-10 py-5 items-center'>
				<div className='block md:hidden justify-center'>
					<Image
						src={'/kamiGreen.png'}
						alt={'logo'}
						width={100}
						height={100}
						className='ml-5'
					/>
				</div>
				<div className='flex-1 '>{children}</div>
				<div className='h-[50px] items-center flex justify-end gap-4'>
					{wallet?.getAccount().address && (
						<Popover
							showArrow
							offset={10}
							placement='bottom'
							isOpen={isOpenNoti}
							onOpenChange={(open: boolean) => {
								setIsOpenNoti(open);
							}}
						>
							<Badge
								content={
									notifications.filter((n) => !n.readAt)
										.length
								}
								color='success'
								size='sm'
								showOutline={false}
								placement='top-right'
								isInvisible={
									notifications.filter((n) => !n.readAt)
										.length === 0
								}
							>
								<PopoverTrigger>
									<Button
										size='sm'
										className='bg-transparent'
										isIconOnly
									>
										<Image
											className='cursor-pointer'
											src={'/bell.svg'}
											alt={'bell'}
											width={27}
											height={27}
										/>
									</Button>
								</PopoverTrigger>
							</Badge>
							<PopoverContent className='w-full min-w-[300px] max-w-[500px] bg-background'>
								{(titleProps) => (
									<div className='px-1 py-2 w-full '>
										{notifications.length > 0 && (
											<div className='flex justify-between items-center'>
												<p className='text-foreground text-[18px] font-semibold'>
													Notifications
												</p>
												<Button
													size='sm'
													className='bg-transparent'
													isIconOnly
													onClick={() =>
														gs?.walletAddress &&
														clearNotification(
															gs.walletAddress,
														).then(() => {
															gs?.walletAddress &&
																getNotification(
																	gs.walletAddress,
																);
														})
													}
												>
													<Image
														className='cursor-pointer'
														src={
															'/creator/trash.svg'
														}
														alt={'trash'}
														width={27}
														height={27}
													/>
												</Button>
											</div>
										)}
										{/* <p className='text-small font-bold text-foreground' {...titleProps}>
									Notifications
								</p> */}
										<div className='mt-2 flex flex-col w-full divide-y divide-slate-200 max-h-[550px] overflow-y-auto'>
											{notifications.length === 0 && (
												<p className='text-small italic text-slate-500'>
													No notifications
												</p>
											)}
											{notifications.map((n, index) => {
												const payload: NotificationMessage =
													JSON.parse(n.message);
												if (!payload.topic) {
													return null;
												}
												if (
													payload.topic.includes(
														'post',
													)
												) {
													return (
														<div
															key={index}
															className='flex flex-row gap-2 h-10 py-4 items-center justify-between'
															onClick={async () =>
																await markNotificationAsRead(
																	n.id,
																)
															}
														>
															<Image
																src={
																	payload
																		.payload
																		.from
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-full bg-slate-200 w-8 h-8 cursor-pointer aspect-square object-cover'
																alt={'avatar'}
																width={27}
																height={27}
																onClick={() => {
																	setIsOpenNoti(
																		false,
																	);
																	router.push(
																		`/profile/${payload.payload.walletAddress}`,
																	);
																}}
															/>
															<span className='text-small text-foreground w-full'>
																{
																	payload.message
																}
															</span>
															<Image
																src={
																	payload
																		.payload
																		.from
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-md bg-slate-200 w-8 h-8 cursor-pointer aspect-square object-cover'
																alt={'avatar'}
																width={27}
																height={27}
																onClick={() => {
																	setIsOpenNoti(
																		false,
																	);
																	router.push(
																		`/post/${payload.payload.postId}`,
																	);
																}}
															/>
														</div>
													);
												} else if (
													payload.topic.includes(
														'project',
													)
												) {
													return (
														<div
															key={index}
															className='flex flex-row gap-2 h-10 py-4 items-center justify-between'
														>
															<Image
																src={
																	payload
																		.payload
																		.from
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-full bg-slate-200 w-8 h-8 aspect-square object-cover cursor-pointer'
																alt={'avatar'}
																width={27}
																height={27}
															/>
															<span className='text-small text-foreground w-full'>
																{
																	payload.message
																}
															</span>
															<Button
																className={`bg-[#11FF49]`}
																size='sm'
																onClick={() => {
																	setNotificationPayload(
																		payload,
																	);
																	setNotificationId(
																		n.id,
																	);
																	triggerButtonClick();
																}}
															>
																View
															</Button>
														</div>
													);
												} else if (
													payload.topic.includes(
														'product',
													)
												) {
													return (
														<div
															key={index}
															className='flex flex-row gap-2 h-10 py-4 items-center justify-between'
															onClick={async () =>
																await markNotificationAsRead(
																	n.id,
																)
															}
														>
															<Image
																src={
																	payload
																		.payload
																		.from
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-full bg-slate-200 w-8 h-8 cursor-pointer aspect-square object-cover '
																alt={'avatar'}
																width={27}
																height={27}
																onClick={() => {
																	setIsOpenNoti(
																		false,
																	);
																	router.push(
																		`/profile/${payload.payload.walletAddress}`,
																	);
																}}
															/>
															<span className='text-small text-foreground w-full'>
																{
																	payload.message
																}
															</span>
															<Image
																src={
																	payload
																		.payload
																		.product
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-md bg-slate-200 w-8 h-8 cursor-pointer aspect-square object-cover'
																alt={'avatar'}
																width={27}
																height={27}
																onClick={() => {
																	setIsOpenNoti(
																		false,
																	);

																	router.push(
																		`/product/${payload.payload.productId}`,
																	);
																}}
															/>
														</div>
													);
												} else if (
													payload.topic.includes(
														'collection',
													)
												) {
													return (
														<div
															key={index}
															className='flex flex-row gap-2 h-10 py-4 items-center justify-between'
															onClick={async () =>
																await markNotificationAsRead(
																	n.id,
																)
															}
														>
															<Image
																src={
																	payload
																		.payload
																		.from
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-full bg-slate-200 w-8 h-8 cursor-pointer aspect-square object-cover'
																alt={'avatar'}
																width={27}
																height={27}
																onClick={() => {
																	setIsOpenNoti(
																		false,
																	);
																	router.push(
																		`/profile/${payload.payload.walletAddress}`,
																	);
																}}
															/>
															<span className='text-small text-foreground w-full'>
																{
																	payload.message
																}
															</span>
															<Image
																src={
																	payload
																		.payload
																		.collection
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-md bg-slate-200 w-8 h-8 cursor-pointer aspect-square object-cover'
																alt={'avatar'}
																width={27}
																height={27}
																onClick={() => {
																	setIsOpenNoti(
																		false,
																	);

																	router.push(
																		`/collection/${payload.payload.collectionId}`,
																	);
																}}
															/>
														</div>
													);
												} else if (
													payload.topic.includes(
														'follow',
													) ||
													payload.topic.includes(
														'order',
													)
												) {
													return (
														<div
															key={index}
															className='flex flex-row gap-2 h-10 py-4 items-center justify-between'
															onClick={async () =>
																await markNotificationAsRead(
																	n.id,
																)
															}
														>
															<Image
																src={
																	payload
																		.payload
																		.from
																		?.avatarUrl ??
																	'/settings/avatarIcon.svg'
																}
																className='rounded-full bg-slate-200 w-8 h-8 cursor-pointer aspect-square object-cover'
																alt={'avatar'}
																width={27}
																height={27}
																onClick={() => {
																	setIsOpenNoti(
																		false,
																	);
																	router.push(
																		`/profile/${payload.payload.walletAddress}`,
																	);
																}}
															/>
															<span className='text-small text-foreground w-full'>
																{
																	payload.message
																}
															</span>
														</div>
													);
												}
											})}
										</div>
									</div>
								)}
							</PopoverContent>
						</Popover>
					)}

					{/* Popover and Badge for cart */}
					{wallet?.getAccount().address && (
						<Popover
							showArrow
							offset={10}
							placement='bottom'
							isOpen={isOpenCart}
							onOpenChange={(open: boolean) => {
								setIsOpenCart(open);
							}}
						>
							<Badge
								color='danger'
								size='sm'
								content={cartCount}
								placement='top-right'
								showOutline={false}
								isInvisible={cartCount === 0}
							>
								<PopoverTrigger>
									<Button
										size='sm'
										className='bg-transparent'
										isIconOnly
										onClick={() => router.push('/cart')}
										onMouseEnter={handleCartMouseEnter}
										onMouseLeave={handleCartMouseLeave}
									>
										<Image
											src={'/cart.svg'}
											alt={'cart'}
											width={27}
											height={27}
										/>
									</Button>
								</PopoverTrigger>
							</Badge>
							<PopoverContent
								className='w-full min-w-[170px] max-w-[300px] bg-background'
								onMouseEnter={handleCartMouseEnter}
								onMouseLeave={handleCartMouseLeave}
							>
								<div className='px-1 py-2 w-full '>
									<p className='text-small font-bold text-foreground'>
										Cart
									</p>
									<div className='mt-2 flex flex-col w-full divide-y divide-slate-200 max-h-[300px] overflow-y-auto'>
										{cartPreviewItems.length === 0 && (
											<p className='text-small italic text-slate-500'>
												Your cart is empty
											</p>
										)}
										{cartPreviewItems.map((item) => {
											const metaData = item.assetId
												? parseVoucherMetadata(
														item.product?.asset?.find(
															(asset) =>
																asset.id ===
																item.assetId,
														)?.metadata,
													)
												: parseVoucherMetadata(
														item.product?.voucher
															?.metadata,
													);

											return (
												<div
													key={item.productId}
													className='flex flex-row gap-2 py-2 items-center justify-between min-w-0'
												>
													<div className='flex items-center gap-2 flex-1 min-w-0 overflow-hidden'>
														<div className='w-8 h-8 bg-slate-200 rounded overflow-hidden flex-shrink-0'>
															{metaData?.image ? (
																<Image
																	src={
																		convertIPFSUrl(
																			metaData.image,
																		) ?? ''
																	}
																	alt={
																		item
																			.product
																			.name
																	}
																	width={64}
																	height={64}
																	className='object-cover w-full h-full'
																	onError={(
																		e,
																	) => {
																		console.warn(
																			`Failed to load image for ${item.product.name}:`,
																			metaData.image,
																		);
																		// Hide the image element on error
																		(
																			e.target as HTMLImageElement
																		).style.display =
																			'none';
																	}}
																/>
															) : (
																<div className='w-full h-full flex items-center justify-center text-slate-400 text-xs'>
																	No Image
																</div>
															)}
														</div>
														<div className='flex-1 min-w-0 overflow-hidden'>
															<div className='text-xs font-medium text-foreground truncate'>
																{item.product
																	.name ||
																	'Product'}
															</div>
															<div className='flex flex-row items-center gap-1'>
																{item.product
																	.collection
																	.chainId && (
																	<Image
																		src={
																			getChainIcon(
																				item
																					.product
																					.collection
																					.chainId,
																			)!
																		}
																		alt='chain icon'
																		width={
																			12
																		}
																		height={
																			12
																		}
																	/>
																)}
																<p className='text-xs text-slate-500'>
																	{
																		item
																			.product
																			.currencySymbol
																	}{' '}
																	{numberFormat(
																		parseFloat(
																			(item.assetId
																				? item.product.asset?.find(
																						(
																							asset,
																						) =>
																							asset.id ===
																							item.assetId,
																					)
																						?.price
																				: item
																						.product
																						.price) ||
																				'0',
																		),
																	) +
																		' × ' +
																		item.quantity}
																</p>
															</div>
														</div>
													</div>
													<Button
														className='bg-[#FF3B3B]'
														size='sm'
														isIconOnly
														onClick={() =>
															removeCartItem(
																item.id,
															)
														}
													>
														<Image
															className='cursor-pointer'
															src={
																'/creator/trash.svg'
															}
															alt={'remove'}
															width={16}
															height={16}
														/>
													</Button>
												</div>
											);
										})}
									</div>
								</div>
							</PopoverContent>
						</Popover>
					)}

					{wallet?.getAccount().address && (
						<div
							className='hidden md:flex '
							data-tour='profile-section'
						>
							<Popover
								showArrow
								offset={10}
								placement='bottom'
								isOpen={isWalletOpen}
								onOpenChange={(open: boolean) => {
									// Prevent closing if in transfer view
									if (!open && walletView === 'transfer') {
										return;
									}
									setIsWalletOpen(open);
									// Reset wallet view when closing
									if (!open) {
										setWalletView('dashboard');
									}
								}}
								shouldCloseOnBlur={walletView !== 'transfer'}
								className='popover-arrow-left-58'
							>
								<PopoverTrigger>
									<Button
										size='sm'
										className='bg-transparent'
										isIconOnly
									>
										<Image
											className='cursor-pointer'
											src={'/wallet.svg'}
											alt={'wallet'}
											width={27}
											height={27}
										/>
									</Button>
								</PopoverTrigger>
								<PopoverContent className='bg-black'>
									<Wallet onViewChange={setWalletView} />
								</PopoverContent>
							</Popover>
						</div>
					)}
					{
						<div
							className='hidden md:flex '
							data-tour='profile-section'
						>
							{wallet?.getAccount().address ? (
								<button
									className='bg-[#323131] rounded-lg p-2 px-8 text-center text-white'
									onClick={() => {
										if (gs && wallet && gs.profile)
											setGs({
												profile: undefined,
												walletAddress: undefined,
												isLoggedIn: false,
											});
										deleteCookie('jwt');
										wallet.logout();
										setNotifications([]);
										router.push('/home');
									}}
								>
									Logout
								</button>
							) : (
								<Button
									className='rounded-lg py-4 px-10 text-center bg-[#323131] text-white text-[15px]'
									onClick={() => {
										setIsOpenLogin(true);
									}}
								>
									Login
								</Button>
							)}
						</div>
					}
				</div>
				<MobileMenu>
					{
						<div className='flex md:hidden '>
							{wallet?.getAccount() ? (
								<p
									className='text-[15px] text-[#F1F0EB]'
									onClick={() => {
										if (gs && wallet && gs.profile)
											setGs({
												profile: undefined,
												walletAddress: undefined,
												isLoggedIn: false,
											});
										deleteCookie('jwt');
										wallet.logout();
										setNotifications([]);
										router.push('/home');
									}}
								>
									Logout
								</p>
							) : (
								<Button
									className='rounded-lg py-4 px-10 text-center bg-[#323131] text-white text-[15px]'
									onClick={() => {
										setIsOpenLogin(true);
									}}
								>
									Login
								</Button>
							)}
						</div>
					}
				</MobileMenu>
				<Modal
					className='dark text-foreground bg-background'
					isOpen={isWhiteWarningOpen}
					onOpenChange={onWhiteWarningOpenChange}
				>
					<ModalContent>
						{(onClose) => (
							<>
								<ModalHeader className='flex flex-col gap-1'>
									WHITELISTED USERS ONLY
								</ModalHeader>
								<ModalBody>
									<p>
										Only users whitelisted by KAMI are able
										to login during the pre-launch phase.
									</p>
									<p>
										If you believe you should be whitelisted
										you may contact{' '}
										<a
											className='text-blue-600'
											href='mailto:KAMI Support<support@kamiunlimited.com>?subject=Request Whitelisting'
										>
											KAMI-Support
										</a>
										.
									</p>
								</ModalBody>
								<ModalFooter>
									<Button
										color='danger'
										variant='light'
										onPress={onClose}
									>
										Close
									</Button>
								</ModalFooter>
							</>
						)}
					</ModalContent>
				</Modal>
				<OnboardingPopUp
					isOpenOnboarding={isOpenOnboarding}
					setIsOpenOnboarding={setIsOpenOnboarding}
				/>
				<LoginModal
					isOpenLogin={isOpenLogin}
					onWhiteListFailed={() => {
						onWhiteWarningOpen();
					}}
					setIsOpenLogin={setIsOpenLogin}
				/>
				{/* {notifications.map((n, i) => {
				const payload: NotificationMessage = JSON.parse(n.message);

				if (payload.topic.includes('project')) {
					return ( */}

				{/* );
				}
			})} */}
			</div>

			<InviteCollaborator
				mode={'accept'}
				projectId={notificationPayload?.payload.projectId ?? 0}
				walletAddress={
					notificationPayload?.payload.from?.walletAddress ?? ''
				}
				avatar={notificationPayload?.payload.from?.avatarUrl ?? ''}
				username={notificationPayload?.payload.from?.userName ?? ''}
				description={
					notificationPayload?.payload.from?.description ?? ''
				}
				inviteMessageSrc={notificationPayload?.payload.message ?? ''}
				projectName={notificationPayload?.payload.projectName ?? ''}
				notificationId={notificationId ?? undefined}
				buttonRef={buttonRef}
			/>
		</>
	);
}
