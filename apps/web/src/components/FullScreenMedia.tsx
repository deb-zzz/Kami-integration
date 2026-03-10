import { convertIPFSUrl, IsImage } from '@/lib/Util';
import { Modal, ModalBody, ModalContent } from '@nextui-org/react';
import { Dispatch, LegacyRef, SetStateAction } from 'react';
import ReactPlayer from 'react-player';
import Image from 'next/image';
import { VoucherContextType } from '@/types';
import {
	MediaController,
	MediaControlBar,
	MediaTimeRange,
	MediaTimeDisplay,
	MediaVolumeRange,
	MediaPlaybackRateButton,
	MediaPlayButton,
	MediaSeekBackwardButton,
	MediaSeekForwardButton,
	MediaMuteButton,
	MediaFullscreenButton,
} from 'media-chrome/react';

export default function FullScreenMedia({
	isOpen,
	closeFullScreen,
	mediaUrl,
}: {
	isOpen: boolean;
	closeFullScreen: () => void;
	mediaUrl: string;
}) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={() => closeFullScreen()}
			backdrop='opaque'
			size='full'
			className='bg-black shadow-none rounded-none p-0 m-0 h-fit'
			classNames={{
				closeButton:
					'top-0 border-white border-2 text-white hover:bg-black  absolute right-8 top-4 z-20',
				backdrop:
					'bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20',
				base: ' overflow-y-visible',
			}}
		>
			<ModalContent>
				{(onClose) => (
					<ModalBody className='p-0 m-0 h-full z-10 '>
						{/* <ReactPlayer
                        loop={true}
                        url='https://openseauserdata.com/files/9afe11a74bd18b52cb8b75fb7c2e84ce.mp4'
                        controls={true}
                        playing
                        width={'100%'}
                        height={'100%'}
                        style={{
                            objectFit: 'contain',
                        }}
                    /> */}
						{IsImage(mediaUrl ?? '') ? (
							<div className='w-full h-full '>
								<Image
									className='object-contain '
									alt='mute'
									draggable='false'
									layout='fill'
									src={mediaUrl!}
								/>
								<button
									onClick={() => {
										onClose();
									}}
									className={`absolute bottom-2 right-3 cursor-pointer bg-[#00000078]  flex items-center justify-center rounded-full p-2`}
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
							// <ReactPlayer
							// 	ref={playerRef}
							// 	url={playerData?.mediaUrl}
							// 	playing={state.playing}
							// 	controls={true}
							// 	width='100%'
							// 	height='100%'
							// 	onProgress={handleProgress}
							// 	onDuration={handleDuration}
							// 	style={{
							// 		backgroundColor: 'black',
							// 		objectFit: 'contain',
							// 	}}
							// 	onEnded={() =>
							// 		setState((prevState) => ({
							// 			...prevState,
							// 			ended: !prevState.ended,
							// 		}))
							// 	}
							// 	onPlay={() =>
							// 		setState((prevState) => ({
							// 			...prevState,
							// 			ended: false,
							// 		}))
							// 	}
							// />
							<MediaController
								style={{
									width: '100%',
								}}
							>
								<video
									suppressHydrationWarning={true}
									style={{
										width: '100%',
										aspectRatio: 2,
									}}
									slot='media'
									src={convertIPFSUrl(mediaUrl) ?? ''}
									preload='auto'
									muted
									crossOrigin=''
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
									<MediaSeekBackwardButton seekOffset={10} />
									<MediaSeekForwardButton seekOffset={10} />
									<MediaTimeRange />
									<MediaTimeDisplay showDuration />
									<MediaMuteButton />
									<MediaVolumeRange />
									<MediaPlaybackRateButton />
									{/* <MediaFullscreenButton /> */}
									<button
										onClick={() => {
											onClose();
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
						)}
					</ModalBody>
				)}
			</ModalContent>
		</Modal>
	);
}
