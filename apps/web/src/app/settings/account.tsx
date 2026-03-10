import { Button, Checkbox, Input } from '@nextui-org/react';
import Image from 'next/image';
import { useState } from 'react';
export default function Account() {
	const [isVisible, setIsVisible] = useState(false);

	const toggleVisibility = () => setIsVisible(!isVisible);
	return (
		<div className='w-full flex flex-col gap-10'>
			<div className='flex flex-col gap-4 w-1/2'>
				<div>
					<label>Email</label>
					<Input
						size='sm'
						variant='flat'
						className='mt-1'
						classNames={{
							base: 'bg-transparent',
							inputWrapper:
								'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
							input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
						}}
					/>
				</div>
				<div>
					<label>Full Name</label>
					<Input
						size='sm'
						variant='flat'
						className='mt-1'
						classNames={{
							base: 'bg-transparent',
							inputWrapper:
								'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
							input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
						}}
					/>
					<p className='text-[12px] font-light mt-1'>
						This won&#39;t be displayed on your Profile Page.
					</p>
				</div>
				<div className='flex flex-row gap-5 w-3/4 mt-2'>
					<Button
						size='sm'
						variant='flat'
						// onClick={() => setIsEdit(!isEdit)}
						className='bg-[#11FF49] border-none w-full text-[#1A1A1A] text-[15px] font-bold self-center rounded-[5px]'
					>
						Update
					</Button>
					<Button
						size='sm'
						variant='flat'
						// onClick={() => setIsEdit(!isEdit)}
						className='bg-[#323131] border-none w-full text-[#7A7A7A] text-[15px]  self-center rounded-[5px]'
					>
						Delete my account
					</Button>
				</div>
			</div>
			<div>
				<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
					<p className='text-[23px]'>Login & Security</p>
				</div>
				<div className='flex flex-col gap-4 w-1/2 mt-5'>
					<div>
						<label>Current Password</label>
						<Input
							size='sm'
							variant='flat'
							className='mt-1'
							classNames={{
								base: 'bg-transparent',
								inputWrapper:
									'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
								input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
							}}
							endContent={
								<button
									className='focus:outline-none'
									type='button'
									onClick={toggleVisibility}
									aria-label='toggle password visibility'
								>
									{isVisible ? (
										<Image
											alt='eyeOff'
											draggable='false'
											width={20}
											height={20}
											src={'/settings/eyeOffIcon.svg'}
										/>
									) : (
										<Image
											alt='eye'
											draggable='false'
											width={20}
											height={20}
											src={'/settings/eyeIcon.svg'}
										/>
									)}
								</button>
							}
							type={isVisible ? 'text' : 'password'}
						/>
					</div>
					{/* <Image
							alt='link'
							draggable='false'
							width={20}
							height={20}
							src={'/settings/avatarIcon.svg'}
						/> */}
					<div className='flex flex-row gap-5 '>
						<div className='w-full'>
							<label>New Password</label>
							<Input
								size='sm'
								variant='flat'
								className='mt-1'
								classNames={{
									base: 'bg-transparent',
									inputWrapper:
										'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
									input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
								}}
							/>
						</div>
						<div className='w-full'>
							<label>Confirm Password</label>
							<Input
								size='sm'
								variant='flat'
								className='mt-1'
								classNames={{
									base: 'bg-transparent',
									inputWrapper:
										'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
									input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
								}}
							/>
						</div>
					</div>

					<Button
						size='sm'
						variant='flat'
						// onClick={() => setIsEdit(!isEdit)}
						className='bg-[#11FF49] border-none  text-[#1A1A1A] text-[15px] font-bold rounded-[5px] w-[35%] mt-5'
					>
						Save Changes
					</Button>
				</div>
			</div>
			<div>
				<div>
					<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
						<p className='text-[23px]'>Passkeys</p>
					</div>
					<p className='text-[12px] mt-1 font-light'>
						With Passkeys, you can quickly and securely sign in
						using your fingerprint, face or other screen-lock
						method.
					</p>
				</div>
				<div className='w-1/2 mt-5'>
					<label>Manage Devices</label>
					<Input
						size='sm'
						variant='flat'
						className='mt-1'
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
						className='bg-[#11FF49] border-none  text-[#1A1A1A] text-[15px] font-bold rounded-[5px] w-[35%] mt-10'
					>
						Create A Passkey
					</Button>
				</div>
			</div>
		</div>
	);
}
