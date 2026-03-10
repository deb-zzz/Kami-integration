'use client';
import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	useDisclosure,
	Input,
	Divider,
	Tabs,
	Tab,
} from '@nextui-org/react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { CommentSection } from './Comments';
import CreatePost from '@/components/CreatePost';
import {
	getFavouriteFeed,
	getFollowingFeed,
	getTrendingFeed,
	likePost,
	unlikePost,
} from '@/apihandler/Feed';
import useKamiWallet from '@/lib/KamiWalletHook';
import {
	ContentType,
	FeedComment,
	FeedContent,
	FeedPost,
	FeedType,
} from '@/types';
import { addView } from '@/apihandler/Post';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	checkPermissionState,
	notificationUnsupported,
	registerAndSubscribe,
} from '../../lib/Push';
import PostComponent from '@/components/Timeline/PostComponent';
import { useSearch } from '@/lib/SearchContextProvider';
import { useInView } from 'react-intersection-observer';
import { PostSkeletonList } from '@/components/Timeline/PostSkeleton';
import { SearchInput } from '@/components/SearchInput';
import { getChainIcons } from '@/lib/Util';
// type ContentType = {
// 	collectionId?: number;
// 	productId?: number;
// 	imageURl: string;
// };

const loadingLimit = 10;

export default function Home() {
	const [trendingData, setTrendingData] = useState<FeedType[]>([]);
	const [favouriteData, setFavouriteData] = useState<FeedType[]>([]);
	const [followingData, setFollowingData] = useState<FeedType[]>([]);
	const [singleFeedData, setSingleFeedData] = useState<FeedType>();
	const [walletAddress, setWalletAddress] = useState<string>('');
	const wallet = useKamiWallet();
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const { isOpen, onOpen, onOpenChange } = useDisclosure();
	const [isRepost, setIsRepost] = useState<boolean>(false);
	const [selectedTab, setSelectedTab] = useState<string>('trending');
	const [commentRepost, setCommentRepost] = useState<string>('');
	const [content, setContent] = useState<ContentType[]>([]);
	const [gs, setGs] = useGlobalState();
	const [unsupported, setUnsupported] = useState<boolean>(false);
	const [, setSubscription] = useState<PushSubscription | null>(null);
	const [notificationModalOpen, setNotificationModalOpen] =
		useState<boolean>(false);
	const [, setHasPermission] = useState<boolean>(false);
	const [isLoadingFollowing, setIsLoadingFollowing] =
		useState<boolean>(false);
	const [isLoadingFavourite, setIsLoadingFavourite] =
		useState<boolean>(false);

	useEffect(() => {
		const isUnsupported = notificationUnsupported();
		setUnsupported(isUnsupported);
		if (isUnsupported || !gs) {
			return;
		}
		setHasPermission(checkPermissionState() == 'granted');
		registerAndSubscribe(gs.walletAddress ?? '', setSubscription);
	}, [gs]);

	useEffect(() => {
		if (!wallet?.getAccount()?.address) return;
		const w = wallet.getAccount().address!;

		setWalletAddress(w);
		setNotificationModalOpen(checkPermissionState() == 'default');

		// EnvData().then((v) => console.log(v));
	}, [wallet?.getAccount()?.address]);

	useEffect(() => {
		if (!wallet?.getAccount()?.address) return;
		const w = wallet.getAccount().address!;
		switch (selectedTab) {
			case 'trending':
				getTrendingData(w);
				break;
			case 'following':
				getFollowingData(w);
				break;
			case 'favourite':
				getFavouriteData(w);
				break;
			default:
				getTrendingData(w);
				break;
		}
	}, [wallet?.getAccount()?.address, selectedTab]);

	const getTrendingData = async (address: string) => {};

	const getFollowingData = async (address: string) => {
		setIsLoadingFollowing(true);
		try {
			const data = await getFollowingFeed(address);
			if (data.success && data.following.length > 0) {
				// Combine all posts from following users into a single array
				// and sort by postedAt in descending order
				const combinedPosts = data.following
					.flatMap((item) => item.posts)
					.filter((post) => !post.repost);
				combinedPosts.sort((a, b) => b.postedAt - a.postedAt);

				setFollowingData(combinedPosts);
			} else {
				setFollowingData([]);
			}
		} finally {
			setIsLoadingFollowing(false);
		}
	};
	const getFavouriteData = async (address: string) => {
		setIsLoadingFavourite(true);
		try {
			const res = await getFavouriteFeed(address);
			if (res.success) {
				setFavouriteData(res.data);
			} else {
				setFavouriteData([]);
			}
		} finally {
			setIsLoadingFavourite(false);
		}
	};

	const openPost = (e: boolean, content: ContentType[], comment?: string) => {
		setCommentRepost('');
		setContent(content);
		setCreateIsOpen(true);
		setIsRepost(e);

		if (comment) {
			setCommentRepost(comment);
		}
	};

	const openLevel2 = (e: number) => {
		onOpen();
		addViewCount(e);
		const data = getData();
		// there's get single post api, integrate that instead
		const singleData = data.find((x) => x.id === e);
		setSingleFeedData(singleData);
	};

	const addViewCount = async (e: number) => {
		const res = await addView(walletAddress, e);
		// console.log('Add View Response', res);
	};

	const reactToPost = (isLiked: boolean, id: number, data?: FeedType[]) => {
		if (!data) data = getData();
		if (isLiked) {
			const y = data!.find((x) => x.id === id);
			if (y) {
				y.likedByMe = true;
			}
			// if (selectedTab === 'trending') {
			// 	setTrendingData(data);
			// }
		} else {
			const y = data!.find((x) => x.id === id);
			if (y) {
				y.likedByMe = false;
			}
			// if (selectedTab === 'trending') {
			// 	setTrendingData(data);
			// }
		}
	};
	const commentToPost = async (
		id: number,
		comment: string | null,
		isReply: boolean
	) => {
		if (walletAddress && id && comment !== null) {
			// const res = await commentPost(walletAddress, id, commentData);
			// if (res.success && gs && gs.profile) {

			if (isReply) {
				const y = singleFeedData?.comments.find((x) => x.id === id);

				if (y) {
					y.replies.push({
						createdByUser: gs?.profile,
						comment: comment,
						replyToCommentId: id,
					} as unknown as FeedComment);
					setSingleFeedData(singleFeedData);
				}
			} else {
				const d = {
					id: null,
					postId: id,
					createdByAddress: walletAddress,
					comment: comment,
					likes: 0,
					createdByUser: gs?.profile,
					likedByMe: false,
					replyToCommentId: null,
				};
				const arr = singleFeedData;
				let commentArray = arr?.comments;
				if (commentArray) {
					commentArray = [
						...commentArray,
						d as unknown as FeedComment,
					];
					if (arr) arr.comments = commentArray;
				}
				setSingleFeedData(arr);
			}
		}
	};

	const getData = () => {
		switch (selectedTab) {
			case 'trending':
				return trendingData;
			case 'following':
				return followingData;
			case 'favourite':
				return favouriteData;
			default:
				return [];
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
			<main className='flex min-h-screen  flex-row justify-center pb-10'>
				<div className='w-[95%] md:w-[80%] xl:w-[50%]  '>
					<AllowNotificationModal
						isOpen={notificationModalOpen && !unsupported}
						onOpenChange={setNotificationModalOpen}
						setSubscription={setSubscription}
						walletAddress={walletAddress}
					/>
					{gs && gs.walletAddress ? (
						<Tabs
							onSelectionChange={(e) => {
								if (e != null) setSelectedTab(e.toString());
							}}
							variant='underlined'
							aria-label='Tabs variants'
							fullWidth
							classNames={{
								tabList:
									'w-full  relative rounded-none p-0 border-b border-b-[0.5] text-[#F1F0EB]',
								cursor: 'w-full bg-[#F1F0EB] text-[#F1F0EB]',
								tabContent:
									'text-[#F1F0EB] tracking-[1px] text-[15px] font-[300] group-data-[selected=true]:text-[#F1F0EB] group-data-[selected=true]:font-semibold uppercase',
							}}
						>
							<Tab key='trending' title='Trending'>
								<TrendingTab
									incomingFeedData={[]}
									walletAddress={walletAddress}
									openLevel2={openLevel2}
									openPost={openPost}
									createIsOpen={createIsOpen}
									reactToPost={reactToPost}
									data={(data) => setTrendingData(data)}
								/>
							</Tab>
							<Tab key='following' title='Following'>
								<FollowingTab
									feedData={followingData}
									walletAddress={walletAddress}
									openLevel2={openLevel2}
									openPost={openPost}
									createIsOpen={createIsOpen}
									reactToPost={reactToPost}
									isLoading={isLoadingFollowing}
								/>
							</Tab>
							<Tab
								key='favourite'
								title={
									<div className='flex gap-2 items-center'>
										<span className='text-[15px]'>
											Favourites
										</span>
										<Image
											src={'/fire/fire.png'}
											alt={'fire'}
											width={18}
											height={18}
											className='mb-2'
										/>
									</div>
								}
							>
								<FavouriteTab
									feedData={favouriteData}
									walletAddress={walletAddress}
									openLevel2={openLevel2}
									openPost={openPost}
									createIsOpen={createIsOpen}
									reactToPost={reactToPost}
									isLoading={isLoadingFavourite}
								/>
							</Tab>
						</Tabs>
					) : (
						<TrendingTab
							incomingFeedData={[]}
							walletAddress={walletAddress}
							openLevel2={openLevel2}
							openPost={openPost}
							createIsOpen={createIsOpen}
							reactToPost={reactToPost}
							data={(data) => setTrendingData(data)}
						/>
					)}
				</div>
				<Modal
					isOpen={isOpen}
					onOpenChange={onOpenChange}
					className='bg-transparent rounded-none p-0 m-0 min-h-[500px] '
					classNames={{
						closeButton:
							' border-white border-2 text-white hover:bg-black absolute -right-12 top-0 ',
						body: '',
						backdrop: '',
						base: ' overflow-y-visible',
					}}
					size='4xl'
				>
					<ModalContent>
						{(onClose) => (
							<ModalBody className='p-0 m-0 h-full flex-grow basis-0 shrink-0 flex-row gap-0 bg-black'>
								{singleFeedData && (
									<>
										<PostComponent
											isLevel2={true}
											clickFunction={() => onOpen()}
											key={0}
											index={0}
											openPost={(
												e: boolean,
												content: ContentType[]
											) => openPost(e, content)}
											isOpen={createIsOpen}
											isRepost={singleFeedData?.repost}
											feedData={singleFeedData}
											walletAdd={walletAddress}
											reactToPost={reactToPost}
										/>
										<CommentSection
											isRepost={singleFeedData?.repost}
											data={singleFeedData}
											walletAddress={walletAddress}
											commentToPost={commentToPost}
											openPost={(
												e: boolean,
												content: ContentType[],
												comment?: string
											) => openPost(e, content, comment)}
											isOpen={createIsOpen}
											chainIcon={getChainIcon(
												singleFeedData?.chainId
											)}
										/>
									</>
								)}
							</ModalBody>
						)}
					</ModalContent>
				</Modal>
			</main>
			<CreatePost
				isOpen={createIsOpen}
				setIsOpen={setCreateIsOpen}
				isRepost={true}
				content={content}
				walletAddress={walletAddress}
				commentToRepost={commentRepost}
			/>
		</>
	);
}

const TrendingTab = ({
	incomingFeedData,
	walletAddress,
	openLevel2,
	openPost,
	createIsOpen,
	reactToPost,
	data,
}: {
	incomingFeedData: FeedType[];
	walletAddress: string;
	openLevel2: (e: number) => void;
	openPost: (e: boolean, content: ContentType[]) => void;
	createIsOpen: boolean;
	reactToPost: (isLiked: boolean, id: number) => void;
	data: (feed: FeedType[]) => void;
}) => {
	const { searchText, setSearchText, handleSearch } = useSearch();

	const [page, setPage] = useState<number>(1);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isFinished, setIsFinished] = useState<boolean>(false);
	const { ref, inView } = useInView();
	const [trendingData, setTrendingData] = useState<FeedType[]>([]);

	const getTrendingData = async (address?: string) => {
		const data = await getTrendingFeed(address, {
			page: page ?? 1,
			limit: loadingLimit,
			searchText: searchText,
		});

		if (data.feed.length < loadingLimit) {
			setIsFinished(true);
		}
		setTrendingData([...trendingData, ...data.feed]);
		setPage((prev) => prev + 1);
	};

	useEffect(() => {
		if (inView) {
			if (isLoading) return;
			setIsLoading(true);
			if (walletAddress) {
				getTrendingData(walletAddress);
			} else {
				getTrendingData();
			}

			setIsLoading(false);
		}
	}, [ref, inView]);

	useEffect(() => {
		if (trendingData.length > 0) {
			data(trendingData);
		}
	}, [trendingData]);

	const feedData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const c = handleSearch(searchText, trendingData);
			const u = handleSearch(
				searchText,
				trendingData,
				['createdBy'],
				(key, data) => {
					return (data as any).userName;
				}
			);
			const results = [...c, ...u].sort(
				(a: FeedType, b: FeedType) => a.createdAt - b.createdAt
			);
			return results;
		} else return trendingData;
	}, [searchText, trendingData]);

	return (
		<div>
			{walletAddress && <SearchInput />}
			{!walletAddress && (
				<div className='flex flex-row items-center justify-center border-b-2 border-b-[#F1F0EB] w-[70%] mx-auto pb-3 mb-10 '>
					<p className='text-[#F1F0EB] text-[15px] font-medium uppercase'>
						Latest Posts
					</p>
				</div>
			)}
			<div className='flex flex-col gap-8 items-center justify-center center '>
				{feedData && feedData.length > 0 ? (
					<>
						{feedData.map((data, i) => (
							<PostComponent
								clickFunction={(e: number) => {
									if (!walletAddress) return;
									openLevel2(e);
								}}
								key={i}
								index={i}
								openPost={(
									e: boolean,
									content: ContentType[]
								) => openPost(e, content)}
								isOpen={createIsOpen}
								isRepost={data.repost}
								feedData={data}
								walletAdd={walletAddress}
								reactToPost={reactToPost}
							/>
						))}
					</>
				) : (
					<div className='mt-10'>
						<p>Be the first to share something awesome!</p>
					</div>
				)}
				{!isFinished && (
					<div ref={ref} className='w-full'>
						<PostSkeletonList count={3} />
					</div>
				)}
			</div>
		</div>
	);
};

const AllowNotificationModal = ({
	isOpen,
	onOpenChange,
	setSubscription,
	walletAddress,
}: {
	isOpen: boolean;
	onOpenChange: (e: boolean) => void;
	setSubscription: (a: PushSubscription | null) => void;
	walletAddress: string;
}) => {
	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			className='bg-transparent rounded-none p-0 m-0 h-fit'
			classNames={{
				closeButton:
					'border-white border-2 text-white hover:bg-black absolute -right-10 top-0',
				body: '',
				backdrop: '',
				base: 'overflow-y-visible',
			}}
			size='lg'
		>
			<ModalContent>
				{(onClose) => (
					<ModalBody className='p-4 rounded-md m-0 h-full flex-grow basis-0 shrink-0 items-center justify-center center flex-row gap-0 bg-black'>
						<div className='flex flex-col gap-4 items-center justify-center center'>
							<div className='flex flex-col gap-4 items-center justify-center center'>
								<p className='text-white text-2xl'>
									Allow Notifications
								</p>
								<p className='text-white text-lg '>
									We need your permission to send you
									notifications.
								</p>
								<div className='flex gap-4'>
									<Button
										onClick={() => {
											registerAndSubscribe(
												walletAddress,
												setSubscription
											);
											onOpenChange(false);
										}}
										className='bg-[#F1F0EB] text-black'
									>
										Allow
									</Button>
									<Button
										onClick={() => {
											onOpenChange(false);
										}}
										className='bg-transparent border-[#F1F0EB] border-1 text-[#F1F0EB]'
									>
										Not Now
									</Button>
								</div>
							</div>
						</div>
					</ModalBody>
				)}
			</ModalContent>
		</Modal>
	);
};

const FollowingTab = ({
	feedData,
	walletAddress,
	openLevel2,
	openPost,
	createIsOpen,
	reactToPost,
	isLoading,
}: {
	feedData: FeedType[];
	walletAddress: string;
	openLevel2: (e: number) => void;
	openPost: (e: boolean, content: ContentType[]) => void;
	createIsOpen: boolean;
	reactToPost: (isLiked: boolean, id: number) => void;
	isLoading: boolean;
}) => {
	const { searchText, handleSearch } = useSearch();

	const filteredFeedData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const c = handleSearch(searchText, feedData);
			const u = handleSearch(
				searchText,
				feedData,
				['createdBy'],
				(key, data) => {
					return (data as any).userName;
				}
			);
			const results = [...c, ...u].sort(
				(a: FeedType, b: FeedType) => a.createdAt - b.createdAt
			);
			return results;
		} else return feedData;
	}, [searchText, feedData]);

	return (
		<div>
			<SearchInput />
			<div className='flex flex-col gap-8 items-center justify-center center '>
				{isLoading ? (
					<PostSkeletonList count={3} />
				) : filteredFeedData && filteredFeedData.length > 0 ? (
					filteredFeedData.map((data, i) => (
						<PostComponent
							clickFunction={(e: number) => openLevel2(e)}
							key={i}
							index={i}
							openPost={(e: boolean, content: ContentType[]) =>
								openPost(e, content)
							}
							isOpen={createIsOpen}
							isRepost={data.repost}
							feedData={data}
							walletAdd={walletAddress}
							reactToPost={reactToPost}
						/>
					))
				) : (
					<div className='mt-10'>
						<p>Oops! You haven&apos;t followed anyone.</p>
					</div>
				)}
			</div>
		</div>
	);
};

const FavouriteTab = ({
	feedData,
	walletAddress,
	openLevel2,
	openPost,
	createIsOpen,
	reactToPost,
	isLoading,
}: {
	feedData: FeedType[];
	walletAddress: string;
	openLevel2: (e: number) => void;
	openPost: (e: boolean, content: ContentType[]) => void;
	createIsOpen: boolean;
	reactToPost: (isLiked: boolean, id: number) => void;
	isLoading: boolean;
}) => {
	const { searchText, handleSearch } = useSearch();

	const filteredFeedData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const c = handleSearch(searchText, feedData);
			const u = handleSearch(
				searchText,
				feedData,
				['createdBy'],
				(key, data) => {
					return (data as any).userName;
				}
			);
			const results = [...c, ...u].sort(
				(a: FeedType, b: FeedType) => a.createdAt - b.createdAt
			);
			return results;
		} else return feedData;
	}, [searchText, feedData]);

	return (
		<div>
			<SearchInput />
			<div className='flex flex-col gap-8 items-center justify-center center '>
				{isLoading ? (
					<PostSkeletonList count={3} />
				) : filteredFeedData && filteredFeedData.length > 0 ? (
					filteredFeedData.map((data, i) => (
						<PostComponent
							clickFunction={(e: number) => openLevel2(e)}
							key={i}
							index={i}
							openPost={(e: boolean, content: ContentType[]) =>
								openPost(e, content)
							}
							isOpen={createIsOpen}
							isRepost={data.repost}
							feedData={data}
							walletAdd={walletAddress}
							reactToPost={reactToPost}
						/>
					))
				) : (
					<div className='mt-10'>
						<p>Oops! You haven&apos;t favourited any post.</p>
					</div>
				)}
			</div>
		</div>
	);
};
