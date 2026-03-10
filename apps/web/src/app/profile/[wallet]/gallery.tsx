'use client';

import { getAllCollectionForProfile } from '@/apihandler/Collections';
import {
	getCollaboration,
	getProfileProducts,
	getSpotlight,
	getSpotlightStatus,
	switchSpotlight,
	updateSpotlightStatus,
} from '@/apihandler/Profile';
import AssetCard from '@/app/asset/[product_id]/AssetCard';
import CollectionCard from '@/components/CollectionCard';
import CreatePost from '@/components/CreatePost';
import ProductCard from '@/components/ProductCard';
import CrateCard from '@/components/Profile/CrateCard';
import SortComponent from '@/components/Sort';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	AssetType,
	CollectionType,
	ProductType,
	ProfileProduct,
} from '@/types';
import {
	Accordion,
	AccordionItem,
	Checkbox,
	Input,
	Skeleton,
	Switch,
	Tab,
	Tabs,
} from '@nextui-org/react';
import Image from 'next/image';
import {
	Dispatch,
	SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { MinusIcon } from './MinusIcon';
import { useSearch } from '@/lib/SearchContextProvider';
import useKamiWallet from '@/lib/KamiWalletHook';
import { getChainIcons, MetaDataParser } from '@/lib/Util';
import useEmblaCarousel from 'embla-carousel-react';
import {
	PrevButton,
	NextButton,
	usePrevNextButtons,
} from '@/components/CarouselArrowButtons';

export default function GalleryTab({
	walletAddress,
	banner,
}: {
	walletAddress: string;
	banner?: string;
}) {
	const wallet = useKamiWallet();
	const [gs, setGs] = useGlobalState();
	const test = ['1', '2', '3', '4', '5', '6'];
	const [category, setCategory] = useState<string>('all');
	const [isCrateDigging, setIsCrateDigging] = useState<boolean>(false);
	const [collections, setCollections] = useState<
		(CollectionType & { isCollab?: boolean })[]
	>([]);
	const [assets, setAssets] = useState<AssetType[]>([]);
	const [spotlight, setSpotlight] = useState<ProductType[]>([]);
	const [showSpotlight, setShowSpotlight] = useState<boolean>(false);
	const [filterValue, setFilterValue] = useState<string[]>(['all']);
	const [filterTypeValue, setFilterTypeValue] = useState<string[]>(['all']);
	const [isLoadingCollections, setIsLoadingCollections] =
		useState<boolean>(true);
	const [emblaRef, emblaApi] = useEmblaCarousel();
	const {
		prevBtnDisabled,
		nextBtnDisabled,
		onPrevButtonClick,
		onNextButtonClick,
	} = usePrevNextButtons(emblaApi);

	const [ownedEmblaRef, ownedEmblaApi] = useEmblaCarousel();
	const {
		prevBtnDisabled: ownedPrevBtnDisabled,
		nextBtnDisabled: ownedNextBtnDisabled,
		onPrevButtonClick: onOwnedPrevButtonClick,
		onNextButtonClick: onOwnedNextButtonClick,
	} = usePrevNextButtons(ownedEmblaApi);

	const isMyProfile =
		wallet?.getAccount()?.address === walletAddress ? true : false;

	const getCategory = (e: string) => {
		// console.log(`getCategory ${e}`);
		setCategory(e);
		setIsCrateDigging(false);
	};

	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);

	const openPost = () => {
		setCreateIsOpen(true);
	};

	useEffect(() => {
		if (walletAddress) {
			getCollection(walletAddress);
			getInventory(walletAddress);
			getSpotlightItems(walletAddress);
			getUserSpotlightStatus(walletAddress);

			//'0xcE228C60C6D668aFBBd536f6d729fb69089AC878'
			//TODO remove the wallet address
		}
	}, [walletAddress]);

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

	const getCollection = async (walletAddress: string) => {
		setIsLoadingCollections(true);
		const res = await getAllCollectionForProfile(
			walletAddress,
			wallet?.getAccount()?.address,
			true,
		);
		if (res) {
			res.collections.sort(
				(a: CollectionType, b: CollectionType) =>
					b.createdAt - a.createdAt,
			);
			const collabData = await getCollaborationData(walletAddress);

			const updatedCollections = res.collections
				.filter(
					(collection: CollectionType) =>
						collection.products?.length > 0,
				)
				.map((collection: CollectionType) => {
					const isCollab = collabData.some(
						(collab: CollectionType) =>
							collab.collectionId === collection.collectionId,
					);
					return { ...collection, isCollab };
				});
			setCollections(updatedCollections);
		}
		setIsLoadingCollections(false);
	};

	const getCollaborationData = async (walletAddress: string) => {
		const res = await getCollaboration(walletAddress);
		if (res.success) {
			return res.collaborations.collections;
		}
		return [];
	};
	const getInventory = async (walletAddress: string) => {
		const res = await getProfileProducts(walletAddress);

		if (res.success) {
			const assetList = res.profile.assets ?? [];

			assetList.forEach((asset: AssetType) => {
				if (asset.price === undefined || asset.price === null) {
					asset.price = '0';
				}
			});
			assetList.sort(
				(a: AssetType, b: AssetType) =>
					(b.createdAt ?? 0) - (a.createdAt ?? 0),
			);
			setAssets(assetList);
		}
	};
	const getUserSpotlightStatus = async (walletAddress: string) => {
		const res = await getSpotlightStatus(walletAddress);
		if (res.success) {
			setShowSpotlight(res.showSpotlight);
		}
	};

	const getSpotlightItems = async (walletAddress: string) => {
		const res = await getSpotlight(walletAddress);

		if (res) {
			for (let i = 0; i < res.length; i++) {
				res[i].voucher = res[i].nft;
			}

			setSpotlight(res);
		}
	};

	const updateSpotlight = async (id: number, isSpotlight: boolean) => {
		if (walletAddress && id) {
			const res = await updateSpotlightStatus(walletAddress, id, {
				spotlight: isSpotlight,
			});
			if (res.success) {
				getSpotlightItems(walletAddress);
			}
		}
	};

	const spotlightSwitch = async (e: boolean) => {
		// getUserSpotlightStatus(walletAddress);
		if (walletAddress) {
			try {
				const res = await switchSpotlight(walletAddress, {
					showSpotlight: e,
				});
				if (res) {
					setShowSpotlight(res.showSpotlight);
				}
			} catch (e) {
				console.log(e);
			}
		}
	};

	const getSortData = (data: any) => {
		if (category === 'owned') {
			const d: AssetType[] = data;
			setAssets([...d]);
		} else {
			const d: CollectionType[] = data;
			setCollections([...d]);
		}
	};

	const handleAssetUpdate = (
		assetId: number,
		updates: Partial<ProductType> | Partial<AssetType>,
	) => {
		setAssets((prevAssets) =>
			prevAssets.map((asset) =>
				asset.id === assetId || asset.productId === assetId
					? { ...asset, ...updates }
					: asset,
			),
		);
	};

	const handleProductUpdate = (
		productId: number,
		updates: Partial<ProductType>,
	) => {
		setSpotlight((prevSpotlight) =>
			prevSpotlight.map((product) =>
				product.id === productId || product.productId === productId
					? { ...product, ...updates }
					: product,
			),
		);
	};

	const filter = (filterValues: string[], dataType: string) => {
		if (dataType.toLowerCase() === 'genre') {
			setFilterValue(filterValues);
		} else {
			setFilterTypeValue(filterValues);
		}
	};

	const filteredCollectionData = useMemo(() => {
		if (filterValue.length === 0 || filterValue.includes('all'))
			return collections;
		return collections.filter(
			(c) => c.category && filterValue.includes(c.category),
		);
	}, [filterValue, collections]);

	const typeFilter = useMemo(() => {
		if (filterTypeValue.length === 0 || filterTypeValue.includes('all'))
			return filteredCollectionData;
		if (filterTypeValue.includes('collab'))
			return filteredCollectionData.filter((c) => c.isCollab);
		if (filterTypeValue.includes('solo'))
			return filteredCollectionData.filter((c) => !c.isCollab);
		return filteredCollectionData;
	}, [filteredCollectionData, filterTypeValue]);

	const { searchText, setSearchText, handleSearch } = useSearch();

	const searchCollectionData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const results = handleSearch(searchText, typeFilter, ['name']);

			return results;
		} else return typeFilter;
	}, [searchText, typeFilter]);

	const searchAssetData = useMemo(() => {
		if (!searchText || searchText.length === 0) return assets;
		const lower = searchText.trim().toLowerCase();
		return assets.filter((a: AssetType) => {
			let metadataName = '';
			try {
				const metadata =
					typeof a.metadata === 'string'
						? MetaDataParser(String(a.metadata))
						: a.metadata;
				metadataName = (metadata?.name ?? '').toLowerCase();
			} catch {
				metadataName = '';
			}
			return (
				metadataName.includes(lower) ||
				(a.price ?? '').toLowerCase().includes(lower) ||
				(a.collection?.name ?? '').toLowerCase().includes(lower)
			);
		});
	}, [searchText, assets]);

	const getChainIcon = (chainId: string) => {
		if (chainId && gs?.chainIcons) {
			return gs.chainIcons[chainId];
		}
		return undefined;
	};

	return (
		<>
			<div className=' py-4 w-full flex flex-row gap-14 '>
				<div className='w-1/5'>
					{gs?.walletAddress ? (
						<>
							<div className='h-10'></div>
							<GalleryFilter
								getCategory={getCategory}
								currentCategory={category}
								categories={gs?.categories}
								filter={filter}
								setSearchText={setSearchText}
							/>
						</>
					) : (
						<div className='gap-4 flex flex-col'>
							{/* <div className='h-10'></div> */}
							<p className=' text-[#6E6E6E] font-medium  border-b border-b-[#6e6e6e] pb-4'>
								Collection
							</p>
							<p className=' text-[#6E6E6E] font-medium'>
								Inventory
							</p>
						</div>
					)}
				</div>
				{/* {isCrateDigging ? (
					<div className='w-4/5'>
						<CrateCard />
					</div>
				) : ( */}
				<div className='w-4/5'>
					<div className={` flex flex-row  items-center -mt-2 mb-4 `}>
						<div className=' w-4/5 flex flex-row items-center'>
							{category === 'owned' ? (
								<p className='text-[18px] font-medium pr-3'>
									Owned
								</p>
							) : category === 'collection' ? (
								<p className='text-[18px] font-medium '>
									Created
								</p>
							) : (
								<></>
							)}
							{isMyProfile &&
								category === 'owned' &&
								assets.length > 8 && (
									<Switch
										disableAnimation
										isSelected={showSpotlight}
										onValueChange={(e) => {
											//setShowSpotlight(e);
											spotlightSwitch(e);
										}}
										size='sm'
										classNames={{
											base: 'inline-flex flex-row-reverse gap-5 ',
											thumb: 'bg-[#6E6E6E] group-data-[selected=true]:bg-[#11FF49] group-data-[selected=true]:ml-[14px]  w-3 h-3',
											wrapper:
												'w-9 h-5 group-data-[selected=true]:bg-[#1A1A1A] group-data-[selected=true]:border-[#11FF49] border border-[#6E6E6E] bg-[#1A1A1A]',
										}}
									>
										<p className=' text-[14px] text-[#F1F0EB] font-medium border-l-2 border-l-[#6E6E6E] pl-3'>
											Spotlight
										</p>
									</Switch>
								)}
						</div>
						<div className=' w-1/5 '>
							{gs?.walletAddress &&
								((category === 'owned' && assets.length > 0) ||
									(category === 'collection' &&
										collections.length > 0)) && (
									<SortComponent
										page={category}
										sorted={getSortData}
										data={
											category === 'owned'
												? assets
												: collections
										}
									/>
								)}
						</div>
					</div>
					{category === 'owned' && spotlight && showSpotlight && (
						<div
							className=' w-fit  mb-10  p-5  relative bg-slate-500'
							style={{
								backgroundImage: `url(${banner})`,
								backgroundSize: 'cover',
								backgroundPosition: 'top',
							}}
						>
							<div className='spotlightOverlay'></div>
							<div className='flex flex-col'>
								<p className='text-[18px] font-medium text-[#f1f0eb] z-50'>
									Spotlight
								</p>
								{/* <div className='grid  grid-cols-3 gap-2 mt-3'> */}
								<div className='flex flex-row gap-5 mt-3'>
									{spotlight?.map((p, i) => (
										<ProductCard
											key={i}
											data={p}
											collectionName={p.collection.name}
											isSpotlight
											updateSpotlight={updateSpotlight}
											avatarUrl={gs?.profile?.avatarUrl}
											walletAddress={gs?.walletAddress}
											onProductUpdate={
												handleProductUpdate
											}
											chainIcon={getChainIcon(
												p?.collection?.chainId || '',
											)}
										/>
									))}
									{[...Array(3 - spotlight.length)].map(
										(p, i) => (
											<div
												key={i}
												className='w-[232px] h-[406px] p-8  bg-[#1a1a1a] z-50  flex justify-center items-center'
											>
												{isMyProfile && (
													<p className='text-[#f1f0eb] text-center italic z-50'>
														Add your product to
														spotlight.
													</p>
												)}
											</div>
										),
									)}
								</div>
							</div>
						</div>
					)}
					{/* {renderHeadings(
						category,
						walletAddress,
						spotlight,
						showSpotlight,
						banner,
						isMyProfile ? updateSpotlight : undefined,
						gs?.profile?.avatarUrl,
						searchInventoryData.length > 0 ? true : false
					)} */}
					<div className={`flex flex-row flex-wrap gap-3 `}>
						{category === 'owned' ? (
							searchAssetData.length > 0 ? (
								searchAssetData
									.filter((data: AssetType) => {
										// If owner, show all. If not, only show Public items.
										return isMyProfile
											? data
											: data.audience === 'Public';
									})
									.map((data: AssetType) => (
										<AssetCard
											key={data.id ?? data.productId ?? 0}
											data={data}
											walletAddress={
												gs?.walletAddress ?? ''
											}
											ownerWalletAddress={
												data.ownerWalletAddress ??
												walletAddress
											}
											onProductUpdate={handleAssetUpdate}
											chainIcon={getChainIcon(
												data?.collection?.chainId || '',
											)}
										/>
									))
							) : (
								<div className='flex justify-center w-4/5'>
									<p className=' mt-10'>
										Oops! You have no assets.
									</p>
								</div>
							)
						) : category === 'collection' &&
						  isLoadingCollections ? (
							<CollectionCardSkeleton
								count={4}
								showAvatar={!!gs?.walletAddress}
							/>
						) : category === 'collection' &&
						  searchCollectionData &&
						  searchCollectionData.length > 0 ? (
							searchCollectionData.map(
								(data: CollectionType, i) => (
									<CollectionCard
										data={data}
										index={i}
										key={i}
									/>
								),
							)
						) : category === 'all' ? (
							<div className='flex flex-col gap-16 w-full h-fit flex-wrap'>
								{searchCollectionData.length > 0 && (
									<div className='flex flex-col gap-2 w-full'>
										<div className='flex flex-row items-center justify-between pr-10'>
											<p className='text-[20px] font-medium pr-3'>
												Created
											</p>
											{/* <p
												className='text-[14px] text-[#F1F0EB] font-medium cursor-pointer'
												onClick={() =>
													getCategory('collection')
												}
											>
												View All
											</p> */}
										</div>
										<div className='embla'>
											<div
												className='embla__viewport'
												ref={emblaRef}
											>
												<div className='embla__container'>
													{isLoadingCollections ? (
														<CollectionCardSkeleton
															count={4}
															showAvatar={
																!!gs?.walletAddress
															}
														/>
													) : (
														<>
															{searchCollectionData
																.slice(0, 5)
																.map((c, i) => (
																	<div
																		className='embla__slide'
																		key={
																			c.collectionId ??
																			i
																		}
																	>
																		<div className='embla__slide__number'>
																			<CollectionCard
																				data={
																					c
																				}
																				index={
																					i
																				}
																			/>
																		</div>
																	</div>
																))}
															{searchCollectionData.length >
																0 && (
																<div className='embla__slide'>
																	<button
																		type='button'
																		onClick={() =>
																			getCategory(
																				'collection',
																			)
																		}
																		className='w-full h-full min-h-[300px] rounded-none border-1 border-[#F1F0EB] bg-[#2a2a2a] flex flex-col items-center justify-center gap-2 hover:bg-[#3a3a3a] transition-colors cursor-pointer'
																	>
																		<span className='text-[#F1F0EB] font-semibold text-[18px]'>
																			View
																			all
																		</span>
																	</button>
																</div>
															)}
														</>
													)}
												</div>
											</div>
											{(!prevBtnDisabled ||
												!nextBtnDisabled) && (
												<div className='embla__controls'>
													<div className='embla__buttons'>
														<PrevButton
															onClick={
																onPrevButtonClick
															}
															disabled={
																prevBtnDisabled
															}
														/>
														<NextButton
															onClick={
																onNextButtonClick
															}
															disabled={
																nextBtnDisabled
															}
														/>
													</div>
												</div>
											)}
										</div>
										{/* <div className='flex flex-row flex-wrap gap-3'>
											{isLoadingCollections ? (
												<CollectionCardSkeleton
													count={4}
													showAvatar={
														!!gs?.walletAddress
													}
												/>
											) : (
												searchCollectionData
													.slice(0, 4)
													.map((c, i) => (
														<CollectionCard
															key={
																c.collectionId ??
																i
															}
															data={c}
															index={i}
														/>
													))
											)}
										</div> */}
									</div>
								)}
								{searchAssetData.length > 0 && (
									<div className='flex flex-col gap-2 w-full'>
										<div className='flex flex-row items-center justify-between pr-10'>
											<p className='text-[20px] font-medium pr-3'>
												Owned
											</p>
											{/* <p
												className='text-[14px] text-[#F1F0EB] font-medium cursor-pointer'
												onClick={() =>
													getCategory('owned')
												}
											>
												View All
											</p> */}
										</div>
										<div className='embla'>
											<div
												className='embla__viewport'
												ref={ownedEmblaRef}
											>
												{/* 9E9E9D */}
												<div className='embla__container'>
													{searchAssetData
														.filter(
															(
																data: AssetType,
															) =>
																isMyProfile
																	? data
																	: data.audience ===
																		'Public',
														)
														.slice(0, 5)
														.map(
															(
																data: AssetType,
															) => (
																<div
																	className='embla__slide'
																	key={
																		data.id ??
																		data.productId ??
																		0
																	}
																>
																	<div className='embla__slide__number'>
																		<AssetCard
																			data={
																				data
																			}
																			walletAddress={
																				gs?.walletAddress ??
																				''
																			}
																			ownerWalletAddress={
																				data.ownerWalletAddress ??
																				walletAddress
																			}
																			onProductUpdate={
																				handleAssetUpdate
																			}
																			chainIcon={getChainIcon(
																				data
																					?.collection
																					?.chainId ||
																					'',
																			)}
																		/>
																	</div>
																</div>
															),
														)}
													{searchAssetData.length >
														0 && (
														<div className='embla__slide'>
															<button
																type='button'
																onClick={() =>
																	getCategory(
																		'owned',
																	)
																}
																className='w-full h-full min-h-[300px] rounded-none border-1 border-[#F1F0EB] bg-[#2a2a2a] flex flex-col items-center justify-center gap-2 hover:bg-[#3a3a3a] transition-colors cursor-pointer'
															>
																<span className='text-[#F1F0EB] font-semibold text-[18px]'>
																	View all
																</span>
															</button>
														</div>
													)}
												</div>
											</div>
											{(!ownedPrevBtnDisabled ||
												!ownedNextBtnDisabled) && (
												<div className='embla__controls'>
													<div className='embla__buttons'>
														<PrevButton
															onClick={
																onOwnedPrevButtonClick
															}
															disabled={
																ownedPrevBtnDisabled
															}
														/>
														<NextButton
															onClick={
																onOwnedNextButtonClick
															}
															disabled={
																ownedNextBtnDisabled
															}
														/>
													</div>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className='flex justify-center w-4/5'>
								<p className=' mt-10'>
									Oops! You haven&apos;t published any
									collections.
								</p>
							</div>
						)}
					</div>
				</div>
				{/* )} */}
			</div>
			{/* <CreatePost isOpen={createIsOpen} setIsOpen={setCreateIsOpen} /> */}
		</>
	);
}

function CollectionCardSkeleton({
	count = 3,
	showAvatar = false,
}: {
	count?: number;
	showAvatar?: boolean;
}) {
	return (
		<>
			{[...Array(count)].map((_, i) => (
				<div
					key={i}
					className='max-w-[232] min-w-[200px] h-full flex flex-col'
				>
					<div className='border-3 border-[#F1F0EB] relative flex-2 z-10'>
						<Skeleton className='rounded-none'>
							<div className='w-full h-[232] bg-default-300'></div>
						</Skeleton>
						<div className='h-[50%] rounded-r-md bg-[#F1F0EB] w-[5px] absolute left-0 top-0 bottom-0 m-auto shadow-lg'></div>
						<div className='h-[50%] rounded-l-md bg-[#F1F0EB] w-[5px] absolute right-0 top-0 bottom-0 m-auto shadow-lg'></div>
					</div>
					<div className='flex-1 py-2 bg-[#F1F0EB] text-[#1A1A1A]'>
						<div className='px-4 space-y-2'>
							<Skeleton className='w-4/5 rounded-lg'>
								<div className='h-4 w-4/5 rounded-lg bg-default-400'></div>
							</Skeleton>
							<Skeleton className='w-3/5 rounded-lg'>
								<div className='h-3 w-3/5 rounded-lg bg-default-300'></div>
							</Skeleton>
						</div>
						{showAvatar && (
							<div className='flex flex-row justify-end px-3 mt-2'>
								<Skeleton className='rounded-full'>
									<div className='w-[30px] h-[30px] rounded-full bg-default-300'></div>
								</Skeleton>
							</div>
						)}
					</div>
				</div>
			))}
		</>
	);
}

const renderHeadings = (
	category: string,
	walletAddress: string,
	inventory?: ProductType[],
	showSpotlight?: boolean,
	banner?: string,
	updateSpotlight?: (id: number, isSpotlight: boolean) => void,
	avatarUrl?: string,
	isCollection?: boolean,
) => {
	switch (category) {
		case 'collection':
			return isCollection ? (
				<p className='text-[18px] font-medium mb-5 -mt-2'>
					Collections
				</p>
			) : null;
		case 'inventory':
			return (
				<>
					<p className='text-[18px] font-medium mb-5 -mt-2'>
						Inventory
					</p>
					{inventory && showSpotlight && (
						<div
							className=' w-fit  mb-10  p-5  relative bg-slate-500'
							style={{
								backgroundImage: `url(${banner})`,
								backgroundSize: 'cover',
								backgroundPosition: 'top',
							}}
						>
							<div className='spotlightOverlay'></div>
							<div className='flex flex-col'>
								<p className='text-[18px] font-medium text-[#f1f0eb] z-50'>
									Spotlight
								</p>
								{/* <div className='grid  grid-cols-3 gap-2 mt-3'> */}
								<div className='flex flex-row gap-5 mt-3'>
									{inventory?.map((p, i) => (
										<ProductCard
											key={i}
											data={p}
											collectionName={p.collection.name}
											isSpotlight
											updateSpotlight={
												showSpotlight
													? updateSpotlight
													: undefined
											}
											avatarUrl={avatarUrl}
										/>
									))}
									{[...Array(3 - inventory.length)].map(
										(p, i) => (
											<div
												key={i}
												className='w-[232px] h-[406px] p-8  bg-[#1a1a1a] z-50  flex justify-center items-center'
											>
												{updateSpotlight && (
													<p className='text-[#f1f0eb] text-center italic z-50'>
														Add your product to
														spotlight.
													</p>
												)}
											</div>
										),
									)}
								</div>
							</div>
						</div>
					)}
				</>
			);
		case 'playlist':
			return <p className='text-[18px] font-medium'>Playlist</p>;
		default:
			return;
	}
};

const GalleryFilter = ({
	getCategory,
	currentCategory,
	categories,
	filter,
	setSearchText,
}: {
	getCategory: (e: string) => void;
	currentCategory: string;
	categories?: { description: string; name: string; id: number }[];
	filter: (filterValues: string[], dataType: string) => void;
	setSearchText: Dispatch<SetStateAction<string | undefined>>;
}) => {
	//TODO Once we have transaction going on
	// const [invFilter, setInvFilter] = useState([
	// 	{ label: 'All', value: 'all', selected: false },
	// 	{ label: 'Owned', value: 'owned', selected: false },
	// 	{ label: 'Rented', value: 'rented', selected: false },
	// 	{ label: 'For Sale', value: 'sale', selected: false },
	// 	{ label: 'For Rent', value: 'rent', selected: false },
	// ]);
	const [colFilter, setColFilter] = useState([
		{
			label: 'Genre',
			filterList: [{ label: 'All', value: 'all', selected: true }],
		},
		{
			label: 'Type',
			filterList: [
				{ label: 'All', value: 'all', selected: true },
				{ label: 'Solo', value: 'solo', selected: false },
				{ label: 'Collaboration', value: 'collab', selected: false },
			],
		},
	]);
	const [selected, setSelected] = useState('all');
	useEffect(() => {
		if (categories) {
			const y = categories.map((c) => ({
				value: c.name,
				label: c.name,
				selected: false,
			}));
			const x = colFilter.map((c) => {
				if (c.label === 'Genre') {
					c.filterList = [...c.filterList, ...y];
				}
				return c;
			});
			setColFilter(x);
		}
	}, [categories]);

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
				<div className='w-full flex flex-col gap-2'>
					<div
						className={`w-full border-b border-b-[#F1F0EB] py-2 cursor-pointer ${
							currentCategory === 'all'
								? 'font-bold'
								: 'font-normal opacity-80'
						}`}
						onClick={() => getCategory('all')}
					>
						<p>All</p>
					</div>
				</div>
				<div className='w-full flex flex-col gap-2'>
					<div
						className={`w-full border-b border-b-[#F1F0EB] py-2 cursor-pointer mt-6   ${
							currentCategory === 'collection'
								? 'font-bold'
								: 'font-normal opacity-80'
						}`}
						onClick={() => getCategory('collection')}
					>
						<p>Created</p>
					</div>
					{currentCategory === 'collection' && (
						<div>
							<Accordion
								className='p-0'
								isCompact
								selectionMode='multiple'
							>
								{colFilter.map((fil, i) => (
									<AccordionItem
										key={i + 1}
										aria-label={fil.label}
										title={fil.label}
										classNames={{
											title: 'text-[#F1F0EB] text-[13px] font-bold',
											base: 'm-0 p-0',
											titleWrapper: 'm-0 p-0 ',
											heading:
												'border-b border-b-[#F1F0EB] w-full p-0 ',
											content: 'p-0',
										}}
										disableIndicatorAnimation
										indicator={<MinusIcon />}
									>
										{fil.filterList.map((item, j) => (
											<div
												key={j}
												className='border-b last:border-none border-b-[#6E6E6E] w-full  py-1'
											>
												<Checkbox
													isSelected={item.selected}
													onValueChange={(e) => {
														item.selected =
															!item.selected;
														setColFilter([
															...colFilter,
														]);
														if (
															item.value === 'all'
														) {
															fil.filterList.forEach(
																(f) =>
																	(f.selected =
																		f.value ===
																		'all'),
															);
														} else {
															fil.filterList.find(
																(f) =>
																	f.value ===
																	'all',
															)!.selected = false;
															if (
																fil.filterList.every(
																	(f) =>
																		!f.selected,
																)
															) {
																fil.filterList.find(
																	(f) =>
																		f.value ===
																		'all',
																)!.selected =
																	true;
															}
														}
														filter(
															fil.filterList
																.filter(
																	(f) =>
																		f.selected,
																)
																.map(
																	(f) =>
																		f.value,
																),
															fil.label,
														);
													}}
													radius='full'
													classNames={{
														label: 'text-[#6E6E6E] text-[12px] font-light ml-1',
														icon: 'hidden bg-[#F1F0EB]',
														wrapper:
															'after:bg-[#F1F0EB] after:border-[#F1F0EB] before:border-[#6E6E6E] before:border w-3 h-3 ',
													}}
													className='m-0 p-0 ml-2'
													size='sm'
												>
													{item.label}
												</Checkbox>
											</div>
										))}
									</AccordionItem>
								))}
							</Accordion>
						</div>
					)}
				</div>
				<div className='w-full flex flex-col gap-2'>
					<div
						className={`w-full border-b border-b-[#F1F0EB] py-2 cursor-pointer mt-6   ${
							currentCategory === 'owned'
								? 'font-bold'
								: 'font-normal opacity-80'
						}`}
						onClick={() => getCategory('owned')}
					>
						<p>Owned</p>
					</div>
				</div>
				{/*  TODO: will come back to this later 
				<div
					className={`w-full border-b border-b-[#F1F0EB] py-2 cursor-pointer mt-6 ${
						currentCategory === 'playlist' ? 'font-bold' : 'font-normal opacity-80'
					}`}
					onClick={() => getCategory('playlist')}>
					<p>Playlist</p>
				</div> */}
			</div>
		</div>
	);
};

// const renderProductCard = (
// 	category: string,
// 	walletAddress: string,
// 	setIsCrateDigging: Dispatch<SetStateAction<boolean>>,
// 	openPost: () => void,
// 	collections?: CollectionType[],
// 	inventory?: ProductType[],
// 	updateSpotlight?: (id: number, isSpotlight: boolean) => void
// ) => {
// 	switch (category) {
// 		case 'inventory':
// 			console.log(inventory);
// 			return inventory?.map((data: ProductType, i) => (
// 				<ProductCard
// 					key={i}
// 					data={data}
// 					collectionName={data.collection?.name}
// 					updateSpotlight={updateSpotlight}
// 				/>
// 			));
// 		case 'collection':
// 			return collections?.map((data: CollectionType, i) => (
// 				<CollectionCard data={data} index={i} key={i} />
// 			));
// 		case 'playlist':
// 			return [...Array(10)].map((p, i) => (
// 				<ProductCard
// 					key={i}
// 					isPlaylist={true}
// 					setIsCrateDigging={setIsCrateDigging}
// 				/>
// 			));
// 	}
// };
