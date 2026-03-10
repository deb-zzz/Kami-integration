'use client';
import {
	Accordion,
	AccordionItem,
	Button,
	Checkbox,
	Divider,
	Input,
	Textarea,
	Tooltip,
} from '@nextui-org/react';
import Image from 'next/image';
import Banner from '../../../../public/profile/banner.svg';
import {
	Dispatch,
	SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import ProductCard from '@/components/ProductCard';
import useSound from 'use-sound';
import { motion } from 'framer-motion';
import CrackSound from '../../../../public/crack.mp3';
import CreatePost from '@/components/CreatePost';
import { useParams, useRouter } from 'next/navigation';
import {
	cachedGetACollection,
	getACollection,
	likeCollection,
	unlikeCollection,
	updateCollection,
} from '@/apihandler/Collections';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	CollectionType,
	Creator,
	NotificationEntitySubType,
	NotificationEntityType,
	ProductType,
	Traits,
} from '@/types';
import { format } from 'date-fns/format';
import { uploadMedia } from '@/apihandler/Project';
import axios from 'axios';
import SortComponent from '@/components/Sort';
import { MinusIcon } from '@/app/profile/[wallet]/MinusIcon';
import { getChainIcons, IsAudio, IsVideo, numberFormat } from '@/lib/Util';
import { useSearch } from '@/lib/SearchContextProvider';
import useKamiWallet from '@/lib/KamiWalletHook';
import { set } from 'date-fns';
import { createActivity } from '@/apihandler/Activity';
import { ToastMessage } from '@/components/ToastMessage';
import ShareModal from '@/components/ShareModal';
import BackButton from '@/components/BackButton';
export default function CollectionPageComponent({
	colelctionId,
}: {
	colelctionId: string;
}) {
	// const params = useParams<{ collection_id: string }>();
	const [isLiked, setIsLiked] = useState<boolean>(false);
	const [showCrack, setShowCrack] = useState<boolean>(false);
	const [play] = useSound(CrackSound);
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const openPost = () => {
		setCreateIsOpen(true);
	};

	const [gs, setGs] = useGlobalState();
	const [collectionData, setCollectionData] = useState<CollectionType>();
	const [floorPrice, setFloorPrice] = useState<number>(0);

	const [avatarImage, setAvatarImage] = useState<
		{ file: any; uploadLink?: string; destination?: string } | undefined
	>(undefined);
	const [bannerImage, setBannerImage] = useState<
		{ file: any; uploadLink?: string; destination?: string } | undefined
	>(undefined);
	const [edit, setEdit] = useState<boolean>(false);
	const avHiddenFileInput = useRef<HTMLInputElement>(null);
	const bnHiddenFileInput = useRef<HTMLInputElement>(null);
	const [products, setProducts] = useState<ProductType[]>([]);
	const [displayProducts, setDisplayProducts] = useState<
		ProductType[] | null
	>(null);
	const [creators, setCreators] = useState<Creator[]>();
	const [traits, setTraits] = useState<
		(Traits & { label: string; selected: boolean })[]
	>([]);
	const [detailsFilter, setDetailsFilter] = useState<
		{ label: string; value: string; selected: boolean }[]
	>([]);
	const [filterValue, setFilterValue] = useState<string[]>([]);
	const [filterShowValue, setFilterShowValue] = useState<string[]>([]);
	const [filterTypeValue, setFilterTypeValue] = useState<string[]>(['all']);
	const router = useRouter();
	const wallet = useKamiWallet();
	const accountAddress = wallet?.getAccount()?.address;
	const [kudosCount, setKudosCount] = useState<number>(0);
	const [isOpenShare, setIsOpenShare] = useState(false);
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

	const sortProducts = useCallback((list: ProductType[]) => {
		return [...list].sort((a, b) => {
			const aAudience = a.audience?.toLowerCase();
			const bAudience = b.audience?.toLowerCase();
			const aIsPrivate = aAudience === 'private';
			const bIsPrivate = bAudience === 'private';
			if (aIsPrivate !== bIsPrivate) {
				return aIsPrivate ? 1 : -1;
			}
			const aCreatedAt =
				typeof a.createdAt === 'number' ? a.createdAt : 0;
			const bCreatedAt =
				typeof b.createdAt === 'number' ? b.createdAt : 0;
			return bCreatedAt - aCreatedAt;
		});
	}, []);

	const getWallet = useCallback(() => {
		const getCollection = async (address: string, isLoggedIn: boolean) => {
			let data;
			if (isLoggedIn) {
				data = await getACollection(
					address,
					colelctionId as unknown as number,
				);
			} else {
				data = await cachedGetACollection(
					colelctionId as unknown as number,
				);
			}
			if (data) {
				const productsSortedByDate = [...data.products].sort(
					(a: ProductType, b: ProductType) =>
						b.createdAt - a.createdAt,
				);
				const audienceSortedProducts =
					sortProducts(productsSortedByDate);
				setCollectionData({
					...data,
					products: audienceSortedProducts,
				});
				setKudosCount(data.likes);
				setIsLiked(data.likedByMe);
				setProducts(audienceSortedProducts);

				let arr: Creator[] = [];
				// if (data.creator) arr.push(data.creator);
				if (data.collaborators && data.collaborators.length > 0) {
					for (let i = 0; i < data.collaborators.length; i++) {
						if (
							data.collaborators[i].userWalletAddress &&
							data.collaborators[i].status.toLowerCase() ===
								'accepted'
						) {
							data.collaborators[i].userProfile.walletAddress =
								data.collaborators[i].userWalletAddress;

							if (
								data.collaborators[i].userWalletAddress ===
								data.ownerWalletAddress
							) {
								arr.unshift(data.collaborators[i].userProfile);
							} else {
								arr.push(data.collaborators[i].userProfile);
							}
						}
					}
				}
				setCreators(arr);

				const details = audienceSortedProducts
					.map((item) => {
						if (item.animationUrl) {
							const type = IsAudio(item.animationUrl)
								? 'audio'
								: IsVideo(item.animationUrl)
									? 'video'
									: undefined;
							if (type) {
								return {
									label: type,
									value: type,
									selected: false,
								};
							}
						}
						return undefined;
					})
					.filter(
						(item, index, self) =>
							item !== undefined &&
							self.findIndex((i) => i?.value === item?.value) ===
								index,
					)
					.sort((a, b) => a!.label.localeCompare(b!.label));
				if (details && details.length > 0) {
					const d = [
						{ label: 'All', value: 'all', selected: true },
						...(details as {
							label: string;
							value: string;
							selected: boolean;
						}[]),
					];
					setDetailsFilter(d);
				}

				// Extract traits
				const traits = Array.from(
					new Set(
						audienceSortedProducts.flatMap(
							(item) =>
								item?.traits?.map((trait) =>
									JSON.stringify(trait),
								) ?? [],
						),
					),
				).map((trait) => {
					const parsedTrait = JSON.parse(trait);
					return {
						...parsedTrait,
						label: `${parsedTrait.value}`,
						selected: false,
					};
				});
				setTraits(traits);
			}
		};
		if (accountAddress) {
			getCollection(accountAddress, true);
			setIsLoggedIn(true);
		} else {
			getCollection('', false);
			setIsLoggedIn(false);
		}
	}, [accountAddress, colelctionId, sortProducts]);

	useEffect(() => {
		getWallet();

		// const w = wallet?.getAccount();
		// console.log('Fetching collection data for address:', w?.address);
		// if (w?.address) {
		// 	getCollection(w.address);
		// }
		// getCollection('0x0000000000');
	}, [getWallet]);

	const likedCollection = async () => {
		const w = wallet?.getAccount();
		if (w?.address && collectionData?.collectionId) {
			const res = await likeCollection(
				w.address,
				collectionData.collectionId,
			);
			if (res.success) {
				setIsLiked(true);

				setShowCrack(true);
				setKudosCount((prev) => prev + 1);
				play();
				setTimeout(function () {
					setShowCrack(false);
				}, 1500);
			}
		}
	};

	const unlikedCollection = async () => {
		const w = wallet?.getAccount();
		if (w?.address && collectionData?.collectionId) {
			const res = await unlikeCollection(
				w.address,
				collectionData.collectionId,
			);
			if (res.success) {
				setIsLiked(false);
				setKudosCount((prev) => prev - 1);
			}
		}
	};

	const handleImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
		type: 'AV' | 'BN',
	) => {
		const img = e.target.files;
		if (!img) return;
		const file = img[0];
		if (file) {
			// Validate file type - check if it's an image or GIF
			const validExtensions = /\.(jpg|jpeg|png|gif)$/i;

			if (!validExtensions.test(file.name)) {
				ToastMessage(
					'warning',
					'Please use jpg, jpeg, png or gif only',
				);
				// Clear the input
				e.target.value = '';
				return;
			}

			if (type === 'AV') setAvatarImage({ file });
			if (type === 'BN') setBannerImage({ file });
		}
	};

	const getSortData = useCallback((sorted: ProductType[]) => {
		setDisplayProducts(sorted);
	}, []);

	const filterFunction = (filterValue: string[], type: string) => {
		if (type.toLowerCase() === 'traits') {
			setFilterValue(filterValue);
		} else if (type.toLowerCase() === 'show') {
			setFilterShowValue(filterValue);
		} else {
			setFilterTypeValue(filterValue);
		}
	};

	const isOwner = useMemo(() => {
		const ownerAddress = collectionData?.ownerWalletAddress?.toLowerCase();
		const walletAddress =
			accountAddress?.toLowerCase() ?? gs?.walletAddress?.toLowerCase();
		if (!ownerAddress || !walletAddress) return false;
		return ownerAddress === walletAddress;
	}, [accountAddress, collectionData?.ownerWalletAddress, gs?.walletAddress]);

	useEffect(() => {
		if (!isOwner) {
			setFilterShowValue([]);
		}
	}, [isOwner]);

	const handleProductUpdate = useCallback(
		(productId: number, updates: Partial<ProductType>) => {
			setProducts((prevProducts) => {
				const updatedProducts = prevProducts.map((product) => {
					const currentId = product.productId ?? product.id;
					if (currentId === productId) {
						return { ...product, ...updates };
					}
					return product;
				});
				return sortProducts(updatedProducts);
			});

			setCollectionData((prevCollection) => {
				if (!prevCollection) return prevCollection;
				const updatedProducts = prevCollection.products.map(
					(product) => {
						const currentId = product.productId ?? product.id;
						if (currentId === productId) {
							return { ...product, ...updates };
						}
						return product;
					},
				);
				return {
					...prevCollection,
					products: sortProducts(updatedProducts),
				};
			});
		},
		[sortProducts],
	);

	const showFilteredProducts = useMemo(() => {
		if (filterShowValue.length === 0 || filterShowValue.includes('all')) {
			return isOwner
				? products
				: products.filter((product) => product.audience === 'Public');
		}
		const includePublic = filterShowValue.includes('public');
		const includePrivate = filterShowValue.includes('private') && isOwner;
		const filtered = products.filter((product) => {
			if (product.audience === 'Public') {
				return includePublic;
			}
			return includePrivate;
		});
		return filtered;
	}, [filterShowValue, isOwner, products]);

	const filteredProduct = useMemo(() => {
		if (filterValue.length === 0 || filterValue.includes('all'))
			return showFilteredProducts;
		return showFilteredProducts.filter((product) =>
			product.traits?.some((trait) => filterValue.includes(trait.value)),
		);
	}, [filterValue, showFilteredProducts]);

	const typeFilter = useMemo(() => {
		if (filterTypeValue.length === 0 || filterTypeValue.includes('all'))
			return filteredProduct;
		if (filterTypeValue.includes('video')) {
			return filteredProduct.filter(
				(product) =>
					product.animationUrl && IsVideo(product.animationUrl),
			);
		}
		if (filterTypeValue.includes('audio')) {
			return filteredProduct.filter(
				(product) =>
					product.animationUrl && IsAudio(product.animationUrl),
			);
		}
		return filteredProduct;
	}, [filteredProduct, filterTypeValue]);

	const showCounts = useMemo(() => {
		const counts = { public: 0, private: 0 };
		products.forEach((product) => {
			if (product.audience === 'Public') {
				counts.public += 1;
			} else {
				counts.private += 1;
			}
		});
		return counts;
	}, [products]);

	const { searchText, setSearchText, handleSearch } = useSearch();
	const searchCollectionData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const results = handleSearch(searchText, typeFilter, [
				'name',
				'price',
				'productId',
			]);

			return results;
		} else return typeFilter;
	}, [handleSearch, searchText, typeFilter]);

	useEffect(() => {
		setDisplayProducts(searchCollectionData ?? null);
	}, [searchCollectionData]);

	// Derive floor price whenever searchCollectionData changes (first load + after handleProductUpdate)
	useEffect(() => {
		if (searchCollectionData && searchCollectionData.length > 0) {
			const prices = searchCollectionData
				.map((item) => Number(item.price))
				.filter((n) => !Number.isNaN(n));
			const floor = prices.length > 0 ? Math.min(...prices) : 0;
			setFloorPrice((prev) => floor);
		} else {
			setFloorPrice(0);
		}
	}, [searchCollectionData]);

	const getChainIcon = (chainId: string) => {
		if (chainId) {
			if (gs?.chainIcons) {
				return gs.chainIcons[chainId];
			} else {
				getChainIcons().then((chain) => {
					if (chain && chainId) {
						setGs({
							chainIcons: chain,
						});
						return chain[chainId];
					}
				});
			}
		}
	};

	return (
		<>
			<main className='flex flex-col h-full pb-10  px-10 '>
				<div className='mb-4'>
					<BackButton />
				</div>
				<div className='flex-[0.5] relative'>
					{
						<>
							{collectionData?.bannerUrl || bannerImage ? (
								<Image
									onClick={() =>
										edit &&
										bnHiddenFileInput &&
										bnHiddenFileInput.current &&
										bnHiddenFileInput.current.click()
									}
									src={
										bannerImage && bannerImage.file
											? URL.createObjectURL(
													bannerImage.file,
												)
											: collectionData?.bannerUrl +
												'?' +
												new Date().getTime()
									}
									alt={'banner'}
									width={1000}
									height={300}
									className={`w-[100%] h-[300px] md:h[250px] sm:h[200px] object-center object-cover   ${
										edit ? 'cursor-pointer' : ''
									}`}
								/>
							) : (
								<div
									// onClick={() =>
									// 	edit &&
									// 	bnHiddenFileInput &&
									// 	bnHiddenFileInput.current &&
									// 	bnHiddenFileInput.current.click()
									// }
									className={`w-[100%] h-[300px] bg-gradient-to-b from-[#C4C4C4] to-[#5E5E5E] ${
										edit ? 'cursor-pointer' : ''
									}`}
								/>
							)}

							<input
								ref={bnHiddenFileInput}
								className=''
								hidden
								type='file'
								accept='image/*'
								onChange={(e) => handleImageUpload(e, 'BN')}
							/>
						</>
					}
					{edit && (
						<div
							className='overlay  cursor-pointer content-center relative'
							onClick={() =>
								edit &&
								bnHiddenFileInput &&
								bnHiddenFileInput.current &&
								bnHiddenFileInput.current.click()
							}
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
					)}
				</div>
				<div className='h-full mt-10 flex-[2] relative'>
					<div className='w-full flex flex-row gap-14 pb-10'>
						<div className='w-1/5'>
							<div className='w-[160px]  h-[160px]  relative border border-[#454343] '>
								{
									<>
										{collectionData?.avatarUrl ||
										(avatarImage && avatarImage.file) ? (
											<Image
												src={
													avatarImage &&
													avatarImage.file
														? URL.createObjectURL(
																avatarImage.file,
															)
														: (collectionData?.avatarUrl ??
															'')
												}
												onClick={() =>
													edit &&
													avHiddenFileInput &&
													avHiddenFileInput.current &&
													avHiddenFileInput.current.click()
												}
												alt={'card1'}
												width={200}
												height={200}
												className={`  aspect-square object-cover ${
													edit ? 'cursor-pointer' : ''
												}`}
											/>
										) : (
											<div
												onClick={() =>
													edit &&
													avHiddenFileInput &&
													avHiddenFileInput.current &&
													avHiddenFileInput.current.click()
												}
												className={`w-[100%] h-[100%] bg-gradient-to-b from-[#C4C4C4] to-[#5E5E5E] ${
													edit ? 'cursor-pointer' : ''
												}`}
											/>
										)}
										<input
											ref={avHiddenFileInput}
											className=''
											hidden
											type='file'
											accept='image/*'
											onChange={(e) =>
												handleImageUpload(e, 'AV')
											}
										/>
									</>
								}
								{edit && (
									<div
										className='overlay  cursor-pointer content-center '
										onClick={() =>
											edit &&
											avHiddenFileInput &&
											avHiddenFileInput.current &&
											avHiddenFileInput.current.click()
										}
									>
										<Image
											src={'/editWhite.svg'}
											alt={'heart'}
											width={25}
											height={25}
											className='justify-self-center mb-2'
										/>
										<p className=' text-[10px]'>
											800 x 800 pixels
										</p>
									</div>
								)}
								{isLoggedIn && (
									<motion.div
										className='cursor-pointer w-fit absolute -bottom-2 -right-5'
										onClick={() => {}}
										animate={{
											scale:
												isLiked && showCrack
													? [
															1.3, 1.3, 1.3, 1.3,
															1.3, 1.3, 1.3, 1.1,
															1,
														]
													: [1],
											transition: { duration: 1.8 },
										}}
									>
										{isLiked ? (
											<Image
												onClick={() =>
													unlikedCollection()
												}
												src={`/collection/greenFist.svg`}
												alt={'fist'}
												width={55}
												height={55}
											/>
										) : (
											<Image
												onClick={() =>
													likedCollection()
												}
												src={`/collection/defaultFist.svg`}
												alt={'fist'}
												width={55}
												height={55}
											/>
										)}
									</motion.div>
								)}
							</div>

							<div className='mt-2'>
								<span className='text-[17px] font-semibold'>
									{kudosCount}
									<span className='text-[17px] text-[#6E6E6E] font-normal ml-2'>
										Kudos
									</span>
								</span>
							</div>
						</div>
						<div className='w-4/5'>
							<div className='flex flex-row'>
								<div className='flex-1'>
									{/* {edit && collectionData ? (
									<input
										className=' bg-transparent px-3 text-[32px] border-[0.5px] border-[#979797] mb-2  group-data-[focus=true]:border-[#979797] rounded-[6px]'
										value={collectionData?.name}
										onChange={(e) => setCollectionData({ ...collectionData, name: e.target.value })}
									/>
								) : ( */}
									<p className='text-[32px] font-medium '>
										{collectionData?.name}
									</p>
									{/* )} */}
									{creators && creators.length > 0 && (
										<div className='flex flex-row '>
											<p className='text-[13px] font-light mr-1'>
												BY
											</p>
											{creators &&
												creators.map((item, i) => (
													<p
														key={i}
														className='text-[13px] font-light cursor-pointer'
														onClick={() =>
															router.push(
																'/profile/' +
																	item.walletAddress,
															)
														}
													>
														{item.userName}
														<span className='mr-1'>
															{item !==
																creators[
																	creators.length -
																		1
																] && ','}
														</span>
													</p>
												))}
										</div>
									)}
								</div>

								<div className='flex flex-row justify-end gap-3 mb-3 ml-2'>
									<Image
										className='cursor-pointer '
										alt='Share'
										draggable='false'
										width={25}
										height={25}
										src={'/post/send.svg'}
										onClick={() => setIsOpenShare(true)}
									/>
									<Image
										className='cursor-pointer '
										alt='Ticket'
										hidden
										draggable='false'
										width={25}
										height={25}
										src={'/collection/ticket.svg'}
									/>
									<Image
										className='cursor-pointer '
										alt='Subscription'
										draggable='false'
										hidden
										width={25}
										height={25}
										src={'/collection/subscription.svg'}
									/>
									{gs &&
										gs.walletAddress &&
										collectionData &&
										collectionData.owner &&
										collectionData.owner.walletAddress &&
										gs?.walletAddress ===
											collectionData?.owner
												?.walletAddress && (
											<Button
												size='sm'
												variant='flat'
												onClick={async () => {
													// Validate description before saving
													if (edit) {
														if (
															!collectionData?.description ||
															collectionData.description.trim() ===
																''
														) {
															ToastMessage(
																'warning',
																'Collection description cannot be empty',
															);
															return;
														}
													}

													// banner & avatar upload
													setEdit(!edit);
													if (edit) {
														if (
															avatarImage &&
															collectionData
														) {
															try {
																const {
																	path,
																	url,
																} =
																	await uploadMedia(
																		avatarImage
																			.file
																			.name,
																		avatarImage
																			.file
																			.type,
																		collectionData.collectionId,
																	);

																var formData =
																	new FormData();

																if (
																	avatarImage
																) {
																	formData.append(
																		'body',
																		avatarImage.file,
																	);
																	const {
																		status,
																	} =
																		await axios.put(
																			url,
																			avatarImage.file,
																			{
																				headers:
																					{
																						'Content-Type':
																							avatarImage
																								.file
																								.type,
																					},
																			},
																		);
																	// console.log(JSON.stringify(status, null, 2));
																	if (
																		status >=
																			200 &&
																		status <
																			300
																	)
																		collectionData.avatarUrl =
																			path;
																}
															} catch (e) {
																console.log(e);
																// alert(
																// 	'Error in uploading media file ' +
																// 		JSON.stringify(
																// 			e,
																// 			null,
																// 			2
																// 		)
																// );
																return;
															}
														}

														if (
															bannerImage &&
															collectionData
														) {
															try {
																const {
																	path,
																	url,
																} =
																	await uploadMedia(
																		bannerImage
																			.file
																			.name,
																		bannerImage
																			.file
																			.type,
																		collectionData.collectionId,
																	);

																var formData =
																	new FormData();

																if (
																	bannerImage
																) {
																	formData.append(
																		'body',
																		bannerImage.file,
																	);
																	const {
																		status,
																	} =
																		await axios.put(
																			url,
																			bannerImage.file,
																			{
																				headers:
																					{
																						'Content-Type':
																							bannerImage
																								.file
																								.type,
																					},
																			},
																		);
																	// console.log(JSON.stringify(status, null, 2));
																	if (
																		status >=
																			200 &&
																		status <
																			300
																	)
																		collectionData.bannerUrl =
																			path;
																}
															} catch (e) {
																console.log(e);
																// alert(
																// 	'Error in uploading media file ' +
																// 		JSON.stringify(
																// 			e,
																// 			null,
																// 			2
																// 		)
																// );
																return;
															}
														}

														if (
															accountAddress &&
															collectionData?.collectionId
														) {
															await updateCollection(
																accountAddress,
																collectionData?.collectionId,
																{
																	description:
																		collectionData?.description,
																	avatarUrl:
																		collectionData?.avatarUrl ??
																		undefined,
																	bannerUrl:
																		collectionData?.bannerUrl ??
																		undefined,
																},
															);
															await createActivity(
																accountAddress,
																`You've updated ${collectionData.name} collection.`,
																undefined,
																NotificationEntityType.Collection,
																NotificationEntitySubType.Updated,
																collectionData?.collectionId.toString(),
															);
															ToastMessage(
																'success',
																'Collection Updated',
															);
														}
													}
												}}
												className='bg-[#5e5e5e] border-none w-full text-[#e2e2e2] text-[14px] font-medium uppercase px-6 self-center ml-2'
											>
												{edit ? 'Save' : 'Edit'}
											</Button>
										)}
									{/* TODO: minting now 
								 <Button
									size='sm'
									variant='flat'
									// onClick={() => setIsEdit(!isEdit)}
									className='bg-[#11FF49] border-none w-full text-[#1A1A1A] text-[15px] font-bold uppercase px-4 self-center ml-2'>
									Edit
								</Button> */}
								</div>
							</div>
							<Divider className='bg-[#F1F0EB] opacity-80 my-4' />
							<div className='flex flex-row gap-14'>
								<div className='flex-1 mr-2'>
									{edit && collectionData ? (
										<Textarea
											variant='bordered'
											minRows={2}
											classNames={{
												input: 'pr-1 text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB] text-[13px]',
												inputWrapper:
													'  bg-transparent border-[0.5px] border-[#979797] mb-2 group-data-[focus=true]:bg-transparent group-data-[hover=true]:bg-transparent group-data-[focus=true]:border-[#979797] rounded-[6px]  ',
											}}
											// className='text-[13px] bg-transparent w-full p-2 '
											value={collectionData?.description}
											onChange={(e) =>
												setCollectionData({
													...collectionData,
													description: e.target.value,
												})
											}
										/>
									) : (
										<p className='font-normal'>
											{collectionData?.description}
										</p>
									)}
								</div>
								<div className='flex-[0.8] grid grid-cols-3 gap-6'>
									<div>
										<p className='text-[#6E6E6E]'>
											Created
										</p>
										<p className='text-[16px]'>
											{format(
												collectionData?.createdAt
													? new Date(
															collectionData?.createdAt *
																1000,
														)
													: new Date(),
												' MMM yyyy',
											)}
										</p>
									</div>
									{/* <div>
									<p className='text-[#6E6E6E]'>
										Total Volume
									</p>
									<p className='text-[16px]'>1.2K USD</p>
								</div>
								<div>
									<p className='text-[#6E6E6E]'>
										Unique Owners
									</p>
									<p className='text-[16px]'>789 (78.9%)</p>
								</div> */}
									<div>
										<p className='text-[#6E6E6E]'>Items</p>
										<p className='text-[16px]'>
											{collectionData?.products.length}
										</p>
									</div>
									<div>
										<p className='text-[#6E6E6E]'>
											Floor Price
										</p>

										<div className='flex flex-row items-center gap-2'>
											{collectionData?.chainId && (
												<Image
													src={
														getChainIcon(
															collectionData?.chainId,
														) || ''
													}
													alt='chain icon'
													width={20}
													height={20}
												/>
											)}
											<p className='text-[16px]'>
												{numberFormat(
													Number(floorPrice),
													2,
												)}{' '}
												USD
											</p>
										</div>
									</div>
									{/* <div>
									<p className='text-[#6E6E6E]'>Listed</p>
									<p className='text-[16px]'>0%</p>
								</div> */}
								</div>
							</div>
						</div>
					</div>
					{showCrack && (
						<Image
							src={'/collection/crack.svg'}
							alt={'fist'}
							width={400}
							height={400}
							className={`absolute top-[-60px] left-[-56px] `}
							draggable={false}
						/>
						// the absolute position changes according  to the image size
					)}

					<Divider className='bg-[#F1F0EB] opacity-80 my-6' />
					<div className='w-full flex flex-row gap-14 '>
						<div className='w-1/5'>
							<div className='h-10'></div>
							<CollectionFilter
								traits={traits}
								filterFunction={filterFunction}
								detailsFilter={detailsFilter}
								setSearchText={setSearchText}
								showCounts={showCounts}
								isOwner={isOwner}
							/>
						</div>
						<div className='w-4/5'>
							<div className='w-[200px] mb-4 justify-self-end'>
								<SortComponent
									page={'collectionsPage'}
									sorted={getSortData}
									data={
										displayProducts ??
										searchCollectionData ??
										[]
									}
								/>
							</div>
							{/* grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4  3xl:grid-cols-5 */}
							<div
								className={`flex flex-row flex-wrap gap-3  min-h-[350px]  `}
							>
								{collectionData &&
								(displayProducts ?? searchCollectionData)
									?.length ? (
									(displayProducts ?? searchCollectionData)
										.filter((data: ProductType) => {
											// If owner, show all. If not, only show Public items.
											return isOwner
												? data
												: data.audience === 'Public';
										})
										.map((item, i) => (
											<ProductCard
												key={
													item.productId ??
													item.id ??
													i
												}
												walletAddress={
													gs?.walletAddress
												}
												// openPost={openPost}
												data={{
													...item,
													collectionId:
														collectionData.collectionId,
												}}
												collectionName={
													collectionData.name
												}
												type={collectionData.type}
												avatarUrl={
													gs?.profile?.avatarUrl
												}
												ownerWalletAddress={
													collectionData.ownerWalletAddress
												}
												onProductUpdate={
													handleProductUpdate
												}
												isCollection
												chainIcon={getChainIcon(
													collectionData?.chainId ||
														'',
												)}
											/>
										))
								) : (
									<p>No data.</p>
								)}
							</div>
						</div>
					</div>
				</div>
			</main>
			<ShareModal
				isOpenShare={isOpenShare}
				setIsOpenShare={setIsOpenShare}
				link={
					`https://app.kamiunlimited.com/collection/` +
					collectionData?.collectionId
				}
			/>
		</>
	);
}

export const CollectionFilter = ({
	traits,
	filterFunction,
	detailsFilter,
	setSearchText,
	showCounts,
	isOwner,
}: {
	traits: (Traits & { label: string; selected: boolean })[];
	filterFunction: (filterValue: string[], type: string) => void;
	detailsFilter: { label: string; value: string; selected: boolean }[];
	setSearchText: Dispatch<SetStateAction<string | undefined>>;
	showCounts: { public: number; private: number };
	isOwner: boolean;
}) => {
	type FilterItem = {
		label: string;
		value: string;
		selected: boolean;
		count?: number;
	};

	type FilterSection = {
		title: string;
		filterList: FilterItem[];
	};

	const createShowSection = useCallback(
		(): FilterSection => ({
			title: 'Show',
			filterList: [
				{ label: 'All', value: 'all', selected: true },
				{
					label: 'Visible',
					value: 'public',
					selected: false,
					count: showCounts.public,
				},
				{
					label: 'Hidden',
					value: 'private',
					selected: false,
					count: showCounts.private,
				},
			],
		}),
		[showCounts.private, showCounts.public],
	);

	const buildInitialFilters = (): FilterSection[] => {
		const sections: FilterSection[] = [];
		if (isOwner) {
			sections.push(createShowSection());
		}
		sections.push({
			title: 'Traits',
			filterList: traits,
		});
		sections.push({
			title: 'Details',
			filterList: detailsFilter,
		});
		return sections;
	};

	const [filter, setFilter] = useState<FilterSection[]>(buildInitialFilters);

	useEffect(() => {
		setFilter((prevFilter) => {
			const updatedFilter = prevFilter.map((f) => {
				if (f.title === 'Traits') {
					return {
						...f,
						filterList: [
							{ label: 'All', value: 'all', selected: true },
							...traits,
						],
					};
				}
				return f;
			});
			return updatedFilter;
		});
	}, [traits]);
	useEffect(() => {
		setFilter((prevFilter) => {
			const updatedFilter = prevFilter.map((f) => {
				if (f.title === 'Details') {
					return {
						...f,
						filterList: detailsFilter,
					};
				}
				return f;
			});
			return updatedFilter;
		});
	}, [detailsFilter]);
	useEffect(() => {
		setFilter((prevFilter) => {
			const hasShowSection = prevFilter.some((f) => f.title === 'Show');
			if (isOwner && !hasShowSection) {
				return [createShowSection(), ...prevFilter];
			}
			if (!isOwner && hasShowSection) {
				return prevFilter.filter((f) => f.title !== 'Show');
			}
			return prevFilter;
		});
	}, [createShowSection, isOwner]);
	useEffect(() => {
		setFilter((prevFilter) =>
			prevFilter.map((f) => {
				if (f.title === 'Show') {
					return {
						...f,
						filterList: f.filterList.map((item) => {
							if (item.value === 'public') {
								return { ...item, count: showCounts.public };
							}
							if (item.value === 'private') {
								return { ...item, count: showCounts.private };
							}
							return item;
						}),
					};
				}
				return f;
			}),
		);
	}, [showCounts]);
	return (
		<div>
			<div className='w-full flex flex-row items-center gap-2 '>
				<Input
					isClearable
					// label='Search'
					// labelPlacement={'outside'}
					size='sm'
					className='flex-1'
					placeholder='Search...'
					classNames={{
						base: 'bg-transparent',
						input: 'group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[13px]',
						inputWrapper:
							'group-data-[hover=true]:bg-[#323131]  group-data-[focus=true]:bg-[#323131] group-data-[focus=true]:border-[0.5px]  group-data-[focus=true]:border-[#979797] rounded-[6px] bg-[#323131]',
					}}
					onChange={(e) => setSearchText(e.target.value)}
					onClear={() => setSearchText('')}
				/>
				<Image
					src={'/search.svg'}
					alt={'search'}
					width={20}
					height={20}
				/>
			</div>
			<div className='mt-5'>
				<div>
					<Accordion className='p-0' selectionMode='multiple'>
						{filter.map((fil, i) => (
							<AccordionItem
								key={i + 1}
								aria-label={fil.title}
								title={fil.title}
								classNames={{
									title: 'text-[#F1F0EB] text-[13px] font-bold',
									base: 'm-0 p-0',
									titleWrapper: 'm-0 p-0 ',
									heading:
										'border-b border-b-[#F1F0EB] w-full p-0 ',
									content: 'p-0',
								}}
								hidden={
									fil.title.toLowerCase() === 'traits'
										? fil.filterList.length < 2
										: fil.filterList.length === 0
								}
								//disableIndicatorAnimation
								// indicator={<MinusIcon />}s
							>
								{fil.filterList.map((item, j) => (
									<div
										key={j}
										className='border-b  border-b-[#6E6E6E] w-full  py-1'
									>
										<Checkbox
											isSelected={item.selected}
											onValueChange={() => {
												if (
													fil.title.toLowerCase() ===
													'show'
												) {
													fil.filterList.forEach(
														(f) =>
															(f.selected =
																f.value ===
																item.value),
													);
													setFilter([...filter]);
													filterFunction(
														[item.value],
														fil.title,
													);
													return;
												}

												if (item.value === 'all') {
													fil.filterList.forEach(
														(f) =>
															(f.selected =
																f.value ===
																'all'),
													);
												} else {
													item.selected =
														!item.selected;
													const allOption =
														fil.filterList.find(
															(f) =>
																f.value ===
																'all',
														);
													if (allOption) {
														allOption.selected = false;
													}
													const hasSelection =
														fil.filterList.some(
															(f) =>
																f.value !==
																	'all' &&
																f.selected,
														);
													if (
														!hasSelection &&
														allOption
													) {
														allOption.selected = true;
													}
												}
												setFilter([...filter]);
												filterFunction(
													fil.filterList
														.filter(
															(f) => f.selected,
														)
														.map((f) => f.value),
													fil.title,
												);
											}}
											radius='full'
											classNames={{
												base: 'w-full',
												label: 'w-full',
												icon: 'hidden bg-[#F1F0EB]',
												wrapper:
													'after:bg-[#F1F0EB] after:border-[#F1F0EB] before:border-[#6E6E6E] before:border w-3 h-3 ',
											}}
											className='m-0 p-0 ml-2 max-w-full'
											size='sm'
										>
											<div className='flex flex-row w-full items-center justify-between'>
												<span className='text-[#6E6E6E] text-[12px] font-light capitalize ml-1'>
													{item.label}
												</span>
												{item.count !== undefined && (
													<span className='text-[#6E6E6E] mr-4 text-[12px] font-light'>
														{item.count}
													</span>
												)}
											</div>
										</Checkbox>
									</div>
								))}
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</div>
		</div>
	);
};
