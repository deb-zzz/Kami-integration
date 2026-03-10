import { Button, Checkbox } from '@nextui-org/react';

export default function PrivacyDisplay() {
	return (
		<div className='flex flex-col gap-10'>
			<div className=' border-b border-b-[#D8DEE4] w-full pb-2 '>
				<p className='text-[23px]'>Display</p>
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
