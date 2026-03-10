import { useGlobalState } from '@/lib/GlobalContext';
import useKamiWallet from '@/lib/KamiWalletHook';
import { Link, Navbar, NavbarContent, NavbarMenu, NavbarMenuItem, NavbarMenuToggle } from '@nextui-org/react';
import { ReactElement, useEffect, useState } from 'react';

export default function MobileMenu({ children }: { children?: ReactElement }) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isPrivate, setIsPrivate] = useState<boolean>(false);
	const [page, setPage] = useState<string>('home');
	const wallet = useKamiWallet();
	const [gs, setGs] = useGlobalState();
	const menuItems = [
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
			name: 'Explore',
			link: '/explore',
			icon: '/menuIcon/explore.svg',
			enabled: true,
		},
		{
			name: 'Featured',
			link: null,
			icon: '/menuIcon/featuredGrey.svg',
			enabled: isPrivate,
		},
		{
			name: 'Activity',
			link: null,
			icon: '/menuIcon/activityGrey.svg',
			enabled: isPrivate,
		},
		{
			name: 'Settings',
			link: '/settings',
			icon: '/menuIcon/settings.svg',
			enabled: isPrivate,
		},
	];

	useEffect(() => {
		setIsPrivate(Boolean(gs?.walletAddress));
	}, [gs?.walletAddress]);

	return (
		<Navbar
			classNames={{
				base: 'bg-transparent data-[menu-open=true]:backdrop-blur-none backdrop-blur-none',
				// menuItem: [
				// 	'text-[#F1F0EB]/80 data-[active=true]:after:text-primary',
				// ],
			}}
			isBordered
			isMenuOpen={isMenuOpen}
			onMenuOpenChange={setIsMenuOpen}
			className='md:hidden w-fit'
		>
			<NavbarContent justify='start'>
				<NavbarMenuToggle aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} />
			</NavbarContent>
			<NavbarMenu className='mt-5 bg-[#1a1a1a]/70 px-10 py-5'>
				{menuItems.map(
					(item, index) =>
						item.enabled && (
							<NavbarMenuItem key={`${item}-${index}`} onClick={() => setPage(item.name.toLowerCase())}>
								{item.link !== null ? (
									<Link className='w-full text-[#F1F0EB] text-[15px]' href={item.link} size='lg'>
										{item.name}
									</Link>
								) : (
									<p className='text-[15px] text-[#F1F0EB]/20'>{item.name}</p>
								)}
							</NavbarMenuItem>
						)
				)}
				{children}
			</NavbarMenu>
		</Navbar>
	);
}
