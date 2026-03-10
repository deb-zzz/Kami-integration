'use client';

// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { useEffect, useRef, useState, type FC } from 'react';
import {
	MediaController,
	MediaTimeRange,
	MediaControlBar,
	MediaTimeDisplay,
	MediaPlayButton,
	MediaMuteButton,
} from 'media-chrome/react';
import Image from 'next/image';
import { Button } from '@nextui-org/react';

interface VideoEditorProps {
	url: string;
	onTrimUpdate: (times: { startTime: number; endTime: number }) => void;
	setIsOpen: (isOpen: boolean) => void;
}
function formatTime(seconds: number): string {
	if (isNaN(seconds) || seconds < 0) {
		return '00:00.000';
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	const milliseconds = Math.floor(
		(remainingSeconds - Math.floor(remainingSeconds)) * 1000
	);

	return `${String(minutes).padStart(2, '0')}:${String(
		Math.floor(remainingSeconds)
	).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

const MIN_TRIM_DURATION = 10; // 10 seconds
const MAX_TRIM_DURATION = 60; // 1 minute
const DEFAULT_TRIM_DURATION = 30; // 30 seconds
const THUMBNAIL_COUNT = 15;

const VideoEditor: FC<VideoEditorProps> = ({
	url,
	onTrimUpdate,
	setIsOpen,
}) => {
	const [videoSrc, setVideoSrc] = useState('');
	const [thumbnails, setThumbnails] = useState<string[]>([]);
	const [duration, setDuration] = useState(0);
	const [startTime, setStartTime] = useState(0);
	const [endTime, setEndTime] = useState(0);
	const [isLoadingThumbs, setIsLoadingThumbs] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const timelineRef = useRef<HTMLDivElement>(null);
	const isDraggingRef = useRef<null | 'start' | 'end' | 'range'>(null);
	const dragStartRef = useRef({ x: 0, startTime: 0, endTime: 0 });

	useEffect(() => {
		setVideoSrc(url);
	}, [url]);

	const handleLoadedMetadata = (
		e: React.SyntheticEvent<HTMLVideoElement>
	) => {
		const video = e.currentTarget;
		const videoDuration = video.duration;
		setDuration(videoDuration);
		const initialEndTime = Math.min(videoDuration, DEFAULT_TRIM_DURATION);
		setEndTime(initialEndTime);
		// onTrimUpdate({ startTime: 0, endTime: initialEndTime });
		generateThumbnails(video);
	};

	const generateThumbnails = async (videoElement: HTMLVideoElement) => {
		if (!videoElement.videoWidth) return;
		setIsLoadingThumbs(true);
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const newThumbnails: string[] = [];
		const interval = videoElement.duration / THUMBNAIL_COUNT;

		canvas.width = videoElement.videoWidth;
		canvas.height = videoElement.videoHeight;

		videoElement.muted = true;
		const originalTime = videoElement.currentTime;

		for (let i = 0; i < THUMBNAIL_COUNT; i++) {
			const time = i * interval;
			videoElement.currentTime = time;
			await new Promise((resolve) => {
				const onSeeked = () => {
					videoElement.removeEventListener('seeked', onSeeked);
					resolve(true);
				};
				videoElement.addEventListener('seeked', onSeeked);
			});

			ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
			newThumbnails.push(canvas.toDataURL());
		}

		videoElement.currentTime = originalTime;
		videoElement.muted = false;
		setThumbnails(newThumbnails);
		setIsLoadingThumbs(false);
	};
	// const onTrimUpdate = (times: { startTime: number; endTime: number }) => {
	// 	console.log(times);
	// };
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !duration) return;

		let animationFrameId: number | null = null;

		const onTimeUpdate = () => {
			const current = video.currentTime;
			setCurrentTime(current);
			if (current < startTime || current > endTime) {
				video.currentTime = startTime;
				video.pause();
				setIsPlaying(false);
				if (animationFrameId !== null) {
					cancelAnimationFrame(animationFrameId);
					animationFrameId = null;
				}
			}
		};

		const updateCurrentTime = () => {
			if (video && !video.paused && duration > 0) {
				setCurrentTime(video.currentTime);
				animationFrameId = requestAnimationFrame(updateCurrentTime);
			}
		};

		const onPlay = () => {
			setIsPlaying(true);
			updateCurrentTime();
		};
		const onPause = () => {
			setIsPlaying(false);
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
		};
		const onEnded = () => {
			setIsPlaying(false);
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
		};

		// Use both timeupdate and progress events for better updates
		video.addEventListener('timeupdate', onTimeUpdate);
		video.addEventListener('progress', onTimeUpdate);
		video.addEventListener('play', onPlay);
		video.addEventListener('playing', onPlay);
		video.addEventListener('pause', onPause);
		video.addEventListener('ended', onEnded);

		// Also update currentTime immediately
		setCurrentTime(video.currentTime);
		setIsPlaying(!video.paused);
		if (!video.paused) {
			updateCurrentTime();
		}

		return () => {
			if (video) {
				video.removeEventListener('timeupdate', onTimeUpdate);
				video.removeEventListener('progress', onTimeUpdate);
				video.removeEventListener('play', onPlay);
				video.removeEventListener('playing', onPlay);
				video.removeEventListener('pause', onPause);
				video.removeEventListener('ended', onEnded);
			}
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	}, [startTime, endTime, duration]);

	const handleMouseDown = (
		e: React.MouseEvent<HTMLDivElement>,
		handle: 'start' | 'end' | 'range'
	) => {
		isDraggingRef.current = handle;
		dragStartRef.current = { x: e.clientX, startTime, endTime };
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!isDraggingRef.current || !timelineRef.current) return;

		const timelineRect = timelineRef.current.getBoundingClientRect();
		const dx = e.clientX - dragStartRef.current.x;
		const deltaSeconds = (dx / timelineRect.width) * duration;

		let newStartTime = startTime;
		let newEndTime = endTime;

		if (isDraggingRef.current === 'start') {
			newStartTime = dragStartRef.current.startTime + deltaSeconds;
			if (
				dragStartRef.current.endTime - newStartTime <
				MIN_TRIM_DURATION
			) {
				newStartTime = dragStartRef.current.endTime - MIN_TRIM_DURATION;
			}
			if (
				dragStartRef.current.endTime - newStartTime >
				MAX_TRIM_DURATION
			) {
				newStartTime = dragStartRef.current.endTime - MAX_TRIM_DURATION;
			}
			newStartTime = Math.max(0, newStartTime);
			if (newStartTime > newEndTime) {
				newStartTime = newEndTime;
			}
		} else if (isDraggingRef.current === 'end') {
			newEndTime = dragStartRef.current.endTime + deltaSeconds;
			if (
				newEndTime - dragStartRef.current.startTime <
				MIN_TRIM_DURATION
			) {
				newEndTime = dragStartRef.current.startTime + MIN_TRIM_DURATION;
			}
			if (
				newEndTime - dragStartRef.current.startTime >
				MAX_TRIM_DURATION
			) {
				newEndTime = dragStartRef.current.startTime + MAX_TRIM_DURATION;
			}
			newEndTime = Math.min(duration, newEndTime);
			if (newEndTime < newStartTime) {
				newEndTime = newStartTime;
			}
		} else if (isDraggingRef.current === 'range') {
			const trimDuration =
				dragStartRef.current.endTime - dragStartRef.current.startTime;
			newStartTime = dragStartRef.current.startTime + deltaSeconds;
			newEndTime = newStartTime + trimDuration;

			if (newStartTime < 0) {
				newStartTime = 0;
				newEndTime = trimDuration;
			}

			if (newEndTime > duration) {
				newEndTime = duration;
				newStartTime = newEndTime - trimDuration;
			}
		}

		setStartTime(newStartTime);
		setEndTime(newEndTime);
		// onTrimUpdate({ startTime: newStartTime, endTime: newEndTime });

		if (videoRef.current) {
			if (
				isDraggingRef.current === 'start' ||
				isDraggingRef.current === 'range'
			) {
				videoRef.current.currentTime = newStartTime;
			} else {
				videoRef.current.currentTime = newEndTime;
			}
		}
	};

	const handleMouseUp = () => {
		isDraggingRef.current = null;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	};

	const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
	const endPercent = duration > 0 ? (endTime / duration) * 100 : 0;
	const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

	return (
		<div className='space-y-4'>
			<div>
				<div className='w-full h-full aspect-video object-contain'>
					{videoSrc && (
						<MediaController className='w-full h-full bg-black audio-editor-controller'>
							<video
								ref={videoRef}
								slot='media'
								src={videoSrc}
								onLoadedMetadata={handleLoadedMetadata}
								className='object-contain h-full w-full'
								crossOrigin='anonymous'
							/>
							<MediaControlBar className='bg-[#14141e]/70'>
								<MediaPlayButton noTooltip />
								<MediaTimeRange></MediaTimeRange>
								<MediaTimeDisplay></MediaTimeDisplay>
								<MediaMuteButton noTooltip />
							</MediaControlBar>
						</MediaController>
					)}
				</div>
			</div>

			<div>
				<div>
					<div className='flex justify-between text-sm font-mono text-muted-foreground mb-2 mt-4'>
						<span className='text-[#1A1A1A]'>
							Start: {formatTime(startTime)}
						</span>
						<span className='text-[#1A1A1A]'>
							Selected: {formatTime(endTime - startTime)}
						</span>
						<span className='text-[#1A1A1A]'>
							End: {formatTime(endTime)}
						</span>
					</div>
					<div
						ref={timelineRef}
						className='relative  pl-2 pr-2  w-full h-20
						 bg-muted select-none cursor-pointer'
					>
						<div className='relative w-full h-full flex overflow-hidden rounded-sm'>
							{isLoadingThumbs && (
								<div className='w-full h-full flex items-center justify-center text-[#1A1A1A]'>
									Generating thumbnails...
								</div>
							)}
							{!isLoadingThumbs &&
								thumbnails.map((thumb, index) => (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										key={index}
										src={thumb}
										className='h-full object-cover'
										style={{
											width: `${100 / THUMBNAIL_COUNT}%`,
										}}
										alt={`thumbnail-${index}`}
									/>
									// <Image
									// 	key={index}
									// 	src={thumb}
									// 	className='h-full object-cover'
									// 	style={{
									// 		width: `${100 / THUMBNAIL_COUNT}%`,
									// 	}}
									// 	alt={`thumbnail-${index}`}
									// />
								))}
						</div>
						<div className='absolute inset-0'>
							{/* Playback indicator - shows current playback position, always visible */}
							{duration > 0 && (
								<div
									className='absolute top-0 w-0.5 h-full bg-black z-10'
									style={{
										left: `${currentPercent}%`,
										transition: isPlaying
											? 'none'
											: 'left 0.1s linear',
									}}
								>
									<div className='absolute -top-1 -left-1 w-[10px] h-[10px] bg-black rounded-full shadow-md' />
								</div>
							)}
							<div
								className='absolute h-full border-4 border-[#11FF49] bg-[#11FF49]/20 cursor-grab'
								style={{
									left: `${startPercent}%`,
									width: `${Math.min(
										endPercent - startPercent,
										(MAX_TRIM_DURATION / duration) * 100
									)}%`,
								}}
								onMouseDown={(e) => handleMouseDown(e, 'range')}
							>
								<div
									className='absolute -left-[6px] top-0 w-[12px] h-full bg-[#11FF49] cursor-ew-resize rounded-l-sm'
									onMouseDown={(e) => {
										e.stopPropagation();
										handleMouseDown(e, 'start');
									}}
								/>
								<div
									className='absolute -right-[6px] top-0 w-[12px] h-full bg-[#11FF49] cursor-ew-resize rounded-r-sm'
									onMouseDown={(e) => {
										e.stopPropagation();
										handleMouseDown(e, 'end');
									}}
								/>
							</div>
						</div>
					</div>
				</div>
				<p className='text-[#1A1A1A] mt-2 font-semibold'>
					Drag the green bar to select the preview section. Drag the
					ends of the green bar to adjust the duration of the preview
					(10-60 secs)
				</p>
			</div>
			<div className='flex justify-end gap-3'>
				<Button
					variant='light'
					size='md'
					className='text-[#1A1A1A] text-[13px]'
				>
					Cancel
				</Button>
				<Button
					variant='solid'
					size='md'
					className='bg-[#11FF49] text-[13px] font-bold text-[#1a1a1a]  rounded-md'
					onPress={() => {
						onTrimUpdate({ startTime, endTime });
						setIsOpen(false);
					}}
				>
					Confirm
				</Button>
			</div>
		</div>
	);
};

export default VideoEditor;
