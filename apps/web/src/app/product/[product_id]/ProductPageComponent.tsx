'use client';

import {
	Accordion,
	AccordionItem,
	Avatar,
	AvatarIcon,
	Chip,
	Divider,
	Tooltip,
} from '@nextui-org/react';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import Traits from './Traits';
import { MetaDataParser } from '@/lib/Util';

import Image from 'next/image';
import Bundle from './Bundle';
import CollectionSuggestion from './Collection';
import Players, { PlayerType } from './Players';
import { cachedGetProduct, getProduct } from '@/apihandler/Post';
import {
	AssetType,
	BundleType,
	CollectionType,
	Creator,
	Mention,
	ProductType,
	Profile,
	SocialPost,
	VoucherContextType,
	VoucherMetadata,
} from '@/types';
import { useGlobalState } from '@/lib/GlobalContext';
import { getACollection } from '@/apihandler/Collections';
import { useParams, useRouter } from 'next/navigation';
import { getChainIcons, numberFormat, numberWithCommas } from '@/lib/Util';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { likeProduct, unlikeProduct } from '@/apihandler/Product';
import CreatePost from '@/components/CreatePost';
import ShareModal from '@/components/ShareModal';
import FeedModal from '@/components/FeedModal';
import { ToastMessage } from '@/components/ToastMessage';
import BackButton from '@/components/BackButton';
import SocialCard from '@/components/Profile/SocialCard';
import useKamiWallet from '@/lib/KamiWalletHook';
import AddToCartButton from '@/components/AddToCartButton';
import { likeAsset, unlikeAsset } from '@/apihandler/Asset';
export default function ProductPageComponent({
	productId,
	assetId: assetIdParam,
}: {
	productId: string;
	assetId?: string;
}) {
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const [isBundle, setIsBundle] = useState<boolean>(false);
	const [productData, setProductData] = useState<ProductType>();
	const [selectedVoucherOrAsset, setSelectedVoucherOrAsset] = useState<
		VoucherContextType | undefined
	>();
	const [bundleData, setBundleData] = useState<BundleType[]>([]);
	const [playerData, setPlayerData] = useState<VoucherMetadata>({});
	const [metadata, setMetadata] = useState<VoucherMetadata>();
	const [creators, setCreators] = useState<Creator[]>();
	const [collectionData, setCollectionData] = useState<CollectionType>();
	const [totalLikes, setTotalLikes] = useState<number>(0);
	const [isMyProduct, setIsMyProduct] = useState<boolean>(false);
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
	const [assetData, setAssetData] = useState<AssetType | undefined>(
		undefined,
	);
	const router = useRouter();
	// const params = useParams<{ product_id: string }>();
	const [gs] = useGlobalState();

	useEffect(() => {
		if (assetIdParam !== undefined) {
			console.log('Asset ID from URL:', assetIdParam);
		}
	}, [assetIdParam]);

	useEffect(() => {
		if (productId) {
			if (gs?.walletAddress) {
				setIsLoggedIn(true);
				getProductApi(productId, gs?.walletAddress, assetIdParam);
			} else {
				setIsLoggedIn(false);
				getProductApi(productId, null, assetIdParam);
			}
		}
	}, [gs?.walletAddress, productId, assetIdParam]);

	const calculateCreatorLikes = (
		mentions: Mention[],
		creatorWalletAddress: string,
	) => {
		return mentions.reduce((totalLikes, mention) => {
			if (
				mention.creatorWalletAddress === creatorWalletAddress &&
				mention.postedBy.walletAddress === creatorWalletAddress
			) {
				return totalLikes + mention.likes;
			}
			return totalLikes;
		}, 0);
	};

	const getProductApi = async (
		id: string,
		address: string | null,
		assetId?: string,
	) => {
		// const data = await getProduct(address, Number(id));
		let data;
		if (address) {
			data = await getProduct(address, Number(id));
		} else {
			data = await cachedGetProduct(Number(id));
		}

		// New function to calculate total likes for mentions by the creator
		if (data && data.mentions && data.creator?.walletAddress) {
			const totalLikesByCreator = calculateCreatorLikes(
				data.mentions,
				data.creator?.walletAddress,
			);
			const totalLikes = totalLikesByCreator + data.likes;
			setTotalLikes(totalLikes);
		}
		if (data) {
			if (assetId && data.asset && data.asset.length > 0) {
				const filteredAsset = data.asset.filter((a) => {
					return Number(a.tokenId) === Number(assetId);
				});

				setAssetData(filteredAsset[0]);
				if (filteredAsset[0]?.walletAddress === address) {
					setIsMyProduct(true);
				}
			} else {
				if (data.ownerWalletAddress === address) {
					setIsMyProduct(true);
				} else {
					setIsMyProduct(false);
				}
			}

			setProductData(data);
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
						arr.push(data.collaborators[i].userProfile);
					}
				}
			}

			// Ensure the creator is the first element in the array
			if (data.creator && data.creator.walletAddress) {
				arr = arr.filter(
					(creator) =>
						creator.walletAddress !== data.creator?.walletAddress,
				);
				arr.unshift(data.creator);
			}

			// Remove duplicates by walletAddress
			// arr = arr.filter(
			// 	(creator, index, self) =>
			// 		index ===
			// 		self.findIndex(
			// 			(c) => c.walletAddress === creator.walletAddress
			// 		)
			// );

			let x: BundleType[] = [];
			if (data.voucher?.metadata ?? data?.asset?.[0]?.metadata) {
				const metadata = MetaDataParser(
					String(
						data.voucher?.metadata ?? data?.asset?.[0]?.metadata,
					),
				);
				setMetadata(metadata);

				if (metadata?.name && metadata?.image) {
					const obj = {
						url: metadata.animation_url
							? metadata.animation_url
							: metadata.image,
						coverUrl: metadata.animation_url
							? metadata.image
							: undefined,
						name: metadata.name,
						description: metadata.description ?? '',
						// ? metadata.description
						// : desc,
					};
					x.push(obj);
				}
			}
			if (data.bundle && data.bundle?.length > 0) {
				x.push(...data.bundle);
			}
			setBundleData(x);
			if (data.voucher) {
				setPlayerData(data.voucher?.metadata ?? {});
			} else if (data.asset?.[0]) {
				setPlayerData(data.asset?.[0]?.metadata ?? {});
			}
			setIsBundle(false);
			setCreators(arr);
			if (gs && gs.walletAddress) {
				getCollection(gs.walletAddress, data?.collectionId);
			}
		}
	};

	const getCollection = async (walletAddress: string, id: number) => {
		const data = await getACollection(walletAddress, id);
		if (data) {
			setCollectionData(data);
		}
	};

	const chooseBundle = (
		bundle: BundleType & { ownerDescription?: string },
	) => {
		let x: VoucherMetadata & { ownerDescription?: string | null } = {
			animation_url: bundle.coverUrl ? bundle.url : undefined,
			image: bundle.coverUrl ? bundle.coverUrl : bundle.url,
			name: bundle.name,
			description: bundle.description ?? '',
			ownerDescription: isMyProduct ? bundle.ownerDescription : null,
		};

		setPlayerData(x);
		setIsBundle(true);
	};
	const AccordionStyle = {
		title: 'text-[#F1F0EB] text-[16px] font-bold ',
		// base: 'm-0 p-0',
		titleWrapper: 'pt-5',
		heading: 'border-b-[0.5px] border-b-[#6E6E6E] w-full ',
		content: 'py-5',
	};
	return (
		<main className='h-full px-10 pb-10 '>
			<div className=' mb-4 flex flex-row gap-8'>
				<BackButton />
				<div className='flex flex-row gap-3 items-center flex-[0.8]'>
					<Avatar
						src={productData?.collection?.avatarUrl ?? undefined}
						icon={<AvatarIcon />}
						className='w-[40px] h-[40px] '
						classNames={{
							base: 'w-[40px] h-[40px]',
						}}
					/>

					<div>
						<p
							className='text-[15px] font-semibold  cursor-pointer'
							onClick={() =>
								router.push(
									'/collection/' + productData?.collectionId,
								)
							}
						>
							{productData?.collection?.name}
						</p>
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
														creators.length - 1
													] && ','}
											</span>
										</p>
									))}
							</div>
						)}
					</div>
				</div>
			</div>
			<div className='flex flex-row gap-10 mt-4'>
				<div className='flex-[0.8]  '>
					{(productData?.voucher ??
						(productData?.asset &&
							productData?.asset?.length > 0)) && (
						<div>
							<Players
								playerData={playerData}
								// name={productData?.name}
								isBundle={isBundle}
							/>
						</div>
					)}

					{productData?.bundle && productData?.bundle.length > 0 && (
						<div>
							<Bundle
								data={bundleData}
								chooseBundle={chooseBundle}
							/>
						</div>
					)}
					<Divider className='bg-white  mb-5 mt-7' />
					{productData &&
						(productData.voucher ?? productData?.asset?.[0]) && (
							<ProductBasicDetails
								setIsOpen={setCreateIsOpen}
								isOpen={createIsOpen}
								data={productData}
								walletAddress={gs?.walletAddress}
								router={router}
								setLikes={(number: number) =>
									setTotalLikes(totalLikes + number)
								}
								isLoggedIn={isLoggedIn}
								isMyProduct={isMyProduct}
								assetData={assetData}
							/>
						)}
					<div className='mt-6'>
						{productData?.tags.map((tag, index) => (
							<Chip
								key={index}
								size='md'
								variant='bordered'
								classNames={{
									base: 'border border-[#9E9E9D] px-2 py-2 rounded-full mr-2',
									content:
										'text-[13px] font-light text-[#9E9E9D] text-center ',
									closeButton: 'ml-1',
								}}
							>
								{tag.tag}
							</Chip>
						))}
					</div>
					<Divider className='bg-white mb-5 mt-4' />
					<div className=' flex flex-row  gap-5'>
						<div className=' flex-1'>
							<Accordion
								defaultExpandedKeys={['1']}
								selectionMode='multiple'
							>
								<AccordionItem
									key='1'
									aria-label='Creator'
									title='Creator'
									classNames={AccordionStyle}
								>
									<ProductCreator
										creator={creators}
										router={router}
									/>
								</AccordionItem>
								<AccordionItem
									key='2'
									aria-label='Descriptions'
									title='Descriptions'
									classNames={AccordionStyle}
								>
									<ProductDescription
										data={{
											productDescription:
												productData?.description,
											collectionDescription:
												productData?.collection
													?.description,
										}}
										bundleData={playerData}
									/>
								</AccordionItem>
								<AccordionItem
									key='3'
									aria-label='Details'
									title='Details'
									classNames={AccordionStyle}
								>
									{productData && (
										<ProductDetails
											data={{
												description:
													productData?.description,
												voucher:
													productData?.voucher ??
													productData?.asset?.[0],
												creator: creators,
												availableQuantity:
													productData.availableQuantity,
											}}
											router={router}
										/>
									)}
								</AccordionItem>

								<AccordionItem
									key='4'
									aria-label='Traits'
									title='Traits'
									classNames={AccordionStyle}
									hidden={
										metadata?.attributes &&
										metadata.attributes.length > 0
											? false
											: true
									}
								>
									{metadata &&
										metadata.attributes &&
										metadata.attributes.length > 0 &&
										(productData?.voucher?.metadata ??
											productData?.asset?.[0]
												?.metadata) && (
											<Traits
												data={String(
													productData?.voucher
														?.metadata ??
														productData?.asset?.[0]
															?.metadata,
												)}
											/>
										)}
								</AccordionItem>

								{/* <AccordionItem
									key='5'
									aria-label='Transactions'
									title='Transactions'
									classNames={AccordionStyle}
								>
									<Offers />
									<Activity />
								</AccordionItem> */}
							</Accordion>
						</div>
						<div className=' flex-1'>
							<Accordion defaultExpandedKeys={['1']}>
								<AccordionItem
									key='1'
									aria-label='Interactions'
									title='Interactions'
									classNames={AccordionStyle}
								>
									<div className='flex-1'>
										<ProductMentions
											data={productData?.mentions}
											productData={productData}
											router={router}
											totalLikes={totalLikes}
										/>
									</div>
								</AccordionItem>
							</Accordion>
						</div>
					</div>
				</div>

				{collectionData && collectionData?.products.length > 1 && (
					<div className='flex-[0.2]  h-[500px] min-[1600px]:h-[600px]'>
						<CollectionSuggestion
							collectionData={collectionData}
							router={router}
							currentId={productId}
						/>
					</div>
				)}
			</div>

			{productData &&
				(productData.voucher?.mediaUrl ??
					productData?.asset?.[0]?.mediaUrl) && (
					<CreatePost
						isOpen={createIsOpen}
						setIsOpen={setCreateIsOpen}
						isRepost={false}
						content={[
							{
								collectionId: productData.collectionId,
								productId: assetIdParam
									? undefined
									: productData.id,
								imageURl:
									productData.voucher?.mediaUrl ??
									productData?.asset?.[0]?.mediaUrl ??
									'',
								assetId: Number(assetIdParam) ?? undefined,
							},
						]}
						walletAddress={gs?.walletAddress}
					/>
				)}
		</main>
	);
}
const ProductBasicDetails = ({
	setIsOpen,
	isOpen,
	data,
	walletAddress,
	router,
	setLikes,
	isLoggedIn,
	isMyProduct,
	assetData,
}: {
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	isOpen: boolean;
	data: ProductType;
	walletAddress?: string;
	router: AppRouterInstance;
	setLikes: (number: number) => void;
	isLoggedIn?: boolean;
	isMyProduct?: boolean;
	assetData?: AssetType;
}) => {
	//const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const [isLiked, setIsLiked] = useState<boolean>(
		assetData?.likedByMe ?? data.likedByMe ?? false,
	);
	const [isOpenShare, setIsOpenShare] = useState(false);
	const [gs, setGs] = useGlobalState();

	const clickHeart = async (liked: boolean) => {
		if (liked) {
			if (walletAddress) {
				if (assetData) {
					const res = await likeAsset(
						walletAddress,
						Number(assetData.id),
					);
					if (res.success) {
						setIsLiked(true);
						setLikes(1); // Increment likes by 1
					}
				} else {
					const res = await likeProduct(walletAddress, data.id);
					if (res.success) {
						setIsLiked(true);
						setLikes(1); // Increment likes by 1
					}
				}
			}
		} else {
			if (walletAddress) {
				if (assetData) {
					const res = await unlikeAsset(
						walletAddress,
						Number(assetData.id),
					);
					if (res.success) {
						setIsLiked(false);
						setLikes(-1); // Decrement likes by 1
					}
				} else {
					const res = await unlikeProduct(walletAddress, data.id);
					if (res.success) {
						setIsLiked(false);
						setLikes(-1); // Decrement likes by 1
					}
				}
			}
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

	return (
		<>
			<div className='flex flex-row gap-4 '>
				<div className='flex-[0.7] wordWrap'>
					<div
						className={`flex 2xl:flex-row flex-col 2xl:gap-6 gap-2 mb-2 max-w-[90%]`}
					>
						<p className='text-[24px] font-bold '>
							{data.name}{' '}
							{assetData ? (
								<span>{`(ID : ${assetData.tokenId}
								)`}</span>
							) : (
								(data.voucher?.tokenId ??
									data?.asset?.[0]?.tokenId) && (
									<span>{`(ID : ${
										data.voucher?.productId ??
										data?.asset?.[0]?.productId
									})`}</span>
								)
							)}
						</p>
						{isLoggedIn && (
							<div className='flex flex-row text-center items-start gap-4 mt-2'>
								{isLiked ? (
									<Image
										onClick={() => {
											clickHeart(false);
										}}
										unoptimized
										className='cursor-pointer -mt-2'
										alt='Like'
										draggable='false'
										width={20}
										height={20}
										src={'/fire/fire.gif'}
									/>
								) : (
									<Image
										onClick={() => {
											clickHeart(true);
										}}
										unoptimized
										className='cursor-pointer -mt-2'
										alt='Like'
										draggable='false'
										width={20}
										height={20}
										src={'/fire/empty.svg'}
									/>
								)}
								<Tooltip
									className='bg-black  text-[10px]'
									content='Coming Soon..'
								>
									<Image
										className='cursor-pointer '
										alt='Playlist'
										draggable='false'
										width={25}
										height={25}
										src={'/post/playlistGrey.svg'}
									/>
								</Tooltip>

								<Image
									className='cursor-pointer '
									alt='Share'
									draggable='false'
									width={25}
									height={25}
									src={'/post/send.svg'}
									onClick={(e) => {
										e.stopPropagation();
										setIsOpenShare(true);
									}}
								/>
								<Image
									onClick={() => setIsOpen(!isOpen)}
									className='cursor-pointer '
									alt='Bookmark'
									draggable='false'
									width={23}
									height={23}
									src={'/post/post.svg'}
								/>
							</div>
						)}
					</div>
					<div className='flex flex-row '>
						<p className='text-[13px] font-light mr-1'>owned by</p>
						<p
							className='text-[13px] font-light cursor-pointer'
							onClick={() =>
								router.push(
									'/profile/' +
										(assetData
											? assetData.walletAddress
											: data.owner?.walletAddress),
								)
							}
						>
							{/* TODO: Add owner name from asset data if available */}
							{assetData
								? assetData.user?.userName
								: data.owner?.userName}
						</p>
					</div>
				</div>
				<div className='flex-[0.3] wordWrap flex flex-col items-end'>
					<div className='flex flex-row items-center gap-3'>
						{data?.collection?.chainId && (
							<Image
								src={
									getChainIcon(data?.collection?.chainId) ||
									''
								}
								alt='chain icon'
								width={20}
								height={20}
							/>
						)}
						<p className='text-[24px] font-bold '>
							{assetData
								? numberWithCommas(assetData.price, 2)
								: data.price
									? numberWithCommas(data.price, 2)
									: '0'}{' '}
							USDC
						</p>
					</div>
					{/* TO ADD Chain ID HERE */}
					{walletAddress &&
						isLoggedIn &&
						!isMyProduct &&
						data.consumerAction === 'Buy' && (
							<AddToCartButton
								productId={data?.id}
								walletAddress={walletAddress}
								assetId={assetData?.id ?? undefined}
							/>
						)}
				</div>
			</div>
			<ShareModal
				isOpenShare={isOpenShare}
				setIsOpenShare={setIsOpenShare}
				link={`https://app.kamiunlimited.com/product/` + data?.id}
			/>
		</>
	);
};

const ProductDetails = ({
	data,
	router,
}: {
	data: {
		description: string;
		voucher: VoucherContextType;
		creator?: Creator[];
		availableQuantity?: number | null;
	};
	router: AppRouterInstance;
}) => {
	return (
		<div>
			{/* <div>
				<p className='font-bold'>Description</p>
				<p className='mt-4 capitalize'>{data.description}</p>
			</div>
			{data.creator && data.creator.length > 0 && (
				<div className='mt-10'>
					<p className='font-bold'>Creators</p>
					<div className='mt-4'>
						{data.creator &&
							data.creator.map((item, i) => (
								<div
									key={i}
									className='flex flex-row gap-20 items-center mb-7'
								>
									<p className='text-[#A79755] text-[12px] font-medium'>
										Role Name
									</p>
									<div
										className={`flex flex-row gap-5 items-center cursor-pointer`}
										onClick={() =>
											router.push(
												'/profile/' + item.walletAddress
											)
										}
									>
										<Avatar
											src={item.avatarUrl}
											icon={<AvatarIcon />}
											size='sm'
											classNames={{
												base: 'w-[50px] h-[50px]',
											}}
										/>

										<div className='flex-1  gap-1 '>
											<p className='font-bold  text-[#AFAB99] capitalize'>
												{item.userName}
												
											</p>
							
										</div>
									</div>
								</div>
							))}
					</div>
				</div>
			)} */}
			<div>
				<div className='flex flex-col gap-2 font-light'>
					<div className='flex flex-row gap-2'>
						<p className='w-1/2'>Contract Address</p>
						<p>{data.voucher?.contractAddress ?? '-'}</p>
					</div>
					<div className='flex flex-row gap-2'>
						<p className='w-1/2'>Token ID</p>
						<p>{data.voucher?.tokenId}</p>
					</div>
					<div className='flex flex-row gap-2'>
						<p className='w-1/2'>Token standard</p>
						<p>{data.voucher?.contractType}</p>
					</div>
					{data.availableQuantity && (
						<div className='flex flex-row gap-2'>
							<p className='w-1/2'>Quantity</p>
							<p>{data.availableQuantity}</p>
						</div>
					)}
					{/* <div className='flex flex-row gap-2'>
						<p className='w-1/2'>Latest Update</p>
						<p>5 months ago</p>
					</div>
					<div className='flex flex-row gap-2'>
						<p className='w-1/2'>Creator Earnings</p>
						<p>5%</p>
					</div> */}
				</div>
			</div>
		</div>
	);
};

const ProductMentions = ({
	data,
	productData,
	router,
	totalLikes,
}: {
	data?: Mention[];
	productData?: ProductType;
	router: AppRouterInstance;
	totalLikes: number;
}) => {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [postId, setPostId] = useState<string>('');
	const [gs] = useGlobalState();

	// Transform Mention to SocialPost format
	const transformMentionToSocialPost = (
		mention: Mention,
	): SocialPost & { isPinned?: boolean } => {
		if (!productData) {
			throw new Error('Product data is required to transform mention');
		}

		return {
			id: mention.postId,
			createdAt: productData.createdAt || Date.now(),
			products: [
				{
					productId: productData.id,
					name: productData.name,
					description: productData.description,
					imageUrl:
						productData.voucher?.mediaUrl ??
						productData?.asset?.[0]?.mediaUrl ??
						'',
					collection: {
						collectionId: productData.collectionId,
						name: productData.collection.name,
					},
					audience: productData.audience ?? '',
					trait: productData.traits || [],
				},
			],
			comment: [],
			likes: mention.likes,
			shares: mention.shares,
			likedByMe: mention.likedByMe,
			isRepost: false,
			reposts: mention.reposts,
			numComments: mention.numComments,
			caption: mention.caption,
			postedBy: {
				avatarUrl: mention.postedBy.avatarUrl,
				tagLine: '',
				userName: mention.postedBy.userName,
			},
		};
	};

	return (
		//need to do scroll inside
		<>
			<div className='h-full w-full'>
				<div className='flex flex-row  mt-4   justify-around'>
					<div className='flex flex-1 flex-col items-center border-r border-r-[#454343]'>
						<p className='text-[20px] font-light'>
							{numberFormat(data?.length ?? 0)}
						</p>
						<p className='font-semibold mt-1'>Shares</p>
					</div>

					<div className='flex flex-1 flex-col items-center'>
						<p className='text-[20px] font-light'>
							{numberFormat(totalLikes)}
						</p>
						<p className='font-semibold mt-1'>Light ups</p>
					</div>
				</div>
			</div>
			{data && data?.length > 0 && productData && (
				<div className='mt-8'>
					<div className='px-10 pb-10 pt-6 border border-[#323131] rounded-lg mt-4 '>
						<p className='font-bold mb-6'>Social Mentions</p>
						<div className='scrollbar-thumb-rounded-3xl pr-[10px] scrollbar-thin  scrollbar-track-transparent scrollbar-thumb-neutral-600  overflow-auto max-h-[500px]'>
							{data.map((item, i) => {
								if (!productData) return null;
								const socialPost =
									transformMentionToSocialPost(item);
								return (
									<div
										key={i}
										className={` border-b border-b-[#323131] py-5 last:border-none ${
											gs?.walletAddress
												? 'cursor-pointer'
												: 'cursor-default'
										}  ${i === 0 && 'pt-0'} `}
									>
										<SocialCard
											data={socialPost}
											isMyPost={false}
											walletAddress={gs?.walletAddress}
											isProfile={false}
										/>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</>
	);
};

const ProductDescription = ({
	data,
	bundleData,
}: {
	data: {
		productDescription?: string;
		collectionDescription?: string;
	};
	bundleData?: VoucherMetadata & { ownerDescription?: string | null };
}) => {
	return (
		<div>
			<div>
				<p className='font-semibold'>Collection Description</p>
				<p className='mt-2 font-light '>
					{data.collectionDescription ?? '-'}
				</p>
			</div>

			<div className='mt-5'>
				<p className='font-semibold'>Product Description</p>
				<p className='mt-2 font-light '>
					{bundleData?.description
						? bundleData?.description !== '<p></p>' && (
								<div
									dangerouslySetInnerHTML={{
										__html: bundleData?.description
											? bundleData?.description
											: '',
									}}
									className='text-[13px] font-light [&_p]:mb-4  wordWrap'
								/>
							)
						: ((data.productDescription !== '<p></p>' && (
								<div
									dangerouslySetInnerHTML={{
										__html: data.productDescription
											? data.productDescription
											: '',
									}}
									className='text-[13px] font-light [&_p]:mb-4  wordWrap'
								/>
							)) ??
							'-')}
				</p>
			</div>
			{bundleData?.ownerDescription && (
				<div className='mt-5'>
					<div className='flex flex-row items-center gap-2'>
						<p className='font-semibold'>
							Product Description (Private)
						</p>
						<Tooltip
							className='bg-black cursor-pointer text-[10px]'
							content={
								<>
									<p className='text-[11px]'>
										This message is only visible to the
										owner of this product ,
									</p>
									<p className='text-[11px]'>
										so remember to keep this information to
										yourself.
									</p>
								</>
							}
						>
							<Image
								className='cursor-pointer '
								alt='info'
								draggable='false'
								width={16}
								height={16}
								src={'/info.svg'}
							/>
						</Tooltip>
					</div>
					<p className='mt-2 font-light '>
						{bundleData?.ownerDescription}
					</p>
				</div>
			)}
		</div>
	);
};

const ProductCreator = ({
	creator,
	router,
}: {
	creator?: Creator[];
	router: AppRouterInstance;
}) => {
	return (
		creator &&
		creator.length > 0 && (
			<div className=''>
				<div className='mt-4'>
					{creator &&
						creator.map((item, i) => (
							<div
								key={i}
								className='flex flex-row gap-20 items-center mt-5 first:mt-0 '
							>
								{/* <p className='text-[#A79755] text-[12px] font-medium'>
									Role Name
								</p> */}
								<div
									className={`flex flex-row gap-5 items-center cursor-pointer`}
									onClick={() =>
										router.push(
											'/profile/' + item.walletAddress,
										)
									}
								>
									<Avatar
										src={item.avatarUrl}
										icon={<AvatarIcon />}
										size='sm'
										classNames={{
											base: 'w-[50px] h-[50px]',
										}}
									/>

									<div className='flex-1  gap-1 '>
										<p className='font-semibold  '>
											{item.userName}
											{/* <span className='font-normal ml-1'>
								{item.description}
							</span> */}
										</p>
										{/* <div
							dangerouslySetInnerHTML={{
								__html: item?.description
									? item?.description
									: '',
							}}
							className='text-[11px] font-normal line-clamp-3 '
						/> */}
									</div>
								</div>
							</div>
						))}
				</div>
			</div>
		)
	);
};

{
	/* <div
className='flex flex-row gap-2 border-b border-b-[#323131] py-6 last:border-none first:pt-0 last:pb-0'
key={i}
>
<div className='flex flex-row'>
	<Avatar
		src={item.postedBy.avatarUrl}
		icon={<AvatarIcon />}
		size='sm'
		classNames={{ base: 'w-[25px] h-[25px]' }}
	/>
</div>
<div className='flex-1 flex flex-col gap-2'>
	<p className='font-bold text-[12.6px]'>
		{item.postedBy.userName}
	</p>
	<p>{item.caption}</p>
	<div className='flex text-center items-center justify-between mt-4'>
		<div className=' flex flex-row items-center gap-2'>
			<Image
				alt='mute'
				width={16}
				height={16}
				src={'/fire/fireEmpty.png'}
				className='mb-1'
			/>
			<p className='text-[12px]'>
				{numberFormat(item.likes)}
			</p>
		</div>
		<div className=' flex flex-row items-center gap-2'>
			<Image
				alt='mute'
				width={20}
				height={20}
				src={'/post/send.svg'}
			/>{' '}
			<p className='text-[12px]'>
				{numberFormat(item.shares)}
			</p>
		</div>
		<div className=' flex flex-row items-center gap-2'>
			<Image
				alt='mute'
				width={20}
				height={20}
				src={'/post/refresh.svg'}
			/>{' '}
			<p className='text-[12px]'>
				{numberFormat(item.reposts)}
			</p>
		</div>
	
	</div>
</div>
</div>	 */
}
{
	/* <div className=' flex flex-row items-center gap-2'>
			<Image
				alt='mute'
				width={20}
				height={20}
				src={'/post/bookmark.svg'}
			/>
			<p className='text-[12px]'>120</p>
		</div> */
}
