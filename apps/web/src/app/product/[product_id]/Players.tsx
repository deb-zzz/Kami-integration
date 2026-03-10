'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactPlayer, { ReactPlayerProps } from 'react-player';
import Image from 'next/image';
import BaseReactPlayer from 'react-player/base';
import {
	Modal,
	ModalBody,
	ModalContent,
	Select,
	SelectItem,
	Slider,
	useDisclosure,
} from '@nextui-org/react';
import Duration from './Duration';
import { VoucherContextType, VoucherMetadata } from '@/types';
import { convertIPFSUrl, IsAudio, IsImage } from '@/lib/Util';
import { MetaDataParser } from '@/lib/Util';
import {
	MediaControlBar,
	MediaController,
	MediaMuteButton,
	MediaPlaybackRateButton,
	MediaPlayButton,
	MediaSeekBackwardButton,
	MediaSeekForwardButton,
	MediaTimeDisplay,
	MediaTimeRange,
	MediaVolumeRange,
} from 'media-chrome/react';
import { getMimeExtension, getMimeType, isAudio, isImage } from 'mime-detector';

export type PlayerType = {
	animation_url?: string;
	image: string;
	name: string;
	description?: string;
};

export default function Players({
	playerData,
	// name,
	isBundle = false,
}: {
	playerData: VoucherMetadata;
	// name: string | undefined;
	isBundle?: boolean;
}) {
	const data = isBundle ? playerData : MetaDataParser(String(playerData));
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [isClient, setIsClient] = useState<boolean>(false);
	const [isHovered, setIsHovered] = useState<boolean>(false);
	const [isAnimationAudio, setIsAnimationAudio] = useState<boolean>(false);
	const [isMediaImage, setIsMediaImage] = useState<boolean>(false);
	const playerRef = useRef<BaseReactPlayer<ReactPlayerProps>>(null);
	const fullScreenRef = useRef<HTMLVideoElement | null>(null);
	const rotationRef = useRef(null);
	useEffect(() => {
		setIsClient(true);
	}, []);

	// const data = [
	// 	'/product/sticker.png',
	// 	'/product/baju.png',
	// 	'/product/cover.png',
	// 	'/product/doll.png',
	// 	'/product/ticket.png',
	// ];
	const isMusic = false;

	const speedArr = [
		{
			key: '0.5',
			label: 'x0.5',
		},
		{
			key: '0.75',
			label: 'x0.75',
		},

		{
			key: '1',
			label: 'x1',
		},
		{
			key: '1.5',
			label: 'x1.5',
		},
		{
			key: '2',
			label: 'x2',
		},
	];

	const [state, setState] = useState({
		url: null,
		playing: false,
		controls: false,
		muted: false,
		played: 0,
		loaded: 0,
		duration: 0,
		seeking: false,
		ended: false,
		playbackRate: 1.0,
		hidePlay: false,
	});

	const handlePlayPause = () => {
		setState((prevState) => ({
			...prevState,
			playing: !prevState.playing,
		}));
	};
	const handleToggleMuted = () => {
		setState((prevState) => ({
			...prevState,
			muted: !prevState.muted,
		}));
	};
	const handleSeekMouseDown = (e: any) => {
		setState((prevState) => ({
			...prevState,
			seeking: true,
		}));
	};

	const handleSeekChange = (e: any) => {
		setState((prevState) => ({
			...prevState,
			played: parseFloat(e.target.value),
		}));
	};

	const handleSeekMouseUp = (e: any) => {
		setState((prevState) => ({
			...prevState,
			seeking: false,
		}));
		playerRef.current?.seekTo(parseFloat(e.target.value));
	};
	const handleDuration = (duration: number) => {
		setState((prevState) => ({
			...prevState,
			duration: duration,
		}));
	};

	const handleProgress = (e: any) => {
		setState((prevState) => ({
			...prevState,
			played: parseFloat(e.played),
		}));
		// We only want to update time slider if we are not currently seeking
		if (!state.seeking) {
			setState((prevState) => ({
				...prevState,
				state,
			}));
		}
	};

	const handleSpeed = (e: any) => {
		setState((prevState) => ({
			...prevState,
			playbackRate: parseFloat(e.target.value),
		}));
	};

	// const mediaCondition =
	// 	data?.animation_url !== undefined || data?.animation_url !== null
	// 		? data?.animation_url
	// 		: data?.image;

	useEffect(() => {
		checkFileType();
	}, [data]);

	const checkFileType = async () => {
		if (data.animation_url === undefined || data.animation_url === null) {
			setIsMediaImage(true);
			return;
		}
		const url = convertIPFSUrl(data.animation_url);
		if (url) {
			setIsMediaImage(false);
			const fileType = await getMimeType(url);
			if (fileType.includes('audio')) {
				setIsAnimationAudio(true);
			} else {
				setIsAnimationAudio(false);
			}
		}
	};

	// const onReady = useCallback(() => {
	// 	if (fullScreenRef && fullScreenRef.current)
	// 		fullScreenRef?.current.seekTo(state.played, 'seconds');
	// }, [fullScreenRef?.current]);

	const [fullScreenState, setFullScreenState] = useState({
		playing: false,
		played: state.played,
		loaded: 0,
		duration: 0,
		playbackRate: 1.0,
		hidePlay: false,
		ended: false,
		seeking: false,
	});
	const handleFSDuration = (duration: number) => {
		setFullScreenState((prevState) => ({
			...prevState,
			duration: duration,
		}));
	};

	const handleFSProgress = (e: any) => {
		setFullScreenState((prevState) => ({
			...prevState,
			played: parseFloat(e.played),
		}));
		// We only want to update time slider if we are not currently seeking
		if (!fullScreenState.seeking) {
			setFullScreenState((prevState) => ({
				...prevState,
				fullScreenState,
			}));
		}
	};
	const handleFSPlayPause = () => {
		setFullScreenState((prevState) => ({
			...prevState,
			playing: !prevState.playing,
		}));
	};
	const handleFSSeekMouseDown = (e: any) => {
		setFullScreenState((prevState) => ({
			...prevState,
			seeking: true,
		}));
	};

	const handleFSSeekChange = (e: any) => {
		setFullScreenState((prevState) => ({
			...prevState,
			played: parseFloat(e.target.value),
		}));
	};

	const handleFSSeekMouseUp = (e: any) => {
		setFullScreenState((prevState) => ({
			...prevState,
			seeking: false,
		}));
		//fullScreenRef.current?.seekTo(parseFloat(e.target.value));
	};

	useEffect(() => {
		const video = fullScreenRef.current;
		if (!video) return;

		const handleLoaded = () => {
			if (state.played > 0) {
				video.currentTime = state.played * 60;
			}
		};
		video.addEventListener('loadedmetadata', handleLoaded);
		return () => video.removeEventListener('loadedmetadata', handleLoaded);
	}, [isOpen]);
	return (
		<div className=' h-full flex flex-col justify-center '>
			{isClient ? (
				<>
					<div
						className='h-[500px] min-[1600px]:h-[600px] relative bg-black'
						onMouseEnter={() =>
							setState((prevState) => ({
								...prevState,
								hidePlay: false,
							}))
						}
						onMouseLeave={() =>
							setState((prevState) => ({
								...prevState,
								hidePlay: true,
							}))
						}
					>
						{isMediaImage ? (
							<Image
								className='object-contain'
								alt='mute'
								draggable='false'
								layout='fill'
								src={convertIPFSUrl(data?.image) ?? ''}
							/>
						) : (
							<>
								<ReactPlayer
									ref={playerRef}
									url={
										convertIPFSUrl(data?.animation_url) ??
										''
									}
									playing={state.playing}
									controls={false}
									muted={state.muted}
									playbackRate={state.playbackRate}
									width='100%'
									height='100%'
									onProgress={handleProgress}
									onDuration={handleDuration}
									style={{
										backgroundColor: 'black',
										objectFit: 'contain',
									}}
									onEnded={() =>
										setState((prevState) => ({
											...prevState,
											ended: !prevState.ended,
										}))
									}
									onPlay={() =>
										setState((prevState) => ({
											...prevState,
											ended: false,
										}))
									}
								/>
							</>
						)}

						{isAnimationAudio && (
							<div className='h-[400px]  w-[400px]  absolute center-absolute '>
								<Image
									ref={rotationRef}
									alt='mute'
									draggable='false'
									layout='fill'
									src={convertIPFSUrl(data?.image) ?? ''}
									className={`object-cover rounded-full rotation ${
										state.playing && !state.ended
											? ''
											: 'paused'
									}`}
								/>
							</div>
						)}
						{!state.hidePlay && !isMediaImage && (
							<button
								onClick={handlePlayPause}
								className={`absolute cursor-pointer  center-absolute bg-[#ffffff75] flex items-center justify-center rounded-full`}
							>
								{state.playing && !state.ended ? (
									<Image
										alt='pause'
										draggable='false'
										width={120}
										height={120}
										src={'/product/pauseicon.svg'}
									/>
								) : (
									<Image
										alt='play'
										draggable='false'
										width={120}
										height={120}
										src={'/product/playicon.svg'}
									/>
								)}
							</button>
						)}
						{!isAnimationAudio && (
							<button
								onClick={() => {
									onOpen();
									setState((prevState) => ({
										...prevState,
										playing: false,
									}));
								}}
								className={`absolute bottom-5 cursor-pointer right-5 bg-[#ffffff2f] flex items-center justify-center rounded-full p-2`}
							>
								<Image
									alt='mute'
									draggable='false'
									width={20}
									height={20}
									src={'/product/expand.svg'}
								/>
							</button>
						)}
					</div>
					{/* ${
								isHovered ? 'block' : 'hidden'
							} */}
					{!isMediaImage ? (
						<>
							<div className='flex flex-row justify-between items-center mt-3'>
								<p className='text-[20px] font-bold text-[#F1F0EB]'>
									{data.name}
								</p>
								<div className='flex flex-row items-center  gap-4'>
									<div onClick={() => handleToggleMuted()}>
										{state.muted ? (
											<Image
												className='cursor-pointer '
												alt='mute'
												draggable='false'
												width={25}
												height={25}
												src={'/product/mute.svg'}
											/>
										) : (
											<Image
												className='cursor-pointer '
												alt='mute'
												draggable='false'
												width={24}
												height={25}
												src={'/product/volume.svg'}
											/>
										)}
									</div>
									<div>
										<Select
											size='sm'
											className='w-[80px]'
											aria-label='Speed'
											classNames={{
												label: 'group-data-[filled=true]:-translate-y-5 text-[#F1F0EB]',
												popoverContent: 'bg-[#1A1A1A]',
												trigger:
													'bg-[#1A1A1A] border border-[#AFAB994d] data-[hover=true]:bg-[#1A1A1A] ',
												innerWrapper: 'text-[#F1F0EB]',
												value: 'text-[#F1F0EB] text-[13px] group-data-[has-value=true]:text-[#F1F0EB]',
												listboxWrapper:
													'border border-[#AFAB994d] rounded-lg',
											}}
											onChange={handleSpeed}
											defaultSelectedKeys={['1']}
										>
											{speedArr.map((speed) => (
												<SelectItem key={speed.key}>
													{speed.label}
												</SelectItem>
											))}
										</Select>
									</div>
								</div>
							</div>
							<div className='flex flex-col my-4 gap-3'>
								<div className='flex flex-row justify-between'>
									<Duration
										seconds={state.duration * state.played}
									/>
									<Duration seconds={state.duration} />
								</div>
								<input
									type='range'
									min={0}
									max={0.999999}
									step='any'
									value={state.played}
									onMouseDown={handleSeekMouseDown}
									onChange={handleSeekChange}
									onMouseUp={handleSeekMouseUp}
									className='slider'
									style={{ accentColor: 'white' }}
								/>
							</div>
						</>
					) : (
						<p className='text-[20px] font-bold text-[#F1F0EB]  mt-3 capitalize'>
							{data.name}
						</p>
					)}
				</>
			) : (
				<div className='h-[600px] bg-black'></div>
			)}
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				size='full'
				className='bg-black shadow-none rounded-none p-0 m-0'
				hideCloseButton
			>
				<ModalContent>
					{(onClose) => (
						<ModalBody className='  z-10 p-0  justify-center'>
							{isMediaImage ? (
								<div className='relative w-full h-full'>
									<Image
										className='object-contain'
										alt='mute'
										draggable='false'
										layout='fill'
										src={convertIPFSUrl(data.image) ?? ''}
									/>
									<button
										onClick={() => {
											onClose();
										}}
										className={`absolute cursor-pointer bottom-0 right-0  flex items-center justify-center rounded-full p-2`}
									>
										<Image
											alt='mute'
											draggable='false'
											width={20}
											height={20}
											src={'/product/minimize.svg'}
										/>
									</button>
								</div>
							) : (
								<MediaController
									style={{
										width: '100%',
									}}
								>
									<video
										ref={fullScreenRef}
										suppressHydrationWarning={true}
										style={{
											width: '100%',
											// aspectRatio: 2,
										}}
										slot='media'
										src={
											convertIPFSUrl(
												data.animation_url,
											) ?? ''
										}
										preload='auto'
										crossOrigin=''
										className='aspect-[16/9] md:aspect-[1.45] xl: 2xl:aspect-[2]'
									></video>
									{/* <ReactPlayer
																	slot='media'
																	loop={true}
																	src={mediaUrl}
																	controls={false}
																	playing
																	width={'100%'}
																	height={'100%'}
																	style={{
																		objectFit: 'contain',
																	}}
																/> */}
									<MediaControlBar>
										<MediaPlayButton />
										<MediaSeekBackwardButton
											seekOffset={10}
										/>
										<MediaSeekForwardButton
											seekOffset={10}
										/>
										<MediaTimeRange />
										<MediaTimeDisplay
											showDuration
											mediaDuration={
												fullScreenState.duration
											}
											mediaSeekable={[
												fullScreenState.played,
												fullScreenState.duration,
											]}
										/>
										<MediaMuteButton />
										<MediaVolumeRange />
										<MediaPlaybackRateButton />
										{/* <MediaFullscreenButton /> */}
										<button
											onClick={() => {
												onClose();
												const vid =
													fullScreenRef?.current;
												if (!vid) return;

												setState((prevState) => ({
													...prevState,
													played:
														vid.currentTime / 60 ||
														0,
												}));
												playerRef.current?.seekTo(
													vid.currentTime / 60 || 0,
												);
											}}
											className={` cursor-pointer   flex items-center justify-center rounded-full p-2`}
										>
											<Image
												alt='mute'
												draggable='false'
												width={20}
												height={20}
												src={'/product/minimize.svg'}
											/>
										</button>
									</MediaControlBar>
								</MediaController>
								// <div
								// 	className='flex flex-col items-center justify-center relative h-full max-h-[100vh] '
								// 	onMouseEnter={() =>
								// 		setState((prevState) => ({
								// 			...prevState,
								// 			hidePlay: false,
								// 		}))
								// 	}
								// 	onMouseLeave={() =>
								// 		setState((prevState) => ({
								// 			...prevState,
								// 			hidePlay: true,
								// 		}))
								// 	}
								// >
								// 	<ReactPlayer
								// 		ref={fullScreenRef}
								// 		url={data.animation_url}
								// 		playing={fullScreenState.playing}
								// 		playbackRate={
								// 			fullScreenState.playbackRate
								// 		}
								// 		// onReady={onReady}
								// 		onProgress={handleFSProgress}
								// 		onDuration={handleFSDuration}
								// 		onEnded={() =>
								// 			setFullScreenState((prevState) => ({
								// 				...prevState,
								// 				ended: !prevState.ended,
								// 			}))
								// 		}
								// 		height={'100%'}
								// 		width={'88%'}
								// 		style={{
								// 			objectFit: 'contain',
								// 			zIndex: 0,
								// 		}}
								// 	/>
								// 	{!state.hidePlay &&
								// 		!IsImage(mediaCondition) && (
								// 			<button
								// 				onClick={handleFSPlayPause}
								// 				className={`absolute cursor-pointer  center-absolute bg-[#ffffff75] flex items-center justify-center rounded-full`}
								// 			>
								// 				{fullScreenState.playing &&
								// 				!fullScreenState.ended ? (
								// 					<Image
								// 						alt='pause'
								// 						draggable='false'
								// 						width={120}
								// 						height={120}
								// 						src={
								// 							'/product/pauseicon.svg'
								// 						}
								// 					/>
								// 				) : (
								// 					<Image
								// 						alt='play'
								// 						draggable='false'
								// 						width={120}
								// 						height={120}
								// 						src={
								// 							'/product/playicon.svg'
								// 						}
								// 					/>
								// 				)}
								// 			</button>
								// 		)}
								// 	{!state.hidePlay && (
								// 		<div className='absolute bottom-1  bg-[#a7a7a7be]  w-full px-4'>
								// 			<div className='flex flex-row items-center gap-4'>
								// 				<div className=' flex-1 flex flex-col my-4 gap-3'>
								// 					<div className='flex flex-row justify-between text-[#f1f0eb]'>
								// 						<Duration
								// 							seconds={
								// 								fullScreenState.duration *
								// 								fullScreenState.played
								// 							}
								// 						/>
								// 						<Duration
								// 							seconds={
								// 								fullScreenState.duration
								// 							}
								// 						/>
								// 					</div>
								// 					<input
								// 						type='range'
								// 						min={0}
								// 						max={0.999999}
								// 						step='any'
								// 						value={
								// 							fullScreenState.played
								// 						}
								// 						onMouseDown={
								// 							handleFSSeekMouseDown
								// 						}
								// 						onChange={
								// 							handleFSSeekChange
								// 						}
								// 						onMouseUp={
								// 							handleFSSeekMouseUp
								// 						}
								// 						className='slider slider-fullscreen'
								// 						style={{
								// 							accentColor:
								// 								'white',
								// 						}}
								// 					/>
								// 				</div>
								// 				<button
								// 					onClick={() => {
								// 						onClose();
								// 					}}
								// 					className={` cursor-pointer   flex items-center justify-center rounded-full p-2`}
								// 				>
								// 					<Image
								// 						alt='mute'
								// 						draggable='false'
								// 						width={20}
								// 						height={20}
								// 						src={
								// 							'/product/minimize.svg'
								// 						}
								// 					/>
								// 				</button>
								// 			</div>
								// 		</div>
								// 	)}
								// </div>
							)}
						</ModalBody>
					)}
				</ModalContent>
			</Modal>
		</div>
	);
}
