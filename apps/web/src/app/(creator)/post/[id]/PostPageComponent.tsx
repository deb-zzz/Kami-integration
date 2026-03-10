'use client';
import { CommentSection } from '@/app/home/Comments';
import CreatePost from '@/components/CreatePost';
import { useGlobalState } from '@/lib/GlobalContext';
import { ContentType, FeedComment, FeedType } from '@/types';
import { useDisclosure } from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useKamiWallet from '@/lib/KamiWalletHook';
import { cachedGetSinglePost, getSinglePost } from '@/apihandler/Post';
import PostComponent from '@/components/Timeline/PostComponent';

export default function PostPageComponent({
	postId,
	isModal = false,
}: {
	postId: string;
	isModal?: boolean;
}) {
	const [isRepost, setIsRepost] = useState<boolean>(false);
	const [commentRepost, setCommentRepost] = useState<string>('');
	const [content, setContent] = useState<ContentType[]>([]);
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const [feedData, setFeedData] = useState<FeedType>();
	const { isOpen, onOpen, onOpenChange } = useDisclosure();

	// const params = useParams<{ id: string }>();
	const [gs, setGs] = useGlobalState();
	const wallet = useKamiWallet();

	useEffect(() => {
		if (postId) {
			if (wallet?.getAccount()?.address) {
				getPostData(postId, true);
			} else {
				getPostData(postId, false);
			}
		}
	}, [postId, wallet?.getAccount()?.address]);

	const getPostData = async (postId: string, isLoggedIn: boolean) => {
		let data;
		if (isLoggedIn) {
			data = await getSinglePost(Number(postId), gs?.walletAddress);
		} else {
			data = await cachedGetSinglePost(Number(postId));
		}

		// const data = await getSinglePost(Number(postId), gs?.walletAddress);

		if (data.success) {
			setFeedData(data.posts[0]);
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

	const reactToPost = (isLiked: boolean, id: number) => {
		if (isLiked) {
			if (feedData) feedData.likedByMe = true;
		} else {
			if (feedData) feedData.likedByMe = false;
		}
	};
	const commentToPost = async (
		id: number,
		comment: string | null,
		isReply: boolean
	) => {
		if (gs?.walletAddress && id && comment !== null) {
			// const res = await commentPost(walletAddress, id, commentData);
			// if (res.success && gs && gs.profile) {

			if (isReply) {
				const y = feedData?.comments.find((x) => x.id === id);

				if (y) {
					y.replies.push({
						createdByUser: gs?.profile,
						comment: comment,
						replyToCommentId: id,
					} as unknown as FeedComment);
					setFeedData(feedData);
				}
			} else {
				const d = {
					id: null,
					postId: id,
					createdByAddress: gs?.walletAddress,
					comment: comment,
					likes: 0,
					createdByUser: gs?.profile,
					likedByMe: false,
					replyToCommentId: null,
				};
				const arr = feedData;
				let commentArray = arr?.comments;
				if (commentArray) {
					commentArray = [
						...commentArray,
						d as unknown as FeedComment,
					];
					if (arr) arr.comments = commentArray;
				}
				setFeedData(arr);
			}
		}
	};

	return (
		<div
			className={`${
				isModal
					? 'flex-grow basis-0 shrink-0 flex flex-row gap-0'
					: 'w-[80%] md:w-[70%]  justify-self-center py-20 m-0 h-full flex flex-row gap-0 '
			}`}
		>
			{feedData && (
				// <p>
				// 	test{' '}
				// 	{console.log(wallet?.getAccount()?.address, feedData)}
				// </p>

				<div className=' flex-grow basis-0 shrink-0 flex flex-row gap-0 '>
					<PostComponent
						isLevel2={true}
						index={0}
						openPost={(e: boolean, content: ContentType[]) =>
							openPost(e, content)
						}
						isOpen={createIsOpen}
						isRepost={feedData.repost}
						feedData={feedData}
						walletAdd={wallet?.getAccount().address ?? ''}
						reactToPost={reactToPost}
						clickFunction={() => onOpen()}
					/>
					<CommentSection
						isRepost={feedData.repost}
						data={feedData}
						walletAddress={wallet?.getAccount().address ?? ''}
						commentToPost={commentToPost}
						openPost={(
							e: boolean,
							content: ContentType[],
							comment?: string
						) => openPost(e, content, comment)}
						isOpen={createIsOpen}
					/>
				</div>
			)}
			<CreatePost
				isOpen={createIsOpen}
				setIsOpen={setCreateIsOpen}
				isRepost={true}
				content={content}
				walletAddress={gs?.walletAddress}
				commentToRepost={commentRepost}
			/>
		</div>
	);
}
