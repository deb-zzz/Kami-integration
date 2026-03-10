import {
	commentPost,
	likeComment,
	replyComment,
	unlikeComment,
} from '@/apihandler/Post';
import {
	followProfile,
	getFollowInfo,
	unfollowProfile,
} from '@/apihandler/Profile';
import { useGlobalState } from '@/lib/GlobalContext';
import {
	ContentType,
	FeedComment,
	FeedContent,
	FeedPost,
	FeedType,
	Profile,
} from '@/types';
import {
	Avatar,
	AvatarIcon,
	Modal,
	ModalBody,
	ModalContent,
	Textarea,
	Tooltip,
	useDisclosure,
} from '@nextui-org/react';
import { get } from 'http';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MentionText } from '@/components/MentionText';
import { MentionTextarea } from '@/components/MentionTextarea';
import { loadAllProfilesToCache } from '@/lib/mention-cache';
import { numberFormat } from '@/lib/Util';
import AddToCartButton from '@/components/AddToCartButton';

export const CommentSection = ({
	isRepost = false,
	data,
	walletAddress,
	commentToPost,
	openPost,
	isOpen,
	chainIcon,
}: {
	isRepost?: boolean;
	data: FeedType | undefined;
	walletAddress: string;
	commentToPost?: (
		id: number,
		comment: string | null,
		isReply: boolean,
	) => void;
	openPost: (e: boolean, content: ContentType[], comment: string) => void;
	isOpen: boolean;
	chainIcon?: string;
}) => {
	const router = useRouter();
	const [value, setValue] = useState<string>('');
	const [clearFlipper, setClearFlipper] = useState<boolean>(false);
	const [commentData, setCommentData] = useState<FeedComment[]>(
		data?.comments ?? [],
	);
	const [followerMap, setFollowersMap] = useState<Map<string, boolean>>(
		new Map(),
	);

	const commentOnPost = async () => {
		if (walletAddress && data?.id && value !== '') {
			const commentData = { comment: value };
			const res = await commentPost(walletAddress, data.id, commentData);

			if (res.success) {
				if (commentToPost) {
					commentToPost(data?.id!, value, false);
				}
				setCommentData(data?.comments);

				setClearFlipper(!clearFlipper); // Clear the textarea after successful comment
				setValue(''); // Clear the main comment textarea
			}
		}
	};
	const replyToComment = async (replyValue: string | null, id: number) => {
		if (walletAddress && id && replyValue !== null) {
			const commentData = {
				comment: replyValue,
				replyToCommentId: id,
			};
			const res = await replyComment(
				walletAddress,
				data?.id as number,
				commentData,
			);
			if (res.success) {
				if (commentToPost) {
					commentToPost(id, replyValue, true);
				}
				if (data?.comments) setCommentData([...data?.comments]);
			}
		}
	};
	const commentSectionRef = useRef<HTMLDivElement>(null);
	const prevCommentDataLength = useRef<number>(commentData.length);

	useEffect(() => {
		if (
			commentSectionRef.current &&
			commentData.length !== prevCommentDataLength.current
		) {
			commentSectionRef.current.scrollTop =
				commentSectionRef.current.scrollHeight;
			prevCommentDataLength.current = commentData.length;
		}
	}, [commentData]);

	const follow = async (address: string) => {
		if (walletAddress) {
			const res = await followProfile(address, walletAddress);
			if (res.success) {
				// Update the followerMap directly
				followerMap.set(address, true);
				setFollowersMap(new Map(followerMap));
			}
		}
	};
	const unfollow = async (address: string) => {
		if (walletAddress) {
			const res = await unfollowProfile(address, walletAddress);
			if (res.success) {
				// Update the followerMap directly
				followerMap.set(address, false);
				setFollowersMap(new Map(followerMap));
			}
		}
	};

	const fetchFollowingInfo = async () => {
		if (data?.postedBy) {
			const res = await getFollowInfo(data?.postedBy.walletAddress);
			if (res.followers.length > 0 && walletAddress) {
				const isFollowed = res.followers?.includes(walletAddress);
				followerMap.set(data.postedBy.walletAddress, isFollowed);
			}
		}

		if (data?.comments) {
			for (const comment of data.comments) {
				if (comment.createdByAddress) {
					if (!followerMap.get(comment.createdByAddress)) {
						const res = await getFollowInfo(
							comment.createdByAddress,
						);
						if (res.followers.length > 0 && walletAddress) {
							const isFollowed =
								res.followers.includes(walletAddress);
							followerMap.set(
								comment.createdByAddress,
								isFollowed,
							);
						}
					}
				}
				if (comment.replies) {
					for (const reply of comment.replies) {
						if (reply.createdByAddress) {
							if (!followerMap.get(reply.createdByAddress)) {
								const res = await getFollowInfo(
									reply.createdByAddress,
								);
								if (res.followers.length > 0 && walletAddress) {
									const isFollowed =
										res.followers.includes(walletAddress);
									followerMap.set(
										reply.createdByAddress,
										isFollowed,
									);
								}
							}
						}
					}
				}
			}
			// setCommentData([...data.comments]);
		}
		setFollowersMap(new Map(followerMap));
	};
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

	// Initialize global profile cache on component mount
	useEffect(() => {
		loadAllProfilesToCache();
	}, []);

	useEffect(() => {
		fetchFollowingInfo();
		if (walletAddress) {
			setIsLoggedIn(true);
		} else {
			setIsLoggedIn(false);
		}
	}, [data, walletAddress]);

	return (
		<div className='bg-black h-full  p-3 flex-1  relative '>
			<div className='flex flex-col h-full '>
				<div className='flex-1'>
					{data?.content && (
						<Details
							data={data?.content[0]}
							walletAddress={walletAddress}
							chainIcon={chainIcon}
							// creatorName={data?.createdBy.userName}
							// walletAddress={data?.createdBy.walletAddress}
						/>
					)}
					<div>
						<div
							ref={commentSectionRef}
							className={`${
								isRepost ? 'max-h-[500px]' : 'max-h-[430px]'
							} pb-1 mt-2 scrollbar-thumb-rounded-3xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-600  overflow-auto`}
						>
							{isRepost && !data?.caption && (
								<div className='flex flex-row items-center gap-3  my-2  p-2'>
									<Image
										className='cursor-pointer '
										alt='Refresh'
										draggable='false'
										width={28}
										height={28}
										src={'/post/refresh.svg'}
									/>
									<p className='text-start font-bold line-clamp-1 text-sm'>
										{data?.postedBy.userName} reposted
									</p>
								</div>
							)}
							{data?.caption && (
								<div
									onClick={(e) => {
										e.stopPropagation();
										router.push(
											'/profile/' +
												data?.postedBy.walletAddress,
										);
									}}
									className='flex flex-row items-start text-[#f1f0eb] my-2 w-fit  p-2 cursor-pointer'
								>
									<div className='relative h-fit'>
										<Avatar
											className='mr-3 min-w-[32px]'
											size={'sm'}
											icon={<AvatarIcon />}
											src={
												data?.postedBy.avatarUrl ??
												undefined
											}
										/>
										{isLoggedIn &&
											data.postedBy.walletAddress !==
												walletAddress && (
												<div className='cursor-pointer w-fit absolute -bottom-1 right-1 z-30'>
													<Image
														// src={`/profile/info/follow.svg`}
														src={`/profile/info/${
															followerMap.get(
																data.postedBy
																	.walletAddress,
															)
																? 'followGreen'
																: 'follow'
														}.svg`}
														alt={'plus'}
														width={20}
														height={20}
														onClick={(e) => {
															e.stopPropagation();
															followerMap.get(
																data.postedBy
																	.walletAddress,
															)
																? unfollow(
																		data
																			.postedBy
																			.walletAddress,
																	)
																: follow(
																		data
																			.postedBy
																			.walletAddress,
																	);
														}}
													/>
												</div>
											)}
									</div>
									<div>
										<p className='text-start font-bold line-clamp-1 text-sm capitalize'>
											{data.postedBy.userName}
										</p>
										<MentionText
											text={data?.caption || ''}
											router={router}
											className='font-light'
										/>
									</div>
								</div>
							)}
							<div>
								{commentData &&
									commentData?.length > 0 &&
									commentData.map(
										(comment: FeedComment, index) => (
											<div key={index} className='z-0'>
												<div className='relative z-0'>
													{comment.replyToCommentId ===
														null && (
														<Comment
															data={comment}
															walletAddress={
																walletAddress
															}
															key={index}
															clearValue={
																clearFlipper
															}
															replyToComment={(
																replyValue:
																	| string
																	| null,
																id: number,
															) =>
																replyToComment(
																	replyValue,
																	id,
																)
															}
															router={router}
															openPost={openPost}
															isOpen={isOpen}
															postData={[
																{
																	postId: data?.id,
																	imageURl:
																		data
																			?.content[0]
																			?.product
																			?.voucher
																			?.mediaUrl ??
																		data
																			?.content[0]
																			?.product
																			?.asset?.[0]
																			?.mediaUrl ??
																		'',
																},
															]}
															follow={follow}
															unfollow={unfollow}
															isFollowed={followerMap.get(
																comment.createdByAddress,
															)}
															isLoggedIn={
																isLoggedIn
															}
														/>
													)}
													{/* {comment.replies &&
														comment.replies.length >
															0 && (
															<div
																className={`absolute h-[100%] mt-8 w-[0.2px] top-0 left-6 bg-[#4E4E4E] `}
															></div>
														)} */}
												</div>
												<div>
													{comment.replies &&
														comment.replies.length >
															0 &&
														comment.replies.map(
															(
																item: FeedComment,
																idx,
															) => (
																<div
																	key={idx}
																	className='relative'
																>
																	{/* {idx !== comment.replies.length - 1 && (
																<div
																	className={`absolute h-[100%] mt-8 w-[0.2px] top-0 left-[66px] bg-[#4E4E4E] `}></div>
															)} */}

																	<Comment
																		data={
																			item
																		}
																		walletAddress={
																			walletAddress
																		}
																		router={
																			router
																		}
																		openPost={
																			openPost
																		}
																		isOpen={
																			isOpen
																		}
																		postData={[
																			{
																				postId: data?.id,
																				imageURl:
																					data
																						?.content[0]
																						.product
																						.voucher
																						.mediaUrl! ??
																					data
																						?.content[0]
																						.product
																						.asset?.[0]
																						?.mediaUrl!,
																			},
																		]}
																		follow={
																			follow
																		}
																		unfollow={
																			unfollow
																		}
																		isFollowed={followerMap.get(
																			item.createdByAddress,
																		)}
																		isLoggedIn={
																			isLoggedIn
																		}
																		isReply={
																			true
																		}
																	/>
																</div>
															),
														)}
												</div>
											</div>
										),
									)}
							</div>
						</div>
					</div>
				</div>
				{isLoggedIn && (
					<div className='w-full   border-t border-t-[#4E4E4E] '>
						<MentionTextarea
							maxRows={2}
							variant='flat'
							placeholder='Add a comment'
							walletAddress={walletAddress}
							value={value}
							classNames={{
								base: 'bg-black ',
								innerWrapper: 'items-center',
								input: ' group-data-[has-value=true]:text-[#6E6E6E] placeholder:text-[#6E6E6E] placeholder:font-light placeholder:italic text-[13px] font-light',
								inputWrapper:
									' border-none bg-black shadow-none group-data-[hover=true]:bg-black group-data-[hover=true]:border-none group-data-[focus=true]:bg-black group-data-[focus=true]:border-none rounded-lg  ',
							}}
							onValueChange={setValue}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									commentOnPost();
								}
							}}
							endContent={
								<Image
									className='cursor-pointer '
									alt='enter'
									draggable='false'
									width={30}
									height={30}
									src={'/post/commentEnter.svg'}
									onClick={() => {
										commentOnPost();
									}}
								/>
							}
						/>
					</div>
				)}
			</div>
		</div>
	);
};

const Details = ({
	data,
	walletAddress,
	chainIcon,
}: {
	data: FeedContent;
	walletAddress: string;
	chainIcon?: string;
}) => {
	return (
		<div className='flex flex-col bg-[#191919] w-full p-3 rounded-lg'>
			<div className='flex flex-row gap-3'>
				<div className='relative h-fit'>
					<Link href={'/collection/' + data.collectionId}>
						<Avatar
							className='w-[35px] h-[35px]'
							size={'sm'}
							icon={<AvatarIcon />}
							src={data?.collection.avatarUrl ?? undefined}
						/>
					</Link>
					{/* <div className='cursor-pointer w-fit absolute -bottom-1 -right-1.5 '>
					<Image
						src={`/profile/info/follow.svg`}
						alt={'plus'}
						width={20}
						height={20}
					/>
				</div> */}
				</div>

				<div className='flex-1 flex flex-col gap-3'>
					<div className='cursor-pointer w-fit'>
						<Link href={'/collection/' + data.collectionId}>
							<p className='font-bold text-[15px] '>
								{data.collection.name}
							</p>
						</Link>
						<Link
							href={
								'/profile/' +
								data.collection.owner?.walletAddress
							}
						>
							<p className='text-[12px] font-light  '>
								By {data.collection.owner?.userName}
							</p>
						</Link>
					</div>
					<div>
						<div className='flex flex-row items-center justify-between'>
							<div className='flex  items-center'>
								<Link href={'/product/' + data.productId}>
									<p className='font-light'>
										Product ID: {data.productId}
									</p>
								</Link>
							</div>
							<div className='flex justify-end'>
								<div className='flex flex-row gap-3  items-center '>
									<div className='flex flex-row gap-2 items-center'>
										{chainIcon && (
											<Image
												src={chainIcon}
												alt='chain icon'
												width={20}
												height={20}
											/>
										)}
										<p className='text-[15px] font-bold'>
											{data.product.price
												? numberFormat(
														Number(
															data.product.price,
														),
														2,
													) + ' USDC'
												: 0 + ' USDC'}
										</p>
									</div>
									{/* TO ADD Chain ID HERE */}
									{walletAddress !==
										data.product.ownerWalletAddress &&
										data.product.consumerAction ===
											'Buy' && (
											<AddToCartButton
												productId={data.product.id}
												walletAddress={walletAddress}
												showOnlyIcon={true}
											/>
										)}
									{/* <button className='text-[13px] font-bold px-2 py-1  border border-[#F1F0EB] rounded-md text-[#F1F0EB]'>
							Buy Now
						</button> */}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export type CommentOptions = {
	person: string;
	msg: string;
	hasReply?: boolean;
	isReply?: boolean;
};

export const Comment = ({
	data,
	walletAddress,
	replyToComment,
	router,
	openPost,
	isOpen,
	postData,
	follow,
	unfollow,
	isFollowed = false,
	isLoggedIn = false,
	isReply = false,
	clearValue = false,
}: {
	data: FeedComment;
	walletAddress: string;
	replyToComment?: (replyValue: string | null, id: number) => void;
	router: AppRouterInstance;
	openPost: (e: boolean, content: ContentType[], comment: string) => void;
	isOpen: boolean;
	postData?: ContentType[];
	follow?: (address: string) => Promise<void>;
	unfollow?: (address: string) => Promise<void>;
	isFollowed?: boolean;
	isLoggedIn?: boolean;
	isReply?: boolean;
	clearValue?: boolean;
}) => {
	const [replyInput, setReplyInput] = useState<boolean>(false);
	const [replyValue, setReplyValue] = useState('');
	const [isLiked, setIsLiked] = useState<boolean>(data.likedByMe);

	useEffect(() => {
		setReplyValue('');
	}, [clearValue]);

	const clickLikeComment = async () => {
		if (walletAddress && data.id) {
			const res = await likeComment(walletAddress, data.id);
		}
	};
	const clickUnlikeComment = async () => {
		if (walletAddress && data.id) {
			const res = await unlikeComment(walletAddress, data.id);
		}
	};
	const clickHeart = (liked: boolean) => {
		if (liked) {
			clickLikeComment();
			setIsLiked(true);
		} else {
			clickUnlikeComment();
			setIsLiked(false);
		}
	};
	return (
		<>
			<div
				className={`flex flex-col w-full p-2 ${isReply ? 'pl-12' : ''}`}
			>
				<div className='flex gap-2'>
					<div>
						<div className='relative h-fit'>
							<Avatar
								className='w-[35px] h-[35px] z-30'
								size={'sm'}
								icon={<AvatarIcon />}
								src={
									data?.createdByUser?.avatarUrl ?? undefined
								}
								onClick={(e) => {
									e.stopPropagation();
									router.push(
										'/profile/' + data?.createdByAddress,
									);
								}}
							/>
							{isLoggedIn &&
								data.createdByAddress !== walletAddress && (
									<div className='cursor-pointer w-fit absolute -bottom-1 -right-1.5 z-30'>
										<Image
											// src={`/profile/info/follow.svg`}
											src={`/profile/info/${
												isFollowed
													? 'followGreen'
													: 'follow'
											}.svg`}
											alt={'plus'}
											width={20}
											height={20}
											onClick={(e) => {
												e.stopPropagation();

												isFollowed
													? unfollow &&
														unfollow(
															data?.createdByAddress,
														)
													: follow &&
														follow(
															data?.createdByAddress,
														);
											}}
										/>
									</div>
								)}
						</div>
						{/* {data.replies && data.replies.length > 0 && (
							<div className='ml-[45%] border-[#4E4E4E] border-0 border-l h-[100%]' />
						)} */}
					</div>
					<div className='pl-2 pt-1'>
						<p
							className='font-bold cursor-pointer'
							onClick={(e) => {
								e.stopPropagation();
								router.push(
									'/profile/' + data?.createdByAddress,
								);
							}}
						>
							{data.createdByUser?.userName}
						</p>
						<MentionText
							text={data.comment}
							router={router}
							className='text-[12px] font-light mt-1'
						/>
						{isLoggedIn && (
							<div className='flex text-center items-center gap-2 mt-3 mb-2 '>
								{/* <Image
								className='cursor-pointer '
								alt='Like'
								draggable='false'
								width={20}
								height={20}
								// src={'/post/heart.svg'}
								src={`/fire/${
									isLiked ? 'fire.gif' : 'fireEmpty.png'
								}`}
								onClick={() => {
									// setIsLiked(!isLiked);
									clickHeart(!isLiked);
									// likedPost();
								}}
							/> */}
								{isLiked ? (
									<div className='  w-[25px] h-[25px] mb-1  relative'>
										<Image
											src={'/fire/fire.gif'}
											unoptimized
											onClick={() => {
												clickHeart(false);
												// if (reactToPost)
												// 	reactToPost(false, data.id!);
												// setIsLiked(false);
											}}
											alt='Like'
											layout='fill'
											objectFit='contain'
											className=' cursor-pointer'
											draggable='false'
										/>
									</div>
								) : (
									<div className='  w-[25px] h-[25px] mb-1 relative'>
										<Image
											src={'/fire/empty.svg'}
											unoptimized
											onClick={() => {
												clickHeart(true);
												// if (reactToPost)
												// 	reactToPost(false, data.id!);
												// setIsLiked(false);
											}}
											alt='Like'
											layout='fill'
											objectFit='contain'
											className=' cursor-pointer'
											draggable='false'
										/>
									</div>
								)}
								{data.replyToCommentId === null && (
									<>
										{/* <Tooltip
											className='bg-black cursor-pointer text-[10px]'
											content='Coming Soon..'
										>
											<Image
												className='cursor-pointer '
												alt='Share'
												draggable='false'
												width={20}
												height={20}
												src={'/post/sendGrey.svg'}
											/>
										</Tooltip> */}
										<Image
											className='cursor-pointer '
											alt='Refresh'
											draggable='false'
											width={20}
											height={20}
											src={'/post/refresh.svg'}
											onClick={(e) => {
												e.preventDefault();
												if (openPost && postData)
													openPost(
														true,
														postData,
														data.comment,
													);
											}}
										/>
										<Image
											className='cursor-pointer '
											alt='Reply'
											draggable='false'
											width={20}
											height={20}
											src={'/post/comment.svg'}
											onClick={() =>
												setReplyInput(!replyInput)
											}
										/>
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
			{isLoggedIn && replyInput && (
				<div className='flex gap-2'>
					<div className='w-[35px]' />
					<div className='w-[85%] mb-2 relative  '>
						<MentionTextarea
							minRows={1}
							variant='flat'
							placeholder='Reply comment'
							walletAddress={walletAddress}
							classNames={{
								base: 'bg-black  ',
								innerWrapper: 'items-center',
								input: 'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-600 group-data-[has-value=true]:text-[#6E6E6E] placeholder:text-[#6E6E6E] placeholder:font-light placeholder:italic text-[13px] font-light',
								inputWrapper:
									'z-10 border border-[#4E4E4E] bg-black shadow-none group-data-[hover=true]:bg-black group-data-[hover=true]:border border-[#4E4E4E] group-data-[focus=true]:bg-black group-data-[focus=true]:border border-[#4E4E4E] rounded-lg  ',
							}}
							onValueChange={setReplyValue}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									if (replyToComment)
										replyToComment(replyValue, data?.id!);
									setReplyInput(false);
									setReplyValue(''); // Clear the reply textarea after successful reply
								}
							}}
							endContent={
								<Image
									className='cursor-pointer self-end'
									alt='enter'
									draggable='false'
									width={20}
									height={20}
									src={'/post/commentEnter.svg'}
									onClick={() => {
										if (replyToComment)
											replyToComment(
												replyValue,
												data?.id!,
											);
										setReplyInput(false);
										setReplyValue(''); // Clear the reply textarea after successful reply
										// commentOnPost();
									}}
								/>
							}
						/>
						<Image
							className='cursor-pointer absolute -top-2 -right-2 z-20 bg-black'
							alt='close'
							draggable='false'
							width={20}
							height={20}
							src={'/post/close.svg'}
							onClick={() => {
								setReplyInput(false);
							}}
						/>
					</div>
				</div>
			)}
		</>
	);
};
