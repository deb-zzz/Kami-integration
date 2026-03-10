'use client';

import { cachedGetProduct, getProduct } from '@/apihandler/Post';
import BackButton from '@/components/BackButton';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	convertIPFSUrl,
	getChainIcons,
	IsAudio,
	IsVideo,
	numberFormat,
} from '@/lib/Util';
import {
	AssetType,
	Creator,
	ProductType,
	Traits,
	VoucherContextType,
} from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
	Accordion,
	AccordionItem,
	Checkbox,
	Divider,
	Input,
	Button,
} from '@nextui-org/react';
import { format } from 'date-fns';
import { CollectionFilter } from '@/app/collection/[collection_id]/CollectionPageComponent';
import { useSearch } from '@/lib/SearchContextProvider';
import ProductCard from '@/components/ProductCard';
import useKamiWallet from '@/lib/KamiWalletHook';
import AssetCard from './AssetCard';
import { MetaDataParser } from '@/lib/Util';
import { getMimeType } from 'mime-detector';
import SortComponent from '@/components/Sort';
import { stopMinting } from '@/apihandler/Asset';
import { validateProduct } from '@/apihandler/Product';
import { ToastMessage } from '@/components/ToastMessage';
import { useCartState } from '@/hooks/useCartState';

export default function AssetPageComponent({
	productId,
}: {
	productId: string;
}) {
	const [assetData, setAssetData] = useState<AssetType[] | null>(null);
	const [productData, setProductData] = useState<ProductType | null>(null);
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
	const [creators, setCreators] = useState<Creator[]>();
	const [gs, setGs] = useGlobalState();
	const router = useRouter();
	const [isOpenShare, setIsOpenShare] = useState(false);
	const [floorPrice, setFloorPrice] = useState<number>(0);
	const [productImageUrl, setProductImageUrl] = useState<string>('');
	const [traits, setTraits] = useState<
		(Traits & { label: string; selected: boolean })[]
	>([]);
	const [detailsFilter, setDetailsFilter] = useState<
		{ label: string; value: string; selected: boolean }[]
	>([]);
	const [filterValue, setFilterValue] = useState<string[]>([]);
	const [filterTypeValue, setFilterTypeValue] = useState<string[]>(['all']);

	const wallet = useKamiWallet();
	const accountAddress = wallet?.getAccount()?.address;
	const [isOwner, setIsOwner] = useState<boolean>(false);
	const { addToCartWithSync } = useCartState(accountAddress || '');

	useEffect(() => {
		if (productId) {
			if (gs?.walletAddress) {
				setIsLoggedIn(true);
				getAssetData(productId, gs?.walletAddress);
			} else {
				setIsLoggedIn(false);
				getAssetData(productId, null);
			}
		}
	}, [gs?.walletAddress, productId]);

	useEffect(() => {
		if (productData?.metadata) {
			const metadata = MetaDataParser(String(productData?.metadata));
			setProductImageUrl(metadata?.image ?? '');
		}
	}, [productData?.metadata]);

	const getAssetData = async (id: string, address: string | null) => {
		// const data = await getProduct(address, Number(id));
		let data;

		if (address) {
			data = await getProduct(address, Number(id));
		} else {
			data = await cachedGetProduct(Number(id));
		}
		if (data) {
			// const productsSortedByDate = [...data.asset].sort(
			// 	(a: ProductType, b: ProductType) =>
			// 		b.createdAt - a.createdAt
			// );
			// const audienceSortedProducts =
			// 	sortProducts(productsSortedByDate);
			setAssetData(data.asset);
			setProductData(data);
			const floorPrice = data.asset?.length
				? Math.min(...data.asset?.map((item) => Number(item.price)))
				: 0;
			setFloorPrice(floorPrice);

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
			const assets = data.asset ?? [];
			const types = await Promise.all(
				assets.map(async (item) => {
					if (!item.animationUrl) return null;
					const url = convertIPFSUrl(item.animationUrl);
					if (!url) return null;
					const mime = await getMimeType(url);
					if (mime?.includes('audio')) return 'audio';
					if (mime?.includes('video')) return 'video';
					return null;
				}),
			);

			const defined = types.filter(
				(t): t is 'audio' | 'video' => t != null,
			);
			const uniqueTypes = Array.from(new Set(defined)).sort();
			if (uniqueTypes.length > 0) {
				setDetailsFilter([
					{ label: 'All', value: 'all', selected: true },
					...uniqueTypes.map((value) => ({
						label: value,
						value,
						selected: false,
					})),
				]);
			}
			// Extract traits from each asset's metadata.attributes (metadata may be string or object)
			const traits = Array.from(
				new Set(
					data.asset?.flatMap((item) => {
						try {
							const raw = item.metadata;
							const metadata =
								raw == null
									? null
									: typeof raw === 'string'
										? JSON.parse(raw)
										: raw;
							const attrs = metadata?.attributes;
							const arr =
								typeof attrs === 'string'
									? JSON.parse(attrs || '[]')
									: Array.isArray(attrs)
										? attrs
										: [];
							return (
								arr as { trait_type?: string; value?: string }[]
							).map((trait) => JSON.stringify(trait));
						} catch {
							return [];
						}
					}) ?? [],
				),
			).map((trait) => {
				const parsedTrait = JSON.parse(trait) as {
					trait_type?: string;
					value?: string;
				};
				return {
					trait_type: parsedTrait.trait_type ?? '',
					value: parsedTrait.value ?? '',
					label: `${parsedTrait.value ?? ''}`,
					selected: false,
				};
			}) as (Traits & { label: string; selected: boolean })[];
			setTraits(traits);
			setCreators(arr);
		}
	};

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

	useEffect(() => {
		if (accountAddress && productData?.ownerWalletAddress) {
			setIsOwner(accountAddress === productData?.ownerWalletAddress);
		}
	}, [accountAddress, productData?.ownerWalletAddress]);

	const filteredProduct = useMemo(() => {
		if (filterValue.length === 0 || filterValue.includes('all'))
			return assetData ?? null;
		return (
			assetData?.filter((product) => {
				try {
					const raw = product.metadata;
					const metadata =
						raw == null
							? null
							: typeof raw === 'string'
								? JSON.parse(raw)
								: raw;
					const attrs = metadata?.attributes;
					const arr =
						typeof attrs === 'string'
							? JSON.parse(attrs || '[]')
							: Array.isArray(attrs)
								? attrs
								: [];
					const values = (
						arr as { trait_type?: string; value?: string }[]
					).map((t) => String(t?.value ?? ''));
					return values.some((v) => filterValue.includes(v));
				} catch {
					return false;
				}
			}) ?? null
		);
	}, [filterValue, assetData]);

	const typeFilter = useMemo(() => {
		if (filterTypeValue.length === 0 || filterTypeValue.includes('all'))
			return filteredProduct;
		if (filterTypeValue.includes('video')) {
			return (
				filteredProduct?.filter(
					(product) =>
						product.animationUrl && IsVideo(product.animationUrl),
				) ?? null
			);
		}
		if (filterTypeValue.includes('audio')) {
			return (
				filteredProduct?.filter(
					(product) =>
						product.animationUrl && IsAudio(product.animationUrl),
				) ?? null
			);
		}
		return filteredProduct;
	}, [filteredProduct, filterTypeValue]);

	const { searchText, setSearchText, handleSearch } = useSearch();
	const searchAssetData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const results = handleSearch(searchText, typeFilter as any, [
				'name',
				'price',
				'tokenId',
			]);

			return results;
		} else return typeFilter;
	}, [handleSearch, searchText, typeFilter]);

	const [displayAssets, setDisplayAssets] = useState<AssetType[] | null>(
		null,
	);

	useEffect(() => {
		setDisplayAssets(searchAssetData ?? null);
	}, [searchAssetData]);

	const getSortData = useCallback((sorted: AssetType[]) => {
		setDisplayAssets(sorted);
	}, []);

	const sortProducts = useCallback((list: AssetType[]) => {
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

	const handleProductUpdate = useCallback(
		(productId: number, updates: Partial<AssetType>) => {
			setAssetData((prevProducts) => {
				if (!prevProducts) return prevProducts;
				const updatedProducts = prevProducts.map(
					(product: AssetType) => {
						const currentId = product.productId ?? product.id;
						if (currentId === productId) {
							return {
								...product,
								...updates,
							} as AssetType;
						}
						return product;
					},
				) as AssetType[];
				return sortProducts(updatedProducts);
			});

			setProductData((prevProduct) => {
				if (!prevProduct || !prevProduct.asset) return prevProduct;
				const updatedAssets = prevProduct.asset.map(
					(product: AssetType) => {
						const currentId = product.productId ?? product.id;
						if (currentId === productId) {
							return {
								...product,
								...updates,
							} as AssetType;
						}
						return product;
					},
				) as AssetType[];
				return {
					...prevProduct,
					asset: sortProducts(updatedAssets),
				};
			});
		},
		[sortProducts],
	);

	const filterFunction = (filterValue: string[], type: string) => {
		if (type.toLowerCase() === 'traits') {
			setFilterValue(filterValue);
		} else if (type.toLowerCase() === 'details') {
			setFilterTypeValue(filterValue);
		}
	};

	const stopMintingApi = async () => {
		try {
			console.log(productData);
			const res = await stopMinting(Number(productData?.id));
			console.log(res);
		} catch (error) {
			console.log(error);
		}
	};

	const validateProductApi = async (productId: number) => {
		if (accountAddress) {
			const res = await validateProduct(accountAddress, productId);
			if (res.canAdd) {
				// TO ADD Chain ID HERE
				addToCartApi(productId);
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

	const addToCartApi = async (productId: number) => {
		if (accountAddress) {
			const data = {
				walletAddress: accountAddress,
				productId,
				quantity: 1,
				checkoutAction: 'None',
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

	return (
		<>
			<main className='flex flex-col h-full pb-10  px-10 '>
				<div className='mb-4'>
					<BackButton />
				</div>
				{/* TODO: add product banner image for future */}
				{/* <div className='flex-[0.5] relative'>
					{productData?.collection.bannerUrl ? (
						<Image
							src={
								convertIPFSUrl(
									productData?.collection.bannerUrl,
								) ?? ''
							}
							alt={'banner'}
							width={1000}
							height={300}
							className={`w-[100%] h-[300px] md:h[250px] sm:h[200px] object-center object-cover`}
						/>
					) : (
						<div
							className={`w-[100%] h-[300px] md:h[250px] sm:h[200px] bg-gradient-to-b from-[#C4C4C4] to-[#5E5E5E] `}
						/>
					)}
				</div> */}
				<div className='h-full mt-10 flex-[2] relative'>
					<div className='w-full flex flex-row gap-14 pb-10'>
						<div className='w-1/5'>
							<div className='w-[160px]  h-[160px]  relative border border-[#454343] '>
								{
									<>
										{productImageUrl ? (
											<Image
												src={productImageUrl ?? ''}
												alt={'card1'}
												width={200}
												height={200}
												className={`  aspect-square object-cover `}
											/>
										) : (
											<div
												className={`w-[100%] h-[100%] bg-gradient-to-b from-[#C4C4C4] to-[#5E5E5E] `}
											/>
										)}
									</>
								}
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
										{productData?.name}
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

								<div className='flex flex-row items-centerjustify-end gap-3 mb-3 ml-2'>
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
									{/* TODO: minting now */}
									{isOwner ? (
										<Button
											size='sm'
											variant='flat'
											onClick={stopMintingApi}
											className='bg-[#11FF49] border-none w-full text-[#1A1A1A] text-[15px] font-bold uppercase px-4 self-center ml-2'
										>
											Stop Minting
										</Button>
									) : (
										<Button
											size='sm'
											variant='flat'
											onClick={() =>
												validateProductApi(
													Number(productId),
												)
											}
											className='bg-[#11FF49] border-none w-full text-[#1A1A1A] text-[15px] font-bold uppercase px-4 self-center ml-2'
										>
											Start Minting
										</Button>
									)}
								</div>
							</div>
							<Divider className='bg-[#F1F0EB] opacity-80 my-4' />
							<div className='flex flex-row gap-14'>
								<div className='flex-1 mr-2'>
									{productData?.description !== '<p></p>' && (
										<div
											dangerouslySetInnerHTML={{
												__html: productData?.description
													? productData?.description
													: '',
											}}
											className='text-[13px] font-light [&_p]:mb-4  wordWrap'
										/>
									)}
								</div>
								<div className='flex-[0.8] grid grid-cols-3 gap-6'>
									<div>
										<p className='text-[#6E6E6E]'>
											Created
										</p>
										<p className='text-[16px]'>
											{format(
												productData?.collection
													?.createdAt
													? new Date(
															productData
																?.collection
																?.createdAt *
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
											{assetData?.length}
										</p>
									</div>
									<div>
										<p className='text-[#6E6E6E]'>
											Floor Price
										</p>

										<div className='flex flex-row items-center gap-2'>
											{productData?.collection
												?.chainId && (
												<Image
													src={
														getChainIcon(
															productData
																?.collection
																?.chainId,
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
					{/* {showCrack && (
						<Image
							src={'/collection/crack.svg'}
							alt={'fist'}
							width={400}
							height={400}
							className={`absolute top-[-60px] left-[-56px] `}
							draggable={false}
						/>
						// the absolute position changes according  to the image size
					)} */}
					<Divider className='bg-[#F1F0EB] opacity-80 my-6' />
					<div className='w-full flex flex-row gap-14 '>
						<div className='w-full'>
							<div className='flex flex-row items-center justify-between mb-10'>
								<div className=' flex flex-row items-center gap-2 w-1/3 '>
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
										onChange={(e) =>
											setSearchText(e.target.value)
										}
										onClear={() => setSearchText('')}
									/>
									<Image
										src={'/search.svg'}
										alt={'search'}
										width={20}
										height={20}
									/>
								</div>
								<div className='w-[200px] mb-4 justify-self-end'>
									<SortComponent
										page={'collectionsPage'}
										sorted={getSortData}
										data={
											displayAssets ??
											searchAssetData ??
											[]
										}
									/>
								</div>
							</div>

							{/* grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4  3xl:grid-cols-5 */}
							<div className=' flex flex-row flex-wrap gap-3 min-h-[350px] '>
								{(displayAssets ?? searchAssetData) &&
								((displayAssets ?? searchAssetData)?.length ??
									0) > 0 ? (
									(displayAssets ?? searchAssetData)
										// ?.filter((data: VoucherContextType) => {
										// 	// If owner, show all. If not, only show Public items.
										// 	return isOwner
										// 		? data
										// 		: data.audience === 'Public';
										// })
										?.map((item: AssetType, i) => (
											<AssetCard
												key={i}
												walletAddress={
													gs?.walletAddress ?? ''
												}
												// openPost={openPost}
												data={{
													...(item as any),
													collectionId:
														productData?.collection
															.collectionId!,
												}}
												ownerWalletAddress={
													item.walletAddress ?? ''
												}
												onProductUpdate={
													handleProductUpdate
												}
												chainIcon={getChainIcon(
													productData?.collection
														?.chainId || '',
												)}
											/>
										))
								) : (
									<div className='flex justify-center w-full'>
										<p className='italic text-[#6E6E6E]'>
											{isOwner
												? 'Spread the word to mint now!'
												: 'Be the first to mint!'}
										</p>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</main>
		</>
	);
}

const AssetFilter = ({
	traits,
	detailsFilter,
	setSearchText,
	filterFunction,
}: {
	traits: (Traits & { label: string; selected: boolean })[];
	detailsFilter: { label: string; value: string; selected: boolean }[];
	setSearchText: (text: string) => void;
	filterFunction: (filterValue: string[], type: string) => void;
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

	const buildInitialFilters = (): FilterSection[] => {
		const sections: FilterSection[] = [];

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
