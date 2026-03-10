'use client';

import { Input, Divider, Tabs, Tab } from '@nextui-org/react';
import Image from 'next/image';
import { useSearch } from '@/lib/SearchContextProvider';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
	searchAll,
	SearchResults,
	SearchProfile,
	SearchProduct,
	SearchCollection,
	SearchTag,
} from '@/apihandler/Search';
import { useGlobalState } from '@/lib/GlobalContext';
import { useRouter } from 'next/navigation';
import '@/styles/scrollbar.css';
import {
	followProfile,
	unfollowProfile,
	getFollowInfo,
} from '@/apihandler/Profile';
import { ToastMessage } from '@/components/ToastMessage';

type TabKey = 'forYou' | 'accounts' | 'tags' | 'products' | 'collections';

// Helper function to convert IPFS URLs to HTTP URLs
const getImageUrl = (url: string | null | undefined): string | null => {
	if (!url) return null;
	
	// If it's an IPFS URL, convert it to HTTP
	if (url.startsWith('ipfs://')) {
		const hash = url.replace('ipfs://', '');
		return `https://ipfs.io/ipfs/${hash}`;
	}
	
	// If it's already an HTTP URL, return as is
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}
	
	// If it's a relative path, return as is
	if (url.startsWith('/')) {
		return url;
	}
	
	// Otherwise, return null to show fallback
	return null;
};

export const SearchInput = () => {
	const { searchText, setSearchText } = useSearch();
	const [gs] = useGlobalState();
	const [isSearching, setIsSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<SearchResults | null>(
		null
	);
	const [showResults, setShowResults] = useState(false);
	const [selectedTab, setSelectedTab] = useState<TabKey>('forYou');
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const searchTimeoutRef = useRef<NodeJS.Timeout>();
	const searchContainerRef = useRef<HTMLDivElement>(null);
	const router = useRouter();
	const [followerMap, setFollowerMap] = useState<Map<string, boolean>>(
		new Map()
	);

	// Handle search with debounce
	const performSearch = useCallback(
		async (query: string, tagFilter?: string) => {
			if (!query?.trim() || !gs?.walletAddress) {
				setSearchResults(null);
				setShowResults(false);
				return;
			}
			
			setIsSearching(true);
			try {
				const results = await searchAll(gs.walletAddress, query, {
					limit: 10,
					...(tagFilter && { tag: tagFilter }),
				});
				
				if (results.success) {
					setSearchResults(results.results);
					setShowResults(true);
				} else {
					setSearchResults(null);
					setShowResults(false);
				}
			} catch (error) {
				console.error('Search failed with error:', error);
				setSearchResults(null);
				setShowResults(false);
			} finally {
				setIsSearching(false);
			}
		},
		[gs?.walletAddress]
	);

	// Debounced search effect
	useEffect(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		if (searchText?.trim()) {
			searchTimeoutRef.current = setTimeout(() => {
				performSearch(searchText, selectedTag || undefined);
			}, 300);
		} else {
			setSearchResults(null);
			setShowResults(false);
		}

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, [searchText, selectedTag, performSearch]);

	// Handle click outside to close results
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				searchContainerRef.current &&
				!searchContainerRef.current.contains(event.target as Node)
			) {
				setShowResults(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	const handleProfileClick = (walletAddress: string) => {
		router.push(`/profile/${walletAddress}`);
		setShowResults(false);
		setSearchText('');
	};

	const handleProductClick = (productId: number) => {
		router.push(`/product/${productId}`);
		setShowResults(false);
		setSearchText('');
	};

	const handleCollectionClick = (collectionId: number) => {
		router.push(`/collection/${collectionId}`);
		setShowResults(false);
		setSearchText('');
	};

	const handleProfileHover = (walletAddress: string) => {
		router.prefetch(`/profile/${walletAddress}`);
	};

	const handleProductHover = (productId: number) => {
		router.prefetch(`/product/${productId}`);
	};

	const handleCollectionHover = (collectionId: number) => {
		router.prefetch(`/collection/${collectionId}`);
	};

	const handleTagClick = (tag: string) => {
        setSelectedTag(tag);
        // setSearchText('');
		setShowResults(false);
		if (searchText?.trim()) {
			performSearch(searchText, tag);
		}
	};

	const handleRemoveTag = () => {
		setSelectedTag(null);
		if (searchText?.trim()) {
			performSearch(searchText);
		}
	};

	const follow = async (address: string) => {
		if (gs?.walletAddress) {
			const res = await followProfile(address, gs.walletAddress);
			if (res.success) {
				followerMap.set(address, true);
				setFollowerMap(new Map(followerMap));
				ToastMessage('success', 'Successfully followed user');
			} else {
				ToastMessage('error', 'Failed to follow user');
			}
		}
	};

	const unfollow = async (address: string) => {
		if (gs?.walletAddress) {
			const res = await unfollowProfile(address, gs.walletAddress);
			if (res.success) {
				followerMap.set(address, false);
				setFollowerMap(new Map(followerMap));
				ToastMessage('success', 'Successfully unfollowed user');
			} else {
				ToastMessage('error', 'Failed to unfollow user');
			}
		}
	};

	const fetchFollowingInfo = async () => {
		if (!searchResults?.profiles || !gs?.walletAddress) return;

		for (const profile of searchResults.profiles) {
			if (profile.walletAddress !== gs.walletAddress) {
				const res = await getFollowInfo(profile.walletAddress);
				if (res.followers.length > 0) {
					const isFollowed = res.followers.includes(gs.walletAddress);
					followerMap.set(profile.walletAddress, isFollowed);
				}
			}
		}
		setFollowerMap(new Map(followerMap));
	};

	useEffect(() => {
		if (searchResults?.profiles && gs?.walletAddress) {
			fetchFollowingInfo();
		}
	}, [searchResults?.profiles, gs?.walletAddress]);

	const getFilteredResults = () => {
		if (!searchResults) return null;

		switch (selectedTab) {
			case 'accounts':
				return { profiles: searchResults.profiles };
			case 'tags':
				return { tags: searchResults.tags };
			case 'products':
				return { products: searchResults.products };
			case 'collections':
				return { collections: searchResults.collections };
			case 'forYou':
			default:
				return searchResults;
		}
	};

	const filteredResults = getFilteredResults();
	const hasResults =
		filteredResults &&
		(filteredResults.profiles?.length ||
			filteredResults.products?.length ||
			filteredResults.collections?.length ||
			filteredResults.tags?.length);
            
	return (
		<div className='relative' ref={searchContainerRef}>
			{/* Tag Filter Chip */}
			{selectedTag && (
				<div className='mb-2 flex items-center gap-2'>
					<div className='inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2A2A2A] border border-[#3A3A3A] rounded-full'>
						<span className='text-[#F1F0EB] text-[11px]'>
							#{selectedTag}
						</span>
						<button
							onClick={handleRemoveTag}
							className='text-[#6E6E6E] hover:text-[#F1F0EB] transition-colors'
							aria-label='Remove tag filter'
						>
							<Image
								src={'/close.svg'}
								alt='remove'
								width={12}
								height={12}
							/>
						</button>
					</div>
					<span className='text-[#6E6E6E] text-[10px]'>
						Filtering by tag
					</span>
				</div>
			)}
			
			<div className='flex flex-row items-center justify-center gap-2 mb-14'>
				<div className='w-full flex flex-row items-center gap-2'>
					<Input
						isClearable
						size='sm'
						className='flex-1'
						placeholder="Hello, is it me you're looking for?"
						value={searchText}
						classNames={{
							base: 'bg-transparent',
							input: 'group-data-[has-value=true]:text-[#F1F0EB] pr-0 placeholder:text-[#6E6E6E] placeholder:italic text-[12px]',
							inputWrapper:
								'group-data-[hover=true]:bg-transparent h-[15px] p-0  group-data-[focus=true]:bg-transparent group-data-[focus=true]:border-b-none rounded-none border-b-none   bg-transparent',
						}}
						onChange={(e) => setSearchText(e.target.value)}
						onClear={() => {
							setSearchText('');
							setShowResults(false);
						}}
						onFocus={() => {
							if (searchText?.trim() && searchResults) {
								setShowResults(true);
							}
						}}
					/>
					<Image
						src={'/search.svg'}
						alt={'search'}
						width={20}
						height={20}
					/>
				</div>
				<Divider
					orientation='vertical'
					className='bg-[#6E6E6E] h-[20px]'
				/>
				<Image
					src={'/filterLines.svg'}
					alt={'filter'}
					width={20}
					height={20}
					className='cursor-pointer'
				/>
			</div>

			{/* Search Results Dropdown */}
			{showResults && searchText?.trim() && (
				<div className='absolute top-full left-0 right-0 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl z-50 max-h-[500px] overflow-hidden'>
					{/* Tabs */}
					<Tabs
						selectedKey={selectedTab}
						onSelectionChange={(key) =>
							setSelectedTab(key as TabKey)
						}
						variant='underlined'
						classNames={{
							base: 'w-full',
							tabList:
								'w-full bg-[#1A1A1A] border-b border-[#2A2A2A] px-4',
							cursor: 'bg-[#F1F0EB]',
							tab: 'text-[#6E6E6E] data-[selected=true]:text-[#F1F0EB]',
							tabContent:
								'text-[12px] group-data-[selected=true]:text-[#F1F0EB]',
						}}
					>
						<Tab key='forYou' title='For you' />
						<Tab key='accounts' title='Accounts' />
						<Tab key='tags' title='Tags' />
						<Tab key='products' title='Products' />
						<Tab key='collections' title='Collections' />
					</Tabs>

					{/* Results Content */}
					<div className='overflow-y-auto max-h-[400px] custom-scrollbar'>
						{isSearching ? (
							<div className='p-4 text-center text-[#6E6E6E]'>
								Searching...
							</div>
						) : hasResults ? (
							<div className='p-2'>
								{/* Profiles */}
								{filteredResults?.profiles &&
									filteredResults.profiles.length > 0 && (
										<div className='mb-4'>
											{selectedTab === 'forYou' && (
												<div className='px-2 py-1 text-[10px] text-[#6E6E6E] uppercase'>
													Accounts
												</div>
											)}
											{filteredResults.profiles.map(
												(profile) => (
													<ProfileResult
														key={
															profile.walletAddress
														}
														profile={profile}
														onClick={() =>
															handleProfileClick(
																profile.walletAddress
															)
														}
														onHover={() =>
															handleProfileHover(
																profile.walletAddress
															)
														}
														follow={follow}
														unfollow={unfollow}
														isFollowed={followerMap.get(
															profile.walletAddress
														)}
														isLoggedIn={!!gs?.walletAddress}
														currentUserAddress={gs?.walletAddress}
													/>
												)
											)}
										</div>
									)}

								{/* Tags */}
								{filteredResults?.tags &&
									filteredResults.tags.length > 0 && (
										<div className='mb-4'>
											{selectedTab === 'forYou' && (
												<div className='px-2 py-1 text-[10px] text-[#6E6E6E] uppercase'>
													Tags
												</div>
											)}
											{filteredResults.tags.map((tag) => (
												<TagResult
													key={tag.id}
													tag={tag}
													onClick={() =>
														handleTagClick(tag.tag)
													}
												/>
											))}
										</div>
									)}

								{/* Products */}
								{filteredResults?.products &&
									filteredResults.products.length > 0 && (
										<div className='mb-4'>
											{selectedTab === 'forYou' && (
												<div className='px-2 py-1 text-[10px] text-[#6E6E6E] uppercase'>
													Products
												</div>
											)}
											{filteredResults.products.map(
												(product) => (
													<ProductResult
														key={product.id}
														product={product}
														onClick={() =>
															handleProductClick(
																product.id
															)
														}
														onHover={() =>
															handleProductHover(
																product.id
															)
														}
													/>
												)
											)}
										</div>
									)}

								{/* Collections */}
								{filteredResults?.collections &&
									filteredResults.collections.length > 0 && (
										<div className='mb-4'>
											{selectedTab === 'forYou' && (
												<div className='px-2 py-1 text-[10px] text-[#6E6E6E] uppercase'>
													Collections
												</div>
											)}
											{filteredResults.collections.map(
												(collection) => (
													<CollectionResult
														key={
															collection.collectionId
														}
														collection={collection}
														onClick={() =>
															handleCollectionClick(
																collection.collectionId
															)
														}
														onHover={() =>
															handleCollectionHover(
																collection.collectionId
															)
														}
													/>
												)
											)}
										</div>
									)}
							</div>
						) : (
							<div className='p-4 text-center text-[#6E6E6E]'>
								No results found
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

// Profile Result Component
const ProfileResult = ({
	profile,
	onClick,
	onHover,
	follow,
	unfollow,
	isFollowed = false,
	isLoggedIn = false,
	currentUserAddress,
}: {
	profile: SearchProfile;
	onClick: () => void;
	onHover: () => void;
	follow?: (address: string) => Promise<void>;
	unfollow?: (address: string) => Promise<void>;
	isFollowed?: boolean;
	isLoggedIn?: boolean;
	currentUserAddress?: string;
}) => {
	const avatarUrl = getImageUrl(profile.avatarUrl);
	
	return (
		<div
			className='flex items-center gap-3 p-2 hover:bg-[#2A2A2A] rounded-lg cursor-pointer transition-colors'
			onClick={onClick}
			onMouseEnter={onHover}
		>
			<div className='relative h-fit'>
				<div className='w-10 h-10 rounded-full overflow-hidden bg-[#2A2A2A] flex-shrink-0'>
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt={profile.userName}
							className='w-full h-full object-cover'
						/>
					) : (
						<div className='w-full h-full flex items-center justify-center text-[#6E6E6E]'>
							{profile.userName.charAt(0).toUpperCase()}
						</div>
					)}
				</div>
				{isLoggedIn &&
					profile.walletAddress !== currentUserAddress && (
						<div className='cursor-pointer w-fit absolute -bottom-1 right-0 z-30'>
							<Image
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
												profile.walletAddress
										  )
										: follow &&
										  follow(
												profile.walletAddress
										  );
								}}
							/>
						</div>
					)}
			</div>
		<div className='flex-1 min-w-0'>
			<div className='text-[#F1F0EB] text-[14px] font-medium truncate'>
				{profile.displayName || profile.userName}
			</div>
			<div className='text-[#6E6E6E] text-[12px] truncate'>
				@{profile.userName}
			</div>
		</div>
		<button className='px-3 py-1 bg-transparent border border-[#F1F0EB] text-[#F1F0EB] text-[12px] rounded hover:bg-[#F1F0EB] hover:text-black transition-colors'>
				View Profile
			</button>
		</div>
	);
};

// Tag Result Component
const TagResult = ({
	tag,
	onClick,
}: {
	tag: SearchTag;
	onClick: () => void;
}) => (
	<div
		className='flex items-center gap-3 p-2 hover:bg-[#2A2A2A] rounded-lg cursor-pointer transition-colors'
		onClick={onClick}
	>
		<div className='w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center flex-shrink-0'>
			<span className='text-[#F1F0EB] text-[16px]'>#</span>
		</div>
		<div className='flex-1 min-w-0'>
			<div className='text-[#F1F0EB] text-[14px] font-medium'>
				# {tag.tag}
			</div>
			<div className='text-[#6E6E6E] text-[12px]'>
				{tag.usageCount.total} uses
			</div>
		</div>
	</div>
);

// Product Result Component
const ProductResult = ({
	product,
	onClick,
	onHover,
}: {
	product: SearchProduct;
	onClick: () => void;
	onHover: () => void;
}) => {
	const mediaUrl = getImageUrl(product.mediaUrl);
	
	return (
		<div
			className='flex items-center gap-3 p-2 hover:bg-[#2A2A2A] rounded-lg cursor-pointer transition-colors'
			onClick={onClick}
			onMouseEnter={onHover}
		>
			<div className='relative w-10 h-10 rounded overflow-hidden bg-[#2A2A2A] flex-shrink-0'>
				{mediaUrl ? (
					<img
						src={mediaUrl}
						alt={product.name}
						className='w-full h-full object-cover'
					/>
				) : (
					<div className='w-full h-full flex items-center justify-center text-[#6E6E6E]'>
						<Image
							src={'/cube.svg'}
							alt='product'
							width={20}
							height={20}
						/>
					</div>
				)}
			</div>
		<div className='flex-1 min-w-0'>
			<div className='text-[#F1F0EB] text-[14px] font-medium truncate'>
				{product.name}
			</div>
			<div className='text-[#6E6E6E] text-[12px] truncate'>
				{product.owner.userName} • {product.price} {product.currency}
			</div>
		</div>
		</div>
	);
};

// Collection Result Component
const CollectionResult = ({
	collection,
	onClick,
	onHover,
}: {
	collection: SearchCollection;
	onClick: () => void;
	onHover: () => void;
}) => {
	const avatarUrl = getImageUrl(collection.avatarUrl);
	
	return (
		<div
			className='flex items-center gap-3 p-2 hover:bg-[#2A2A2A] rounded-lg cursor-pointer transition-colors'
			onClick={onClick}
			onMouseEnter={onHover}
		>
			<div className='relative w-10 h-10 rounded overflow-hidden bg-[#2A2A2A] flex-shrink-0'>
				{avatarUrl ? (
					<img
						src={avatarUrl}
						alt={collection.name}
						className='w-full h-full object-cover'
					/>
				) : (
					<div className='w-full h-full flex items-center justify-center text-[#6E6E6E]'>
						<Image
							src={'/folder.svg'}
							alt='collection'
							width={20}
							height={20}
						/>
					</div>
				)}
			</div>
		<div className='flex-1 min-w-0'>
			<div className='text-[#F1F0EB] text-[14px] font-medium truncate'>
				{collection.name}
			</div>
			<div className='text-[#6E6E6E] text-[12px] truncate'>
				{collection.owner.userName} • {collection.itemCount} items
			</div>
		</div>
			<button className='px-3 py-1 bg-transparent border border-[#F1F0EB] text-[#F1F0EB] text-[12px] rounded hover:bg-[#F1F0EB] hover:text-black transition-colors'>
				View Collection
			</button>
		</div>
	);
};
