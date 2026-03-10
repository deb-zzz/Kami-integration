'use client';
import Link from 'next/link';
import Image from 'next/image';
import KamiLogo from '../../public/kami.gif';
import {
	Fragment,
	ReactElement,
	ReactHTMLElement,
	useEffect,
	useState,
} from 'react';
import CreatePost from './CreatePost';
import { useGlobalState } from '@/lib/GlobalContext';
import useKamiWallet from '@/lib/KamiWalletHook';
import { Tooltip } from '@nextui-org/react';
export default function SideBar() {
	const [hoverIndex, setHoverIndex] = useState<null | number>(null);
	const [showCreateMenu, setShowCreateMenu] = useState<boolean>(false);
	const [showShortcut, setShowShortcut] = useState<boolean>(false);
	const [isPrivate, setIsPrivate] = useState<boolean>(false);
	const wallet = useKamiWallet();

	const [gs, setGs] = useGlobalState();
	const menu = [
		{
			name: 'Home',
			link: '/home',
			icon: '/menuIcon/home.svg',
			enabled: true,
		},
		{
			name: 'Profile',
			link: '/profile/' + wallet?.getAccount()?.address,
			icon: '/menuIcon/profile.svg',
			enabled: isPrivate,
		},
		{
			name: 'Activity',
			link: '/activity',
			icon: '/menuIcon/activity.svg',
			enabled: isPrivate,
		},
		{
			name: 'Explore',
			link: null,
			// link: '/explore',
			icon: '/menuIcon/exploreGrey.svg',
			enabled: isPrivate,
		},

		{
			name: 'Featured',
			link: null,
			icon: '/menuIcon/featuredGrey.svg',
			enabled: isPrivate,
		},
		{
			name: 'Settings',
			link: null,
			// link: '/settings',
			icon: '/menuIcon/settingsGrey.svg',
			enabled: isPrivate,
		},
		{
			name: 'Report Bug',
			link: '/report',
			icon: '/menuIcon/report.svg',
			enabled: true,
		},
	];

	const creatorDashboardMenu = [
		// {
		// 	name: 'Post',
		// 	link: null,
		// 	icon: '/menuIcon/post.svg',
		// 	subLink: [
		// 		{
		// 			name: 'Project',
		// 			link: '/project',
		// 		},
		// 		{
		// 			name: 'Post',
		// 			link: '/home',
		// 		},
		// 	],
		// },
		{
			name: 'Playlist',
			link: null,
			icon: '/menuIcon/playlistGrey.svg',
			subLink: null,
		},
		{
			name: 'Project',
			link: '/project',
			icon: '/menuIcon/folder.svg',
			subLink: null,
		},
	];

	useEffect(() => {
		setIsPrivate(Boolean(gs?.walletAddress));
	}, [gs?.walletAddress]);

	const ShortcutLink: React.FC<{
		hrefLink: string | null;
		children: React.ReactElement<any>;
	}> = ({ hrefLink, children }) => {
		if (hrefLink !== null) {
			return (
				<Link href={hrefLink} className='flex flex-row'>
					{children}
				</Link>
			);
		} else {
			return (
				<div
					className='flex flex-row items-start cursor-pointer'
					onClick={() => setShowCreateMenu(!showCreateMenu)}
				>
					{children}
				</div>
			);
		}
	};
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	return (
		<>
			<aside className='w-[90px]  bg-black py-8  self-start sticky top-0 h-screen md:block hidden'>
				<div className='relative h-full'>
					<Link href={'/home'} className='cursor-pointer'>
						<Image
							src={KamiLogo}
							alt={'logo'}
							className=' m-auto'
							width={50}
							height={50}
						/>
					</Link>
					<div className='mt-6 group '>
						{menu.map((item, index) =>
							item.enabled ? (
								<div
									className='flex flex-row justify-center my-5 w-full'
									key={index}
								>
									<ShortcutLink hrefLink={item.link}>
										<Image
											onMouseEnter={() =>
												setHoverIndex(index)
											}
											onMouseLeave={() =>
												setHoverIndex(null)
											}
											src={item.icon}
											alt={'logo'}
											width={25}
											height={25}
										/>
									</ShortcutLink>
									<div className='relative hidden  group-hover:grid  place-items-center  cursor-default'>
										<p
											className={`absolute left-4 cursor-default  ${
												hoverIndex === index
													? '  group-hover:opacity-100 group-hover:transition-opacity group-hover:duration-200 group-hover:ease-in'
													: 'opacity-0 '
											} ${
												item.link !== null
													? 'text-[#F1F0EB]'
													: 'text-[#6E6E6E]'
											}   text-[13px] font-normal w-full`}
										>
											{item.link !== null
												? item.name
												: 'Coming soon'}
										</p>
										{/* <p
								className={`absolute top-0 bottom-0  place-items-center  left-4 hidden  ${
									hoverIndex === index
										? ' group-hover:grid '
										: ' '
								} text-[#F1F0EB]  text-[13px] font-normal`}
							>
								{item.name}
							</p> */}
									</div>
								</div>
							) : (
								<Fragment key={index}></Fragment>
							)
						)}
					</div>
					{isPrivate && (
						<div
							className='absolute bottom-0 w-full'
							onMouseLeave={() => {
								setShowShortcut(false);
								setShowCreateMenu(false);
							}}
						>
							{showShortcut && (
								<div>
									{creatorDashboardMenu.map((item, index) => (
										<Tooltip
											key={index}
											className='bg-black cursor-pointer text-[10px] ml-[25%] '
											content={'Coming Soon..'}
											isDisabled={item.link !== null}
										>
											<div className='flex flex-row my-3  ml-[45%]'>
												{/* {item.name === 'Post' ? :} */}
												<ShortcutLink
													hrefLink={item.link}
												>
													<>
														<Image
															src={item.icon}
															alt={'logo'}
															width={20}
															height={20}
														/>

														<div
															className={`ml-3 flex flex-col  `}
														>
															<p
																className={`${
																	item.link !==
																	null
																		? 'text-[#F1F0EB]'
																		: 'text-[#454343]'
																}   text-[13px] font-normal flex flex-col `}
															>
																{item.name}
															</p>
															{/* {item.subLink?.length &&
													showCreateMenu &&
													item.subLink?.map(
														(l, idx) => (
															<Link
																key={idx}
																href={l.link}
																className='text-[#F1F0EB] text-[13px] font-normal mt-4 ml-2'
															>
																{l.name}
															</Link>
														)
													)} */}
														</div>
													</>
												</ShortcutLink>
											</div>
										</Tooltip>
									))}
								</div>
							)}
							<div
								className=' w-full flex flex-row justify-center mt-4 cursor-pointer'
								onMouseEnter={() => setShowShortcut(true)}
								data-tour='create-button'
							>
								<Image
									src={'/menuIcon/shortcut.svg'}
									alt={'logo'}
									width={35}
									height={35}
								/>
							</div>
						</div>
					)}
				</div>
			</aside>
			{/* <CreatePost isOpen={createIsOpen} setIsOpen={setCreateIsOpen} /> */}
		</>
	);
}
