'use client';

import { formatTime } from '@/lib/Util';
import { Button } from '@nextui-org/react';
import {
	MediaController,
	MediaPlayButton,
	MediaTimeRange,
	MediaVolumeRange,
	MediaControlBar,
	MediaTimeDisplay,
	MediaMuteButton,
} from 'media-chrome/react';
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// import { Music } from 'lucide-react';
import { useEffect, useRef, useState, type FC } from 'react';

interface AudioEditorProps {
	url: string;
	onTrimUpdate: (times: { startTime: number; endTime: number }) => void;
	setIsOpen: (isOpen: boolean) => void;
}

const MAX_TRIM_DURATION = 60; // 1 minute

const AudioEditor: FC<AudioEditorProps> = ({
	url,
	onTrimUpdate,
	setIsOpen,
}) => {
	const [audioSrc, setAudioSrc] = useState('');
	const [duration, setDuration] = useState(0);
	const [startTime, setStartTime] = useState(0);
	const [endTime, setEndTime] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);

	const audioRef = useRef<HTMLAudioElement>(null);
	const timelineRef = useRef<HTMLDivElement>(null);
	const isDraggingRef = useRef<null | 'start' | 'end' | 'range'>(null);
	const dragStartRef = useRef({ x: 0, startTime: 0, endTime: 0 });

	useEffect(() => {
		setAudioSrc(url);
	}, [url]);

	const handleLoadedMetadata = (
		e: React.SyntheticEvent<HTMLAudioElement>
	) => {
		const audio = e.currentTarget;
		const audioDuration = audio.duration;
		setDuration(audioDuration);
		const initialEndTime = Math.min(audioDuration, MAX_TRIM_DURATION);
		setEndTime(initialEndTime);
		onTrimUpdate({ startTime: 0, endTime: initialEndTime });
	};

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const onTimeUpdate = () => {
			setCurrentTime(audio.currentTime);
			if (audio.currentTime < startTime || audio.currentTime > endTime) {
				audio.currentTime = startTime;
				audio.pause();
				setIsPlaying(false);
			}
		};

		const onPlay = () => setIsPlaying(true);
		const onPause = () => setIsPlaying(false);
		const onEnded = () => setIsPlaying(false);

		audio.addEventListener('timeupdate', onTimeUpdate);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('ended', onEnded);

		return () => {
			if (audio) {
				audio.removeEventListener('timeupdate', onTimeUpdate);
				audio.removeEventListener('play', onPlay);
				audio.removeEventListener('pause', onPause);
				audio.removeEventListener('ended', onEnded);
			}
		};
	}, [startTime, endTime]);

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
			newStartTime = Math.max(0, newStartTime);
			if (
				dragStartRef.current.endTime - newStartTime >
				MAX_TRIM_DURATION
			) {
				newStartTime = dragStartRef.current.endTime - MAX_TRIM_DURATION;
			}
			if (newStartTime > newEndTime) {
				newStartTime = newEndTime;
			}
		} else if (isDraggingRef.current === 'end') {
			newEndTime = dragStartRef.current.endTime + deltaSeconds;
			newEndTime = Math.min(duration, newEndTime);
			if (
				newEndTime - dragStartRef.current.startTime >
				MAX_TRIM_DURATION
			) {
				newEndTime = dragStartRef.current.startTime + MAX_TRIM_DURATION;
			}
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
		onTrimUpdate({ startTime: newStartTime, endTime: newEndTime });

		if (audioRef.current) {
			if (
				isDraggingRef.current === 'start' ||
				isDraggingRef.current === 'range'
			) {
				audioRef.current.currentTime = newStartTime;
			} else {
				audioRef.current.currentTime = newEndTime;
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
	const currentPercent =
		duration > 0
			? Math.min(Math.max((currentTime / duration) * 100, 0), 100)
			: 0;

	return (
		<div className='flex flex-col gap-10'>
			<div>
				<div className='w-full rounded-lg flex flex-col items-center justify-center h-[50px]'>
					{audioSrc && (
						<MediaController className='w-full bg-black color-black audio-editor-controller'>
							<audio
								ref={audioRef}
								slot='media'
								src={audioSrc}
								onLoadedMetadata={handleLoadedMetadata}
								className='w-full'
							/>
							<MediaControlBar className='bg-black'>
								<MediaPlayButton
									className='text-black'
									noTooltip
								/>
								<MediaTimeRange />
								<MediaTimeDisplay />
								<MediaMuteButton noTooltip />
								<MediaVolumeRange />
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
						 bg-muted  select-none cursor-pointer'
						onMouseDown={(e) => handleMouseDown(e, 'range')}
					>
						<div className='relative w-full h-full flex overflow-hidden rounded-sm'>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								// key={index}
								src={'/soundwaveblack.png'}
								className='h-full object-fill w-full'
								alt=''
							/>
							{/* {[...Array(3)].map((_, index) => (
								<img
									key={index}
									src={'/soundwaveblack.png'}
									className='h-full object-fill w-full'
									alt=''
								/>
							))} */}
						</div>
						<div className='absolute inset-0 '>
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
									width: `${endPercent - startPercent}%`,
								}}
							>
								<div
									className='absolute -left-[6px] top-0 w-[12px] h-full bg-[#11FF49] cursor-ew-resize rounded-l-sm'
									onMouseDown={(e) => {
										e.stopPropagation();
										handleMouseDown(e, 'start');
									}}
								/>
								<div
									className='absolute  -right-[6px] top-0 w-[12px] h-full bg-[#11FF49] cursor-ew-resize rounded-r-sm'
									onMouseDown={(e) => {
										e.stopPropagation();
										handleMouseDown(e, 'end');
									}}
								/>
							</div>
						</div>
					</div>
				</div>
				<p className='text-[#1A1A1A] font-semibold mt-2'>
					Drag the green bar to select the preview section. Drag the
					ends of the green bar to adjust the duration of the preview
					(10-60 secs).
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

export default AudioEditor;
