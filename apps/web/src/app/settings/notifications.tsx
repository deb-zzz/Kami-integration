import { Button, Checkbox } from '@nextui-org/react';

export default function Notifications() {
	const settings = [
		{
			title: 'Follow',
			description:
				'Receive notifications whenever a new user follows you.',
			isChecked: true,
		},
		{
			title: 'Post',
			description:
				'Get updates when your posts receive significant engagement or when achievements related to your posts are recognized on your profile.',
			isChecked: false,
		},
		{
			title: 'Featured',
			description:
				'Be notified when your content is featured or highlighted on the platform, showcasing your achievements to a broader audience.',
			isChecked: false,
		},
		{
			title: 'Playlist',
			description:
				'Receive notifications when someone adds your content to their playlist, or when your playlist gets popular.',
			isChecked: false,
		},
		{
			title: 'In-app Rewards',
			description:
				'Stay updated about rewards earned through the app, such as badges, levels, or other recognition tied to your activities.',
			isChecked: false,
		},
		{
			title: 'Offers',
			description: 'Your achievements will be shown on your profile.',
			isChecked: false,
		},
		{
			title: 'Collections',
			description:
				'	Receive updates when your content is added to collections or when a collection you&#39;re following is updated',
			isChecked: false,
		},
		{
			title: 'Collaborations',
			description:
				'Be notified about collaboration requests, invitations, and updates to ongoing collaborative projects.',
			isChecked: false,
		},
		{
			title: 'Wallet',
			description:
				'Get notifications for transactions in your wallet, including deposits, withdrawals, and other account changes.',
			isChecked: true,
		},
	];
	return (
		<div className='flex flex-col gap-10'>
			<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
				<p className='text-[23px]'>Notifications</p>
			</div>
			<div className='flex flex-col gap-8'>
				{settings.map((item, index) => (
					<Checkbox
						key={index}
						size='sm'
						radius='none'
						classNames={{
							base: 'items-start gap-1',
							label: 'text-[#F1F0EB] -mt-[2px]',
						}}
						isSelected={item.isChecked}
					>
						<div>
							<p className='text-[14px] font-bold'>
								{item.title}
							</p>
							<p className='text-[12px] mt-2'>
								{item.description}
							</p>
						</div>
					</Checkbox>
				))}
			</div>
			<Button
				size='sm'
				variant='flat'
				// onClick={() => setIsEdit(!isEdit)}
				className='bg-[#11FF49] border-none  text-[#1A1A1A] text-[15px] font-bold rounded-[5px] w-1/4 mt-5'
			>
				Update Preference
			</Button>
		</div>
	);
}
