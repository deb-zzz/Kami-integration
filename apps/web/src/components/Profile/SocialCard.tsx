import { Avatar, AvatarIcon, Tooltip } from '@nextui-org/react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import { SocialPost } from '@/types';
import { convertIPFSUrl, numberFormat } from '@/lib/Util';
import { deletePost, pinPost } from '@/apihandler/Post';
import { likePost, unlikePost } from '@/apihandler/Feed';
import ShareModal from '../ShareModal';
import CreatePost from '../CreatePost';
import FeedModal from '../FeedModal';

const SocialCard = ({
	data,
	isMyPost = false,
	walletAddress,
	pinAPost,
	deleteSocialPost,
	isProfile = false,
}: {
	data: SocialPost & { isPinned?: boolean; numComments?: number };
	isMyPost?: boolean;
	walletAddress?: string;
	pinAPost?: (id: number) => void;
	deleteSocialPost?: (id: number) => void;
	isProfile?: boolean;
}) => {
	const isPinned = data.isPinned;
	const [likedByMe, setLikedByMe] = useState(data.likedByMe);
	const [likesCount, setLikesCount] = useState(data.likes || 0);
	const [repostsCount, setRepostsCount] = useState(data.reposts || 0);
	const [sharesCount, setSharesCount] = useState(data.shares || 0);
	const [hasShared, setHasShared] = useState(false);
	const [isOpenShare, setIsOpenShare] = useState<boolean>(false);
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const [isOpen, setIsOpen] = useState<boolean>(false);

	useEffect(() => {
		setLikedByMe(data.likedByMe);
		setLikesCount(data.likes || 0);
		setRepostsCount(data.reposts || 0);
		setSharesCount(data.shares || 0);
		setHasShared(false);
	}, [
		data.id,
		data.likedByMe,
		data.likes,
		data.reposts,
		data.shares,
		walletAddress,
	]);

	// const deleteSocialPost = async () => {
	// 	if (walletAddress) {
	// 		console.log('delete post');
	// 		const res = await deletePost(walletAddress, data.id);
	// 		console.log(res);
	// 	}
	// };
	// const pinAPost = async () => {
	// 	if (walletAddress) {
	// 		console.log('pin post', data.id);
	// 		const res = await pinPost(walletAddress, { post_id: data.id });
	// 		console.log(res);
	// 	}
	// };

	const likedPost = async () => {
		if (walletAddress && data.id) {
			const res = await likePost(walletAddress, data.id);
			if (res.success) {
				setLikedByMe(true);
				setLikesCount((prev) => prev + 1);
			}
		}
	};

	const unlikedPost = async () => {
		if (walletAddress && data.id) {
			const res = await unlikePost(walletAddress, data.id);
			if (res.success) {
				setLikedByMe(false);
				setLikesCount((prev) => Math.max(0, prev - 1));
			}
		}
	};
	const isPrivatePost = isProfile && data.products[0]?.audience === 'Private';
	return (
		<div className='relative'>
			{isPrivatePost && (
				<Image
					src='/product/hide.svg'
					alt='menu'
					width={25}
					height={25}
					className='text-white cursor-pointer absolute top-3 left-3 z-10'
				/>
			)}
			<div
				className={`${
					isPrivatePost
						? 'opacity-45 cursor-default'
						: 'cursor-pointer'
				} w-full flex flex-row  gap-5`}
				onClick={() => {
					if (isPrivatePost) return;
					setIsOpen(true);
				}}
			>
				{isProfile && data?.products[0]?.imageUrl && (
					<div className='flex-[0.2] bg-black w-full min-h-[200px]  relative'>
						<Image
							src={
								convertIPFSUrl(data?.products[0]?.imageUrl) ??
								''
							}
							alt={'social'}
							layout='fill'
							objectFit='contain'
						/>
					</div>
				)}
				<div
					className={`${
						isProfile ? 'flex-[0.8]' : 'flex-1'
					} flex flex-row gap-3`}
				>
					<div className='flex-row'>
						<Avatar
							icon={<AvatarIcon />}
							size='sm'
							classNames={{ base: 'w-[25px] h-[25px] ' }}
							src={data?.postedBy.avatarUrl ?? undefined}
						/>
					</div>
					<div className='flex-1 flex flex-col gap-[2px]'>
						<p className='font-bold text-[12.6px]'>
							{data.postedBy.userName}
						</p>
						<p className='font-light'>{data.caption}</p>
						<div
							className={` ${
								isProfile ? 'justify-start' : 'justify-between'
							} flex text-center items-center  gap-8 mt-4`}
						>
							<div
								className=' flex flex-row items-center gap-2'
								onClick={(e) => {}}
							>
								{likedByMe ? (
									<div className='w-[23px] h-[30px] mb-2  relative'>
										<Image
											src={`/fire/fire.gif`}
											alt={'fire'}
											unoptimized
											onClick={(e) => {
												e.stopPropagation();
												if (isPrivatePost) return;
												unlikedPost();
											}}
											layout='fill'
											objectFit='contain'
											draggable='false'
										/>
									</div>
								) : (
									<div className='w-[23px] h-[30px] mb-2  relative'>
										<Image
											src={`/fire/empty.svg`}
											alt={'fire'}
											unoptimized
											onClick={(e) => {
												e.stopPropagation();
												if (isPrivatePost) return;
												likedPost();
											}}
											layout='fill'
											objectFit='contain'
											draggable='false'
										/>
									</div>
								)}
								{/* {likedByMe ? (
									<Image
										className='cursor-pointer'
										alt='Like'
										draggable='false'
										width={16}
										height={16}
										src={'/fire/fire.gif'}
										unoptimized
										onClick={(e) => {
											e.stopPropagation();
											unlikedPost();
										}}
									/>
								) : (
									<Image
										alt='likes'
										width={16}
										height={16}
										src={'/fire/empty.svg'}
										className='mb-1'
										onClick={(e) => {
											e.stopPropagation();
											likedPost();
										}}
									/>
								)} */}
								<p className='text-[12px]'>
									{numberFormat(likesCount)}
								</p>
							</div>
							<div className=' flex flex-row items-center gap-2'>
								<Image
									alt='shares'
									width={20}
									height={20}
									src={'/post/send.svg'}
									onClick={(e) => {
										e.stopPropagation();
										if (isPrivatePost) return;
										setIsOpenShare(true);
									}}
								/>
								<p className='text-[12px]'>
									{numberFormat(sharesCount)}
								</p>
							</div>
							<div className=' flex flex-row items-center gap-2'>
								<Image
									alt='repost'
									width={20}
									height={20}
									src={'/post/refresh.svg'}
									onClick={(e) => {
										e.stopPropagation();
										if (isPrivatePost) return;
										setCreateIsOpen(true);
									}}
								/>
								<p className='text-[12px]'>
									{numberFormat(repostsCount)}
								</p>
							</div>
							{!isProfile && (
								<div className=' flex flex-row items-center gap-2'>
									<Image
										alt='mute'
										width={20}
										height={20}
										src={'/post/chat.svg'}
									/>{' '}
									<p className='text-[12px]'>
										{/* TODO */}
										{numberFormat(data.numComments ?? 0)}
									</p>
								</div>
							)}
						</div>
					</div>
					{isProfile && (
						<div className='flex-[0.5] flex-row flex justify-end gap-4'>
							<div className='flex flex-row h-fit items-center gap-3'>
								{isMyPost && isPinned && (
									<>
										<p className='text-[11px] bg-[#323131] py-1 pl-3 pr-5 font-bold uppercase z-0 rounded-md'>
											Pinned
										</p>

										<Image
											alt='pin'
											width={25}
											height={25}
											src={'/profile/pin.svg'}
											className='h-fit z-20 -ml-3'
										/>
									</>
								)}
								{isMyPost && data.isRepost && (
									<>
										<p className='text-[11px] bg-[#323131] py-1 pl-3 pr-5 font-bold uppercase z-0 rounded-md'>
											Repost
										</p>

										<Image
											alt='pin'
											width={25}
											height={25}
											src={'/profile/repost.svg'}
											className='h-fit z-20 -ml-3'
										/>
									</>
								)}
							</div>
							{isMyPost && (
								<Tooltip
									placement='right-start'
									className='bg-black '
									isDisabled={isPrivatePost}
									content={
										<div>
											{' '}
											<div
												className='text-[11px] font-bold p-1 border-b border-b-[#323131] cursor-pointer'
												onClick={(e) => {
													e.stopPropagation();
													pinAPost &&
														pinAPost(
															data.isPinned
																? 0
																: data.id
														);
												}}
											>
												{data.isPinned
													? 'Unpin'
													: 'Pin'}
											</div>
											<div
												onClick={(e) => {
													e.stopPropagation();
													deleteSocialPost &&
														deleteSocialPost(
															data.id
														);
												}}
												className='text-[11px] text-danger-300 font-bold p-1 cursor-pointer'
											>
												Delete
											</div>
											{/* <div className='text-[11px] font-bold p-1 border-b border-b-[#323131] cursor-auto'>
									Edit
								</div> */}
										</div>
									}
								>
									<Image
										alt='dot'
										width={23}
										height={23}
										src={'/profile/verticalDot.svg'}
										className='h-fit'
										draggable={false}
									/>
								</Tooltip>
							)}
						</div>
					)}
				</div>
			</div>
			<FeedModal
				isOpen={isOpen}
				setIsOpen={setIsOpen}
				postId={data.id.toString()}
			/>
			<ShareModal
				isOpenShare={isOpenShare}
				setIsOpenShare={setIsOpenShare}
				link={`https://app.kamiunlimited.com/post/` + data.id}
				postId={data.id}
				walletAddress={walletAddress}
				onShareSuccess={() => {
					if (hasShared) return;
					setHasShared(true);
					setSharesCount((prev) => prev + 1);
				}}
			/>
			<CreatePost
				isOpen={createIsOpen}
				setIsOpen={setCreateIsOpen}
				isRepost={true}
				content={[
					{
						collectionId: data.products[0].collection.collectionId,
						productId: data.products[0].productId,
						imageURl: data.products[0].imageUrl,
						postId: data.id,
					},
				]}
				walletAddress={walletAddress}
				onRepostSuccess={() => {
					setRepostsCount((prev) => prev + 1);
				}}
			/>
		</div>
	);
};

export default SocialCard;
