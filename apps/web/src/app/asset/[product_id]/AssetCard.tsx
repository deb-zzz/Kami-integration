import CreatePost from '@/components/CreatePost';
import ListForSalesModal from '@/components/ListForSalesModal';
import ShareModal from '@/components/ShareModal';
import { useCartState } from '@/hooks/useCartState';
import { convertIPFSUrl, numberFormat } from '@/lib/Util';
import { AssetType, VoucherContextType, VoucherMetadata } from '@/types';
import { Tooltip } from '@nextui-org/react';
import { useRouter } from 'next/navigation';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { ToastMessage } from '@/components/ToastMessage';
import {
	likeProduct,
	listForSale,
	setAudience,
	unlikeProduct,
	validateProduct,
} from '@/apihandler/Product';
import { type } from 'os';
import { MetaDataParser } from '@/lib/Util';
import {
	likeAsset,
	listAssetForSale,
	setAssetAudience,
	unlikeAsset,
} from '@/apihandler/Asset';

const AssetCard = ({
	data,
	walletAddress,
	ownerWalletAddress,
	onProductUpdate,
	chainIcon,
}: {
	data: AssetType;
	walletAddress: string;
	ownerWalletAddress: string;
	onProductUpdate?: (productId: number, updates: Partial<AssetType>) => void;
	chainIcon?: string;
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
	const [metadata, setMetadata] = useState<VoucherMetadata | null>(null);

	useEffect(() => {
		if (walletAddress) {
			setIsLoggedIn(true);
		} else {
			setIsLoggedIn(false);
		}
	}, [walletAddress]);

	useEffect(() => {
		if (walletAddress && ownerWalletAddress) {
			setIsOwner(walletAddress === ownerWalletAddress);
		}
	}, [ownerWalletAddress, walletAddress]);

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

	useEffect(() => {
		if (data?.metadata) {
			const metadata = MetaDataParser(String(data?.metadata));
			setMetadata(metadata);
		}
	}, [data?.metadata]);

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
		const id = data.id;
		if (liked) {
			if (walletAddress && id) {
				const res = await likeAsset(walletAddress, Number(id));
				if (res.success) {
					setIsLiked(true);
				}
			}
		} else {
			if (walletAddress && id) {
				const res = await unlikeAsset(walletAddress, Number(id));
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
				addToCartApi(productId, chainId, data?.id!);
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

	const addToCartApi = async (
		productId: number,
		chainId: string,
		assetId: number,
	) => {
		if (walletAddress) {
			const data = {
				walletAddress,
				productId,
				quantity: 1,
				checkoutAction: 'None',
				chainId: chainId,
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
	const updateListForSale = async (
		isNotListedForSale: boolean,
		isPriceEdit?: boolean,
	) => {
		const priceEdit = isPriceEdit ?? isEditPrice;
		if (priceEdit) {
			ToastMessage('success', 'Price set successfully');
			setIsOpenListForSales(false);
			return;
		}
		try {
			if (walletAddress && data.id) {
				const res = await listAssetForSale(data.id, {
					consumerAction: isNotListedForSale ? 'Buy' : 'None',
				});

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
			}
		} catch (error) {
			console.log('error', error);
		}
		setIsOpenListForSales(false);
	};

	const handlePriceUpdate = (assetId: number, newPrice: string) => {
		// Update local price state
		setCurrentPrice(newPrice);
		// Notify parent component to update its state
		if (onProductUpdate && data) {
			onProductUpdate(assetId, {
				price: newPrice,
			});
		}
	};

	const hideProduct = async (audience: 'Public' | 'Private') => {
		//TODO: Ask Paul
		if (walletAddress && data?.id) {
			const res = await setAssetAudience(data.id, audience);
			if (res.success) {
				// Use response audience or fallback to the opposite of requested audience
				const updatedAudience =
					res.asset.audience ||
					(audience === 'Public' ? 'Private' : 'Public');
				// Update local state immediately for UI update
				setCurrentAudience(updatedAudience);
				// Notify parent component to update its state
				if (onProductUpdate && data) {
					onProductUpdate(data.id, {
						audience: updatedAudience,
					});
				}
				ToastMessage(
					'success',
					updatedAudience === 'Private'
						? 'Product hidden'
						: 'Product shown',
				);
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
				}`}
			>
				{isOwner && (
					<>
						<div className='absolute top-3 left-3 z-20 '>
							{currentAudience === 'Public' ? (
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
							)}
						</div>

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
									<>
										<div
											className={`px-2 py-2 text-[13px] text-[#F1F0EB] cursor-pointer `}
											onClick={(e) => {
												e.stopPropagation();
												setIsMenuHovered(false);

												if (isListForSale) {
													updateListForSale(
														false,
														false,
													);
												} else {
													setIsOpenListForSales(true);
												}
												setIsEditPrice(false);
											}}
										>
											{isListForSale
												? 'Unlist from'
												: 'List for'}{' '}
											Sale
										</div>
										{isListForSale && (
											<div
												className={`px-2 border-gray-200 py-2 text-[13px] text-[#F1F0EB] cursor-pointer border-t`}
												onClick={(e) => {
													e.stopPropagation();
													setIsMenuHovered(false);

													setIsOpenListForSales(true);
													setIsEditPrice(true);
												}}
											>
												Edit Price
											</div>
										)}
									</>
								</div>
							)}
						</div>
					</>
				)}
				<div
					className={`${
						currentAudience === 'Private' ? 'opacity-40' : ''
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
							router.push(
								'/product/' +
									data?.productId +
									'?asset=' +
									data?.tokenId,
							);

							// }
						}}
					>
						<div className={`bg-black flex-2  z-10 `}>
							{/* mediaurl - inventory api from profile || imageurl - collection api */}
							{data?.mediaUrl ? (
								<Image
									src={convertIPFSUrl(data?.mediaUrl) ?? ''}
									alt={'asset'}
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
							className={`flex-1 px-4  py-2 bg-[#F1F0EB] text-[#1A1A1A] `}
						>
							<>
								<div>
									<Tooltip
										className=' bg-[#1A1A1A]  cursor-pointer text-[#f1f0eb] text-[10px]'
										content={metadata?.name || ''}
									>
										<p className='font-semibold  line-clamp-1 w-fit'>
											{metadata?.name || ''}
											{/* TODO: Add collection name, not name attribute */}
										</p>
									</Tooltip>

									<p className='text-[10px]'>
										ID : {data.tokenId}
									</p>
								</div>
								<div className='flex flex-row items-center mt-3 mb-1 h-6'>
									<div className='flex-[0.8] flex-row gap-2 flex items-center '>
										{isListForSale && (
											<>
												{chainIcon && (
													<Image
														src={chainIcon || ''}
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
														Number(currentPrice),
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
														data?.productId &&
														data.chainId
													) {
														validateProductApi(
															data?.productId,
															data.chainId,
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
							</>
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
								imageURl: data.mediaUrl || '',
								assetId: data.id,
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
				productId={data?.productId}
				isAsset={true}
				assetId={data?.id}
				updateListForSale={updateListForSale}
				onPriceUpdated={handlePriceUpdate}
			/>
		</>
	);
};

export default AssetCard;
