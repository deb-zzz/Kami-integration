'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
	Button,
	Input,
	Textarea,
	Select,
	SelectItem,
	Chip,
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
} from '@nextui-org/react';
import { toast } from 'react-toastify';
import CreatableSelect from 'react-select/creatable';
import BackButton from '@/components/BackButton';
import { useGlobalState } from '@/lib/GlobalContext';
import { sendEmail } from '@/apihandler/Email';

// Dynamic validation schema factory
const createSchema = (isLoggedIn: boolean) =>
	yup.object({
		email: yup
			.string()
			.email('Please enter a valid email address')
			.required('Email is required'),
		issueTypes: yup
			.array()
			.min(1, 'Please select at least one issue type')
			.required(),
		description: yup
			.string()
			.min(10, 'Description must be at least 10 characters')
			.required(),
	});

type FormData = {
	email: string;
	issueTypes: string[];
	description: string;
};

// Issue type options
const issueTypeOptions = [
	{ value: 'login', label: 'Login' },
	{ value: 'profile', label: 'Profile' },
	{ value: 'publish', label: 'Publish' },
	{ value: 'product', label: 'Product' },
	{ value: 'buy-sell', label: 'Buy / Sell' },
	{ value: 'wallet', label: 'Wallet' },
	{ value: 'socials', label: 'Socials' },
	{ value: 'others', label: 'Others' },
];

export default function ReportPage() {
	const [gs] = useGlobalState();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);
	const [selectedIssueTypes, setSelectedIssueTypes] = useState<string[]>([]);

	// Check if user is logged in
	const isLoggedIn = !!gs?.walletAddress;
	const username = gs?.userId || '';

	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch,
		reset,
	} = useForm<FormData>({
		resolver: yupResolver(createSchema(isLoggedIn)),
		defaultValues: {
			email: gs?.email || '',
			issueTypes: [],
			description: '',
		},
	});

	// Update username when user logs in
	useEffect(() => {
		if (gs && gs?.email) {
			setValue('email', gs?.email || '');
		}
	}, [username, gs, setValue]);

	const watchedIssueTypes = watch('issueTypes');

	const handleIssueTypeChange = (selectedOptions: any) => {
		const values = selectedOptions
			? selectedOptions.map((option: any) => option.value)
			: [];
		setSelectedIssueTypes(values);
		setValue('issueTypes', values);
	};

	const onSubmit = async (data: FormData) => {
		setIsSubmitting(true);

		try {
			// Send bug report
			const response = await sendEmail(
				isLoggedIn ? username : '',
				data.email,
				data.issueTypes,
				data.description
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to send bug report');
			}

			// Show success message
			setShowSuccessModal(true);
			reset();
			setSelectedIssueTypes([]);
			// toast.success('Bug report sent successfully!');
		} catch (error) {
			console.error('Error submitting bug report:', error);
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to send bug report. Please try again.'
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const customSelectStyles = {
		control: (base: any) => ({
			...base,
			borderColor: '#FFFFFF99',
			borderWidth: '0.5px',
			borderRadius: 6,
			color: '#F1F0EB',
			backgroundColor: '#1A1A1A',
		}),
		option: (base: any, state: any) => ({
			...base,
			color: state.isFocused ? 'white' : '#979797',
			backgroundColor: state.isFocused ? '#323131' : '#1A1A1A',
		}),
		multiValue: (base: any) => ({
			...base,
			backgroundColor: '#1A1A1A',
			borderWidth: '0.5px',
			borderColor: '#11FF49',
			paddingLeft: 2,
			color: '#F1F0EB',
		}),
		multiValueLabel: (base: any) => ({ ...base, color: '#f1f0eb' }),
		valueContainer: (base: any) => ({
			...base,
			gap: 4,
			color: '#F1F0EB',
		}),
		input: (base: any) => ({ ...base, color: '#B1B1B1' }),
		menu: (base: any) => ({
			...base,
			backgroundColor: '#1A1A1A',
			border: '1px solid #FFFFFF99',
		}),
	};

	return (
		<div className='min-h-screen bg-[#1A1A1A] p-6'>
			<div className='mb-6'>
				<BackButton />
			</div>
			<div className='max-w-2xl mx-auto'>
				<div className='bg-[#323131] rounded-lg p-8 shadow-lg'>
					<div className='mb-8'>
						<h1 className='text-3xl font-bold text-[#F1F0EB] mb-2'>
							Report a Bug
						</h1>
						<p className='text-[#979797] text-sm'>
							Help us improve KAMI by reporting bugs and issues.
							Your feedback is valuable to us.
						</p>
					</div>

					<form
						onSubmit={handleSubmit(onSubmit)}
						className='space-y-6'
					>
						{/* Username Field - Only show if logged in */}
						{isLoggedIn && (
							<div>
								<label className='block text-[#F1F0EB] text-sm font-medium mb-2'>
									Username *
								</label>
								<p className='italic text-[14px] text-[#9E9E9D]'>
									{username}
								</p>
								{/* <Input
									type='text'
									placeholder='Your username'
									value={username}
									isReadOnly
									classNames={{
										inputWrapper:
											'text-[#F1F0EB] bg-[#1A1A1A] border-[#FFFFFF99] group-data-[hover=true]:bg-[#1A1A1A] group-data-[focus=true]:bg-[#1A1A1A]',
										input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
									}}
									{...register('username')}
								/>
								{errors.username && (
									<p className='text-red-400 text-xs mt-1'>
										{errors.username.message}
									</p>
								)} */}
							</div>
						)}

						{/* Email Field */}
						<div>
							<label className='block text-[#F1F0EB] text-sm font-medium mb-2'>
								Your Email *
							</label>
							{isLoggedIn ? (
								<p className='italic text-[14px] text-[#9E9E9D]'>
									{gs?.email}
								</p>
							) : (
								<Input
									type='email'
									placeholder='your.email@example.com'
									classNames={{
										inputWrapper:
											'text-[#F1F0EB] bg-[#1A1A1A] border-[#FFFFFF99] group-data-[hover=true]:bg-[#1A1A1A] group-data-[focus=true]:bg-[#1A1A1A]',
										input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
									}}
									{...register('email')}
								/>
							)}

							{errors.email && (
								<p className='text-red-400 text-xs mt-1'>
									{errors.email.message}
								</p>
							)}
						</div>

						{/* Issue Types - Multi-select */}
						<div>
							<label className='block text-[#F1F0EB] text-sm font-medium mb-2'>
								Issue Types *
							</label>
							<CreatableSelect
								isMulti
								instanceId='issue-types-select'
								options={issueTypeOptions}
								value={issueTypeOptions.filter((option) =>
									selectedIssueTypes.includes(option.value)
								)}
								onChange={handleIssueTypeChange}
								placeholder='Select issue types...'
								styles={customSelectStyles}
								theme={(theme) => ({
									...theme,
									colors: {
										...theme.colors,
										neutral0: '#1a1a1a',
										primary: '#FFFFFF99',
										primary25: '#9797971a',
										dangerLight: '#DE350B1a',
										primary50: '#97979766',
									},
								})}
								formatCreateLabel={(inputValue) =>
									`Add "${inputValue}"`
								}
							/>
							{errors.issueTypes && (
								<p className='text-red-400 text-xs mt-1'>
									{errors.issueTypes.message}
								</p>
							)}
						</div>

						{/* Description */}
						<div>
							<label className='block text-[#F1F0EB] text-sm font-medium mb-2'>
								Description *
							</label>
							<Textarea
								placeholder='Please describe the bug in detail. Include steps to reproduce, expected behavior, and actual behavior...'
								minRows={6}
								classNames={{
									inputWrapper:
										'bg-[#1A1A1A] border-[#FFFFFF99] group-data-[hover=true]:bg-[#1A1A1A] group-data-[focus=true]:bg-[#1A1A1A]',
									input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
								}}
								{...register('description')}
							/>
							{errors.description && (
								<p className='text-red-400 text-xs mt-1'>
									{errors.description.message}
								</p>
							)}
							<p className='text-[#979797] text-xs mt-1'>
								Minimum 10 characters required
							</p>
						</div>

						{/* Selected Issue Types Display */}
						{selectedIssueTypes.length > 0 && (
							<div>
								<label className='block text-[#F1F0EB] text-sm font-medium mb-2'>
									Selected Issue Types:
								</label>
								<div className='flex flex-wrap gap-2'>
									{selectedIssueTypes.map((type) => (
										<Chip
											key={type}
											size='sm'
											classNames={{
												base: 'bg-[#11FF49] rounded-lg text-[#1A1A1A] font-semibold',
												content:
													'text-[#1A1A1A] font-semibold',
											}}
										>
											{issueTypeOptions.find(
												(opt) => opt.value === type
											)?.label || type}
										</Chip>
									))}
								</div>
							</div>
						)}

						{/* Submit Button */}
						<div className='pt-4'>
							<Button
								type='submit'
								disabled={isSubmitting}
								className='w-full bg-[#11FF49] text-[#1A1A1A] font-bold text-lg py-3 hover:bg-[#0EEF44] transition-colors'
							>
								{isSubmitting
									? 'Submitting...'
									: 'Submit Bug Report'}
							</Button>
						</div>
					</form>

					{/* Contact Information */}
					<div className='mt-8 pt-6 border-t border-[#FFFFFF99]'>
						<p className='text-[#979797] text-sm text-center'>
							Reports will be sent directly to our support team at{' '}
							<a
								href='mailto:support@kamiunlimted.com'
								className='text-[#11FF49] hover:underline'
							>
								support@kamiunlimted.com
							</a>
						</p>
					</div>
				</div>
			</div>

			{/* Success Modal */}
			<Modal
				isOpen={showSuccessModal}
				onOpenChange={setShowSuccessModal}
				classNames={{
					base: 'bg-[#1A1A1A]',
					header: 'border-b border-[#FFFFFF99]',
					body: 'py-6',
				}}
			>
				<ModalContent>
					<ModalHeader className='flex flex-col gap-1'>
						<h2 className='text-xl font-bold text-[#F1F0EB]'>
							Report Submitted Successfully!
						</h2>
					</ModalHeader>
					<ModalBody>
						<p className='text-[#979797]'>
							Thank you for reporting this issue! Your bug report
							has been sent to our support team. We&apos;ll review
							it and get back to you via email if we need more
							information.
						</p>
					</ModalBody>
					<ModalFooter>
						<Button
							color='primary'
							onPress={() => setShowSuccessModal(false)}
							className='bg-[#11FF49] text-[#1A1A1A] font-bold'
						>
							Close
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</div>
	);
}
