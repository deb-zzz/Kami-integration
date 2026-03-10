'use client';

// import SelectComp, { OptionType } from '@/components/Select';
import Tiptap from '@/components/Tiptap';
import {
	addTags,
	createProfile,
	editProfile,
	followProfile,
	getFollowInfo,
	getProfile,
	getSigil,
	removeTags,
	unfollowProfile,
	uploadAvatar,
	uploadBanner,
} from '@/apihandler/Profile';
import {
	Avatar,
	AvatarIcon,
	Button,
	Chip,
	Divider,
	Input,
	Tooltip,
} from '@nextui-org/react';
import Image from 'next/image';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import {
	Profile,
	TodaysStatus,
	Tag,
	ProfileEdit,
	ProfileCreate,
	NotificationEntityType,
	NotificationEntitySubType,
} from '@/types';
import useKamiWallet from '@/lib/KamiWalletHook';
import { useRouter } from 'next/navigation';
import { useGlobalState } from '@/lib/GlobalContext';
import { getTags } from '@/apihandler/Tag';
import { useUpdateEffect } from 'react-use';
import axios, { AxiosError } from 'axios';
import Link from 'next/link';
import SearchableDropdown, { OptionType } from './SearchableDropdown';
import InviteCollaborator from '@/components/Project/InviteCollaborator';
import FollowersModal from '@/components/FollowersModal';
import { ToastMessage } from '@/components/ToastMessage';
import { createActivity } from '@/apihandler/Activity';
import ShareModal from '@/components/ShareModal';
import { convertIPFSUrl } from '@/lib/Util';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

type MoodEdit = {
	todaysArt?: string | null;
	todaysBeverage?: string | null;
	todaysFilm?: string | null;
	todaysFood?: string | null;
	todaysGame?: string | null;
	todaysMusic?: string | null;
};

type SocialLink = {
	type: 'facebook' | 'x' | 'instagram' | 'linkedin' | 'telegram' | 'youtube';
	link: string;
};

export default function ProfileTab({
	walletAddress,
	bannerFile: file,
	onProfileChange,
	isedit = false,
}: {
	walletAddress?: string;
	bannerFile?: File;
	onProfileChange: (prof: Profile) => void;
	isedit?: boolean;
}) {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [isFollowers, setIsFollowers] = useState<boolean>(false);
	const [tags, setTags] = useState<Tag[]>();
	const [profile, setProfile] = useState<Profile>();
	const [skillData, setSkillData] = useState<OptionType[] | undefined>();
	const [interestData, setinterestData] = useState<OptionType[]>();
	const [isEditSkills, setIsEditSkills] = useState<boolean>(false);
	const [isEditInterest, setIsEditInterest] = useState<boolean>(false);
	const [isEditSocial, setIsEditSocial] = useState<boolean>(false);
	const [img2Upload, setImg2Upload] = useState<
		{ file: any; uploadLink?: string; destination?: string }[]
	>([]);

	const [isEdit, setIsEdit] = useState<boolean>(
		walletAddress ? false : !isedit ? false : true
	);
	const [isMoodEdit, setIsMoodEdit] = useState<boolean>(false);
	const wallet = useKamiWallet();
	const router = useRouter();
	const [gs, setGs] = useGlobalState();
	const [isFollowed, setIsFollowed] = useState<boolean>(false);
	const [following, setFollowing] = useState<number>(0);
	const [followers, setFollowers] = useState<number>(0);
	const [sigil, setSigil] = useState<{
		image: string;
		tokenId: number;
		name: string;
	}>();

	useEffect(() => {
		if (walletAddress) {
			getProfileData(walletAddress);
			getUserSigil(walletAddress);
		}

		// if (!gs?.walletAddress)
	}, [walletAddress]);

	useEffect(() => {
		setIsEdit(isedit);
	}, [isedit]);

	useEffect(() => {
		if (gs?.walletAddress && !gs.profile && profile !== undefined) {
			const myAdd = gs?.walletAddress;
			if (walletAddress === myAdd) {
				setGs({
					profile: profile,
					userId: profile?.userName,
					walletAddress: myAdd,
				});
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gs?.walletAddress, gs?.profile, profile, walletAddress]);

	useEffect(() => {
		if (walletAddress) {
			getFollowingInfo(walletAddress);
		}
	}, [wallet, walletAddress]);

	const getUserSigil = async (address: string) => {
		try {
			const res = await getSigil(address);
			if (res.sigil) {
				const sigilUrl = convertIPFSUrl(res.sigil);
				if (sigilUrl) {
					try {
						const response = await fetch(sigilUrl);
						const sigil = await response.json();
						setSigil({
							image: convertIPFSUrl(sigil.image) ?? '',
							tokenId: sigil.tokenId,
							name: sigil.name,
						});
					} catch (error) {
						console.error('Error fetching sigil JSON:', error);
					}
				}
			}
		} catch (error) {
			console.error('Error fetching sigil:', error);
		}
	};

	const follow = async () => {
		if (walletAddress && wallet) {
			const account = wallet.getAccount();
			if (account?.address) {
				const res = await followProfile(walletAddress, account.address);
				if (res.success) {
					//setIsFollowed(true);
					getFollowingInfo(walletAddress);
				}
			}
		}
	};
	const unfollow = async () => {
		if (walletAddress && wallet) {
			const account = wallet.getAccount();
			if (account?.address) {
				const res = await unfollowProfile(
					walletAddress,
					account.address
				);
				if (res.success) {
					//setIsFollowed(true);
					getFollowingInfo(walletAddress);
				}
			}
		}
	};

	const getFollowingInfo = async (address: string) => {
		const res = await getFollowInfo(address);
		setFollowing(res.following.length);
		setFollowers(res.followers.length);
		if (res.followers.length > 0 && wallet) {
			const account = wallet.getAccount();
			if (account?.address) {
				const y = res.followers?.includes(account.address);
				setIsFollowed(y);
			}
		}
	};

	const getProfileData = async (address: string) => {
		try {
			const data = await getProfile(address);
			const { tags: tgs } = await getTags();
			setTags(tgs);
			if (data.success && data.profile) {
				setProfile(data.profile);
				if (data.profile) {
					if (data.profile.tags) filterTag(data.profile.tags);
				}
			} else {
				if (!data.success) {
					filterTag([]);
					ToastMessage(
						'error',
						'Error fetchig profile data. Please try again later.'
					);
				}
			}
		} catch (error) {
			console.error('Error fetching profile data:', error);
			ToastMessage(
				'error',
				'Error fetchig profile data. Please try again later.'
			);
		}
	};
	const callCreateActivity = async (from: string) => {
		await createActivity(
			wallet?.getAccount()?.address!,
			`You've updated your ${from}.`,
			undefined,
			NotificationEntityType.User,
			NotificationEntitySubType.Updated,
			wallet?.getAccount()?.address!
		);
	};
	const saveSocial = async () => {
		try {
			const data: ProfileEdit = {
				xUrl: profile?.xUrl,
				linkedInUrl: profile?.linkedInUrl,
				instagramUrl: profile?.instagramUrl,
				telegramUrl: profile?.telegramUrl,
				youtubeUrl: profile?.youtubeUrl,
				fbUrl: profile?.fbUrl,
			};
			const { success, profile: resProfile } = await editProfile(
				walletAddress ?? wallet!.getAccount()!.address!,
				data
			);
			if (success && resProfile) {
				callCreateActivity('social');
				setGs({ profile: resProfile });
				setProfile(resProfile);
				onProfileChange(resProfile);
				ToastMessage('success', 'Profile Updated');
			}
		} catch (error) {
			console.error('Error saving social links:', error);
			ToastMessage('error', 'Profile Update Failed');
		}
	};

	useUpdateEffect(() => {
		const w = wallet?.getAccount();
		if (w?.address) {
			if (!isEditSkills && skillData) {
				addTags(w.address, profileTagAdapter(skillData, 'Skill'));
				ToastMessage('success', 'Profile Updated');
				callCreateActivity('skills');
			}

			const proftag = gs?.profile?.tags.filter((f) => f.type === 'Skill');
			const isSimilar =
				JSON.stringify(proftag?.map((t) => t.tag)) ===
				JSON.stringify(skillData?.map((m) => m.label));
			if (
				proftag &&
				skillData &&
				(proftag?.length ?? 0) > (skillData?.length ?? 0)
			) {
				const ntt = proftag.filter(
					(f) => !skillData.map((m) => m.label).includes(f.tag)
				);
				// console.log(isSimilar, ntt);
				if (!isSimilar)
					removeTags(
						w.address,
						ntt.map((m) => m.id).filter((d) => d !== undefined)
					);
			}
		}
	}, [isEditSkills]);

	useUpdateEffect(() => {
		const type = 'Interest';
		const w = wallet?.getAccount();
		if (w?.address) {
			if (!isEditInterest && interestData) {
				addTags(w.address, profileTagAdapter(interestData, type));
				ToastMessage('success', 'Profile Updated');
				callCreateActivity('interest');
			}

			const proftag = gs?.profile?.tags.filter((f) => f.type === type);
			const isSimilar =
				JSON.stringify(proftag?.map((t) => t.tag)) ===
				JSON.stringify(skillData?.map((m) => m.label));
			if (
				proftag &&
				interestData &&
				(proftag?.length ?? 0) > (interestData?.length ?? 0)
			) {
				const ntt = proftag.filter(
					(f) => !interestData.map((m) => m.label).includes(f.tag)
				);
				if (!isSimilar)
					removeTags(
						w.address,
						ntt.map((m) => m.id).filter((d) => d !== undefined)
					);
			}
		}
	}, [isEditInterest]);

	const filterTag = (tags: Tag[]) => {
		const skills: OptionType[] = [];
		const interests: OptionType[] = [];
		if (tags && tags.length > 0) {
			for (let i = 0; i < tags.length; i++) {
				if (tags[i].type === 'Skill') {
					skills.push({
						value: tags[i].id?.toString() ?? 'None',
						label: tags[i].tag,
					});
				} else {
					interests.push({
						value: tags[i].id?.toString() ?? 'None',
						label: tags[i].tag,
					});
				}
			}
			setSkillData(skills);
			setinterestData(interests);
		}
	};

	const profileTagAdapter = (
		dt: OptionType[],
		type: 'Interest' | 'Skill'
	) => {
		return dt.map((v) => ({ tag: v.label, type }));
	};

	const OptionMaker = (dt: Tag[], type: 'Interest' | 'Skill') => {
		return dt
			.filter((f) => f.type.toUpperCase() === type.toUpperCase())
			.map((v) => ({ value: v.id!.toString(), label: v.tag }));
	};

	const TodaysMood = ({
		data,
		setEdit,
		walletAddress,
	}: {
		data?: TodaysStatus;
		setEdit: (isEdit: boolean) => void;
		walletAddress?: string;
	}) => {
		return (
			<div data-tour='today'>
				<div className='flex justify-between mb-4'>
					<p className='text-[20px] text-[#F1F0EB] font-bold  '>
						Today
					</p>
					{wallet?.getAccount()?.address === walletAddress && (
						<Image
							src={'/editWhite.svg'}
							alt={'edit'}
							width={18}
							height={18}
							className='mb-[2px] cursor-pointer'
							onClick={() => setEdit(true)}
						/>
						// <span
						// 	className='text-[12px] text-[#F1F0EB] flex flex-row gap-2 items-center font-bold  rounded-md px-3 py-1 border cursor-pointer'
						// 	onClick={() => setEdit(true)}
						// >
						// 	<Image
						// 		src={'/editWhite.svg'}
						// 		alt={'edit'}
						// 		width={15}
						// 		height={15}
						// 		className='mb-[2px]'
						// 	/>
						// 	Edit
						// </span>
					)}
				</div>
				<div className='flex flex-col gap-3'>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/film.svg'}
							alt={'film'}
							width={17}
							height={17}
						/>
						<p className='text-[13px] text-[#979797]'>
							{data?.todaysFilm ? (
								data.todaysFilm
							) : (
								<span className='italic text-[#6E6E6E]'>
									Movie that blew my mind
								</span>
							)}
						</p>
					</div>

					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/music.svg'}
							alt={'music'}
							width={17}
							height={17}
						/>
						<p className='text-[13px] text-[#979797]'>
							{data?.todaysMusic ? (
								data?.todaysMusic
							) : (
								<span className='italic text-[#6E6E6E]'>
									Song that’s on repeat
								</span>
							)}
						</p>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/game.svg'}
							alt={'game'}
							width={17}
							height={17}
						/>
						<p className='text-[13px] text-[#979797]'>
							{data?.todaysGame ? (
								data?.todaysGame
							) : (
								<span className='italic text-[#6E6E6E]'>
									Game I cant stop playing
								</span>
							)}
						</p>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/cutlery.svg'}
							alt={'cutlery'}
							width={17}
							height={17}
						/>
						<p className='text-[13px] text-[#979797]'>
							{data?.todaysFood ? (
								data?.todaysFood
							) : (
								<span className='italic text-[#6E6E6E]'>
									Food I am craving
								</span>
							)}
						</p>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/cup.svg'}
							alt={'cup'}
							width={17}
							height={17}
						/>
						<p className='text-[13px] text-[#979797]'>
							{data?.todaysBeverage ? (
								data?.todaysBeverage
							) : (
								<span className='italic text-[#6E6E6E]'>
									Drink I can’t stop sipping
								</span>
							)}
						</p>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/paint.svg'}
							alt={'paint'}
							width={17}
							height={17}
						/>
						<p className='text-[13px] text-[#979797]'>
							{data?.todaysArt ? (
								data?.todaysArt
							) : (
								<span className='italic text-[#6E6E6E]'>
									Colour of the Day
								</span>
							)}
						</p>
					</div>
				</div>
			</div>
		);
	};
	const EditTodaysMood = ({
		data,
		setEdit,
	}: {
		data?: TodaysStatus;
		setEdit: (isEdit: boolean) => void;
	}) => {
		const [moodData, setMooddata] = useState<MoodEdit>({
			todaysGame: profile?.todaysGame ?? undefined,
			todaysArt: profile?.todaysArt ?? undefined,
			todaysFilm: profile?.todaysFilm ?? undefined,
			todaysBeverage: profile?.todaysBeverage ?? undefined,
			todaysFood: profile?.todaysFood ?? undefined,
			todaysMusic: profile?.todaysMusic ?? undefined,
		});

		const inputDesign = {
			base: 'bg-transparent',
			inputWrapper:
				'border-[0.5px] border-[#979797] mb-2  group-data-[focus=true]:border-[#979797] rounded-[6px]',
			input: ' placeholder:italic placeholder:text-[#6E6E6E] placeholder:text-[13px]',
		};
		return (
			<div data-tour='today'>
				<div className='flex justify-between mb-4'>
					<p className='text-[20px] text-[#F1F0EB] font-bold  '>
						Today
					</p>
					<Image
						src={'/save.svg'}
						alt={'save'}
						width={18}
						height={18}
						className='mb-[2px] cursor-pointer'
						onClick={async () => {
							try {
								// Filter out empty strings and trim values, send undefined for empty
								const filteredMoodData: MoodEdit =
									Object.entries(moodData).reduce(
										(acc, [key, value]) => {
											const trimmedValue = value?.trim();
											acc[key as keyof MoodEdit] =
												trimmedValue || null;
											return acc;
										},
										{} as MoodEdit
									);
								const { success, profile: resProfile } =
									await editProfile(
										walletAddress ??
											wallet!.getAccount()!.address!,
										filteredMoodData as ProfileEdit
									);
								if (success && resProfile) {
									callCreateActivity(`today's mood`);
									setGs({ profile: resProfile });
									setProfile(resProfile);
									onProfileChange(resProfile);
									setEdit(false);
									ToastMessage('success', 'Profile Updated');
								}
							} catch (error) {
								console.error('Error updating profile:', error);
								ToastMessage('error', 'Profile Update Failed');
							}
						}}
					/>
					{/* <span
						className='text-[12px] text-[#F1F0EB] font-bold  rounded-md px-3 py-1 border cursor-pointer'
						onClick={async () => {
							const { success, profile } = await editProfile(
								walletAddress!,
								{ ...moodData }
							);
							if (success) {
								// console.log(profile);
								setGs({ profile });
							}
							setEdit(false);
						}}
					>
						Save
					</span> */}
				</div>
				<div className='flex flex-col gap-3'>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/film.svg'}
							alt={'film'}
							width={17}
							height={17}
						/>
						<Input
							defaultValue={data?.todaysFilm}
							variant='bordered'
							name='todaysFilm'
							onValueChange={(val) =>
								setMooddata((prev: any) => ({
									...prev,
									todaysFilm: val,
								}))
							}
							classNames={inputDesign}
							placeholder='Movie that blew my mind'
						/>
					</div>
					{/* onChange={() => setData({ data })}  */}

					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/music.svg'}
							alt={'music'}
							width={17}
							height={17}
						/>
						<Input
							defaultValue={data?.todaysMusic}
							variant='bordered'
							onValueChange={(val) =>
								setMooddata((prev: MoodEdit) => ({
									...prev,
									todaysMusic: val,
								}))
							}
							classNames={inputDesign}
							placeholder='Song that’s on repeat'
						/>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/game.svg'}
							alt={'game'}
							width={17}
							height={17}
						/>
						<Input
							defaultValue={data?.todaysGame}
							variant='bordered'
							onValueChange={(val) =>
								setMooddata((prev: MoodEdit) => ({
									...prev,
									todaysGame: val,
								}))
							}
							classNames={inputDesign}
							placeholder='Game I cant stop playing'
						/>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/cutlery.svg'}
							alt={'cutlery'}
							width={17}
							height={17}
						/>
						<Input
							defaultValue={data?.todaysFood}
							variant='bordered'
							onValueChange={(val) =>
								setMooddata((prev: MoodEdit) => ({
									...prev,
									todaysFood: val,
								}))
							}
							classNames={inputDesign}
							placeholder='Food I am craving'
						/>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/cup.svg'}
							alt={'cup'}
							width={17}
							height={17}
						/>
						<Input
							defaultValue={data?.todaysBeverage}
							variant='bordered'
							onValueChange={(val) =>
								setMooddata((prev: MoodEdit) => ({
									...prev,
									todaysBeverage: val,
								}))
							}
							classNames={inputDesign}
							placeholder='Drink I can’t stop sipping'
						/>
					</div>
					<div className='flex flex-row gap-3'>
						<Image
							src={'/profile/paint.svg'}
							alt={'paint'}
							width={17}
							height={17}
						/>
						<Input
							defaultValue={data?.todaysArt}
							variant='bordered'
							onValueChange={(val) =>
								setMooddata((prev: MoodEdit) => ({
									...prev,
									todaysArt: val,
								}))
							}
							classNames={inputDesign}
							placeholder='Colour of the Day'
						/>
					</div>
				</div>
			</div>
		);
	};

	let hiddenFileInput = useRef<HTMLInputElement>(null);

	const handleImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const img = e.target.files;
		if (!img) return;
		const file = img[0];

		// Validate file type
		const validExtensions = /\.(jpg|jpeg|png|gif)$/i;
		if (!validExtensions.test(file.name)) {
			ToastMessage('warning', 'Please use jpg, jpeg, png or gif only');
			// Clear the input
			e.target.value = '';
			return;
		}

		if (file && profile) {
			setImg2Upload([{ file }]);
		}
	};

	//if (!wallet?.getAccount() && !gs?.profileId) return <Section404 />;
	const [isCopied, setIsCopied] = useState(false);
	const [isOpenShare, setIsOpenShare] = useState(false);
	const copyToClipboard = async () => {
		if (navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(
					'https://app.kamiunlimited.com/profile/' + walletAddress
				);
				setIsCopied(true);
				setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
			} catch (err) {
				console.error('Failed to copy text: ', err);
			}
		}
	};

	return (
		<>
			<div className='flex flex-row py-5 w-full gap-20'>
				<div className='w-2/3'>
					<div className='flex flex-row items-start lg:items-end'>
						<div className='w-1/2 lg:w-[70%] 2xl:w-[80%] flex flex-col gap-4 items-center lg:flex-row'>
							<div className='relative self-start'>
								{
									<>
										{img2Upload.length > 0 ||
										profile?.avatarUrl ? (
											<Image
												src={
													img2Upload.length > 0
														? URL.createObjectURL(
																img2Upload[0]
																	.file
														  )
														: profile?.avatarUrl ??
														  ''
												}
												alt={'avatar'}
												width={100}
												height={100}
												data-tour='avatar'
												className='rounded-full aspect-square object-cover'
											/>
										) : (
											<Avatar
												// onClick={() =>
												// 	isEdit &&
												// 	hiddenFileInput &&
												// 	hiddenFileInput.current &&
												// 	hiddenFileInput.current.click()
												// }
												icon={<AvatarIcon />}
												size='lg'
												data-tour='avatar'
												classNames={{
													base: 'w-[100px] h-[100px] cursor-pointer hover:opacity-50',
												}}
											/>
										)}

										<input
											ref={hiddenFileInput}
											className=''
											hidden
											type='file'
											accept='image/*'
											onChange={handleImageUpload}
										/>
									</>
								}
								{isEdit && (
									<div
										className='overlay rounded-full cursor-pointer content-center'
										onClick={() =>
											isEdit &&
											hiddenFileInput &&
											hiddenFileInput.current &&
											hiddenFileInput.current.click()
										}
									>
										<Image
											src={'/editWhite.svg'}
											alt={'heart'}
											width={25}
											height={25}
											className='justify-self-center mb-2 '
										/>
										<p className=' text-[9px] '>
											800 x 800 pixels
										</p>
									</div>
								)}

								{wallet?.getAccount()?.address &&
									wallet?.getAccount()?.address !==
										walletAddress && (
										<div
											className='cursor-pointer w-fit absolute bottom-0 right-0 '
											onClick={() => {
												if (!isEdit)
													setIsFollowed(!isFollowed);
											}}
										>
											<Image
												src={`/profile/info/${
													isFollowed
														? 'followGreen'
														: 'follow'
												}.svg`}
												alt={'plus'}
												width={30}
												height={30}
												onClick={() =>
													isFollowed
														? unfollow()
														: follow()
												}
											/>
										</div>
									)}
							</div>
							<div className='mb-2'>
								{/* {isEdit ? (
								<div className='flex gap-3'>
									<div>
										First name
										<span className='text-red-500'>*</span>
										<Input
											defaultValue={profile?.firstName}
											variant='bordered'
											onValueChange={(v) =>
												setProfile((prev: any) => ({
													...prev,
													firstName: v,
												}))
											}
											classNames={{
												base: 'bg-transparent',
												inputWrapper:
													'border-[0.5px] border-[#979797] mb-2  group-data-[focus=true]:border-[#979797] rounded-[6px]',
											}}
										/>
									</div>
									<div>
										Last name{' '}
										<span className='text-red-500'>*</span>
										<Input
											defaultValue={profile?.lastName}
											variant='bordered'
											onValueChange={(v) =>
												setProfile((prev: any) => ({
													...prev,
													lastName: v,
												}))
											}
											classNames={{
												base: 'bg-transparent',
												inputWrapper:
													'border-[0.5px] border-[#979797] mb-2  group-data-[focus=true]:border-[#979797] rounded-[6px]',
											}}
										/>
									</div>
								</div>
							) : (
								<p className='text-[32px] font-semibold line-clamp-1'>
									<abbr
										className='border-0 decoration-0 decoration-transparent'
										title={`${profile?.firstName} ${profile?.lastName}`}
									>
										{profile?.firstName} {profile?.lastName}
									</abbr>
								</p>
							)} */}
								<div className='flex flex-row gap-4 items-center'>
									<p className='text-[32px] font-semibold '>
										{profile?.userName}
									</p>

									<Tooltip
										content='Copied'
										isOpen={isCopied}
										size='sm'
										className='bg-[#323131] text-[#F1F0EB] '
									>
										<Image
											src={'/copy.svg'}
											alt={'cup'}
											width={17}
											height={17}
											className='cursor-pointer mt-1'
											onClick={copyToClipboard}
										/>
									</Tooltip>
								</div>

								<div className='flex flex-row gap-4 items-center h-[20px]'>
									<span
										className='text-[18px] font-semibold cursor-pointer'
										onClick={() => {
											setIsOpen(true);
											setIsFollowers(false);
										}}
									>
										{following}
										<span className='text-[13px] font-light text-[#FFFFFF99] ml-2'>
											Following
										</span>
									</span>
									<Divider
										orientation='vertical'
										className='bg-white'
									/>
									<span
										className='text-[18px] font-semibold cursor-pointer'
										onClick={() => {
											setIsOpen(true);
											setIsFollowers(true);
										}}
									>
										{/* {profile?.counts?.follows ?? 0} */}{' '}
										{followers}
										<span className='text-[13px] font-light text-[#FFFFFF99] ml-2'>
											Followers
										</span>
									</span>
								</div>
							</div>
						</div>
						<div className='w-1/2 lg:w-[30%] 2xl:w-[20%] '>
							<div className='flex-row flex justify-end gap-3 mb-3'>
								<Tooltip
									className='bg-black cursor-pointer text-[10px]'
									content='Coming Soon..'
								>
									<Image
										src={'/profile/info/mail.svg'}
										alt={'mail'}
										width={25}
										height={25}
										className='cursor-pointer'
									/>
								</Tooltip>
								<Tooltip
									className='bg-black cursor-pointer text-[10px]'
									content='Coming Soon..'
								>
									<Image
										src={'/profile/info/gift.svg'}
										alt={'gift'}
										width={25}
										height={25}
										className='cursor-pointer'
									/>
								</Tooltip>
								<Tooltip
									className='bg-black cursor-pointer text-[10px] '
									content='Coming Soon..'
								>
									<Image
										src={'/profile/info/avatarCoin.svg'}
										alt={'coin'}
										width={25}
										height={25}
										className='cursor-pointer'
									/>
								</Tooltip>

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
							</div>
							<div>
								{/* <Button
							size='sm'
							variant='flat'
							// onClick={() => setIsEdit(!isEdit)}
							className='bg-[#323131] w-full text-[#F1F0EB] px-10 text-[13px] font-light m-1'
							startContent={
								<Image
									src={'/profile/info/heart.svg'}
									alt={'heart'}
									width={20}
									height={20}
								/>
							}
						>
							Invite to Collaborate
						</Button> */}
								{isEdit ? (
									<Button
										size='sm'
										variant='flat'
										data-tour='edit-profile'
										className='bg-[#323131] w-full text-[#F1F0EB] px-10 text-[13px] font-light m-1'
										onClick={async () => {
											let img: string | undefined =
												undefined;
											// edit profile
											if (img2Upload.length > 0) {
												if (
													gs &&
													gs.profile &&
													gs.profile.userName
												) {
													const { path, url } =
														await uploadAvatar(
															img2Upload[0].file
																.name,
															img2Upload[0].file
																.type,
															gs?.profile
																?.userName ?? ''
														);

													const item =
														img2Upload.length > 0
															? img2Upload[0]
															: undefined;
													var formData =
														new FormData();

													if (item) {
														formData.append(
															'body',
															img2Upload[0].file
														);
														const { status } =
															await axios.put(
																url,
																img2Upload[0]
																	.file,
																{
																	headers: {
																		'Content-Type':
																			img2Upload[0]
																				.file
																				.type,
																	},
																}
															);

														if (
															status >= 200 &&
															status < 300
														)
															img = path;
													}
												}
											}
											let bannerUrl = undefined;
											if (file && profile) {
												try {
													const { path, url } =
														await uploadBanner(
															file.name,
															file.type,
															profile.userName
														);

													var formData =
														new FormData();

													if (file) {
														formData.append(
															'body',
															file
														);
														const { status } =
															await axios.put(
																url,
																file,
																{
																	headers: {
																		'Content-Type':
																			file.type,
																	},
																}
															);
														// console.log(JSON.stringify(status, null, 2));
														if (
															status >= 200 &&
															status < 300
														)
															bannerUrl = path;
													}
												} catch (e) {
													console.log(e);
													alert(
														'Error in uploading media file ' +
															JSON.stringify(
																e,
																null,
																2
															)
													);
													return;
												}
											}

											const data: ProfileEdit = {
												firstName: profile?.firstName,
												lastName: profile?.lastName,
												tagLine:
													profile?.tagLine ===
													'<p></p>'
														? null
														: profile?.tagLine,
												description:
													profile?.description ===
													'<p></p>'
														? null
														: profile?.description,
												avatarUrl: img,
												bannerUrl,
												xUrl: profile?.xUrl,
												linkedInUrl:
													profile?.linkedInUrl,
												instagramUrl:
													profile?.instagramUrl,
												telegramUrl:
													profile?.telegramUrl,
												youtubeUrl: profile?.youtubeUrl,
												fbUrl: profile?.fbUrl,
											};
											const {
												success,
												profile: resProfile,
											} = await editProfile(
												walletAddress ??
													wallet?.getAccount()
														?.address ??
													gs?.walletAddress ??
													'',
												data
											);
											if (success && resProfile) {
												callCreateActivity(`profile`);
												setGs({ profile: resProfile });
												setProfile(resProfile);
												onProfileChange(resProfile);
												ToastMessage(
													'success',
													'Profile Updated'
												);
											} else {
												ToastMessage(
													'error',
													'Profile Update Failed'
												);
											}
											setIsEdit(!isEdit);
										}}
										startContent={
											<Image
												src={'/profile/save.svg'}
												alt={'heart'}
												width={20}
												height={20}
											/>
										}
									>
										Save Changes
									</Button>
								) : wallet?.getAccount()?.address ===
								  walletAddress ? (
									<Button
										size='sm'
										variant='flat'
										data-tour='edit-profile'
										className='bg-[#323131] w-full text-[#F1F0EB] px-10 text-[13px] font-light m-1'
										onClick={() => setIsEdit(!isEdit)}
										startContent={
											<Image
												src={'/profile/user-edit.svg'}
												alt={'heart'}
												width={20}
												height={20}
											/>
										}
									>
										Edit Profile
									</Button>
								) : (
									gs?.walletAddress && (
										<InviteCollaborator
											projectId={0}
											walletAddress={walletAddress ?? ''}
											myWalletAddress={
												wallet?.getAccount()?.address
											}
											projectName={''}
											avatar={profile?.avatarUrl ?? ''}
											username={profile?.userName ?? ''}
											description={
												profile?.description ?? ''
											}
											inviteMessageSrc={''}
											mode={'profile'}
										/>
									)
									// <Button
									// 	size='sm'
									// 	variant='flat'
									// 	// onClick={() => setIsEdit(!isEdit)}
									// 	className='bg-[#323131] w-full text-[#F1F0EB] px-10 text-[13px] font-light m-1'
									// 	startContent={
									// 		<Image
									// 			src={'/profile/info/heart.svg'}
									// 			alt={'heart'}
									// 			width={20}
									// 			height={20}
									// 		/>
									// 	}
									// >
									// 	Invite to Collaborate
									// </Button>
								)}
							</div>
						</div>
					</div>
					<div className='mt-10'>
						{isEdit ? (
							<span>
								<div className='pb-2'>Tagline</div>
								<Tiptap
									isColor
									content={profile?.tagLine}
									onChange={(newContent: string) =>
										setProfile((prev: any) => ({
											...prev,
											tagLine: newContent,
										}))
									}
									autoFocus={false}
								/>
							</span>
						) : (
							<div
								className='tagLine wordWrap'
								dangerouslySetInnerHTML={{
									__html: profile?.tagLine
										? profile.tagLine
										: '',
								}}
							/>
						)}
					</div>

					<div className='mt-8'>
						{isEdit ? (
							<span>
								<div className='pb-2'>Bio</div>
								<Tiptap
									content={profile?.description}
									onChange={(newContent: string) =>
										setProfile((prev: any) => ({
											...prev,
											description: newContent,
										}))
									}
									autoFocus={false}
								/>
							</span>
						) : profile?.description &&
						  profile.description !== '<p></p>' ? (
							<div
								dangerouslySetInnerHTML={{
									__html: profile?.description
										? profile.description
										: '',
								}}
								className='text-[13px] font-light [&_p]:mb-4  wordWrap'
							/>
						) : wallet?.getAccount()?.address === walletAddress ? (
							<p className='italic text-[#6E6E6E]'>
								What&apos;s your story?
							</p>
						) : (
							<p className='italic text-[#6E6E6E]'>
								Seems like this user is shy. Let&apos;s check in
								again later.
							</p>
						)}
					</div>
				</div>
				<div className='w-1/3'>
					{gs?.profile && isMoodEdit ? (
						<EditTodaysMood
							data={profile}
							setEdit={setIsMoodEdit}
							data-tour='today'
						/>
					) : (
						<TodaysMood
							data={profile}
							setEdit={setIsMoodEdit}
							walletAddress={walletAddress}
							data-tour='today'
						/>
					)}
					<Divider className='bg-[#323131] mb-5 mt-7' />
					<Skills
						data={skillData}
						data-tour='skills'
						tgs={OptionMaker(tags ?? [], 'Skill')}
						setData={setSkillData}
						address={walletAddress ?? ''}
						walletAddress={wallet?.getAccount()?.address ?? ''}
						setIsEditSkills={setIsEditSkills}
						isEditSkills={isEditSkills}
					/>
					<Divider className='bg-[#323131] mb-5 mt-6' />
					<Interests
						data={interestData}
						data-tour='interest'
						tgs={OptionMaker(tags ?? [], 'Interest')}
						setData={setinterestData}
						address={walletAddress ?? ''}
						walletAddress={wallet?.getAccount()?.address ?? ''}
						setIsEditInterest={setIsEditInterest}
						isEditInterest={isEditInterest}
					/>
					{/* Sigil Badge  */}

					{sigil && (
						<>
							<Divider className='bg-[#323131] mb-5 mt-8' />
							<Badge sigil={sigil} router={router} />
						</>
					)}
					<Divider className='bg-[#323131] mb-5 mt-6' />
					<Social
						data-tour='social'
						isEditSocial={isEditSocial}
						setIsEditSocial={setIsEditSocial}
						data={profile}
						setData={setProfile}
						address={walletAddress ?? ''}
						walletAddress={wallet?.getAccount()?.address ?? ''}
						saveSocial={saveSocial}
					/>
				</div>
				<FollowersModal
					isOpen={isOpen}
					setIsOpen={setIsOpen}
					walletAddress={walletAddress}
					isFollowers={isFollowers}
					getFollowingInfo={() =>
						walletAddress && getFollowingInfo(walletAddress)
					}
					isMyProfile={
						wallet?.getAccount()?.address === walletAddress
					}
				/>
			</div>
			<ShareModal
				isOpenShare={isOpenShare}
				setIsOpenShare={setIsOpenShare}
				link={`https://app.kamiunlimited.com/profile/` + walletAddress}
			/>
		</>
	);
}

const Skills = ({
	isEditSkills = false,
	data,
	tgs,
	setData,
	address,
	walletAddress,
	setIsEditSkills,
}: {
	isEditSkills: boolean;
	data?: OptionType[];
	tgs: OptionType[];
	setData: (ot: OptionType[]) => void;
	address: string;
	walletAddress: string;
	setIsEditSkills: Dispatch<SetStateAction<boolean>>;
}) => {
	return (
		<div data-tour='skills'>
			<div className='flex flex-row justify-between items-center mb-4'>
				<p className='text-[20px] text-[#F1F0EB] font-bold '>Skills</p>
				{address === walletAddress &&
					(!isEditSkills ? (
						<Image
							src={'/editWhite.svg'}
							alt={'edit'}
							width={18}
							height={18}
							className='mb-[2px] cursor-pointer'
							onClick={() => setIsEditSkills(true)}
						/>
					) : (
						<Image
							src={'/save.svg'}
							alt={'save'}
							width={18}
							height={18}
							className='mb-[2px]  cursor-pointer'
							onClick={() => {
								setIsEditSkills(false);
							}}
						/>
					))}
			</div>

			{isEditSkills ? (
				<SearchableDropdown
					defaultValue={data}
					name='skils'
					type='Skill'
					setValue={(selected: OptionType[]) => setData(selected)}
				/>
			) : (
				<div className='flex flex-row flex-wrap gap-2 '>
					{data && data.length > 0 ? (
						data?.map((skill, index) => (
							<Chip
								key={index}
								size='md'
								variant='bordered'
								className='capitalize'
								classNames={{
									base: 'border-small border-[#979797] ',
									content:
										'text-[13px] text-[#B1B1B1] font-[300] text-center  min-w-[100px]',
								}}
							>
								{skill.label.toLowerCase()}
							</Chip>
						))
					) : address === walletAddress ? (
						<p className=' italic text-[#6E6E6E]  '>
							What are you good at?
						</p>
					) : (
						<></>
					)}
				</div>
			)}
		</div>
	);
};

const Interests = ({
	isEditInterest = false,
	data,
	tgs,
	setData,
	address,
	walletAddress,
	setIsEditInterest,
}: {
	isEditInterest: boolean;
	data?: OptionType[];
	tgs: OptionType[];
	setData: (ot: OptionType[]) => void;
	address: string;
	walletAddress: string;
	setIsEditInterest: Dispatch<SetStateAction<boolean>>;
}) => {
	return (
		<div data-tour='interest'>
			<div className='flex flex-row justify-between items-center mb-4'>
				<p className='text-[20px] text-[#F1F0EB] font-bold '>
					Interests
				</p>
				{address === walletAddress &&
					(!isEditInterest ? (
						<Image
							src={'/editWhite.svg'}
							alt={'edit'}
							width={18}
							height={18}
							className='mb-[2px]  cursor-pointer'
							onClick={() => setIsEditInterest(true)}
						/>
					) : (
						<Image
							src={'/save.svg'}
							alt={'save'}
							width={18}
							height={18}
							className='mb-[2px]  cursor-pointer'
							onClick={() => {
								setIsEditInterest(false);
							}}
						/>
					))}
			</div>
			{isEditInterest ? (
				<SearchableDropdown
					type='Interest'
					defaultValue={data}
					name='interests'
					setValue={(selected: OptionType[]) => setData(selected)}
				/>
			) : (
				// <SelectComp defaultValue={data} isMulti={true} name='interests' options={tgs} setValue={(v: OptionType[]) => setData(v)} />
				<div className='flex flex-row flex-wrap gap-2 '>
					{data && data.length > 0 ? (
						data?.map((interest, index) => (
							<Chip
								key={index}
								size='md'
								variant='bordered'
								className='capitalize'
								classNames={{
									base: 'border-small border-[#979797] ',
									content:
										'text-[13px] text-[#B1B1B1] font-[300] text-center  min-w-[100px]',
								}}
							>
								{interest.label.toLowerCase()}
							</Chip>
						))
					) : address === walletAddress ? (
						<p className='italic text-[#6E6E6E]'>
							What are you passionate about?
						</p>
					) : (
						<></>
					)}
				</div>
			)}
		</div>
	);
};

const Badge = ({
	sigil,
	router,
}: {
	sigil: { image: string; name: string; tokenId: number };
	router: AppRouterInstance;
}) => {
	return (
		<div className='flex flex-col gap-5'>
			<p className='text-[20px] text-[#F1F0EB] font-bold '>Accolades</p>
			<div className='flex flex-row flex-wrap gap-4 '>
				<SigilBadge sigil={sigil} router={router} />
			</div>
		</div>
	);
};

const SigilBadge = ({
	sigil,
	router,
}: {
	sigil: { image: string; name: string; tokenId: number };
	router: AppRouterInstance;
}) => {
	return (
		<div
			className='flex flex-row  items-center gap-2'
			onClick={() => router.push(`/sigil/${sigil.tokenId}`)}
		>
			<div className='text-center w-fit cursor-pointer'>
				<Image
					src={sigil.image}
					alt={sigil.name}
					width={90}
					height={90}
				/>
				<p className='text-[12px] text-[#A79755] font-bold '>
					{sigil.name}
				</p>
			</div>
		</div>
	);
};

const Social = ({
	isEditSocial = false,
	setIsEditSocial,
	data,
	setData,
	address,
	walletAddress,
	saveSocial,
}: {
	isEditSocial: boolean;
	setIsEditSocial: Dispatch<SetStateAction<boolean>>;
	data?: Profile;
	setData: Dispatch<SetStateAction<Profile | undefined>>;
	address: string;
	walletAddress: string;
	saveSocial: () => void;
}) => {
	const youtubeRegex =
		/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:@[\w\-]+|watch\?v=[\w\-]+|embed\/[\w\-]+|v\/[\w\-]+|[\w\-]+)(?:.*)?$/;
	const telegramRegex =
		/^https?:\/\/(?:www\.)?(?:telegram\.me|t\.me)\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=-]+$/i;
	const linkedinRegex =
		/^https?:\/\/(?:www\.)?(?:linkedin\.com)\/(?:in|company|pub)\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=-]+$/i;
	const xRegex =
		/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=-]+$/i;
	const facebookRegex =
		/^https?:\/\/(?:www\.)?(?:facebook\.com)\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=-]+$/i;
	const instagramRegex =
		/^https?:\/\/(?:www\.)?(?:instagram\.com)\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=-]+$/i;

	const [isValidFB, setIsValidFB] = useState(true);
	const [isValidInsta, setIsValidInsta] = useState(true);
	const [isValidX, setIsValidX] = useState(true);
	const [isValidLinkedin, setIsValidLinkedin] = useState(true);
	const [isValidTelegram, setIsValidTelegram] = useState(true);
	const [isValidYT, setIsValidYT] = useState(true);

	const linker = (prof: Profile): SocialLink[] => {
		return [
			{ type: 'instagram', link: prof.instagramUrl },
			{ type: 'x', link: prof.xUrl },
			{ type: 'linkedin', link: prof.linkedInUrl },
			{ type: 'telegram', link: prof.telegramUrl },
			{ type: 'youtube', link: prof.youtubeUrl },
			{ type: 'facebook', link: prof.fbUrl },
		];
	};
	const inputDesign = {
		base: 'bg-transparent',
		inputWrapper:
			'border-[0.5px] border-[#979797] mb-2  group-data-[focus=true]:border-[#979797] rounded-[6px]',
	};

	return (
		<div data-tour='social'>
			<div className='flex flex-row justify-between items-center mb-4'>
				{address === walletAddress ||
				(data && linker(data).some((w) => w.link)) ? (
					<p className='text-[20px] text-[#F1F0EB] font-bold '>
						Socials
					</p>
				) : (
					<></>
				)}
				{address === walletAddress &&
					(!isEditSocial ? (
						<Image
							src={'/editWhite.svg'}
							alt={'edit'}
							width={18}
							height={18}
							className='mb-[2px]  cursor-pointer'
							onClick={() => setIsEditSocial(true)}
						/>
					) : (
						<Image
							src={'/save.svg'}
							alt={'save'}
							width={18}
							height={18}
							className='mb-[2px]  cursor-pointer'
							onClick={async () => {
								if (
									isValidFB &&
									isValidInsta &&
									isValidX &&
									isValidLinkedin &&
									isValidTelegram &&
									isValidYT
								) {
									await saveSocial();
									setIsEditSocial(false);
								}
								// need to handle error, toast
							}}
						/>
					))}
			</div>
			{isEditSocial ? (
				<div>
					<div className='flex flex-col'>
						<div className='flex flex-row gap-3 item-center'>
							<Image
								className='text-center '
								src={'/social/instagram.svg'}
								alt={'instagram'}
								width={20}
								height={20}
							/>
							<Input
								defaultValue={data ? data.instagramUrl : ''}
								variant='bordered'
								name='instagram'
								onValueChange={(val) => {
									if (val !== '') {
										const valid = instagramRegex.test(val);
										setIsValidInsta(valid);
										if (!valid) {
											return;
										}
									} else {
										setIsValidInsta(true);
									}
									setData((prev: any) => ({
										...prev,
										instagramUrl: val,
									}));

									//setData({ ...data, instagramUrl: val });
								}}
								classNames={inputDesign}
							/>
						</div>
						{!isValidInsta && (
							<div className='flex flex-row gap-3 mb-3'>
								<div className='w-[22px]' />
								<p className='text-red-600 text-[10px] -mt-1 ml-2'>
									Invalid Instagram link
								</p>
							</div>
						)}
					</div>
					<div className='flex flex-col'>
						<div className='flex flex-row gap-3 item-center'>
							<Image
								className='text-center '
								src={'/social/x.svg'}
								alt={'x'}
								width={20}
								height={20}
							/>
							<Input
								defaultValue={data ? data.xUrl : ''}
								variant='bordered'
								name='x'
								onValueChange={(val) => {
									if (val !== '') {
										const valid = xRegex.test(val);
										setIsValidX(valid);
										if (!valid) {
											return;
										}
									} else {
										setIsValidX(true);
									}
									setData((prev: any) => ({
										...prev,
										xUrl: val,
									}));

									//setData({ ...data, xUrl: val });
								}}
								classNames={inputDesign}
							/>
						</div>
						{!isValidX && (
							<div className='flex flex-row gap-3 mb-3'>
								<div className='w-[22px]' />
								<p className='text-red-600 text-[10px] -mt-1 ml-2'>
									Invalid X link
								</p>
							</div>
						)}
					</div>
					<div className='flex flex-col'>
						<div className='flex flex-row gap-3 item-center'>
							<Image
								className='text-center'
								src={'/social/linkedin.svg'}
								alt={'linkedin'}
								width={20}
								height={20}
							/>
							<Input
								defaultValue={data ? data.linkedInUrl : ''}
								variant='bordered'
								name='linkedin'
								onValueChange={(val) => {
									if (val !== '') {
										const valid = linkedinRegex.test(val);
										setIsValidLinkedin(valid);
										if (!valid) {
											return;
										}
									} else {
										setIsValidLinkedin(true);
									}
									setData((prev: any) => ({
										...prev,
										linkedInUrl: val,
									}));
									//	setData({ ...data, linkedInUrl: val });
								}}
								classNames={inputDesign}
							/>
						</div>
						{!isValidLinkedin && (
							<div className='flex flex-row gap-3 mb-3'>
								<div className='w-[22px]' />
								<p className='text-red-600 text-[10px] -mt-1 ml-2'>
									Invalid LinkedIn link
								</p>
							</div>
						)}
					</div>
					<div className='flex flex-col'>
						<div className='flex flex-row gap-3 item-center'>
							<Image
								className='text-center'
								src={'/social/telegram.svg'}
								alt={'telegram'}
								width={20}
								height={20}
							/>
							<Input
								defaultValue={data ? data.telegramUrl : ''}
								variant='bordered'
								name='telegram'
								onValueChange={(val) => {
									if (val !== '') {
										const valid = telegramRegex.test(val);
										setIsValidTelegram(valid);
										if (!valid) {
											return;
										}
									} else {
										setIsValidTelegram(true);
									}
									setData((prev: any) => ({
										...prev,
										telegramUrl: val,
									}));

									//setData({ ...data, telegramUrl: val });
								}}
								classNames={inputDesign}
							/>
						</div>
						{!isValidTelegram && (
							<div className='flex flex-row gap-3 mb-3'>
								<div className='w-[22px]' />
								<p className='text-red-600 text-[10px] -mt-1 ml-2'>
									Invalid Telegram link
								</p>
							</div>
						)}
					</div>
					<div className='flex flex-col'>
						<div className='flex flex-row gap-3 item-center'>
							<Image
								className='text-center'
								src={'/social/youtube.svg'}
								alt={'youtube'}
								width={20}
								height={20}
							/>
							<Input
								defaultValue={data ? data.youtubeUrl : ''}
								variant='bordered'
								name='youtube'
								onValueChange={(val) => {
									if (val !== '') {
										const valid = youtubeRegex.test(val);
										setIsValidYT(valid);
										if (!valid) {
											return;
										}
									} else {
										setIsValidYT(true);
									}
									setData((prev: any) => ({
										...prev,
										youtubeUrl: val,
									}));

									//setData({ ...data, youtubeUrl: val });
								}}
								classNames={inputDesign}
							/>
						</div>
						{!isValidYT && (
							<div className='flex flex-row gap-3 mb-3'>
								<div className='w-[22px]' />
								<p className='text-red-600 text-[10px] -mt-1 ml-2'>
									Invalid Youtube link
								</p>
							</div>
						)}
					</div>
					<div className='flex flex-col'>
						<div className='flex flex-row gap-3 item-center'>
							<Image
								className='text-center '
								src={'/social/fb.svg'}
								alt={'facebook'}
								width={20}
								height={20}
							/>
							<Input
								defaultValue={data ? data.fbUrl : ''}
								variant='bordered'
								name='facebook'
								onValueChange={(val) => {
									//setData({ ...data, fbUrl: val });
									if (val !== '') {
										const valid = facebookRegex.test(val);
										setIsValidFB(valid);
										if (!valid) {
											return;
										}
									} else {
										setIsValidFB(true);
									}
									setData((prev: any) => ({
										...prev,
										fbUrl: val,
									}));
								}}
								classNames={inputDesign}
							/>
						</div>
						{!isValidFB && (
							<div className='flex flex-row gap-3 mb-3'>
								<div className='w-[22px]' />
								<p className='text-red-600 text-[10px] -mt-1 ml-2'>
									Invalid Facebook link
								</p>
							</div>
						)}
					</div>
				</div>
			) : (
				<div className='flex flex-row justify-between items-center'>
					<div className='flex flex-row items-center'>
						{data && linker(data).some((w) => w.link) ? (
							linker(data).map((w, _) => {
								let image: string | undefined = undefined;
								switch (w.type) {
									case 'facebook':
										image = '/social/fb.svg';
										break;
									case 'instagram':
										image = '/social/instagram.svg';
										break;
									case 'x':
										image = '/social/x.svg';
										break;
									case 'linkedin':
										image = '/social/linkedin.svg';
										break;
									case 'telegram':
										image = '/social/telegram.svg';
										break;
									case 'youtube':
										image = '/social/youtube.svg';
										break;
								}

								return w.link && image ? (
									<Link
										className='mx-[12px]'
										key={_}
										target='_blank'
										href={w.link ?? undefined}
									>
										<Image
											src={image}
											alt={w.type}
											width={20}
											height={20}
										/>
									</Link>
								) : (
									<span key={_} className='w-0 h-0'></span>
								);
							})
						) : address === walletAddress ? (
							<p className=' italic text-[#6E6E6E]'>
								Where were your past lives?
							</p>
						) : (
							<></>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
