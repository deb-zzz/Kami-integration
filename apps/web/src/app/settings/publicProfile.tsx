import { Checkbox, Input } from '@nextui-org/react';
import Image from 'next/image';
export default function PublicProfile() {
	return (
		<div className='w-full flex flex-col gap-10'>
			<div className='flex flex-col gap-10'>
				<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
					<p className='text-[23px]'>Visibility</p>
				</div>
				<div className='flex flex-col gap-6'>
					<Checkbox
						size='sm'
						radius='none'
						classNames={{
							base: 'items-start gap-2',
							label: 'text-[#F1F0EB] -mt-[2px]',
						}}
					>
						<div>
							<p className='text-[15px] font-bold'>
								Hide Message{' '}
							</p>
							<p className='text-[12px] mt-2'>
								Enabling this will disable the messaging chat
							</p>
						</div>
					</Checkbox>
					{/* <Checkbox
						size='sm'
						radius='none'
						classNames={{
							base: 'items-start gap-2',
							label: 'text-[#F1F0EB] -mt-[2px]',
						}}
					>
						<div>
							<p className='text-[15px] font-bold'>
								Hide Collaborate Button{' '}
							</p>
							<p className='text-[12px] mt-2'>
								Enabling this will disable the collaborate
								button
							</p>
						</div>
					</Checkbox> */}
					<Checkbox
						size='sm'
						radius='none'
						classNames={{
							base: 'items-start gap-2',
							label: 'text-[#F1F0EB] -mt-[2px]',
						}}
					>
						<div>
							<p className='text-[15px] font-bold'>
								Show Ongoing project
							</p>
							<p className='text-[12px] mt-2'>
								Enabling this will override the default bio
								description with the description below
							</p>
						</div>
					</Checkbox>
				</div>
				<div className='flex flex-col gap-2 w-1/2'>
					<label>Project Description</label>
					<Input
						variant='flat'
						classNames={{
							base: 'bg-transparent',
							inputWrapper:
								'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
							input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
						}}
					/>
				</div>
				<div className='flex flex-col gap-2 w-1/2'>
					<label>Website URL</label>
					<Input
						variant='flat'
						classNames={{
							base: 'bg-transparent',
							inputWrapper:
								'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
							input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
						}}
					/>
				</div>
				<div className='flex flex-col gap-2 w-1/2'>
					<label>Social Accounts</label>
					<div className='flex flex-row gap-2'>
						<Image
							alt='link'
							draggable='false'
							width={16}
							height={16}
							src={'/settings/linkIcon.svg'}
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
					</div>
				</div>
			</div>
			<div>
				<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
					<p className='text-[23px]'>Collaboration settings</p>
				</div>
				<div className='mt-5 '>
					<Checkbox
						size='sm'
						radius='none'
						classNames={{
							base: 'items-start gap-2',
							label: 'text-[#F1F0EB] -mt-[2px]',
						}}
					>
						<div>
							<p className='text-[15px] font-bold'>
								Show “Invite To Collaborate” on my profile
							</p>
							<p className='text-[12px] mt-2'>
								Allowing other users to easily request creative
								partnerships or project collaborations with you.{' '}
							</p>
						</div>
					</Checkbox>
				</div>
			</div>
		</div>
	);
}
