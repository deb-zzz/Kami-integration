import React, { useRef, useEffect, useCallback, useState } from 'react';
import Image from 'next/image';
import { useInView } from 'react-intersection-observer';

interface VideoPlayerProps {
	url: string;
	isMuted: boolean;
	onMuteChange: (muted: boolean) => void;
	onClick: () => void;
	isVideo?: boolean;
	poster?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = React.memo(
	({ url, isMuted, onMuteChange, onClick, isVideo }) => {
		const videoRef = useRef<HTMLVideoElement>(null);
		const audioRef = useRef<HTMLAudioElement>(null);
		const muteStateRef = useRef(isMuted);
		const autoplayTriggeredRef = useRef(false);
		const autoplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
		const originalVolumeRef = useRef<number | null>(null);
		const [isPlaying, setIsPlaying] = useState(false);
		const { ref: containerRef, inView } = useInView({
			threshold: 0.5,
			rootMargin: '0px',
		});

		// Track play/pause state
		useEffect(() => {
			if (isVideo) {
				const video = videoRef.current;
				if (!video) return;

				const handlePlay = () => setIsPlaying(true);
				const handlePause = () => setIsPlaying(false);
				const handleEnded = () => setIsPlaying(false);

				video.addEventListener('play', handlePlay);
				video.addEventListener('pause', handlePause);
				video.addEventListener('ended', handleEnded);

				// Set initial state
				setIsPlaying(!video.paused);

				return () => {
					video.removeEventListener('play', handlePlay);
					video.removeEventListener('pause', handlePause);
					video.removeEventListener('ended', handleEnded);
				};
			} else {
				const audio = audioRef.current;
				if (!audio) return;

				const handlePlay = () => setIsPlaying(true);
				const handlePause = () => setIsPlaying(false);
				const handleEnded = () => setIsPlaying(false);

				audio.addEventListener('play', handlePlay);
				audio.addEventListener('pause', handlePause);
				audio.addEventListener('ended', handleEnded);

				// Set initial state
				setIsPlaying(!audio.paused);

				return () => {
					audio.removeEventListener('play', handlePlay);
					audio.removeEventListener('pause', handlePause);
					audio.removeEventListener('ended', handleEnded);
				};
			}
		}, [isVideo]);

		// Pause when out of view (autoplay disabled)
		useEffect(() => {
			if (isVideo) {
				const video = videoRef.current;
				if (!video) return;

				if (!inView) {
					// Only pause if autoplay has completed or hasn't started
					// This prevents interfering with the 0.5s autoplay
					if (
						autoplayTriggeredRef.current ||
						!autoplayTimeoutRef.current
					) {
						video.pause();
					}
				}
			} else {
				const audio = audioRef.current;
				if (!audio) return;

				if (!inView) {
					audio.pause();
				}
			}
		}, [inView, isVideo]);

		// Handle initial mute state
		useEffect(() => {
			if (isVideo) {
				const video = videoRef.current;
				if (!video) return;
				video.muted = isMuted;
			} else {
				const audio = audioRef.current;
				if (!audio) return;
				audio.muted = isMuted;
			}
			muteStateRef.current = isMuted;
		}, [isMuted, isVideo]);

		// Reset autoplay trigger when URL changes
		useEffect(() => {
			autoplayTriggeredRef.current = false;
			originalVolumeRef.current = null;
			if (autoplayTimeoutRef.current) {
				clearTimeout(autoplayTimeoutRef.current);
				autoplayTimeoutRef.current = null;
			}
		}, [url]);

		// Autoplay first 0.5 seconds on load (videos only)
		useEffect(() => {
			if (!isVideo || autoplayTriggeredRef.current) return;

			const video = videoRef.current;
			if (!video) return;

			// Wait for video to be in view
			if (!inView) return;

			// Store original volume and mute state
			if (originalVolumeRef.current === null) {
				originalVolumeRef.current = video.volume;
			}
			const wasMuted = video.muted;

			// Ensure video is muted for autoplay (browser requirement)
			// Also set volume to 0 to ensure no sound during autoplay
			video.muted = true;
			video.volume = 0;

			const triggerAutoplay = () => {
				if (autoplayTriggeredRef.current || !inView) {
					// Restore original volume and mute state
					if (originalVolumeRef.current !== null) {
						video.volume = originalVolumeRef.current;
					}
					video.muted = wasMuted;
					return;
				}

				// Play the video
				video
					.play()
					.then(() => {
						// Pause after 0.5 seconds
						autoplayTimeoutRef.current = setTimeout(() => {
							if (video && !video.paused) {
								video.pause();
							}
							autoplayTriggeredRef.current = true;
							// Restore original volume and mute state
							if (originalVolumeRef.current !== null) {
								video.volume = originalVolumeRef.current;
							}
							video.muted = wasMuted;
						}, 500);
					})
					.catch((error) => {
						// Ignore autoplay errors (browser restrictions)
						autoplayTriggeredRef.current = true;
						// Restore original volume and mute state
						if (originalVolumeRef.current !== null) {
							video.volume = originalVolumeRef.current;
						}
						video.muted = wasMuted;
						console.log('Autoplay prevented:', error);
					});
			};

			const handleCanPlay = () => {
				if (!autoplayTriggeredRef.current && inView) {
					triggerAutoplay();
				}
			};

			const handleLoadedData = () => {
				if (!autoplayTriggeredRef.current && inView) {
					triggerAutoplay();
				}
			};

			// Try multiple events to catch when video is ready
			// If video is already loaded, trigger immediately
			if (video.readyState >= 2) {
				// HAVE_CURRENT_DATA or higher
				// Use a small delay to ensure everything is set up
				setTimeout(() => {
					if (!autoplayTriggeredRef.current && inView) {
						triggerAutoplay();
					}
				}, 100);
			} else {
				video.addEventListener('canplay', handleCanPlay, {
					once: true,
				});
				video.addEventListener('loadeddata', handleLoadedData, {
					once: true,
				});
			}

			return () => {
				video.removeEventListener('canplay', handleCanPlay);
				video.removeEventListener('loadeddata', handleLoadedData);
				if (autoplayTimeoutRef.current) {
					clearTimeout(autoplayTimeoutRef.current);
					autoplayTimeoutRef.current = null;
				}
				// Restore original volume and mute state on cleanup
				if (originalVolumeRef.current !== null) {
					video.volume = originalVolumeRef.current;
				}
				video.muted = wasMuted;
			};
		}, [isVideo, inView, url]);

		const handlePlayPause = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				if (isVideo) {
					const video = videoRef.current;
					if (!video) return;

					if (video.paused) {
						video.play();
					} else {
						video.pause();
					}
				} else {
					const audio = audioRef.current;
					if (!audio) return;

					if (audio.paused) {
						audio.play();
					} else {
						audio.pause();
					}
				}
			},
			[isVideo]
		);

		const handleMuteToggle = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				if (isVideo) {
					const video = videoRef.current;
					if (!video) return;

					muteStateRef.current = !muteStateRef.current;
					video.muted = muteStateRef.current;
				} else {
					const audio = audioRef.current;
					if (!audio) return;

					muteStateRef.current = !muteStateRef.current;
					audio.muted = muteStateRef.current;
				}

				onMuteChange(muteStateRef.current);
			},
			[onMuteChange, isVideo]
		);

		return (
			<div ref={containerRef} className='relative h-full'>
				{isVideo ? (
					<video
						ref={videoRef}
						onClick={onClick}
						src={url}
						width={100}
						height={100}
						style={{
							objectFit: 'contain',
							width: '100%',
							height: '100%',
						}}
						loop
					>
						<source src={url} type='video/mp4' />
					</video>
				) : (
					<audio
						ref={audioRef}
						onClick={onClick}
						src={url}
						playsInline
						loop
					>
						<source src={url} type='audio/mp3' />
					</audio>
				)}
				{/* Play/Pause Button */}
				<button
					onClick={handlePlayPause}
					className={` absolute -bottom-3 p-2 left-8 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer  bg-[#00000078] flex items-center justify-center rounded-full hover:bg-[#000000aa] transition-colors`}
				>
					{isPlaying ? (
						<Image
							className='cursor-pointer'
							alt='pause'
							draggable='false'
							width={24}
							height={24}
							src={'/product/pauseWhite.svg'}
						/>
					) : (
						<Image
							className='cursor-pointer'
							alt='play'
							draggable='false'
							width={24}
							height={24}
							src={'/product/playCircle.svg'}
						/>
					)}
				</button>
				{/* Mute Button */}
				<button
					onClick={handleMuteToggle}
					className={` ${
						isVideo ? 'right-14' : 'right-3'
					} absolute cursor-pointer bottom-2  p-2 bg-[#00000078] flex items-center justify-center rounded-full`}
				>
					{muteStateRef.current ? (
						<Image
							className='cursor-pointer'
							alt='mute'
							draggable='false'
							width={20}
							height={20}
							src={'/product/mute.svg'}
						/>
					) : (
						<Image
							className='cursor-pointer'
							alt='volume'
							draggable='false'
							width={20}
							height={20}
							src={'/product/volume.svg'}
						/>
					)}
				</button>
			</div>
		);
	}
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
