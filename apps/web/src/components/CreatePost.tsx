import {
	Modal,
	ModalContent,
	ModalBody,
	useDisclosure,
	Avatar,
	AvatarIcon,
	Textarea,
	CircularProgress,
} from '@nextui-org/react';
import {
	Dispatch,
	RefObject,
	SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { CommentSection } from '@/app/home/Comments';
import Image from 'next/image';
import { createPost, repost } from '@/apihandler/Post';
import {
	ContentType,
	NotificationEntitySubType,
	NotificationEntityType,
} from '@/types';
import { createActivity } from '@/apihandler/Activity';
import { ToastMessage } from './ToastMessage';
import { useRouter } from 'next/navigation';
import { useGlobalState } from '@/lib/GlobalContext';
import { convertIPFSUrl } from '@/lib/Util';
const CreatePost = ({
	isOpen,
	setIsOpen,
	isRepost = false,
	content,
	walletAddress,
	commentToRepost,
	isPublish = false,
	onRepostSuccess,
}: {
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	isRepost?: boolean;
	content: ContentType[];
	walletAddress?: string;
	commentToRepost?: string;
	isPublish?: boolean;
	onRepostSuccess?: () => void;
}) => {
	const { onOpen, onOpenChange } = useDisclosure();
	const [isPosted, setIsPosted] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isError, setIsError] = useState<boolean>(false);
	const postRef = useRef<any>(null);
	const [value, setValue] = useState<string>(
		commentToRepost ? commentToRepost : '',
	);
	const router = useRouter();
	const [gs] = useGlobalState();

	const avatarURL = gs?.profile?.avatarUrl;

	useEffect(() => {
		setIsPosted(false);
	}, []);
	useEffect(() => {
		if (isOpen && commentToRepost) setValue(commentToRepost);
	}, [isOpen]);

	useEffect(() => {
		if (isPosted) {
			// call the post api
			setIsError(false);
			if (isRepost) {
				repostApi();
			} else {
				createPostApi();
			}

			// reset the textarea
			setValue('');
		}

		// close the modal
		// setIsOpen(false);
	}, [isPosted]);

	const createPostApi = async () => {
		setIsLoading(true);
		if (walletAddress) {
			const data = {
				contentIDs: content,
				comment: value,
			};
			try {
				const res = await createPost(walletAddress, data);
				await createActivity(
					walletAddress,
					`You've posted a product.`,
					undefined,
					NotificationEntityType.Product,
					NotificationEntitySubType.Posted,
					content[0].productId?.toString(),
				);
				if (isPublish) {
					router.push(`/collection/${content[0].collectionId}`);
				}
			} catch (error) {
				console.log(error);
				setIsError(true);
			}
		}
		setIsLoading(false);
	};

	const repostApi = async () => {
		setIsLoading(true);

		if (walletAddress && content[0].postId) {
			let data = {};
			if (value !== null) {
				data = {
					comment: value,
				};
			} else {
				data = {};
			}
			if (content[0].postId) {
				try {
					const res = await repost(
						walletAddress,
						content[0].postId,
						data,
					);
					if (res.success) {
						await createActivity(
							walletAddress,
							`You've reposted a post`,
							undefined,
							NotificationEntityType.Post,
							NotificationEntitySubType.Reposted,
							content[0].postId?.toString(),
						);
						if (onRepostSuccess) {
							onRepostSuccess();
						}
					}
				} catch (error) {
					console.log('repost error', error);
					setIsError(true);
				}
			}
		}
		setIsLoading(false);
	};
	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={() => setIsOpen(!isOpen)}
			onClose={() => setIsPosted(false)}
			className='bg-transparent shadow-none rounded-none p-0 m-0 h-fit'
			classNames={{
				closeButton: `${
					isPosted ? 'text-[#D9D9D9]' : 'text-[#6E6E6E]'
				} bg-transparent  hover:bg-transparent  active:bg-transparent 
				${isPublish ? 'hidden' : ''}`,

				// closeButton:
				// 	'top-0 border-white border-2 text-white hover:bg-black',
				body: '',
				backdrop: '',
				wrapper: '',
			}}
			size='md'
			isDismissable={!isPublish}
		>
			<ModalContent>
				{(onClose) => (
					<ModalBody className='p-0 m-0 h-fit flex-row gap-0'>
						{isPosted ? (
							<LoadingPost
								isRepost={isRepost}
								isLoading={isLoading}
								isError={isError}
							/>
						) : (
							<NewPost
								setIsPosted={setIsPosted}
								isRepost={isRepost}
								postRef={postRef}
								setValue={setValue}
								imageURL={
									convertIPFSUrl(content[0].imageURl) ?? ''
								}
								value={value}
								avatarURL={avatarURL}
							/>
						)}
					</ModalBody>
				)}
			</ModalContent>
		</Modal>
	);
};

const NewPost = ({
	setIsPosted,
	isRepost,
	postRef,
	setValue,
	imageURL,
	value,
	avatarURL,
}: {
	setIsPosted: Dispatch<SetStateAction<boolean>>;
	isRepost: boolean;
	postRef: RefObject<any>;
	setValue: Dispatch<SetStateAction<string>>;
	imageURL: string;
	value?: string;
	avatarURL?: string;
}) => {
	return (
		<div
			className={` text-black w-full bg-[#D9D9D9] p-5 flex flex-col gap-4`}
		>
			<p className='text-[#1A1A1A] tetx-[16px] font-bold'>
				{isRepost ? 'Repost' : 'Create Post'}
			</p>
			<div className='bg-[#F1F0EB]  p-5 flex flex-row items-start rounded-md  '>
				<div className='w-[35px]'>
					<Avatar
						src={avatarURL}
						icon={<AvatarIcon />}
						size='sm'
						className='w-[35px] h-[35px]'
					/>
				</div>
				<Textarea
					size='lg'
					variant='flat'
					placeholder='Add a comment'
					classNames={{
						base: 'bg-[#F1F0EB]',
						input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#1A1A1A] placeholder:font-light placeholder:italic text-[13px] font-light',
						inputWrapper:
							'border-none bg-[#F1F0EB] shadow-none group-data-[hover=true]:bg-[#F1F0EB] group-data-[hover=true]:border-none group-data-[focus=true]:bg-[#F1F0EB] group-data-[focus=true]:border-none rounded-lg',
					}}
					onValueChange={setValue}
					value={value}
				/>
			</div>
			<div className='h-[100px] w-[100px] relative'>
				<Image
					alt='mute'
					draggable='false'
					layout='fill'
					src={convertIPFSUrl(imageURL) ?? ''}
					className={`object-cover  `}
				/>
			</div>
			<div className='flex justify-end gap-5'>
				{/* <button className='w-[150px] py-2 bg-[#D9D9D9] text-[16px] font-semibold text-black rounded-lg disabled:opacity-50'>
                Save
            </button> */}
				<button
					onClick={() => setIsPosted(true)}
					className='w-[150px] py-1 bg-[#11FF49] text-[16px] font-bold text-[#1a1a1a] rounded-md '
				>
					{isRepost ? 'Repost' : 'Post'}
				</button>
			</div>
		</div>
	);
};
const LoadingPost = ({
	isRepost,
	isLoading,
	isError,
}: {
	isRepost: boolean;
	isLoading: boolean;
	isError: boolean;
}) => {
	// const [isLoading, setIsLoading] = useState<boolean>(true);
	// useEffect(() => {
	// 	setTimeout(function () {
	// 		setIsLoading(false);
	// 	}, 1500);
	// }, []);

	return (
		<div
			className={` text-[#F1F0EB] min-h-[400px] w-full bg-[#6E6E6E] p-5 flex flex-col  items-center gap-4`}
		>
			<p className='font-bold text-[16px] text-center'>
				{isLoading
					? 'Sharing'
					: isRepost
						? 'Repost shared'
						: 'Post Shared'}
			</p>
			<div className='flex-1 flex flex-col justify-center'>
				{isLoading ? (
					<CircularProgress
						aria-label='Loading...'
						classNames={{
							svg: 'w-36 h-36 drop-shadow-md',
							indicator: 'stroke-[#11FF49]',
							track: 'stroke-[#11FF49]/10 ',
						}}
						strokeWidth={2}
						size='lg'
					/>
				) : isError ? (
					<p className='font-light text-[14px]  mt-6'>
						Something went wrong
						{/* Your {isRepost ? 'repost' : 'post'} had been shared. */}
					</p>
				) : (
					<>
						<Image
							className='cursor-pointer mx-auto'
							alt='success'
							draggable='false'
							width={100}
							height={100}
							src={'/post/checkCircle.svg'}
						/>
						<p className='font-light text-[14px]  mt-6'>
							Your {isRepost ? 'repost' : 'post'} has been shared.
						</p>
					</>
				)}
			</div>
		</div>
	);
};

export default CreatePost;
