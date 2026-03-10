import { useKeenSlider } from 'keen-slider/react';
import 'keen-slider/keen-slider.min.css';
import { useState } from 'react';
import Image from 'next/image';
import { IsImage, IsVideo } from '@/lib/Util';
import { useGlobalState } from '@/lib/GlobalContext';
import { FeedContent } from '@/types';
import FullScreenMedia from '../FullScreenMedia';

export default function Slider({
	data,
	id,
	clickFunction,
	isLevel2 = false,
	isRepost = false,
}: {
	data: FeedContent[];
	id: number;
	clickFunction: (e: number) => void;
	isLevel2?: boolean;
	isRepost?: boolean;
}) {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [global] = useGlobalState();
	const [currentSlide, setCurrentSlide] = useState(0);
	const [loaded, setLoaded] = useState(false);
	const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
		initial: 0,
		slideChanged(slider) {
			setCurrentSlide(slider.track.details.rel);
		},
		created() {
			setLoaded(true);
		},
	});
	const [isHovered, setIsHovered] = useState(false);
	const onMouseEnter = () => setIsHovered(true);
	const onMouseLeave = () => setIsHovered(false);
	const closeFullScreen = () => {
		setIsHovered(false);
		setIsOpen(false);
	};
	return (
		<>
			<div className='relative overflow-hidden'>
				<div
					ref={sliderRef}
					className='keen-slider overflow-hidden'
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				>
					{data.map((item, i) => (
						<div
							key={i}
							className='keen-slider__slide slider-item cursor-pointer relative'
							onClick={() => {
								if (!isOpen) clickFunction(id);
							}}
						>
							{IsImage(item.product?.voucher.mediaUrl ?? '') && (
								<div className='h-fit w-full relative '>
									{item.product?.voucher.mediaUrl && (
										<Image
											alt='mute'
											draggable='false'
											width={1000}
											height={1000}
											src={item.product?.voucher.mediaUrl}
											className={
												isRepost
													? 'rounded-b-md'
													: undefined
											}
											style={{ margin: 'auto' }}
										/>
									)}
								</div>
							)}
							{IsVideo(item.product?.voucher.mediaUrl ?? '') && (
								<video
									className='w-full h-fit m-1'
									loop
									autoPlay
									muted={global?.isFeedMuted ?? true}
								>
									<source
										src={item.product?.voucher.mediaUrl}
										type='video/mp4'
									/>
									<source
										src={item.product?.voucher.mediaUrl}
										type='video/ogg'
									/>
									Your browser does not support the video tag.
								</video>
							)}
							{!isLevel2 && item.product?.voucher.mediaUrl && (
								<>
									{isHovered && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												setIsOpen(true);
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
									<FullScreenMedia
										isOpen={isOpen}
										closeFullScreen={closeFullScreen}
										mediaUrl={
											item.product?.voucher.mediaUrl
										}
									/>
								</>
							)}
						</div>
					))}
				</div>
				{loaded && instanceRef.current && (
					<>
						{currentSlide !== 0 && (
							<Arrow
								left
								onClick={(e: any) =>
									e.stopPropagation() ||
									instanceRef.current?.prev()
								}
								disabled={currentSlide === 0}
							/>
						)}

						{currentSlide !==
							instanceRef.current.track.details.slides.length -
								1 && (
							<Arrow
								onClick={(e: any) =>
									e.stopPropagation() ||
									instanceRef.current?.next()
								}
								disabled={
									currentSlide ===
									instanceRef.current.track.details.slides
										.length -
										1
								}
							/>
						)}
					</>
				)}
			</div>
		</>
	);
}

function Arrow(props: {
	disabled: boolean;
	left?: boolean;
	onClick: (e: any) => void;
}) {
	const disabled = props.disabled ? ' arrow--disabled' : '';
	return (
		<span
			className={`bg-[#e3e3e3a2] absolute top-[50%] -translate-y-1/2 rounded-full p-2 ${
				props.left ? 'left-[15px]' : 'left-auto right-[15px]'
			} ${disabled}`}
		>
			<svg
				onClick={props.onClick}
				className={`w-[20px] h-[20px]  cursor-pointer `}
				xmlns='http://www.w3.org/2000/svg'
				viewBox='0 0 24 24'
			>
				{props.left && (
					<path d='M16.67 0l2.83 2.829-9.339 9.175 9.339 9.167-2.83 2.829-12.17-11.996z' />
				)}
				{!props.left && (
					<path d='M5 3l3.057-3 11.943 12-11.943 12-3.057-3 9-9z' />
				)}
			</svg>
		</span>
	);
}

// {
// 	loaded && instanceRef.current && (
// 		<div className='dots absolute'>
// 			{instanceRef.current.track.details.slides.map((slide) => {
// 				return (
// 					<button
// 						title='ref'
// 						key={slide.abs}
// 						onClick={() => {
// 							instanceRef.current?.moveToIdx(slide.abs);
// 						}}
// 						className={'dot' + (currentSlide === slide.abs ? ' active' : '')}></button>
// 				);
// 			})}
// 		</div>
// 	);
// }
