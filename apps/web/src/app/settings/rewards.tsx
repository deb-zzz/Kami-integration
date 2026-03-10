import { Button, Checkbox, Input } from '@nextui-org/react';
import Image from 'next/image';
export default function Rewards() {
	return (
		<div className='flex flex-col gap-10'>
			<div>
				<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
					<p className='text-[23px]'>Referral Code</p>
				</div>

				<div className='flex flex-col gap-2 w-1/2 mt-5'>
					<label className='font-bold'>Your Code</label>
					<div className='flex flex-row gap-2 items-start mt-2'>
						<div className='w-full'>
							<Input
								size='sm'
								variant='flat'
								classNames={{
									base: 'bg-transparent',
									inputWrapper:
										'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
									input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
								}}
							/>
							<p className='text-[12px] mt-1 font-light'>
								Share this code to get...
							</p>
						</div>
						<Button
							size='sm'
							variant='flat'
							// onClick={() => setIsEdit(!isEdit)}
							className='bg-[#11FF49] border-none  text-[#1A1A1A]  px-4 rounded-[5px] text-[12px] font-medium ml-5'
						>
							Share Link
						</Button>
					</div>
				</div>
			</div>
			<div>
				<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
					<p className='text-[23px]'>Referrals Reward</p>
				</div>

				<div className='flex flex-col gap-2 w-1/2 mt-5'>
					<label className='font-bold'>Referred accounts</label>
					<div className='flex flex-row gap-2 items-center mt-2'>
						<Image
							alt='link'
							draggable='false'
							width={20}
							height={20}
							src={'/settings/avatarIcon.svg'}
						/>
						<Input
							size='sm'
							variant='flat'
							classNames={{
								base: 'bg-transparent',
								inputWrapper:
									'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
								input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
							}}
						/>
						<Button
							size='sm'
							variant='flat'
							// onClick={() => setIsEdit(!isEdit)}
							className='bg-[#11FF49] border-none  text-[#1A1A1A]  px-4 rounded-[5px] text-[12px] font-medium ml-5'
						>
							Redeem
						</Button>
					</div>
				</div>
			</div>
			<div className='flex flex-col gap-5'>
				<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
					<p className='text-[23px]'>List of Trophies Earned</p>
				</div>

				<Checkbox
					size='sm'
					radius='none'
					classNames={{
						base: 'items-start gap-1',
						label: 'text-[#F1F0EB] -mt-[2px]',
					}}
				>
					<div>
						<p className='text-[14px] font-bold'>
							Show Trophies on my profile{' '}
						</p>
						<p className='text-[12px] mt-2'>
							Your trophies will be shown on your profile.
						</p>
					</div>
				</Checkbox>
				<Badge />
			</div>
		</div>
	);
}

const Badge = () => {
	const dummyBadge = [
		{
			name: 'Top Trader',
			description: 'Achieved 1000+ Likes',
			img: '/profile/badge/trader.svg',
		},
		{
			name: 'Top Artist',
			description: 'Sold 1000+ Posts',
			img: '/profile/badge/artist.svg',
		},
		{
			name: 'Top Fan',
			description: '5000+ Bought Digital Products',
			img: '/profile/badge/fan.svg',
		},
		{
			name: 'Top Collab',
			description: 'Collaborated with 500 Artists',
			img: '/profile/badge/collab.svg',
		},
	];
	return (
		<div className='flex flex-row flex-wrap gap-4 mt-3'>
			{dummyBadge.map((skill, index) => (
				<div key={index} className='w-[75px]'>
					<Image
						src={skill.img}
						alt={skill.name}
						width={30}
						height={30}
						className='m-auto'
					/>
					<div className='flex flex-col gap-1 items-center text-wrap text-center'>
						<p className='text-[10px] text-[#F1F0EB]'>
							{skill.name}
						</p>
						<p className='text-[7px] text-[#F1F0EB]'>
							{skill.description}
						</p>
					</div>
				</div>
			))}
		</div>
	);
};
