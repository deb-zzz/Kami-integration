'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Chip, Input, Textarea, Tooltip } from '@nextui-org/react';
import Image from 'next/image';
import { ToastMessage } from '../ToastMessage';
import { AllProjectType, VoucherContextType } from '@/types';
import { useGlobalState } from '@/lib/GlobalContext';
import { IsAudio, IsImage, IsVideo } from '@/lib/Util';
import {
	Control,
	UseFormSetValue,
	UseFormTrigger,
	UseFormWatch,
	FieldErrors,
} from 'react-hook-form';
import { Controller, useFieldArray } from 'react-hook-form';
import VideoEditorModal from './VideoEditorModal';
import AudioEditorModal from './AudioEditorModal';
import Tiptap from '@/components/Tiptap';

type TraitsType = {
	key: string;
	value: string;
	edit?: boolean;
};

type FormData = {
	name: string;
	description: string;
	tags: string[];
	traits: TraitsType[];
	coverImg?: string;
};

type MainProductProps = {
	file: File;
	project: AllProjectType;
	isActionDisabled: boolean;
	control: Control<FormData>;
	setValue: UseFormSetValue<FormData>;
	trigger: UseFormTrigger<FormData>;
	watch: UseFormWatch<FormData>;
	errors: FieldErrors<FormData>;
	setVoucher: (state: VoucherContextType) => void;
	voucher: VoucherContextType | undefined;
};

const MainProduct = ({
	file,
	project,
	isActionDisabled,
	control,
	setValue,
	trigger,
	watch,
	errors,
	setVoucher,
	voucher,
}: MainProductProps) => {
	const [newTag, setNewTag] = useState('');
	const thumbnailInputRef = useRef<HTMLInputElement>(null);
	const [tag, setTag] = useState<string>(''); // set base tag
	const [collabData, setCollabData] = useState<string[]>([]);
	const isUpdatingTagsRef = useRef<boolean>(false);
	const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

	// Get form values
	const tags = watch('tags') || [];
	const traits = watch('traits') || [];

	const traitsFieldArray = useFieldArray({
		control,
		name: 'traits',
	});

	// Create object URL from file for preview
	useEffect(() => {
		if (file && file instanceof File) {
			const objectUrl = URL.createObjectURL(file);
			setFilePreviewUrl(objectUrl);

			// Set mediaUrl in voucher if not already set
			if (!voucher?.mediaUrl) {
				setVoucher({
					mediaFile: file,
					mediaUrl: objectUrl,
				});
			}

			// Cleanup function
			return () => {
				URL.revokeObjectURL(objectUrl);
			};
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [file]);

	// Trigger validation when component mounts to show errors immediately
	useEffect(() => {
		trigger(); // Validate all fields when MainProduct component mounts
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const arr: string[] = [];
		console.log('Project data:', project);
		if (project?.collaborators && project?.collaborators?.length > 0) {
			const collab = project.collaborators
				.filter((i) => i.status.toLowerCase() === 'accepted')
				.map((i) => i.userProfile.userName);
			arr.push(...collab);
		}
		setCollabData(arr);
	}, [project]);

	// Initialize tags from voucher when component mounts or voucher changes
	useEffect(() => {
		// Skip if we're programmatically updating tags to prevent infinite loop
		if (isUpdatingTagsRef.current) {
			return;
		}

		if (voucher?.tags && voucher.tags.length > 0) {
			// Check if tags are already loaded to prevent duplicates
			const voucherTagStrings = voucher.tags as unknown as string[]; // Cast to string array

			// Only update if tags don't match current state
			const tagsMatch =
				tags.length === voucherTagStrings.length &&
				tags.every((tag) => voucherTagStrings.includes(tag));

			if (!tagsMatch) {
				// Update form value
				setValue('tags', voucherTagStrings);
				// Trigger validation to update button state
				trigger('tags');
			}
		} else if (!voucher?.tags || voucher.tags.length === 0) {
			// Only clear tags if we have current tags but no voucher tags
			if (tags.length > 0) {
				setValue('tags', []);
				// Trigger validation to show error
				trigger('tags');
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [voucher?.tags]);

	const handleThumbnailUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				const file = e.target.files[0];
				setValue('coverImg', file.name);
				// setVoucher({ coverFile: file });
			}
		},
		[setValue, setVoucher]
	);

	const handleThumbnailClick = () => {
		thumbnailInputRef.current?.click();
	};

	const handleAddTag = () => {
		if (newTag.trim() && tags.length < 6) {
			const updatedTags = [...tags, newTag.trim()];
			setValue('tags', updatedTags);
			// setVoucher({ tags: updatedTags as unknown as any });
			setNewTag('');
			trigger('tags');
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		const updatedTags = tags.filter((tag) => tag !== tagToRemove);
		setValue('tags', updatedTags);
		// setVoucher({ tags: updatedTags as unknown as any });
		trigger('tags');
	};

	// Creators are managed from project collaborators, not form state

	const handleAddTrait = () => {
		traitsFieldArray.append({ key: '', value: '', edit: true });
		// Trigger validation after adding trait
		setTimeout(() => {
			trigger('traits');
		}, 0);
	};

	const handleRemoveTrait = (index: number) => {
		traitsFieldArray.remove(index);
		if (traits.length === 1) {
			traitsFieldArray.append({ key: '', value: '', edit: true });
		}
		// Trigger validation after removing trait
		setTimeout(() => {
			trigger('traits');
		}, 0);
	};

	const getFilePreview = () => {
		// Use filePreviewUrl if available (for File objects), otherwise use voucher.mediaUrl
		const previewUrl = filePreviewUrl || voucher?.mediaUrl;
		if (!previewUrl) return null;

		const fileName = file?.name || voucher?.mediaUrl || '';
		const mimeType = file?.type || '';

		if (IsImage(fileName)) {
			return (
				<Image
					src={previewUrl}
					alt='Preview'
					width={300}
					height={200}
					className='w-300 h-auto m-auto '
				/>
			);
		} else if (IsVideo(fileName)) {
			// Get proper MIME type

			return (
				<video
					className='w-300 h-auto  m-auto '
					controls={true}
					preload='metadata'
				>
					<source
						src={previewUrl}
						type={
							'video/' +
								voucher?.mediaUrl
									?.split('.')
									.pop()
									?.toLowerCase() || 'video/mp4'
						}
					/>
					Your browser does not support the video tag.
				</video>
			);
		} else if (IsAudio(fileName)) {
			// Get proper MIME type

			return (
				<audio
					className='w-300 h-auto m-auto '
					controls={true}
					preload='metadata'
				>
					<source
						src={previewUrl}
						type={
							'audio/' +
								voucher?.mediaUrl
									?.split('.')
									.pop()
									?.toLowerCase() || 'audio/mp3'
						}
					/>
					Your browser does not support the audio tag.
				</audio>
			);
		}
	};

	const getThumbnailPreview = () => {
		if (!voucher?.coverUrl)
			return (
				<Image
					src={'/emptyState/emptyimg3.svg'}
					alt='Thumbnail'
					width={50}
					height={50}
					className='w-[50px] h-[50px] object-contain m-auto  '
				/>
			);

		return (
			<Image
				src={voucher?.coverUrl}
				alt='Thumbnail'
				width={128}
				height={128}
				className='w-full h-full object-cover '
			/>
		);
	};

	return (
		<div className='flex flex-row gap-8 w-full border border-[#F1F0EB] rounded-lg p-8'>
			{/* Left Column */}
			<div className='flex flex-col gap-6 w-1/2'>
				{/* Preview Section */}
				<div className='flex flex-col gap-3'>
					<p className='text-[#F1F0EB] font-medium text-[16px] '>
						Preview
					</p>
					<div className='flex flex-col gap-3 border border-[#F1F0EB] rounded-lg bg-[#323131]'>
						<div className='relative '>
							{getFilePreview()}
							{/* <div className='absolute inset-0 flex items-center justify-center'>
							<Button
								isIconOnly
								className='bg-black/50 hover:bg-black/70 rounded-full w-16 h-16'
							>
								<Image
									src='/product/play.svg'
									alt='Play'
									width={24}
									height={24}
								/>
							</Button>
						</div> */}
						</div>

						<div className='flex flex-row gap-3 items-center justify-between px-5 pb-6 pt-4'>
							<span className='text-[#F1F0EB] text-sm line-clamp-1'>
								{voucher?.mediaUrl?.split('/').pop()}
							</span>
							{!isActionDisabled && (
								<Button
									size='sm'
									className='text-[#1A1A1A] bg-[#AFAB99] text-[13px] font-semibold rounded-lg w-24 h-7'
									// onClick={() => {
									// 	if (IsVideo(voucher?.mediaUrl ?? '')) {
									// 		setIsVideoEditorModalOpen(true);
									// 	}
									// 	if (IsAudio(voucher?.mediaUrl ?? '')) {
									// 		setIsAudioEditorModalOpen(true);
									// 	}
									// }}
								>
									Edit
								</Button>
							)}
						</div>
					</div>
				</div>

				{/* Thumbnail Section */}
				<div className='flex flex-col gap-3'>
					<p className='text-[#F1F0EB] font-medium text-[16px] '>
						Thumbnail
					</p>
					<div className='flex flex-row gap-5 items-end'>
						<div className=' w-[150px] h-[150px] bg-[#323131] rounded-lg overflow-hidden relative content-center border border-[#F1F0EB]'>
							{getThumbnailPreview()}
							<input
								ref={thumbnailInputRef}
								type='file'
								className='hidden'
								onChange={handleThumbnailUpload}
								accept='image/*'
							/>
						</div>
						<div className='flex flex-col gap-2 w-2/3'>
							<p className='text-[#9E9E9D] font-light'>
								The cover for your KAMI Digital Object.
								Recommended size is 512 x 512 pixels, with file
								size no larger than 5Mb.
							</p>
							<div className='flex flex-row gap-2 h-10'>
								{/* <Input
								value={thumbnailFile?.name || 'Yellow Mask.png'}
								className='text-[#F1F0EB] w-full'
								variant='bordered'
								size='sm'
							/> */}
								<div className='border border-[#9E9E9D]  text-[13px] text-[#9E9E9D] flex items-center pl-2 font-light rounded-lg  w-full flex-1'>
									<Tooltip
										className='bg-black  text-[10px] '
										content={voucher?.coverUrl
											?.split('/')
											.pop()}
									>
										<p className='line-clamp-1 '>
											{voucher?.coverUrl
												?.split('/')
												.pop()}
										</p>
									</Tooltip>
								</div>
								{!isActionDisabled &&
									!IsImage(voucher?.coverUrl ?? '') && (
										<Button
											isIconOnly
											className=' bg-[#A79755] hover:bg-[#A79755]/80 rounded-lg w-6 h-full'
											onClick={handleThumbnailClick}
										>
											<Image
												src='/uploadIcon.svg'
												alt='Upload'
												width={17}
												height={17}
											/>
										</Button>
									)}
							</div>
						</div>
						<p className='text-red-500 text-[11px] mt-1 ml-1'>
							{errors.coverImg?.message ?? ''}
						</p>
					</div>
				</div>

				{/* Tags Section */}
				<div>
					<p className='text-[#F1F0EB] font-medium text-[16px] '>
						Tags
					</p>
					<Input
						size='sm'
						variant='flat'
						placeholder='+ Add a maximum of 6 tags'
						value={tag}
						disabled={isActionDisabled}
						className='mt-2'
						classNames={{
							base: 'bg-transparent',
							inputWrapper:
								'text-[#F1F0EB] border-b border-b-[#F1F0EB] rounded-none bg-transparent group-data-[focus=true]:bg-transparent group-data-[hover=true]:bg-transparent  p-2 shadow-none',
							input: 'text-[#F1F0EB] text-[16px] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#F1F0EB] placeholder:text-[16px]',
						}}
						onChange={(e) => {
							setTag(e.target.value);
						}}
						onKeyDown={(event: any) => {
							if (event.key === 'Enter') {
								const newTags = event.target.value
									.split(',')
									.map((tag: string) => tag.trim())
									.filter((tag: string) => tag);

								// Validate each tag
								const validatedTags: string[] = [];
								const invalidTags: string[] = [];

								newTags.forEach((tag: string) => {
									// Check if tag contains only alphanumeric characters and spaces
									const alphanumericRegex =
										/^[a-zA-Z0-9\s]+$/;
									if (!alphanumericRegex.test(tag)) {
										invalidTags.push(tag);
										return;
									}

									// Check character count (maximum 30 characters)
									if (tag.length > 30) {
										invalidTags.push(tag);
										return;
									}

									validatedTags.push(tag);
								});

								// Show error messages for invalid tags
								if (invalidTags.length > 0) {
									const hasNonAlphanumeric = invalidTags.some(
										(tag: string) =>
											!/^[a-zA-Z0-9\s]+$/.test(tag)
									);
									const hasExcessCharacters =
										invalidTags.some(
											(tag: string) => tag.length > 30
										);

									if (hasNonAlphanumeric) {
										ToastMessage(
											'warning',
											'Tags can only contain alphanumeric characters and spaces'
										);
									}
									if (hasExcessCharacters) {
										ToastMessage(
											'warning',
											'Each tag must not exceed 30 characters'
										);
									}
								}

								const existingTags = tags;
								const uniqueNewTags = validatedTags.filter(
									(tag: string) => !existingTags.includes(tag)
								);

								if (
									existingTags.length + uniqueNewTags.length >
									6
								) {
									ToastMessage(
										'warning',
										'Maximum of 6 tags allowed'
									);
									uniqueNewTags.splice(
										6 - existingTags.length
									);
								}

								const updatedTags = [
									...existingTags,
									...uniqueNewTags,
								];

								// Set flag to prevent infinite loop
								isUpdatingTagsRef.current = true;

								// Update form value
								setValue('tags', updatedTags);

								// Update voucher
								// setVoucher({
								// 	tags: updatedTags as unknown as any,
								// });

								setTag('');

								// Reset flag after a short delay
								setTimeout(() => {
									isUpdatingTagsRef.current = false;
									// Trigger validation to clear error if tags are added
									trigger('tags');
								}, 100);
							}
						}}
					/>
					<p className='text-red-500 text-[12px] mt-1 ml-1'>
						{errors.tags?.message ?? ''}
					</p>

					<div className='flex flex-row flex-wrap gap-3 mt-3 '>
						{tags?.map((tag, index) => (
							<Chip
								key={index}
								size='md'
								variant='bordered'
								classNames={{
									base: 'border border-[#F1F0EB] px-2 py-4 rounded-lg',
									content:
										'text-[16px] font-light text-[#F1F0EB] text-center ',
									closeButton: 'ml-1  text-[#F1F0EB] ',
								}}
								onClose={
									isActionDisabled
										? undefined
										: () => {
												handleRemoveTag(tag);
										  }
								}
							>
								{tag}
							</Chip>
						))}
					</div>
				</div>
			</div>

			{/* Right Column */}
			<div className='flex flex-col gap-6 w-1/2'>
				{/* Creators Section */}
				<div className='flex flex-col gap-3'>
					<p className='text-[#F1F0EB] text-[16px]'>Creators</p>
					<div className='flex flex-wrap gap-2'>
						{collabData.map((creator: string, index: number) => (
							<Chip
								key={index}
								size='md'
								variant='bordered'
								classNames={{
									base: 'border border-[#6E6E6E] px-2 py-4 rounded-lg bg-[#323131]',
									content:
										'text-[16px] text-[#6E6E6E] text-center ',
								}}
							>
								{creator}
							</Chip>
						))}
					</div>
					{/* <div className='flex gap-2'>
						<Input
							value={newCreator}
							onChange={(e) => setNewCreator(e.target.value)}
							placeholder='Add creator...'
							className='text-[#F1F0EB]'
							variant='bordered'
							size='sm'
						/>
						<Button
							size='sm'
							className='bg-[#11FF49] text-black hover:bg-[#11FF49]/90'
							onClick={handleAddCreator}
							disabled={!newCreator.trim()}
						>
							Add
						</Button>
					</div> */}
				</div>

				{/* Category Section */}
				<div className='flex flex-col gap-3 h-fit'>
					<p className='text-[#F1F0EB] text-[16px]'>Category</p>

					<div className='bg-[#323131] h-10 border border-[#6E6E6E] text-[15px] text-[#6E6E6E] flex items-center pl-2 font-light rounded-lg  w-full'>
						{project?.category?.name}
					</div>
				</div>

				{/* Product Name Section */}
				<div className='flex flex-col'>
					<p className='text-[#F1F0EB] text-[16px] mb-3'>
						Product Name
					</p>

					<Controller
						name='name'
						control={control}
						rules={{ required: 'Product name is required' }}
						render={({ field, fieldState }) => (
							<>
								<Textarea
									{...field}
									placeholder='What do you want to call your product?'
									disabled={isActionDisabled}
									className='text-[#F1F0EB]'
									variant='bordered'
									size='sm'
									maxRows={2}
									classNames={{
										base: 'bg-transparent',
										input: 'text-[#F1F0EB] text-[16px] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E]',
										inputWrapper: fieldState.error
											? 'border border-red-500 rounded-lg bg-transparent group-data-[focus=true]:border-red-500 group-data-[hover=true]:border-red-500 p-2 shadow-none'
											: ' border border-[#F1F0EB] rounded-lg bg-transparent group-data-[focus=true]:border-[#F1F0EB] group-data-[focus=true]:bg-transparent group-data-[hover=true]:bg-transparent  p-2 shadow-none',
									}}
									onChange={(e) => {
										field.onChange(e);
										// setVoucher({
										// 	metadata: {
										// 		...voucher?.metadata,
										// 		name: e.target.value,
										// 	},
										// });
										trigger('name');
									}}
									onBlur={field.onBlur}
								/>
								{fieldState.error && (
									<p className='text-red-500 text-[12px] mt-1 ml-1'>
										{fieldState.error.message}
									</p>
								)}
							</>
						)}
					/>
				</div>

				{/* Product Description Section */}
				<div className='flex flex-col'>
					<p className='text-[#F1F0EB] text-[16px] mb-3'>
						Product Description
						<span className='text-[#9E9E9D] ml-2'>
							(Max. of 1000 characters)
						</span>
					</p>
					<Controller
						name='description'
						control={control}
						rules={{
							required: 'Description is required',
							maxLength: {
								value: 1000,
								message:
									'Description must not exceed 1000 characters',
							},
						}}
						render={({ field, fieldState }) => {
							// Count text characters (strip HTML tags)
							const textContent = field.value
								? field.value.replace(/<[^>]*>/g, '').trim()
								: '';
							const charCount = textContent.length;

							return (
								<>
									{!isActionDisabled ? (
										<div
											className={
												fieldState.error
													? 'border border-red-500 rounded-lg'
													: ''
											}
										>
											<Tiptap
												content={field.value || ''}
												onChange={(htmlContent) => {
													// Strip HTML to count characters
													const text = htmlContent
														.replace(/<[^>]*>/g, '')
														.trim();
													if (text.length <= 1000) {
														field.onChange(
															htmlContent
														);
														trigger('description');
													}
												}}
												isLightMode={false}
												autoFocus={false}
											/>
										</div>
									) : (
										<div
											className={`border rounded-lg bg-transparent p-3 min-h-[150px] ${
												fieldState.error
													? 'border-red-500'
													: 'border-[#F1F0EB]'
											}`}
											dangerouslySetInnerHTML={{
												__html: field.value || '',
											}}
										/>
									)}
									<div className='flex flex-row gap-2 items-center justify-between mt-1 mx-1'>
										<p className='text-red-500 text-[12px] '>
											{fieldState.error?.message ?? ''}
										</p>

										<p className='text-[#6E6E6E] text-[12px] items-end'>
											{charCount}/1000
										</p>
									</div>
								</>
							);
						}}
					/>
				</div>

				{/* Traits Section */}
				<div className='flex flex-col'>
					<p className='text-[#F1F0EB] text-[16px]'>
						Traits{' '}
						<span className='text-[#9E9E9D] ml-2'>
							(Distinctive features to categorise your product)
						</span>
					</p>
					<div className=''>
						{traits.length === 0 && (
							<div className='w-full'>
								<div className='flex flex-row gap-3 mt-3 items-end'>
									<div>
										{/* <p className='text-[#F1F0EB] font-semibold text-[16px]'>
											Type
										</p> */}
										<Input
											size='md'
											variant='bordered'
											className='mt-2'
											placeholder='eg: Color'
											disabled={isActionDisabled}
											classNames={{
												base: 'bg-transparent',
												input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[16px] font-semibold',
												inputWrapper:
													'border border-[#F1F0EB] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
											}}
											onValueChange={(val) => {
												if (val.trim()) {
													traitsFieldArray.append({
														key: val,
														value: '',
														edit: true,
													});
												}
											}}
										/>
									</div>
									<div>
										{/* <p className='text-[#F1F0EB] font-semibold text-[16px] '>
											Name
										</p> */}
										<Input
											size='md'
											variant='bordered'
											className=' mt-2 '
											placeholder='eg: Red'
											disabled={isActionDisabled}
											classNames={{
												base: 'bg-transparent',
												input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[16px] font-semibold',
												inputWrapper:
													'border border-[#F1F0EB] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
											}}
											onValueChange={(val) => {
												if (val.trim()) {
													traitsFieldArray.append({
														key: '',
														value: val,
														edit: true,
													});
												}
											}}
										/>
									</div>
									{!isActionDisabled && (
										<button
											onClick={() => {
												traitsFieldArray.append({
													key: '',
													value: '',
													edit: false,
												});
											}}
											disabled={true}
											className='opacity-50 bg-[#D9D9D9] h-fit max-w-[100px] py-2 px-4 text-[16px] font-semibold text-[#1A1A1A] rounded-lg'
										>
											Add
										</button>
									)}
								</div>
								<p className='text-[#6E6E6E] mt-1'>
									Enter both Type and Name to add a trait
								</p>
							</div>
						)}
						{traitsFieldArray.fields.map((field, index) => {
							const data = traits[index];
							if (!data) return null;
							return data.edit ? (
								<div key={field.id}>
									<div className='flex flex-row gap-3 mt-3 items-end'>
										<div>
											<Controller
												name={`traits.${index}.key`}
												control={control}
												render={({
													field: formField,
												}) => (
													<Input
														value={
															formField.value ||
															''
														}
														size='md'
														variant='bordered'
														className='mt-2'
														placeholder='eg: Color'
														disabled={
															isActionDisabled
														}
														classNames={{
															base: 'bg-transparent',
															input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[16px] font-semibold',
															inputWrapper:
																'border border-[#F1F0EB] group-data-[focus=true]:border-[#F1F0EB] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
														}}
														onValueChange={(
															val
														) => {
															formField.onChange(
																val
															);
														}}
														onBlur={(e) => {
															formField.onBlur();
															// Trigger validation on blur
															trigger(
																`traits.${index}.key`
															);
														}}
													/>
												)}
											/>
										</div>
										<div>
											<Controller
												name={`traits.${index}.value`}
												control={control}
												render={({
													field: formField,
												}) => (
													<Input
														value={
															formField.value ||
															''
														}
														size='md'
														variant='bordered'
														className=' mt-2 '
														placeholder='eg: Red'
														disabled={
															isActionDisabled
														}
														classNames={{
															base: 'bg-transparent',
															input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[16px] font-semibold',
															inputWrapper:
																'border border-[#F1F0EB] group-data-[focus=true]:border-[#F1F0EB] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
														}}
														onValueChange={(
															val
														) => {
															formField.onChange(
																val
															);
														}}
														onBlur={(e) => {
															formField.onBlur();
															// Trigger validation on blur
															trigger(
																`traits.${index}.value`
															);
														}}
													/>
												)}
											/>
										</div>
										{!isActionDisabled && (
											<button
												onClick={() => {
													const updatedTraits = [
														...traits,
													];
													updatedTraits[index] = {
														...updatedTraits[index],
														edit: false,
													};
													setValue(
														'traits',
														updatedTraits
													);
													// setVoucher({
													// 	metadata: {
													// 		...voucher?.metadata,
													// 		attributes:
													// 			updatedTraits
													// 				.filter(
													// 					(t) =>
													// 						t.key &&
													// 						t.value
													// 				)
													// 				.map(
													// 					(
													// 						t
													// 					) => ({
													// 						trait_type:
													// 							t.key,
													// 						value: t.value,
													// 					})
													// 				),
													// 	},
													// });
													// Trigger validation after saving trait
													setTimeout(() => {
														trigger('traits');
													}, 0);
												}}
												disabled={
													(data.key?.length ?? 0) <
														2 ||
													(data.value?.length ?? 0) <
														2
												}
												className={`${
													(data.key?.length ?? 0) <
														2 ||
													(data.value?.length ?? 0) <
														2
														? ' bg-[#F1F0EB]/50 opacity-50'
														: 'opacity-100 bg-[#A79755]'
												}  h-fit max-w-[100px] py-2 px-4  text-[16px] font-semibold text-[#F1F0EB] rounded-lg `}
											>
												Add
											</button>
										)}
										{/* <button className='h-fit max-w-[100px] py-2 px-4 bg-[#D9D9D9] text-[16px] font-semibold text-[#1A1A1A] rounded-lg '>
										Remove
									</button> */}
									</div>
									{((data.key?.length ?? 0) < 2 ||
										(data.value?.length ?? 0) < 2) && (
										<p className='text-red-600 mt-1'>
											Type & Name should contain more than
											1 character
										</p>
									)}
								</div>
							) : (
								<div
									key={field.id}
									className='flex flex-row gap-3 mt-3 items-center'
								>
									<div className='bg-transparent border border-[#6E6E6E]  w-full rounded-lg flex items-center h-fit py-2 px-4'>
										<p className='text-[F1F0EB] text-[16px] font-semibold'>
											{data.key} : {data.value}
										</p>
									</div>
									{!isActionDisabled && (
										<>
											<button
												type='button'
												onClick={() => {
													const updatedTraits = [
														...traits,
													];
													updatedTraits[index] = {
														...updatedTraits[index],
														edit: true,
													};
													setValue(
														'traits',
														updatedTraits
													);
												}}
												className='h-fit max-w-[100px] p-2 bg-[#AFAB99] text-[16px] font-semibold text-[#1A1A1A] rounded-lg '
											>
												<Image
													src={'/edit.svg'}
													alt={'edit'}
													width={25}
													height={25}
												/>
											</button>
											<button
												type='button'
												onClick={() => {
													handleRemoveTrait(index);
													const updatedTraits =
														traits.filter(
															(_, i) =>
																i !== index
														);
													// setVoucher({
													// 	metadata: {
													// 		...voucher?.metadata,
													// 		attributes:
													// 			updatedTraits
													// 				.filter(
													// 					(t) =>
													// 						t.key &&
													// 						t.value
													// 				)
													// 				.map(
													// 					(
													// 						t
													// 					) => ({
													// 						trait_type:
													// 							t.key,
													// 						value: t.value,
													// 					})
													// 				),
													// 	},
													// });
												}}
												className='h-fit max-w-[100px] p-2 bg-[#AFAB99] text-[16px] font-semibold text-[#1A1A1A] rounded-lg '
											>
												<Image
													src={'/creator/trash.svg'}
													alt={'delete'}
													width={25}
													height={25}
												/>
											</button>
										</>
									)}
								</div>
							);
						})}
					</div>

					{!isActionDisabled && (
						<p
							className='text-[#F1F0EB] text-[16px] font-semibold hover:text-[#F1F0EB]/80 justify-start p-0 cursor-pointer mt-5'
							onClick={handleAddTrait}
						>
							+ Add trait
						</p>
					)}
					{errors.traits && (
						<p className='text-red-500 text-sm mt-2'>
							{errors.traits.message}
						</p>
					)}
				</div>
			</div>
		</div>
	);
};

export default MainProduct;
