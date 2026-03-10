import { searchProfiles } from '@/apihandler/Project';
import { getProfiles } from '@/apihandler/Profile';
import { Profile } from '@/types';
import { Avatar, AvatarIcon } from '@nextui-org/react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { addProfilesToMentionCache } from '@/lib/mention-cache';

interface MentionDropdownProps {
	isOpen: boolean;
	query: string;
	onSelect: (profile: Profile) => void;
	onClose: () => void;
	position: { top: number; left: number };
	walletAddress: string;
	selectedIndex: number;
	onSelectedIndexChange: (index: number) => void;
}

export const MentionDropdown = ({
	isOpen,
	query,
	onSelect,
	onClose,
	position,
	walletAddress,
	selectedIndex,
	onSelectedIndexChange,
}: MentionDropdownProps) => {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [loading, setLoading] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	const searchUsers = useCallback(
		async (searchQuery: string) => {
			if (!searchQuery.trim()) {
				setProfiles([]);
				return;
			}

			setLoading(true);
			try {
				// Try the collaboration service first
				let response;
				try {
					response = await searchProfiles(walletAddress, searchQuery);
				} catch (collabError) {
					response = null;
				}

				// If collaboration search fails or returns no results, try getting all profiles
				if (!response || !response.success || !response.users || response.users.length === 0) {
					const allProfilesResponse = await getProfiles();

					if (allProfilesResponse && Array.isArray(allProfilesResponse)) {
						// Filter profiles locally by username
						const filteredProfiles = allProfilesResponse.filter(
							(profile: any) => profile.userName && profile.userName.toLowerCase().includes(searchQuery.toLowerCase())
						);
						const limitedProfiles = filteredProfiles.slice(0, 10);
						// Cache the profiles for mention parsing
						addProfilesToMentionCache(limitedProfiles);
						setProfiles(limitedProfiles);
					} else {
						setProfiles([]);
					}
				} else {
					// Use collaboration search results
					const limitedProfiles = response.users.slice(0, 10);
					// Cache the profiles for mention parsing
					addProfilesToMentionCache(limitedProfiles);
					setProfiles(limitedProfiles);
				}
			} catch (error) {
				console.error('Error searching profiles:', error);
				setProfiles([]);
			} finally {
				setLoading(false);
			}
		},
		[walletAddress]
	);

	// Debounced search with 1.5 second delay
	useEffect(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		if (query.trim()) {
			timeoutRef.current = setTimeout(() => {
				searchUsers(query);
			}, 1500);
		} else {
			setProfiles([]);
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [query, searchUsers]);

	// Handle keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isOpen || profiles.length === 0) return;

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					onSelectedIndexChange((selectedIndex + 1) % profiles.length);
					break;
				case 'ArrowUp':
					e.preventDefault();
					onSelectedIndexChange((selectedIndex - 1 + profiles.length) % profiles.length);
					break;
				case 'Enter':
					e.preventDefault();
					if (profiles[selectedIndex]) {
						onSelect(profiles[selectedIndex]);
					}
					break;
				case 'Escape':
					e.preventDefault();
					onClose();
					break;
			}
		};

		// Use capture phase to ensure we get the event before the textarea
		document.addEventListener('keydown', handleKeyDown, true);
		return () => document.removeEventListener('keydown', handleKeyDown, true);
	}, [isOpen, profiles, selectedIndex, onSelect, onClose, onSelectedIndexChange]);

	// Reset selected index when profiles change
	useEffect(() => {
		onSelectedIndexChange(0);
	}, [profiles, onSelectedIndexChange]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen, onClose]);

	if (!isOpen || !query.trim()) {
		return null;
	}

	return (
		<div
			ref={dropdownRef}
			className='fixed z-[9999] bg-[#1a1a1a] border border-[#4E4E4E] rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-64'
			style={{
				top: position.top,
				left: position.left,
			}}>
			{loading ? (
				<div className='p-3 text-center text-white'>
					<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto'></div>
					<p className='text-sm mt-2'>Searching users...</p>
				</div>
			) : profiles.length > 0 ? (
				<div className='py-1'>
					{profiles.map((profile, index) => (
						<div
							key={profile.walletAddress}
							className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#2a2a2a] transition-colors ${
								index === selectedIndex ? 'bg-[#2a2a2a]' : ''
							}`}
							onClick={() => onSelect(profile)}>
							<Avatar size='sm' icon={<AvatarIcon />} src={profile.avatarUrl ?? undefined} className='w-8 h-8' />
							<div className='flex-1 min-w-0'>
								<p className='text-sm font-medium text-[#f1f0eb] truncate'>{profile.userName}</p>
								<p className='text-xs text-[#6E6E6E] truncate'>
									{profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-4)}
								</p>
							</div>
							{index === selectedIndex && (
								<Image src='/post/checkCircle.svg' alt='Selected' width={16} height={16} className='opacity-70' />
							)}
						</div>
					))}
				</div>
			) : (
				<div className='p-3 text-center text-[#6E6E6E]'>
					<p className='text-sm'>No users found</p>
				</div>
			)}
		</div>
	);
};
