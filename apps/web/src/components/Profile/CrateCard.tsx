import { useState } from 'react';
import ReactCardFlip from 'react-card-flip';
import Image from 'next/image';

const CrateCard = () => {
	const [isFlipped, setIsFlipped] = useState<boolean>(false);
	const trackList = [
		{ name: `This town ain&#39;s big enough for both of us` },
		{ name: 'Hall of mirrors' },
		{ name: 'Trust in me' },
		{ name: 'This Wheel&#39;s on fire' },
		{ name: 'Strange Fruit' },
		{ name: 'The Passenger' },
		{ name: 'Gun' },
	];
	return (
		<div className='w-full flex justify-center'>
			<ReactCardFlip
				isFlipped={isFlipped}
				flipSpeedFrontToBack={0.5}
				flipSpeedBackToFront={0.5}
				containerStyle={{ width: '700px' }}
			>
				<div
					className=' w-full h-[600px] '
					onClick={() => setIsFlipped((prev) => !prev)}
				>
					<Image
						alt='mute'
						draggable='false'
						layout='fill'
						src={'/product/music.png'}
						className={`object-cover rounded-lg`}
					/>
				</div>
				<div
					className=' w-full h-[600px]  '
					onClick={() => setIsFlipped((prev) => !prev)}
				>
					<div className='h-full'>
						<div className='h-1/4 '>
							<div className='h-full relative'>
								<Image
									alt='mute'
									draggable='false'
									layout='fill'
									src={'/crateBanner.png'}
									className={`object-cover rounded-t-lg `}
								/>
							</div>
						</div>
						<div className='h-3/4 bg-black p-10 rounded-b-lg'>
							<p className='text-[#A79755] text-[15px] uppercase'>
								: Track Listing
							</p>
							<div className='flex flex-col gap-2 mt-4 '>
								{trackList.map((list, i) => {
									return (
										<span
											key={i}
											className='capitalize text-[16px] font-light'
										>
											<span className='mr-5 text-[11px]'>
												{i < 11 ? '0' : ''}
												{i + 1}
											</span>
											{list.name}
										</span>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</ReactCardFlip>
		</div>
	);
};

export default CrateCard;
