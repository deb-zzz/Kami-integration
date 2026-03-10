import Image from 'next/image';
import { Dispatch, SetStateAction, useEffect, useState, useRef } from 'react';
import { ProductType } from '@/types';
import CreatePost from './CreatePost';
import { useRouter } from 'next/navigation';
import { Tooltip } from '@nextui-org/react';
import {
	likeProduct,
	listForSale,
	setAudience,
	unlikeProduct,
	validateProduct,
} from '@/apihandler/Product';
import { useCartState } from '@/hooks/useCartState';
import ShareModal from './ShareModal';
import { ToastMessage } from './ToastMessage';
import ListForSalesModal from './ListForSalesModal';
import { convertIPFSUrl, numberFormat } from '@/lib/Util';

const ProductCard = ({
	isPlaylist = false,
	setIsCrateDigging,
	// openPost,
	data,
	walletAddress,
	collectionName,
	updateSpotlight,
	isSpotlight = false,
	avatarUrl,
	ownerWalletAddress,
	onProductUpdate,
	isCollection = false,
	chainIcon,
	type,
}: {
	isPlaylist?: boolean;
	setIsCrateDigging?: Dispatch<SetStateAction<boolean>>;
	// openPost: () => void;
	data?: ProductType;
	walletAddress?: string;
	collectionName?: string;
	updateSpotlight?: (id: number, isSpotlight: boolean) => void;
	isSpotlight?: boolean;
	avatarUrl?: string;
	ownerWalletAddress?: string;

	onProductUpdate?: (
		productId: number,
		updates: Partial<ProductType>,
	) => void;
	isCollection?: boolean;
	chainIcon?: string;
	type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20' | null | undefined;
}) => {
	const router = useRouter();
	const [isOpenShare, setIsOpenShare] = useState(false);
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const openPost = () => {
		setCreateIsOpen(true);
	};
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
	const [isLiked, setIsLiked] = useState<boolean>(data?.likedByMe ?? false);
	const [isMenuHovered, setIsMenuHovered] = useState<boolean>(false);
	const [isOpenListForSales, setIsOpenListForSales] =
		useState<boolean>(false);
	const [isListForSale, setIsListForSale] = useState<boolean>(false);
	const [isOwner, setIsOwner] = useState<boolean>(false);
	const [currentPrice, setCurrentPrice] = useState<string>(
		data?.price ?? '0',
	);
	const [currentAudience, setCurrentAudience] = useState<
		'Public' | 'Private' | 'Whitelist'
	>(data?.audience ?? 'Public');
	const menuRef = useRef<HTMLDivElement>(null);

	const { addToCartWithSync } = useCartState(walletAddress || '');
	const [isEditPrice, setIsEditPrice] = useState<boolean>(false);

	useEffect(() => {
		if (walletAddress) {
			setIsLoggedIn(true);
		} else {
			setIsLoggedIn(false);
		}
	}, [walletAddress]);

	useEffect(() => {
		if (isCollection) {
			setIsOwner(
				data?.ownerWalletAddress === walletAddress &&
					data?.ownerWalletAddress === ownerWalletAddress,
			);
		} else {
			setIsOwner(walletAddress === data?.ownerWalletAddress);
		}
	}, [
		data?.ownerWalletAddress,
		ownerWalletAddress,
		walletAddress,
		isCollection,
	]);

	// Update local price when data prop changes
	useEffect(() => {
		if (data?.price) {
			setCurrentPrice(data.price);
		}
	}, [data?.price]);

	// Update local audience when data prop changes
	useEffect(() => {
		if (data?.audience !== undefined) {
			setCurrentAudience(data.audience);
		}
	}, [data?.audience]);

	useEffect(() => {
		if (data?.consumerAction) {
			setIsListForSale(data.consumerAction === 'Buy' ? true : false);
		}
	}, [data?.consumerAction]);

	const [is721AC, setIs721AC] = useState<boolean>(false);
	const [isMinting, setIsMinting] = useState<boolean>(false);

	useEffect(() => {
		// maxQuantity === 0 && availableQuantity === 0: unlimited supply, minting still open
		// maxQuantity !== 0 && availableQuantity === 0: minting stopped (none left)
		// maxQuantity !== 0 && availableQuantity !== 0: supply left, minting still open
		if (
			(data?.maxQuantity ?? 0) === 0 &&
			(data?.availableQuantity ?? 0) === 0
		) {
			setIsMinting(true); // unlimited
		} else if (
			(data?.maxQuantity ?? 0) !== 0 &&
			(data?.availableQuantity ?? 0) === 0
		) {
			setIsMinting(false); // minting stopped
		} else if (
			(data?.maxQuantity ?? 0) !== 0 &&
			(data?.availableQuantity ?? 0) !== 0
		) {
			setIsMinting(true); // still minting
		}
	}, [data?.maxQuantity, data?.availableQuantity]);

	useEffect(() => {
		if (isCollection && type === 'ERC721AC') {
			setIs721AC(true);
		}
	}, [data?.maxQuantity, data?.availableQuantity, isCollection, type]);

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(event.target as Node)
			) {
				setIsMenuHovered(false);
			}
		};

		if (isMenuHovered) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isMenuHovered]);

	const clickHeart = async (liked: boolean) => {
		if (currentAudience === 'Private') return;
		const id = data?.id ? data.id : data?.productId;
		if (liked) {
			if (walletAddress && id) {
				const res = await likeProduct(walletAddress, id);
				if (res.success) {
					setIsLiked(true);
				}
			}
		} else {
			if (walletAddress && id) {
				const res = await unlikeProduct(walletAddress, id);
				if (res.success) {
					setIsLiked(false);
				}
			}
		}
	};

	const validateProductApi = async (productId: number, chainId: string) => {
		if (walletAddress) {
			const res = await validateProduct(walletAddress, productId);
			if (res.canAdd) {
				// TO ADD Chain ID HERE
				addToCartApi(productId, chainId);
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

	const addToCartApi = async (productId: number, chainId: string) => {
		if (walletAddress) {
			const data = {
				walletAddress,
				productId,
				quantity: 1,
				checkoutAction: 'None',
				chainId: chainId,
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
	const updateListForSale = async (isNotListedForSale: boolean) => {
		if (walletAddress && (data?.id ?? data?.productId)) {
			const res = await listForSale(
				walletAddress,
				data.id ?? data.productId,
				{
					consumerAction: isNotListedForSale ? 'Buy' : 'None',
				},
			);
			if (!isEditPrice) {
				if (res.success) {
					setIsListForSale(isNotListedForSale);
					if (isNotListedForSale) {
						ToastMessage('success', 'Listed for Sale');
					} else {
						ToastMessage('success', 'Unlisted for Sale');
					}
				} else {
					if (isNotListedForSale) {
						ToastMessage('error', 'Failed to list for Sale');
					} else {
						ToastMessage('error', 'Failed to unlist for Sale');
					}
				}
			} else {
				ToastMessage('success', 'Price set successfully');
			}
			setIsOpenListForSales(false);
		}
	};

	const handlePriceUpdate = (productId: number, newPrice: string) => {
		// Update local price state
		setCurrentPrice(newPrice);
		// Notify parent component to update its state
		if (onProductUpdate && data) {
			onProductUpdate(productId, {
				price: newPrice,
			});
		}
	};

	const hideProduct = async (audience: 'Public' | 'Private') => {
		if (walletAddress && (data?.id ?? data?.productId)) {
			const res = await setAudience(data.id ?? data.productId, audience);
			if (res.success) {
				// Use response audience or fallback to the opposite of requested audience
				const updatedAudience =
					res.audience ||
					(audience === 'Public' ? 'Private' : 'Public');
				// Update local state immediately for UI update
				setCurrentAudience(updatedAudience);
				// Notify parent component to update its state
				if (onProductUpdate && data) {
					onProductUpdate(data.id ?? data.productId, {
						audience: updatedAudience,
					});
				}
				ToastMessage(
					'success',
					updatedAudience === 'Private'
						? 'Product hidden'
						: 'Product shown',
				);
				if (
					updateSpotlight &&
					data.spotlight &&
					updatedAudience === 'Private'
				) {
					updateSpotlight(data?.id, false);
				}
			} else {
				ToastMessage('error', 'Failed to update product visibility');
			}
		}
	};
	return (
		<>
			<div
				className={`w-[232px] h-full flex flex-col relative ${
					currentAudience === 'Private'
						? 'cursor-default'
						: 'cursor-pointer'
				}
				${type === 'ERC721AC' ? 'mt-7' : ''} `}
			>
				{!isSpotlight && (
					<div className='absolute top-3 left-3 z-20 '>
						{is721AC && isMinting ? (
							<div className='flex items-center'>
								<div className='bg-[#11FF49] flex items-center justify-center p-1 rounded-full -mr-[10px] z-10 h-[28px] w-[28px]'>
									<Image
										src='/product/remaining.svg'
										alt='menu'
										width={18}
										height={18}
										className='text-white cursor-pointer'
									/>
								</div>
								<div className=' border-1.5 border-[#11FF49] p-1 pl-3 pr-2 rounded-md bg-[#1A1A1A]'>
									<p className='text-[10px] text-[#11FF49]'>
										{data?.maxQuantity === 0
											? 'Unlimited'
											: data?.availableQuantity +
												' remaining'}
									</p>
								</div>
							</div>
						) : (
							isOwner &&
							(currentAudience === 'Public' ? (
								<Image
									src='/product/hide.svg'
									alt='menu'
									width={25}
									height={25}
									className='text-white cursor-pointer'
									onClick={() => hideProduct('Private')}
								/>
							) : (
								currentAudience === 'Private' && (
									<Image
										src='/product/show.svg'
										alt='menu'
										width={25}
										height={25}
										className='text-white cursor-pointer'
										onClick={() => hideProduct('Public')}
									/>
								)
							))
						)}
					</div>
				)}
				{isOwner && (
					<>
						{/* Menu button in top right corner */}
						{/* for now the updateSpotlight is used here as we hid the list for sales. Need to remove this later once list for sales is implemented */}
						{/* so now, we only show the menu in owner's product card and when the spotlight is switched on */}

						<div
							ref={menuRef}
							className={`${
								currentAudience === 'Private'
									? 'opacity-40'
									: ''
							} absolute top-3 right-3 z-20`}
						>
							<div
								// className='cursor-pointer'
								onClick={(e) => {
									e.stopPropagation();
									if (currentAudience === 'Private') return;
									setIsMenuHovered(!isMenuHovered);
								}}
							>
								<Image
									src='/product/menu.svg'
									alt='menu'
									width={25}
									height={25}
									className='text-white'
								/>
							</div>

							{/* Dropdown Menu - positioned closer with no gap */}
							{isMenuHovered && (
								<div className='absolute top-[34px] right-2 bg-[#6E6E6E] border border-gray-200 shadow-lg w-fit min-w-[150px] py-1 z-30'>
									{!isSpotlight && (
										<>
											{!is721AC && !isMinting && (
												<div
													className={`px-2 py-2 text-[13px] text-[#F1F0EB] cursor-pointer ${
														updateSpotlight
															? 'border-b border-gray-200'
															: ''
													}`}
													onClick={(e) => {
														e.stopPropagation();
														setIsMenuHovered(false);

														if (isListForSale) {
															updateListForSale(
																false,
															);
														} else {
															setIsOpenListForSales(
																true,
															);
														}
														setIsEditPrice(false);
													}}
												>
													{isListForSale
														? 'Unlist from'
														: 'List for'}{' '}
													Sale
												</div>
											)}
											{isListForSale && (
												<div
													className={`px-2 border-gray-200 py-2 text-[13px] text-[#F1F0EB] cursor-pointer ${
														updateSpotlight
															? 'border-b '
															: 'border-t'
													}
													${is721AC && !isMinting ? 'border-none' : ''}
													`}
													onClick={(e) => {
														e.stopPropagation();
														setIsMenuHovered(false);

														setIsOpenListForSales(
															true,
														);
														setIsEditPrice(true);
													}}
												>
													Edit Price
												</div>
											)}
										</>
									)}
									{updateSpotlight && (
										<div
											onClick={(e) => {
												e.stopPropagation();
												setIsMenuHovered(false);
												if (
													updateSpotlight &&
													data?.id
												) {
													updateSpotlight(
														data?.id,
														isSpotlight
															? false
															: true,
													);
												}
											}}
											className='px-2 py-1 text-[13px] text-[#F1F0EB] cursor-pointer  '
										>
											{isSpotlight
												? 'Remove from Spotlight '
												: ' Add to Spotlight'}
										</div>
									)}
								</div>
							)}
						</div>
					</>
				)}
				<div
					className={`${
						currentAudience === 'Private' && !isSpotlight
							? 'opacity-40'
							: ''
					}`}
				>
					<div
						onClick={() => {
							// if (isPlaylist) {
							// 	// Navigate to playlist page
							if (currentAudience === 'Private') {
								return;
							}
							let id = data?.productId
								? data?.productId
								: data?.id;
							// router.push('/product/' + id);
							if (type === 'ERC721AC') {
								router.push('/asset/' + id);
							} else {
								router.push('/product/' + id);
							}
							if (setIsCrateDigging) setIsCrateDigging(true);
							// }
						}}
					>
						{isPlaylist ||
							(isCollection && type === 'ERC721AC' && (
								<>
									<div className=' w-full  absolute -top-5 z-0'>
										<div className='w-[85%] bg-[#454343] h-[20px] m-auto'></div>
									</div>
									<div className=' w-full  absolute -top-3 z-2 '>
										<div className='w-[95%] bg-[#6E6E6E] h-[20px] m-auto'></div>
									</div>
								</>
							))}
						<div
							className={`relative bg-black flex-2 z-10 ${
								isPlaylist && 'mt-10'
							} `}
						>
							{/* mediaurl - inventory api from profile || imageurl - collection api */}
							{(data?.voucher?.mediaUrl ??
								data?.asset?.[0]?.mediaUrl) ||
							data?.imageUrl ? (
								<Image
									src={
										convertIPFSUrl(
											data?.voucher?.mediaUrl ??
												data?.asset?.[0]?.mediaUrl,
										) || data.imageUrl
									}
									alt={'card1'}
									width='200'
									height='200'
									// sizes="100vw"
									className='w-full h-[232px]  z-10  object-cover '
									draggable='false'
								/>
							) : (
								<div className='w-[100%]  h-[232px]  bg-gradient-to-b from-[#C4C4C4] to-[#5E5E5E]' />
							)}
						</div>

						<div
							className={`flex-1 px-4  py-2  text-[#1A1A1A] ${
								is721AC && isMinting
									? 'bg-[#11FF49]'
									: 'bg-[#F1F0EB]'
							} `}
						>
							{isPlaylist ? (
								<div>
									<p className='font-bold w-[60%]'>
										Dont Techno for Answer
									</p>
									<div className='h-10'></div>
								</div>
							) : (
								<>
									<div>
										<Tooltip
											className=' bg-[#1A1A1A]  cursor-pointer text-[#f1f0eb] text-[10px]'
											content={
												data?.name || collectionName
											}
										>
											<p className='font-semibold  line-clamp-1 w-fit'>
												{data?.name || collectionName}
												{/* TODO: Add collection name, not name attribute */}
											</p>
										</Tooltip>
										<p className='text-[10px] line-clamp-1'>
											{data?.name && collectionName}
										</p>
										<p className='text-[10px]'>
											ID : {data?.id ?? data?.productId}
										</p>
									</div>
									{is721AC && isMinting && !isOwner ? (
										<div className='flex flex-col items-center justify-center mt-3 mb-1 h-6 '>
											<div
												className='w-full bg-[#1A1A1A] p-1 rounded-md overflow-hidden flex items-center min-h-8 active:scale-95  transition-all duration-100 cursor-pointer'
												onClick={(e) => {
													e.stopPropagation();
													if (isOwner) return;

													if (
														data?.id ??
														data?.productId
													) {
														validateProductApi(
															data?.id ??
																data?.productId,
															data.collection
																?.chainId!,
														);
													}
													//validate the cart first
												}}
											>
												<div className='flex w-max animate-marquee-left items-center'>
													<p className='text-[14px] font-semibold uppercase text-[#11FF49] text-center whitespace-nowrap px-4'>
														Buy Now for{' '}
														{numberFormat(
															Number(
																currentPrice,
															),
															2,
														)}{' '}
														USDC
													</p>
													<p
														className='text-[14px] font-semibold uppercase text-[#11FF49] text-center whitespace-nowrap px-4'
														aria-hidden
													>
														Buy Now for{' '}
														{numberFormat(
															Number(
																currentPrice,
															),
															2,
														)}{' '}
														USDC
													</p>
												</div>
											</div>
										</div>
									) : (
										<div className='flex flex-row items-center mt-3 mb-1 h-6'>
											<div className='flex-[0.8] flex-row gap-2 flex items-center '>
												{isListForSale && (
													<>
														{chainIcon && (
															<Image
																src={
																	chainIcon ||
																	''
																}
																alt='chain icon'
																width={20}
																height={20}
															/>
														)}
														<p className='text-[15px] font-bold'>
															{/* {index >= 2 && isPrivate
											? 'Not For Sale'
											: '28 USD'} */}
															{numberFormat(
																Number(
																	currentPrice,
																),
																2,
															)}{' '}
															USDC
														</p>
													</>
												)}
											</div>
											{/* Show the add to cart button if the product is listed for sale or the owner */}
											{/* isListForSale &&  */}
											{!isOwner &&
												walletAddress &&
												isListForSale && (
													<div
														className={`opacity-100 flex-[0.2] flex items-center justify-end cursor-pointer`}
														onClick={(e) => {
															e.stopPropagation();
															if (isOwner) return;

															if (
																data?.id ??
																data?.productId
															) {
																validateProductApi(
																	data?.id ??
																		data?.productId,
																	data
																		.collection
																		?.chainId!,
																);
															}
															//validate the cart first
														}}
													>
														<Image
															src='/product/blackCart.svg'
															alt='menu'
															width={25}
															height={25}
															className='text-white'
														/>
													</div>
												)}

											{isOwner && (
												<div
													className={`opacity-100 flex-[0.2] flex items-center justify-end`}
												>
													{isListForSale && (
														<Image
															src='/product/currency.svg'
															alt='menu'
															width={25}
															height={25}
															className='text-white'
														/>
													)}

													{/* // <p>not selling</p>
													//unavailable
													<Image
														src='/product/notForSale.svg'
														alt='menu'
														width={25}
														height={25}
														className='text-white'
													/> */}
												</div>
											)}
										</div>
									)}
								</>
							)}
						</div>
					</div>
					{isLoggedIn && (
						<div className='flex px-4 py-2 justify-between text-white bg-[#9E9E9D]'>
							<div className='flex flex-row gap-2  items-end '>
								{isLiked ? (
									<div className='  w-[23px] h-[30px]  relative'>
										<Image
											src={`/fire/fire.gif`}
											alt={'fire'}
											unoptimized
											onClick={() => {
												clickHeart(false);
											}}
											layout='fill'
											objectFit='contain'
											// className=' cursor-pointer'
											draggable='false'
										/>
									</div>
								) : (
									<div className='  w-[23px] h-[30px]  relative'>
										<Image
											src={`/fire/empty.svg`}
											alt={'fire'}
											unoptimized
											onClick={() => clickHeart(true)}
											layout='fill'
											objectFit='contain'
											// className=' cursor-pointer'
											draggable='false'
										/>
									</div>
								)}

								{isLiked && (
									<p className=' h-fit mb-1 uppercase text-[#6E6E6E] text-[9px] font-semibold border border-[#6E6E6E] py-[2px] px-[6px] rounded-md'>
										Liked
									</p>
								)}
							</div>
							<div className='flex text-center items-center gap-3'>
								<Image
									//className='cursor-pointer '
									alt='Share'
									draggable='false'
									width={23}
									height={23}
									src={'/post/send.svg'}
									onClick={(e) => {
										e.stopPropagation();
										if (currentAudience === 'Private')
											return;
										setIsOpenShare(true);
									}}
								/>

								<Tooltip
									className='bg-black  text-[10px]'
									content='Coming Soon..'
									isDisabled={currentAudience === 'Private'}
								>
									<Image
										//className='cursor-pointer '
										alt='Playlist'
										draggable='false'
										width={23}
										height={23}
										src={'/post/playlistGreyProd.svg'}
									/>
								</Tooltip>

								<Image
									onClick={(e) => {
										e.preventDefault();
										if (currentAudience === 'Private')
											return;
										openPost();
									}}
									// className='cursor-pointer '
									alt='post'
									draggable='false'
									width={23}
									height={23}
									src={'/post/post.svg'}
								/>
							</div>
						</div>
					)}
				</div>

				{data && (
					<CreatePost
						isOpen={createIsOpen}
						setIsOpen={setCreateIsOpen}
						isRepost={false}
						content={[
							{
								collectionId: data.collectionId,
								productId: data.productId ?? data.id,
								imageURl:
									data.imageUrl ??
									data.voucher?.mediaUrl ??
									data.asset?.[0]?.mediaUrl,
							},
						]}
						walletAddress={walletAddress}
					/>
				)}
			</div>
			<ShareModal
				isOpenShare={isOpenShare}
				setIsOpenShare={setIsOpenShare}
				link={
					`https://app.kamiunlimited.com/product/` +
					(data?.id ?? data?.productId)
				}
			/>
			<ListForSalesModal
				isOpenListForSales={isOpenListForSales}
				setIsOpenListForSales={setIsOpenListForSales}
				walletAddress={walletAddress}
				productId={data?.id ?? data?.productId}
				updateListForSale={updateListForSale}
				onPriceUpdated={handlePriceUpdate}
			/>
		</>
	);
};

export default ProductCard;
