'use client';
import {
	Avatar,
	AvatarIcon,
	Modal,
	ModalBody,
	ModalContent,
	Tooltip,
} from '@nextui-org/react';
import Image from 'next/image';
import Slider from './Carousel';
import { motion } from 'framer-motion';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	Dispatch,
	SetStateAction,
	useEffect,
	useMemo,
	useRef,
	useState,
	useCallback,
} from 'react';
import { ContentType, FeedPost, FeedType, VoucherContextType } from '@/types';
import { likePost, unlikePost } from '@/apihandler/Feed';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { convertIPFSUrl, IsVideo, VideoMimeType } from '@/lib/Util';
import { MetaDataParser } from '@/lib/Util';
import ReactPlayer from 'react-player';
import { useInView } from 'react-intersection-observer';
import { getCookie, setCookie } from 'cookies-next';
import { get } from 'http';
import React from 'react';
import VideoPlayer from './VideoPlayer';
import ShareModal from '../ShareModal';
import FullScreenMedia from '../FullScreenMedia';

export type PostObject = {
	index: number | number[];
	clickFunction: (e: number) => void;
	isLevel2?: boolean;
	openPost?: (e: boolean, content: ContentType[]) => void;
	isOpen?: boolean;
	isRepost?: boolean;
	zeroPadding?: boolean;
	feedData: FeedType;
	walletAdd?: string;
	reactToPost?: (isLiked: boolean, id: number) => void;
	ref?: React.RefObject<HTMLDivElement>;
};

type PostHeaderType = FeedPost & { comment: string };

export default function PostComponent({
	index,
	clickFunction,
	isLevel2 = false,
	openPost,
	isOpen,
	isRepost = false,
	zeroPadding = false,
	feedData,
	walletAdd,
	reactToPost,
}: PostObject) {
	const router = useRouter();
	const repostCaption = false;
	const [postHeaderData, setPostHeaderData] = useState<PostHeaderType>();
	const [gs, setGs] = useGlobalState();
	const [isMuted, setIsMuted] = useState(false);
	const [isOpenShare, setIsOpenShare] = useState(false);
	const [isOpenFullScreen, setIsOpenFullScreen] = useState(false);
	const [isHovered, setIsHovered] = useState(false);

	const closeFullScreen = () => {
		setIsHovered(false);
		setIsOpenFullScreen(false);
	};
	const onMouseEnter = () => setIsHovered(true);
	const onMouseLeave = () => setIsHovered(false);
	const { ref: inViewRef, inView } = useInView({
		threshold: 0.5,
		rootMargin: '0px',
		triggerOnce: false,
	});
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
	// Sync with global state
	useEffect(() => {
		if (gs?.isFeedMuted !== undefined) {
			setIsMuted(gs.isFeedMuted);
		}
	}, [gs?.isFeedMuted]);

	useEffect(() => {
		if (feedData) getHeaderData();
		if (walletAdd) {
			setIsLoggedIn(true);
		} else {
			setIsLoggedIn(false);
		}
	}, [feedData]);

	const getHeaderData = () => {
		if (feedData) {
			const headerData: PostHeaderType = {
				comment: isRepost
					? feedData.parentPost.caption
					: feedData.caption,
				...feedData.createdBy,
			};
			if (headerData) setPostHeaderData(headerData);
		}
	};

	const divRef = useRef<HTMLDivElement>(null);
	const captionTextRef = useRef<HTMLSpanElement>(null);
	const captionDivRef = useRef<HTMLDivElement>(null);

	const getUrl = (data: VoucherContextType) => {
		const metadata = MetaDataParser(String(data.metadata));

		const isAnimation = Boolean(metadata.animation_url);
		let aniData: {
			url: string;
			type: 'video' | 'audio' | 'image';
			audioUrl?: string;
			poster?: string;
		} = {
			url: '',
			type: 'image',
			audioUrl: '',
		};
		if (isAnimation && metadata.animation_url) {
			if (IsVideo(metadata.animation_url ?? '')) {
				aniData.url = metadata.animation_url ?? '';
				aniData.type = 'video';
				aniData.poster = metadata.image;
			} else {
				if (data.mediaUrl) aniData.url = data?.mediaUrl;
				aniData.audioUrl = metadata.animation_url;
				aniData.type = 'audio';
				aniData.poster = metadata.image;
			}
		} else {
			if (data.mediaUrl) aniData.url = data?.mediaUrl;
			aniData.type = 'image';
		}
		return aniData;
	};

	const [state, setState] = useState({
		url: null,
		playing: false,
		controls: false,
		muted: false,
		played: 0,
		loaded: 0,
		duration: 0,
		seeking: false,
		ended: false,
		playbackRate: 1.0,
		hidePlay: false,
	});
	const handleToggleMuted = () => {
		setState((prevState) => ({
			...prevState,
			muted: !prevState.muted,
		}));
	};
	const handleDuration = (duration: number) => {
		setState((prevState) => ({
			...prevState,
			duration: duration,
		}));
	};
	const handleProgress = (e: any) => {
		// We only want to update time slider if we are not currently seeking
		if (!state.seeking) {
			setState((prevState) => ({
				...prevState,
				state,
			}));
		}
	};
	const muteStateRef = useRef(isMuted);
	const PostMedia = ({
		data,
		feedData,
		gs,
		setGs,
		isMuted,
		setIsMuted,
		isRepost,
		isLevel2,
		clickFunction,
	}: {
		data?: VoucherContextType;
		feedData: FeedType;
		gs: any;
		setGs: (state: any) => void;
		isMuted: boolean;
		setIsMuted: (state: boolean) => void;
		isRepost: boolean;
		isLevel2: boolean;
		clickFunction: (e: number) => void;
	}) => {
		if (data) {
			const { url, type, audioUrl, poster } = getUrl(data);
			switch (type) {
				case 'video':
					return (
						<VideoPlayer
							isVideo={true}
							url={convertIPFSUrl(url) ?? ''}
							poster={
								convertIPFSUrl(poster) ??
								convertIPFSUrl(data.coverUrl) ??
								''
							}
							isMuted={isMuted}
							onMuteChange={(muted) => {
								setIsMuted(muted);
								setGs({ ...gs, isFeedMuted: muted });
							}}
							onClick={() => {
								if (feedData) {
									clickFunction(
										isRepost
											? feedData.parentPostId
											: feedData.id,
									);
								}
							}}
						/>
					);
				case 'audio':
					return (
						<div className='relative h-full'>
							<Image
								onClick={() => {
									if (feedData) {
										clickFunction(
											isRepost
												? feedData.parentPostId
												: feedData.id,
										);
									}
								}}
								draggable='false'
								src={convertIPFSUrl(url) ?? ''}
								alt={url}
								width={0}
								height={0}
								sizes='100vw'
								style={{
									objectFit: 'contain',
									width: '100%',
									height: '100%',
									margin: 'auto',
								}}
							/>
							<div
								className={`absolute top-2 right-3  ${
									walletAdd
										? 'cursor-pointer'
										: 'cursor-default'
								}   bg-[#ffffff2f] flex items-center justify-center rounded-full p-2`}
							>
								<Image
									draggable='false'
									src='/music.png'
									alt='music'
									width={20}
									height={20}
									className='mr-[1px]'
								/>
							</div>
							<VideoPlayer
								poster={
									convertIPFSUrl(poster) ??
									convertIPFSUrl(data.coverUrl) ??
									''
								}
								isVideo={false}
								url={convertIPFSUrl(audioUrl) ?? ''}
								isMuted={isMuted}
								onMuteChange={(muted) => {
									setIsMuted(muted);
									setGs({ ...gs, isFeedMuted: muted });
								}}
								onClick={() => {
									if (feedData) {
										clickFunction(
											isRepost
												? feedData.parentPostId
												: feedData.id,
										);
									}
								}}
							/>
							{/* 
							<button
								// onClick={handleMuteToggle}
								className='absolute cursor-pointer bottom-2 right-3 p-2 bg-[#00000078] flex items-center justify-center rounded-full'
							>
								{muteStateRef.current ? (
									<Image
										className='cursor-pointer'
										alt='mute'
										draggable='false'
										width={20}
										height={20}
										src={'/product/mute.svg'}
									/>
								) : (
									<Image
										className='cursor-pointer'
										alt='volume'
										draggable='false'
										width={20}
										height={20}
										src={'/product/volume.svg'}
									/>
								)}
							</button> */}
						</div>
					);

				default:
					return (
						<Image
							onClick={() => {
								if (feedData) {
									clickFunction(
										isRepost
											? feedData.parentPostId
											: feedData.id,
									);
								}
							}}
							onError={(e) => {
								e.currentTarget.src =
									'/emptyState/emptyimg2.svg';
								e.currentTarget.srcset =
									'/emptyState/emptyimg2.svg';
							}}
							src={convertIPFSUrl(url) ?? ''}
							alt={url}
							className={`${isRepost && 'rounded-b-md '} ${
								walletAdd ? 'cursor-pointer' : 'cursor-default'
							}  m-auto`}
							draggable='false'
							width={300}
							height={300}
							style={{
								objectFit: 'contain',
								width: '100%',
								height: '100%',
								margin: 'auto',
							}}
							// layout={isLevel2 ? 'fill' : 'responsive'}
							// objectFit='contain'
							// width={isLevel2 ? undefined : 500}
							// height={isLevel2 ? undefined : 500}

							// width={300}
							// height={300}
							// draggable='false'
							// style={{
							// 	objectFit: 'cover',
							// 	width: '100%',
							// 	height: '100%',
							// }}
						/>
					);
			}
		}
	};

	return (
		<>
			<div
				className={` text-black bg-black  ${
					isLevel2 ? 'w-[55%]' : 'w-[90%] m-2 md:w-[70%]  '
				} ${isRepost && !isLevel2 ? 'p-5 ' : 'p-0'} `}
			>
				{isRepost && !isLevel2 && (
					<div
						className={`text-[#f1f0eb] cursor-pointer ${
							isLevel2 ? 'pl-4 py-5' : 'mb-7 '
						}`}
						onClick={(e) => {
							e.stopPropagation();
							clickFunction(feedData?.id!);
						}}
					>
						{feedData?.repost ? (
							feedData.caption ? (
								<>
									<div className='flex flex-row items-center gap-3 cursor-pointer'>
										<Avatar
											className=' min-w-[32px]'
											size={'sm'}
											src={
												feedData?.postedBy?.avatarUrl ??
												undefined
											}
											onClick={(e) => {
												e.stopPropagation();
												router.push(
													'/profile/' +
														feedData?.postedBy
															?.walletAddress,
												);
											}}
										/>

										<p
											className='text-start font-bold line-clamp-1 text-sm '
											onClick={(e) => {
												e.stopPropagation();
												router.push(
													'/profile/' +
														feedData?.postedBy
															?.walletAddress,
												);
											}}
										>
											{feedData?.postedBy?.userName}
										</p>
									</div>
									<div
										ref={captionDivRef}
										className={`flex flex-col items-start mt-2 text-justify font-light ${
											isLevel2 ? 'hidden' : 'block'
										}`}
									>
										<span
											ref={captionTextRef}
											className={`${
												!isLevel2 && 'line-clamp-2'
											}`}
										>
											{feedData?.caption}
										</span>
										{/* {!isLevel2 && (
											<span
												onClick={() => {
													if (feedData)
														clickFunction(
															feedData.id
														);
												}}
												className='text-green-600 whitespace-nowrap cursor-pointer mt-1'
											>
												{captionTextRef.current &&
												captionDivRef.current &&
												captionTextRef.current
													.scrollHeight >
													captionDivRef.current
														.offsetHeight
													? 'more'
													: ''}
											</span>
										)} */}
									</div>
								</>
							) : (
								<div className='flex flex-row items-center gap-3 '>
									<Image
										className='cursor-pointer '
										alt='Refresh'
										draggable='false'
										width={28}
										height={28}
										src={'/post/refresh.svg'}
									/>
									<p className='text-start font-bold line-clamp-1 text-sm'>
										{feedData?.postedBy?.userName} reposted
									</p>
								</div>
							)
						) : (
							<></>
						)}
					</div>
				)}
				<div
					ref={divRef}
					className='rounded-md cursor-pointer flex flex-col h-full'
					onClick={(e) => {
						e.stopPropagation();
						clickFunction(
							isRepost ? feedData?.parentPostId : feedData?.id!,
						);
					}}
				>
					<div
						className={`flex-1 ${
							isRepost && !isLevel2
								? 'border border-[#6E6E6E] rounded-md '
								: 'border-none'
						}`}
					>
						<PostHeader
							clickFunction={(e: number) => clickFunction(e)}
							isLevel2={isLevel2}
							isRepost={isRepost}
							data={postHeaderData}
							id={feedData?.id!}
							walletAddress={
								isRepost
									? feedData?.createdBy?.walletAddress
									: feedData?.postedBy?.walletAddress
							}
							router={router}
						/>

						{/* {Array.isArray(index) ? (
					<Slider data={index} />
				) : (
					<Image
						className='object-cover max-h-[550px] cursor-pointer'
						width={3000}
						height={4000}
						alt='test'
						onClick={() => {
							clickFunction();
						}}
						src={`/postImgs/eg${index}.png`}
					/>
				)} */}
						{feedData &&
						feedData?.content &&
						feedData?.content?.length > 1 ? (
							<Slider
								data={feedData.content}
								id={
									isRepost
										? feedData.parentPostId
										: feedData.id
								}
								clickFunction={clickFunction}
								isLevel2={isLevel2}
								isRepost={isRepost}
							/>
						) : (
							<div
								className={`w-full relative ${
									walletAdd
										? 'cursor-pointer'
										: 'cursor-default'
								}  ${
									isLevel2
										? ' h-[500px] content-center'
										: ' h-fit '
								}`}
							>
								{(feedData?.content[0]?.product?.voucher ??
									feedData?.content[0]?.product
										?.asset?.[0]) && (
									<div className='relative h-full w-full'>
										<PostMedia
											data={
												feedData.content[0].product
													.voucher ??
												feedData.content[0].product
													.asset?.[0]
											}
											feedData={feedData}
											gs={gs}
											setGs={setGs}
											isMuted={isMuted}
											setIsMuted={setIsMuted}
											isRepost={isRepost}
											isLevel2={isLevel2}
											clickFunction={clickFunction}
										/>
										{getUrl(
											feedData.content[0].product
												.voucher ??
												feedData.content[0].product
													.asset?.[0],
										).type !== 'audio' && (
											<div className='absolute bottom-2 right-3 cursor-pointer bg-[#00000078] flex items-center justify-center rounded-full p-2'>
												<button
													onClick={(e) => {
														e.stopPropagation();
														setIsOpenFullScreen(
															true,
														);
													}}
												>
													<Image
														alt='expand'
														draggable='false'
														width={20}
														height={20}
														src={
															'/product/expand.svg'
														}
													/>
												</button>
											</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>
					{isLoggedIn && (
						<PostTail
							openPost={openPost}
							isOpen={isOpen}
							data={{
								likedByMe: feedData?.likedByMe!,
								id: feedData?.id ?? null,
								post: feedData?.content.map((c) => {
									if (c) {
										const x = {
											collectionId: c.collectionId,
											productId: c.productId,
											imageURl:
												c.product?.voucher?.mediaUrl ??
												c.product?.asset?.[0]
													?.mediaUrl ??
												'',
											postId: feedData.id,
										};
										return x;
									}
								}),

								walletAdd: walletAdd,
							}}
							reactToPost={reactToPost}
							setIsOpenShare={setIsOpenShare}
						/>
					)}
				</div>
			</div>
			<ShareModal
				isOpenShare={isOpenShare}
				setIsOpenShare={setIsOpenShare}
				link={`https://app.kamiunlimited.com/post/` + feedData.id}
				postId={feedData.id}
				walletAddress={walletAdd}
			/>
			{isOpenFullScreen && (
				<FullScreenMedia
					isOpen={isOpenFullScreen}
					closeFullScreen={closeFullScreen}
					mediaUrl={
						getUrl(
							feedData?.content[0].product?.voucher ??
								feedData.content[0].product.asset?.[0],
						).url ?? ''
						// feedData?.content[0].product?.voucher.mediaUrl ?? ''
						// item.product?.voucher.mediaUrl
					}
				/>
			)}
		</>
	);
}

const PostHeader = ({
	hasAudio = false,
	name = 'Name Place Holder',
	avatar = '/postImgs/eg2.png',
	clickFunction,
	isLevel2,
	isRepost = false,
	data,
	id,
	router,
	walletAddress,
}: {
	hasAudio?: boolean;
	name?: string;
	avatar?: string;
	clickFunction: (e: number) => void;
	isLevel2: boolean;
	isRepost?: boolean;
	data: PostHeaderType | undefined;
	id: number;
	router: AppRouterInstance;
	walletAddress: string | undefined;
}) => {
	const [global, setGlobals] = useGlobalState();
	const [isReadMore, setIsReadMore] = useState(true);
	const toggleReadMore = () => {
		setIsReadMore(!isReadMore);
	};
	const textRef = useRef<HTMLSpanElement>(null);
	const divRef = useRef<HTMLDivElement>(null);

	return (
		<div
			className={` ${
				hasAudio || !isLevel2 ? 'p-4 rounded-md' : 'p-2'
			}  bg-black text-[#f1f0eb] font-light`}
		>
			<div
				className={`flex flex-row ${
					!isLevel2 ? 'justify-between' : 'justify-end'
				}`}
			>
				{!isLevel2 && (
					<div
						className={`flex text-center cursor-pointer items-center flex-[ ${
							hasAudio ? 0.7 : 1
						}] overflow-ellipsis`}
					>
						<Avatar
							onClick={(e) => {
								e.stopPropagation();
								router.push('/profile/' + walletAddress);
							}}
							className='mr-3 min-w-[32px]'
							size={'sm'}
							src={data?.avatarUrl ?? undefined}
							icon={<AvatarIcon />}
						/>

						<p
							className='text-start font-bold line-clamp-1 text-sm capitalize'
							onClick={(e) => {
								e.stopPropagation();
								router.push('/profile/' + walletAddress);
							}}
						>
							{data?.userName}
						</p>
					</div>
				)}

				{hasAudio && (
					<div className='flex text-center flex-[0.3] items-center '>
						<div className='relative w-[110px] h-[18pt] flex overflow-hidden'>
							<MarqueeText
								text={'Song title scroll across here'}
							/>
						</div>
						<Image
							className='p-1'
							onClick={() => {
								setGlobals({
									isFeedMuted: !(
										global?.isFeedMuted ?? false
									),
								});
							}}
							alt='mute'
							width={28}
							height={28}
							src={
								global?.isFeedMuted
									? '/volume-x.svg'
									: '/volume-max.svg'
							}
						/>
					</div>
				)}
			</div>

			{!isLevel2 && data?.comment && (
				<div
					ref={divRef}
					className='flex flex-row items-end mt-2 text-justify mb-2 '
				>
					<span className='font-light'>
						<span ref={textRef} className={`line-clamp-2  `}>
							{data?.comment}
						</span>
					</span>
					{/* <span
						onClick={() => {
							console.log(id);
							clickFunction(id);
						}}
						className='text-green-600 whitespace-nowrap cursor-pointer'
					>
						{textRef.current?.offsetWidth ===
						divRef.current?.offsetWidth
							? 'more'
							: ''}
					</span> */}
				</div>
			)}
		</div>
	);
};

const PostTail = ({
	openPost,
	isOpen,
	data,
	reactToPost,
	setIsOpenShare,
}: {
	openPost?: (e: boolean, content: ContentType[]) => void;
	isOpen?: boolean;

	data: {
		likedByMe: boolean;
		id: number | null;
		post: any;
		walletAdd?: string;
	};
	reactToPost?: (isLiked: boolean, id: number) => void;
	setIsOpenShare: Dispatch<SetStateAction<boolean>>;
}) => {
	const [isLiked, setIsLiked] = useState<boolean>(data.likedByMe);
	useEffect(() => {
		if (data) setIsLiked(data.likedByMe);
	}, [data, data.likedByMe]);

	const likedPost = async () => {
		if (data.walletAdd && data.id) {
			const res = await likePost(data.walletAdd, data.id);
			if (res.success) {
				// data.likedByMe = true;
				setIsLiked(true);
				if (reactToPost) reactToPost(true, data.id!);
			}
		}
	};

	const unlikedPost = async () => {
		if (data.walletAdd && data.id) {
			const res = await unlikePost(data.walletAdd, data.id);
			if (res.success) {
				// data.likedByMe = false;
				setIsLiked(false);
				if (reactToPost) reactToPost(false, data.id!);
			}
		}
	};

	return (
		<>
			<div className='p-4 bg-black'>
				<div className='flex justify-between text-white'>
					<div>
						{isLiked ? (
							<div className='flex flex-row gap-2 items-end'>
								<div className='  w-[35px] h-[35px]  relative'>
									<Image
										src={'/fire/fire.gif'}
										unoptimized
										onClick={(e) => {
											e.stopPropagation();
											unlikedPost();
											// if (reactToPost)
											// 	reactToPost(false, data.id!);
											// setIsLiked(false);
										}}
										alt={'card1'}
										layout='fill'
										objectFit='contain'
										className=' cursor-pointer'
										draggable='false'
									/>
									{/* <Image
								className='cursor-pointer w-[25px] h-25px '
								alt='Like'
								draggable='false'
								width={26}
								height={26}
								src={'/fire/fire.gif'}
								unoptimized
								onClick={() => setIsLiked(!isLiked)}
							/> */}
								</div>
								<p className=' h-fit uppercase text-[#6E6E6E] text-[10px] font-medium border border-[#6E6E6E] py-1 px-2 rounded-md'>
									Liked
								</p>
							</div>
						) : (
							<div className=' w-[35px] h-[35px] relative'>
								<Image
									src={'/fire/empty.svg'}
									unoptimized
									onClick={(e) => {
										e.stopPropagation();
										likedPost();
										// if (reactToPost)
										// 	reactToPost(true, data.id!);
										// setIsLiked(true);
									}}
									alt={'card1'}
									layout='fill'
									objectFit='contain'
									className=' cursor-pointer'
									draggable='false'
								/>
								{/* // 	<Image
							// 	className='cursor-pointer  w-[25px] h-25px '
							// 	alt='Like'
							// 	draggable='false'
							// 	width={23}
							// 	height={23}
							// 	src={'/fire/fireEmpty.png'}
							// 	onClick={() => setIsLiked(!isLiked)}
							// /> */}
							</div>
						)}
					</div>

					<div className='flex text-center items-center gap-3 w-full justify-end z-50'>
						<Image
							className='cursor-pointer '
							alt='Share'
							draggable='false'
							width={23}
							height={23}
							src={'/post/send.svg'}
							onClick={(e) => {
								e.stopPropagation();
								setIsOpenShare(true);
							}}
						/>

						<Tooltip
							className='bg-black cursor-pointer text-[10px]'
							content='Coming Soon..'
						>
							<Image
								className='cursor-pointer '
								alt='Playlist'
								draggable='false'
								width={23}
								height={23}
								src={'/post/playlistGrey.svg'}
							/>
						</Tooltip>
						<Image
							onClick={(e) => {
								e.stopPropagation();
								if (openPost) openPost(true, data.post);
							}}
							className='cursor-pointer '
							alt='Refresh'
							draggable='false'
							width={23}
							height={23}
							src={'/post/refresh.svg'}
						/>
						{/* <Image
							onClick={(e) => {
								e.preventDefault();
								if (openPost) openPost(false, data.post);
							}}
							className='cursor-pointer '
							alt='Bookmark'
							draggable='false'
							width={23}
							height={23}
							src={'/post/post.svg'}
						/> */}
					</div>

					{/* <div className='flex text-center items-center '>
				<Image
					className='cursor-pointer '
					alt='Message'
					draggable='false'
					width={25}
					height={28}
					src={'/post/message.svg'}
				/>
			</div> */}
				</div>
			</div>
		</>
	);
};

const MarqueeText = ({ text }: { text: string }) => {
	return (
		<motion.div
			className='flex w-fit font-bold text-white text-nowrap text-xs items-center'
			initial={{ x: 0 }}
			animate={{ x: -453.162 }}
			transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
		>
			{text} <span className='mx-3'>♫</span> {text}{' '}
			<span className='mx-3'>♫</span> {text}
		</motion.div>
	);
};
