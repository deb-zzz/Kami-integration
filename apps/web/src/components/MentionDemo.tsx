import { MentionTextarea } from '@/components/MentionTextarea';
import { useState } from 'react';

export const MentionDemo = () => {
	const [value, setValue] = useState('');
	const [submittedValue, setSubmittedValue] = useState('');

	const handleSubmit = () => {
		setSubmittedValue(value);
		setValue('');
	};

	return (
		<div className='p-6 bg-black text-white min-h-screen'>
			<div className='max-w-2xl mx-auto'>
				<h1 className='text-2xl font-bold mb-6'>Mention Demo</h1>

				<div className='mb-6'>
					<h2 className='text-lg font-semibold mb-3'>Try typing @ followed by a username:</h2>
					<p className='text-sm text-gray-400 mb-4'>
						- Type @ and wait 1.5 seconds for the dropdown to appear - Use arrow keys to navigate, Enter to select, Escape to
						close - The dropdown will show up to 10 matching users
					</p>

					<MentionTextarea
						placeholder='Type @username to mention someone...'
						walletAddress='demo-wallet-address' // Replace with actual wallet address
						onValueChange={setValue}
						classNames={{
							base: 'bg-[#1a1a1a]',
							input: 'text-white placeholder:text-gray-400',
							inputWrapper: 'border border-gray-600 bg-[#1a1a1a]',
						}}
					/>

					<button onClick={handleSubmit} className='mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'>
						Submit
					</button>
				</div>

				{submittedValue && (
					<div className='mt-6 p-4 bg-[#1a1a1a] rounded-lg border border-gray-600'>
						<h3 className='font-semibold mb-2'>Submitted Text:</h3>
						<p className='text-gray-300'>{submittedValue}</p>
					</div>
				)}
			</div>
		</div>
	);
};
