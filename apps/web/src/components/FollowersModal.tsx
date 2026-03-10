import {
	Modal,
	ModalContent,
	ModalBody,
	useDisclosure,
	ModalHeader,
	Tabs,
	Tab,
	Avatar,
	AvatarIcon,
	Button,
} from '@nextui-org/react';
import Post from './Timeline/PostComponent';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { CommentSection } from '@/app/home/Comments';
import PostComponent from './Timeline/PostComponent';
import {
	getFollowing,
	getFollowers,
	followProfile,
	unfollowProfile,
} from '@/apihandler/Profile';
import { get } from 'http';
import { FollowersType, FollowingType } from '@/types';
import { useRouter } from 'next/navigation';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const FollowersModal = ({
	isOpen,
	setIsOpen,
	walletAddress,
	isFollowers,
	getFollowingInfo,
	isMyProfile,
}: {
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	walletAddress?: string;
	isFollowers: boolean;
	getFollowingInfo: () => void;
	isMyProfile: boolean;
}) => {
	const [followersData, setFollowersData] = useState<
		(FollowersType & { isFollowedBack: boolean })[]
	>([]);
	const [followingData, setFollowingData] = useState<
		(FollowingType & { isFollowedBack: boolean })[]
	>([]);
	const router = useRouter();
	const [selected, setSelected] = useState<string>('followers');
	useEffect(() => {
		if (walletAddress && isOpen) {
			getFollowingData(walletAddress);
		}

		setSelected(isFollowers ? 'followers' : 'following');
	}, [isOpen]);

	const getFollowingData = async (address: string) => {
		const res = await getFollowing(address);
		if (res.success) {
			const updatedFollowingData = res.following.map((following) => ({
				...following,
				isFollowedBack: true,
			}));
			setFollowingData(updatedFollowingData);
			getFollowersData(address, res.following);
		}
	};

	const getFollowersData = async (
		address: string,
		followings: FollowingType[]
	) => {
		const res = await getFollowers(address);
		if (res.success) {
			const updatedFollowersData = res.followers.map((follower) => {
				return {
					...follower,
					isFollowedBack: followings.some(
						(following) =>
							following.followedWalletAddress ===
							follower.followerWalletAddress
					),
				};
			});
			setFollowersData(updatedFollowersData);
		}
	};
	const get = () => {
		if (walletAddress) {
			getFollowingData(walletAddress);
			getFollowingInfo();
		}
	};
	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={() => setIsOpen(!isOpen)}
			className='bg-[#6E6E6E] rounded-[8px] p-0 m-0 h-fit'
			backdrop='blur'
			classNames={{
				closeButton:
					'hover:bg-black/20 active:bg-black/20 text-[#F1F0EB] text-[18px] mr-1 mt-1',
				// backdrop: 'bg-[#D9D9D9]/40',
				// base: 'overflow-y-visible bg-[#D9D9D9]',
			}}
			size='md'
		>
			<ModalContent className='p-6 '>
				<Tabs
					variant='light'
					aria-label='Tabs variants'
					fullWidth
					classNames={{
						base: 'w-1/2',
						tab: 'p-0 first:border-none border-l-[#F1F0EB] border-l-[1.5px] rounded-none h-[18px]',
						tabList:
							'w-full relative rounded-none p-0 gap-0 text-[#F1F0EB] mt-3 mb-2 -ml-2',
						cursor: 'w-full shadow-none dark:bg-transparent bg-transparent text-[#F1F0EB] ',
						tabContent:
							'text-[#F1F0EB] tracking-[1px] text-[14px] font-[300]  group-data-[selected=true]:text-[#F1F0EB] group-data-[selected=true]:font-bold capitalize',
					}}
					selectedKey={selected}
					onSelectionChange={(key) => setSelected(String(key))}
				>
					<Tab key='followers' title='Followers'>
						<ModalBody className='p-0 m-0  overflow-y-scroll scrollbar-thumb-rounded-full  scrollbar-thin   scrollbar-track-transparent scrollbar-thumb-[#9E9E9D] max-h-[60vh]'>
							{followersData.length > 0 ? (
								followersData.map((follower) => (
									<FollowersList
										key={follower.followerWalletAddress}
										isFollowedBack={follower.isFollowedBack}
										walletAddress={
											follower.followerWalletAddress
										}
										name={follower.followerUserName}
										avatar={follower.followerUserAvatarUrl}
										type={'follower'}
										userWalletAddress={walletAddress}
										getData={get}
										isMyProfile={isMyProfile}
										router={router}
									/>
								))
							) : (
								<p className='text-[#F1F0EB]'>
									No followers found
								</p>
							)}
						</ModalBody>
					</Tab>
					<Tab key='following' title='Following'>
						<ModalBody className='p-0 m-0  overflow-y-scroll scrollbar-thumb-rounded-3xl  scrollbar-thin scroll-ml-3 scrollbar-track-transparent scrollbar-thumb-neutral-600 max-h-[40vh]'>
							{followingData.length > 0 ? (
								followingData.map((following) => (
									<FollowersList
										key={following.followedWalletAddress}
										walletAddress={
											following.followedWalletAddress
										}
										isFollowedBack={
											following.isFollowedBack
										}
										name={following.followedUserName}
										avatar={following.followedUserAvatarUrl}
										type={'following'}
										userWalletAddress={walletAddress}
										getData={get}
										isMyProfile={isMyProfile}
										router={router}
									/>
								))
							) : (
								<p className='text-[#F1F0EB]'>
									No following found
								</p>
							)}
						</ModalBody>
					</Tab>
				</Tabs>
				{/* <ModalHeader>
					<p className='text-[16px] font-bold text-white'>
						Followers
					</p>
				</ModalHeader> */}
			</ModalContent>
		</Modal>
	);
};

export default FollowersModal;

const FollowersList = ({
	isFollowedBack,
	walletAddress,
	name,
	avatar,
	type,
	userWalletAddress,
	getData,
	isMyProfile,
	router,
}: {
	isFollowedBack: boolean;
	walletAddress: string;
	name: string;
	avatar: string;
	type: string;
	userWalletAddress?: string;
	getData: () => void;
	isMyProfile: boolean;
	router: AppRouterInstance;
}) => {
	const [isFollowed, setIsFollowed] = useState(isFollowedBack);
	const get = () => {};
	const follow = async () => {
		if (walletAddress && userWalletAddress) {
			if (userWalletAddress) {
				const res = await followProfile(
					walletAddress,
					userWalletAddress
				);
				if (res.success) {
					setIsFollowed(true);
					getData();
				}
			}
		}
	};
	const unfollow = async () => {
		if (walletAddress && userWalletAddress) {
			if (userWalletAddress) {
				const res = await unfollowProfile(
					walletAddress,
					userWalletAddress
				);
				if (res.success) {
					isFollowedBack = !isFollowedBack;
					setIsFollowed(false);
					getData();
				}
			}
		}
	};

	return (
		<div className='flex flex-row gap-2 items-center justify-between w-full first:mt-2 last:mb-0 mb-2 pr-2'>
			<div
				className='flex flex-row gap-3 items-center w-2/3 cursor-pointer'
				onClick={() => router.push('/profile/' + walletAddress)}
			>
				<Avatar
					className='w-[35px]'
					size={'sm'}
					icon={<AvatarIcon />}
					src={avatar ?? undefined}
				/>
				<p className='text-[#F1F0EB]  font-bold'>{name}</p>
			</div>
			<div className='w-1/3'>
				{isMyProfile &&
					(type === 'follower' ? (
						isFollowed ? (
							<Button
								size='sm'
								variant='bordered'
								onClick={() => unfollow()}
								disableAnimation
								disableRipple
								className='data-[hover=true]:!opacity-100  data-[hover=true]:border-[2.5px] data-[hover=true]:font-semibold  rounded-md bg-transparent w-full border-[0.5px] border-[#F1F0EB] text-[#F1F0EB] h-[28px] px-6 text-[13px] font-light'
							>
								Following
							</Button>
						) : (
							<Button
								size='sm'
								variant='flat'
								onClick={() => follow()}
								disableAnimation
								disableRipple
								className='data-[hover=true]:!opacity-100 data-[hover=true]:border-[2.5px] data-[hover=true]:border-[#1A1A1A]  data-[hover=true]:font-semibold rounded-md bg-[#11FF49] w-full  text-[#1A1A1A] h-[28px] px-6 text-[13px] font-medium '
							>
								Follow Back
							</Button>
						)
					) : (
						<Button
							size='sm'
							variant='bordered'
							onClick={() => unfollow()}
							disableAnimation
							disableRipple
							className='data-[hover=true]:!opacity-100  data-[hover=true]:border-[2.5px] data-[hover=true]:font-semibold  rounded-md bg-transparent w-full border-[0.5px] border-[#F1F0EB] text-[#F1F0EB] h-[28px] px-6 text-[13px] font-light'
						>
							Following
						</Button>
					))}
			</div>
		</div>
	);
};

// (
// 	<Button
// 		size='sm'
// 		variant='flat'
// 		onClick={() => follow()}
// 		className='data-[hover=true]:opacity-100 rounded-md bg-[#11FF49] w-full  text-[#1A1A1A] h-[28px] px-6 text-[13px] font-medium '
// 	>
// 		Follow
// 	</Button>
// ))}
