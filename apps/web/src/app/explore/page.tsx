'use client';

import { IsAudio, IsImage, IsVideo } from '@/lib/Util';
import { MasonryPhotoAlbum } from 'react-photo-album';
import InfiniteScroll from 'react-photo-album/scroll';
import 'react-photo-album/masonry.css';
import photoFetcher from './photoFetcher';
import NavBar from '@/components/NavBar';
import { Divider, Input, useDisclosure } from '@nextui-org/react';
import Image from 'next/image';
import FeedModal from '@/components/FeedModal';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ImageType, MediaType } from './photo';
import { getExploreFeed } from '@/apihandler/Feed';
import { useRouter } from 'next/navigation';
import { useGlobalState } from '@/lib/GlobalContext';
import { ExploreType } from '@/types';
import { useBreakpoint } from './ResponsiveFinder';
import YouTube from 'react-player';
import { ImageMimeType, VideoMimeType, evenDist } from '@/lib/Util';
import CollaboratorSearch from '@/components/Project/CollaboratorSearch';
import { useSearch } from '@/lib/SearchContextProvider';
import { useInView } from 'react-intersection-observer';
import { ExploreSpinner } from './ExploreSpinner';
import useKamiWallet from '@/lib/KamiWalletHook';
import BackButton from '@/components/BackButton';

const Grid1 = dynamic(() => import('./grids/Grid1'), { ssr: false });
const Grid2 = dynamic(() => import('./grids/Grid2'), { ssr: false });
const Grid3 = dynamic(() => import('./grids/Grid3'), { ssr: false });

const verticalPosts: ExploreType[] = [];
const horizontalPosts: ExploreType[] = [];
const squarePosts: ExploreType[] = [];

const loadingLimit = 60;

export default function Explore() {
	const { isSm } = useBreakpoint('sm');
	const { isMd } = useBreakpoint('md');
	const { isLg } = useBreakpoint('lg');
	const { isXl } = useBreakpoint('xl');
	const { is2xl } = useBreakpoint('2xl');
	const { is3xl } = useBreakpoint('3xl');

	const [posts, setPosts] = useState<ExploreType[]>([]);
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [gs, setGs] = useGlobalState();
	const router = useRouter();
	const { ref, inView } = useInView();
	const searchRef = useRef<HTMLInputElement>(null);
	const { searchText, setSearchText } = useSearch();
	const [page, setPage] = useState<number>(1);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isFinished, setIsFinished] = useState<boolean>(false);
	const wallet = useKamiWallet();

	const explorePost = async (address: string | undefined) => {
		const explorePost = await getExploreFeed(address ?? '0x0000000000', {
			page,
			searchText,
			limit: loadingLimit,
		});
		if (explorePost.explore.length < loadingLimit) {
			setIsFinished(true);
		}

		const data = await filterBrokenImages(explorePost.explore).then(
			(filtered) => {
				// setValidImages(filtered);
				return filtered;
			}
		);

		data.forEach((post: ExploreType) => {
			if ((post.aspectRatio ?? 1) < 1) {
				//console.log('Vertical Post: ', post);
				verticalPosts.push(post);
			} else if ((post.aspectRatio ?? 1) > 1) {
				//console.log('Horizontal Post: ', post);
				horizontalPosts.push(post);
			} else {
				//console.log('Square Post: ', post);
				squarePosts.push(post);
			}
		});
		//setPosts(explorePost.explore);
		// setVerticalPosts([...verticalPosts]);
		// setHorizontalPosts([...horizontalPosts]);
		// setSquarePosts([...squarePosts]);
		setPosts(
			evenDist(evenDist(verticalPosts, squarePosts), horizontalPosts)
		);
		setPage((prev) => prev + 1);
	};

	const filterBrokenImages = (data: ExploreType[]) => {
		return new Promise<ExploreType[]>((resolve) => {
			const filtered: ExploreType[] = [];
			let checked = 0;

			const checkDone = (item?: ExploreType) => {
				if (item) filtered.push(item);
				if (++checked === data.length) resolve(filtered);
			};

			data.forEach((item) => {
				if (item.animationUrl && IsVideo(item.animationUrl)) {
					const video = document.createElement('video');
					video.onloadeddata = () => checkDone(item);
					video.onerror = () => {
						checkDone();
					};
					video.src = item.animationUrl;
				} else {
					const img = new window.Image();
					img.onload = () => checkDone(item);
					img.onerror = () => {
						checkDone();
					};
					img.src = item.mediaUrl;
				}
			});
		});
	};

	const filteredPosts = useMemo((): ExploreType[] => {
		const filtered: ExploreType[] =
			searchText && searchText.length > 0 ? [] : posts;
		posts.map((post) => {
			if (
				post.description
					.toLowerCase()
					.includes(searchText?.toLowerCase() ?? '')
			) {
				filtered.push(post);
			}

			if (
				post.name
					.toLowerCase()
					.includes(searchText?.toLowerCase() ?? '')
			) {
				filtered.push(post);
			}

			if (searchText?.includes('image')) {
				if (post.filetype.toLowerCase().includes('image')) {
					filtered.push(post);
				}
			}
			if (searchText?.includes('video')) {
				if (post.filetype.toLowerCase().includes('video')) {
					filtered.push(post);
				}
			}
			if (searchText?.includes('audio')) {
				if (post.filetype.toLowerCase().includes('audio')) {
					filtered.push(post);
				}
			}
			if (searchText?.includes('youtube')) {
				if (post.mediaUrl.toLowerCase().includes('youtube')) {
					filtered.push(post);
				}
			}
		});

		// Remove duplicates
		const uniquePosts = filtered.filter(
			(post, index, self) =>
				index === self.findIndex((t) => t.id === post.id)
		);
		return uniquePosts;
	}, [posts, searchText]);

	// useEffect(() => {
	// 	console.log("Vertical Posts: ", verticalPosts);
	// 	console.log("Horizontal Posts: ", horizontalPosts);
	// 	console.log("Square Posts: ", squarePosts);
	// }, [verticalPosts, horizontalPosts, squarePosts]);

	useEffect(() => {
		if (inView) {
			if (isLoading) return;
			setIsLoading(true);
			if (gs && gs.walletAddress) {
				explorePost(gs.walletAddress);
			} else {
				console.log('No wallet address');
				explorePost('0x0000000000');
			}
			setIsLoading(false);
		}
	}, [ref, inView]);

	const RowBox = ({ data }: { data?: ExploreType }) => (
		<div className='bg-transparent row-span-2'>
			<div
				className={`bg-transparent row-span-2 aspect-[auto_0.994/2] ${
					gs && gs.walletAddress && 'cursor-pointer'
				}`}
			>
				<PostMedia data={data} />
			</div>
		</div>
	);

	const ColBox = ({ data }: { data?: ExploreType }) => (
		<div className=' bg-transparent col-span-2'>
			<div
				className={`bg-transparent col-span-2 aspect-[auto_2/0.994]  ${
					gs && gs.walletAddress && 'cursor-pointer'
				}`}
			>
				<PostMedia data={data} />
			</div>
		</div>
	);

	const SquareBox = ({ data }: { data?: ExploreType }) => (
		<div
			className={`bg-transparent aspect-square  ${
				gs && gs.walletAddress && 'cursor-pointer'
			}`}
		>
			<PostMedia data={data} />
		</div>
	);
	const getUrl = (data: ExploreType) => {
		const isAnimation = Boolean(data.animationUrl);
		let aniData: { url: string; type: 'video' | 'audio' | 'image' } = {
			url: '',
			type: 'image',
		};

		if (isAnimation) {
			if (VideoMimeType.includes(data?.animationUrlType ?? '')) {
				aniData.url = data?.animationUrl ?? '';
				aniData.type = 'video';
			} else {
				aniData.url = data?.mediaUrl;
				aniData.type = 'audio';
			}
		} else {
			aniData.url = data?.mediaUrl;
			aniData.type = 'image';
		}
		return aniData;
	};

	const PostMedia = ({ data }: { data?: ExploreType }) => {
		if (data) {
			const { url, type } = getUrl(data);
			switch (type) {
				case 'video':
					return (
						<video
							onClick={() =>
								gs &&
								gs.walletAddress &&
								router.push(`/product/${data?.id}`)
							}
							src={url}
							width={100}
							height={100}
							style={{
								objectFit: 'cover',
								width: '100%',
								height: '100%',
							}}
							muted
							loop
							autoPlay
							playsInline
						>
							<source src={url} type='video/mp4' />
						</video>
					);
				case 'audio':
					return (
						<div className='relative'>
							<Image
								onClick={() =>
									gs &&
									gs.walletAddress &&
									router.push(`/product/${data?.id}`)
								}
								draggable='false'
								src={url}
								alt={url}
								width={300}
								height={300}
								style={{
									objectFit: 'cover',
									width: '100%',
									height: '100%',
								}}
							/>
							<div
								className={`absolute top-2 right-3  cursor-pointer  bg-[#ffffff2f] flex items-center justify-center rounded-full p-2`}
							>
								<Image
									draggable='false'
									src='/music.png'
									alt='music'
									width={20}
									height={20}
									className='mr-[1px]'
								/>
							</div>
						</div>
					);

				default:
					return (
						<Image
							onClick={() =>
								gs &&
								gs.walletAddress &&
								router.push(`/product/${data?.id}`)
							}
							onError={(e) => {
								e.currentTarget.src =
									'/emptyState/emptyimg2.svg';
								e.currentTarget.srcset =
									'/emptyState/emptyimg2.svg';
							}}
							src={url}
							alt={url}
							width={300}
							height={300}
							draggable='false'
							style={{
								objectFit: 'cover',
								width: '100%',
								height: '100%',
							}}
						/>
					);
			}
		}
	};

	return (
		<>
			<main className='flex min-h-screen w-full flex-col px-10 pt-5 pb-10'>
				<div className='flex flex-row justify-between mb-5 -mt-2 items-end'>
					<div className='flex-[0.8] flex-row flex items-end gap-4'>
						<BackButton />

						<p className='text-[17px] font-medium'>Explore</p>
					</div>
					<div className='flex-[0.2]'>
						<div className=' flex flex-row items-center gap-1'>
							<Input
								isClearable
								// label='Search'
								// labelPlacement={'outside'}
								size='sm'
								className='flex-1'
								placeholder='Search for a product'
								classNames={{
									base: 'bg-transparent',
									input: 'group-data-[has-value=true]:text-[#F1F0EB] pr-0 placeholder:text-[#6E6E6E] placeholder:italic text-[12px]',
									inputWrapper:
										'group-data-[hover=true]:bg-transparent h-[15px] p-0  group-data-[focus=true]:bg-transparent  rounded-none group-data-[focus=true]:border-b group-data-[focus=true]:border-b-[#FFFFFF] border-b border-b-[#FFFFFF]  bg-transparent',
								}}
								onChange={(e) =>
									setSearchText(
										e.target.value.length > 0
											? e.target.value
											: undefined
									)
								}
								onClear={() => setSearchText(undefined)}
							/>
							<Image
								src={'/search.svg'}
								alt={'search'}
								width={20}
								height={20}
							/>
						</div>
					</div>
				</div>
				<div className='bg-transparent gap-1 justify-evenly h-full grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 grid-flow-dense'>
					{filteredPosts.map((post, i) => {
						// Grid pattern that ensures no adjacent non-square posts and no gaps
						// For xl breakpoint (4 columns)
						if (post.aspectRatio < 0.8) {
							return <RowBox key={i} data={post} />;
						} else if (post.aspectRatio > 1.2) {
							return <ColBox key={i} data={post} />;
						} else {
							return <SquareBox key={i} data={post} />;
						}
					})}
				</div>
				{!isFinished && (
					<div ref={ref} className='w-full mt-24'>
						<ExploreSpinner />
					</div>
				)}
			</main>
			{/* <FeedModal isOpen={isOpen} setIsOpen={setIsOpen} /> */}
		</>
	);
}
