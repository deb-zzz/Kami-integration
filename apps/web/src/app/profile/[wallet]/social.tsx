'use client';

import { deletePost, getPinnedPost, pinPost } from '@/apihandler/Post';
import {
	getProfileSocialInteractedPost,
	getProfileSocialPost,
} from '@/apihandler/Profile';
import SocialCard from '@/components/Profile/SocialCard';
import SortComponent from '@/components/Sort';
import { useSearch } from '@/lib/SearchContextProvider';
import { SocialPost } from '@/types';
import { Input, Skeleton } from '@nextui-org/react';
import Image from 'next/image';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import useKamiWallet from '@/lib/KamiWalletHook';
import FeedModal from '@/components/FeedModal';

export default function SocialTab({
	walletAddress,
}: {
	walletAddress: string;
}) {
	const wallet = useKamiWallet();
	const [tab, setTab] = useState<string>('posts');
	const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
	const [socialInteractedPost, setSocialInteractedPost] = useState<
		SocialPost[]
	>([]);
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [postId, setPostId] = useState<string>('');
	const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(true);
	const [isLoadingInteractedPosts, setIsLoadingInteractedPosts] = useState<boolean>(true);
	const getTab = (e: string) => {
		// console.log(e);
		setTab(e);
	};
	useEffect(() => {
		if (walletAddress) {
			getSocialPost(walletAddress);
			getSocialInteractedPost(walletAddress);
		}
	}, [walletAddress]);

	const getSocialPinnedPost = async (address: string) => {
		try {
			const res = await getPinnedPost(address);
			return res.pinnedPost;
		} catch (error) {
			console.log(error);
			return undefined;
		}
	};
	const getSocialPost = async (address: string) => {
		setIsLoadingPosts(true);
		const res = await getProfileSocialPost(address);
		if (res.success) {
			res.posts.sort(
				(a: SocialPost, b: SocialPost) => b.createdAt - a.createdAt
			);
			const pinned = await getSocialPinnedPost(walletAddress);
			if (pinned) {
				res.posts = res.posts
					.map((post) => ({
						...post,
						isPinned:
							pinned && pinned.id === post.id ? true : false,
					}))
					.sort((a, b) =>
						a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1
					);
			}
			setSocialPosts(res.posts);
		}
		setIsLoadingPosts(false);
	};
	const pinAPost = async (id: number) => {
		if (walletAddress) {
			const res = await pinPost(walletAddress, { post_id: id });
			if (res.success) {
				if (id !== 0) {
					const x = socialPosts
						.map((post) => ({
							...post,
							isPinned: id === post.id ? true : false,
						}))
						.sort((a, b) =>
							a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1
						);
					setSocialPosts([...x]);
				} else {
					const x = socialPosts.map((post) => ({
						...post,
						isPinned: false,
					}));

					setSocialPosts([...x]);
				}
			}
		}
	};
	const deleteSocialPost = async (id: number) => {
		if (walletAddress) {
			const res = await deletePost(walletAddress, id);
			if (res.success) {
				const updatedPosts = socialPosts.filter(
					(post) => post.id !== id
				);
				setSocialPosts([...updatedPosts]);
			}
		}
	};
	const getSocialInteractedPost = async (address: string) => {
		setIsLoadingInteractedPosts(true);
		const res = await getProfileSocialInteractedPost(address);
		if (res.success) {
			res.posts.sort(
				(a: SocialPost, b: SocialPost) => b.createdAt - a.createdAt
			);
			setSocialInteractedPost(res.posts);
		}
		setIsLoadingInteractedPosts(false);
	};

	//TODO ask Paul how to use callback so it doesnt look ugly when the tab changes
	const getSortData = (data: any) => {
		if (tab === 'posts') {
			const d: SocialPost[] = data;
			setSocialPosts([...d]);
		} else {
			const d: SocialPost[] = data;
			setSocialInteractedPost([...d]);
		}
	};

	const { searchText, setSearchText, handleSearch } = useSearch();

	const searchSocialPostsData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const results = handleSearch(searchText, socialPosts, ['caption']);

			return results;
		}
		return socialPosts;
	}, [searchText, socialPosts]);

	const searchSocialInteractedPostData = useMemo(() => {
		if (searchText && searchText.length > 0) {
			const results = handleSearch(searchText, socialInteractedPost, [
				'caption',
			]);

			return results;
		}
		return socialInteractedPost;
	}, [searchText, socialInteractedPost]);
	return (
		<div className='pt-4  w-full flex flex-row gap-14 '>
			<div className='w-1/5 flex flex-col'>
				{wallet?.getAccount()?.address ? (
					<>
						<div className='h-10'></div>
						<SocialFilter
							getTab={getTab}
							currentTab={tab}
							setSearchText={setSearchText}
						/>
					</>
				) : (
					<div className='gap-4 flex flex-col'>
						{/* <div className='h-10'></div> */}
						<p className=' text-[#6E6E6E] font-medium  border-b border-b-[#6e6e6e] pb-4'>
							Posts
						</p>
						<p className=' text-[#6E6E6E] font-medium'>Replies</p>
					</div>
				)}
			</div>
			<div className='w-4/5 flex flex-col '>
				<div className='w-full flex flex-row items-center -mt-2 mb-4'>
					<div className=' w-4/5 flex flex-row items-center'>
						{tab === 'posts' ? (
							<p className='text-[18px] font-medium pr-3'>
								Posts
							</p>
						) : (
							<p className='text-[18px] font-medium '>Replies</p>
						)}
					</div>
					<div className='w-1/5 '>
						{wallet?.getAccount()?.address &&
							((tab === 'posts' &&
								searchSocialPostsData.length > 0) ||
								(tab === 'replies' &&
									searchSocialInteractedPostData.length >
										0)) && (
								<SortComponent
									page={tab}
									sorted={getSortData}
									data={
										tab === 'posts'
											? socialPosts
											: socialInteractedPost
									}
								/>
							)}
					</div>
				</div>
				<div className='w-4/5 '>
					{tab === 'posts' ? (
						isLoadingPosts ? (
							// Loading skeleton for posts
							<>
								{[...Array(3)].map((_, i) => (
									<div
										key={i}
										className={`border-b border-b-[#323131] py-10 last:border-none ${i === 0 && 'pt-0'}`}
									>
										<div className='w-full flex flex-row gap-5'>
											{/* Image skeleton */}
											<div className='flex-[0.2] w-full min-h-[200px]'>
												<Skeleton className='w-full h-[200px] rounded-lg'>
													<div className='w-full h-[200px] bg-default-300'></div>
												</Skeleton>
											</div>
											{/* Content skeleton */}
											<div className='flex-[0.8] flex flex-row gap-3'>
												{/* Avatar skeleton */}
												<div className='flex-row'>
													<Skeleton className='rounded-full'>
														<div className='w-[25px] h-[25px] rounded-full bg-default-300'></div>
													</Skeleton>
												</div>
												{/* Text content skeleton */}
												<div className='flex-1 flex flex-col gap-2'>
													<Skeleton className='w-1/4 rounded-lg'>
														<div className='h-3 w-1/4 rounded-lg bg-default-300'></div>
													</Skeleton>
													<Skeleton className='w-full rounded-lg'>
														<div className='h-4 w-full rounded-lg bg-default-200'></div>
													</Skeleton>
													<Skeleton className='w-3/4 rounded-lg'>
														<div className='h-4 w-3/4 rounded-lg bg-default-200'></div>
													</Skeleton>
													{/* Action buttons skeleton */}
													<div className='flex gap-8 mt-4'>
														{[...Array(3)].map((_, j) => (
															<div key={j} className='flex flex-row items-center gap-2'>
																<Skeleton className='rounded-lg'>
																	<div className='w-[20px] h-[20px] bg-default-300'></div>
																</Skeleton>
																<Skeleton className='w-8 rounded-lg'>
																	<div className='h-3 w-8 bg-default-200'></div>
																</Skeleton>
															</div>
														))}
													</div>
												</div>
											</div>
										</div>
									</div>
								))}
							</>
						) : searchSocialPostsData.length > 0 ? (
							searchSocialPostsData.map((p, i) => (
								<div
									className={`border-b border-b-[#323131] py-10 last:border-none  ${
										wallet?.getAccount()?.address
											? 'cursor-pointer'
											: 'cursor-default'
									}  ${i === 0 && 'pt-0'}`}
									key={i}
									onClick={() => {
										if (!wallet?.getAccount()?.address)
											return;
										setPostId(p.id.toString());

										setIsOpen(true);
									}}
								>
									<SocialCard
										data={p}
										isMyPost={
											wallet &&
											wallet.getAccount()?.address ===
												walletAddress
												? true
												: false
										}
										pinAPost={pinAPost}
										walletAddress={walletAddress}
										deleteSocialPost={deleteSocialPost}
										isProfile={true}
									/>
								</div>
							))
						) : (
							<div className='flex justify-center w-full'>
								<p className=' mt-10'>
									Oops! You haven&apos;t posted anything.
								</p>
							</div>
						)
					) : isLoadingInteractedPosts ? (
						// Loading skeleton for interacted posts
						<>
							{[...Array(3)].map((_, i) => (
								<div
									key={i}
									className={`border-b border-b-[#323131] py-10 last:border-none ${i === 0 && 'pt-0'}`}
								>
									<div className='w-full flex flex-row gap-5'>
										{/* Image skeleton */}
										<div className='flex-[0.2] w-full min-h-[200px]'>
											<Skeleton className='w-full h-[200px] rounded-lg'>
												<div className='w-full h-[200px] bg-default-300'></div>
											</Skeleton>
										</div>
										{/* Content skeleton */}
										<div className='flex-[0.8] flex flex-row gap-3'>
											{/* Avatar skeleton */}
											<div className='flex-row'>
												<Skeleton className='rounded-full'>
													<div className='w-[25px] h-[25px] rounded-full bg-default-300'></div>
												</Skeleton>
											</div>
											{/* Text content skeleton */}
											<div className='flex-1 flex flex-col gap-2'>
												<Skeleton className='w-1/4 rounded-lg'>
													<div className='h-3 w-1/4 rounded-lg bg-default-300'></div>
												</Skeleton>
												<Skeleton className='w-full rounded-lg'>
													<div className='h-4 w-full rounded-lg bg-default-200'></div>
												</Skeleton>
												<Skeleton className='w-3/4 rounded-lg'>
													<div className='h-4 w-3/4 rounded-lg bg-default-200'></div>
												</Skeleton>
												{/* Action buttons skeleton */}
												<div className='flex gap-8 mt-4'>
													{[...Array(3)].map((_, j) => (
														<div key={j} className='flex flex-row items-center gap-2'>
															<Skeleton className='rounded-lg'>
																<div className='w-[20px] h-[20px] bg-default-300'></div>
															</Skeleton>
															<Skeleton className='w-8 rounded-lg'>
																<div className='h-3 w-8 bg-default-200'></div>
															</Skeleton>
														</div>
													))}
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</>
					) : searchSocialInteractedPostData &&
					  searchSocialInteractedPostData.length > 0 ? (
						searchSocialInteractedPostData.map((p, i) => (
							<div
								className={`border-b border-b-[#323131] py-10 last:border-none ${
									wallet?.getAccount()?.address
										? 'cursor-pointer'
										: 'cursor-default'
								} ${i === 0 && 'pt-0'}`}
								key={i}
								onClick={() => {
									if (!wallet?.getAccount()?.address) return;
									// setPostId(p.id.toString());

									// setIsOpen(true);
								}}
							>
								<SocialCard
									data={p}
									walletAddress={walletAddress}
									pinAPost={pinAPost}
									deleteSocialPost={deleteSocialPost}
									isProfile={true}
								/>
							</div>
						))
					) : (
						<div className='flex justify-center w-full'>
							<p className=' mt-10'>
								Oops! You haven&apos;t replied to any post.
							</p>
						</div>
					)}
					{/* {socialPosts.map((p, i) => (
						<div
							className={`border-b border-b-[#323131] py-10 last:border-none ${
								i === 0 && 'pt-0'
							}`}
							key={i}
						>
							<SocialCard data={p} />
						</div>
					))} */}
				</div>
			</div>
			{/* <FeedModal isOpen={isOpen} setIsOpen={setIsOpen} postId={postId} /> */}
		</div>
	);
}

const SocialFilter = ({
	getTab,
	currentTab,
	setSearchText,
}: {
	getTab: (e: string) => void;
	currentTab: string;
	setSearchText: Dispatch<SetStateAction<string | undefined>>;
}) => {
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
				<div
					className={`w-full border-b border-b-[#F1F0EB] py-2 cursor-pointer ${
						currentTab === 'posts'
							? 'font-bold'
							: 'font-normal opacity-80'
					}`}
					onClick={() => getTab('posts')}
				>
					<p>Posts</p>
				</div>
				<div
					className={`w-full border-b border-b-[#F1F0EB] py-2 cursor-pointer mt-6 ${
						currentTab === 'replies'
							? 'font-bold'
							: 'font-normal opacity-80'
					}`}
					onClick={() => getTab('replies')}
				>
					<p>Replies</p>
				</div>
			</div>
		</div>
	);
};
