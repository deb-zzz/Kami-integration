'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
	UseFieldArrayReturn,
	Control,
	UseFormSetValue,
	UseFormTrigger,
	UseFormWatch,
	FieldErrors,
	Controller,
} from 'react-hook-form';
import {
	Button,
	Input,
	Textarea,
	Chip,
	Select,
	SelectItem,
	Tooltip,
} from '@nextui-org/react';
import Image from 'next/image';
import { isValidFileFormat, IsImage, IsVideo, IsAudio } from '@/lib/Util';
import { ToastMessage } from '@/components/ToastMessage';
import Tiptap from '@/components/Tiptap';
import { useGlobalState } from '@/lib/GlobalContext';

type BundleProductProps = {
	index: number;
	fieldId: string;

	bundleItem:
		| {
				name: string;
				description?: string;
				ownerDescription: string;
				asset: string;
				category: string;
				assetCover?: string;
		  }
		| undefined;
	isActionDisabled?: boolean;
	control: Control<any>;
	setValue: UseFormSetValue<any>;
	trigger: UseFormTrigger<any>;
	errors: FieldErrors<any>;
	thumbnailMap: Record<string, File | null>;
	setThumbnailMap: React.Dispatch<
		React.SetStateAction<Record<string, File | null>>
	>;
};

export default function BundleProduct({
	index,
	fieldId,

	bundleItem,
	isActionDisabled = false,
	control,
	setValue,
	trigger,
	errors,
	thumbnailMap,
	setThumbnailMap,
}: BundleProductProps) {
	const [gs] = useGlobalState();
	const [categories, setCategories] = useState<
		{ key: number; val: string }[]
	>([]);
	const [tags, setTags] = useState<string[]>([]);
	const [newTag, setNewTag] = useState('');
	const [creators, setCreators] = useState<string[]>([]);
	const [newCreator, setNewCreator] = useState('');
	const [traits, setTraits] = useState<
		{ key: string; value: string; edit?: boolean }[]
	>([]);
	const thumbnailInputRef = useRef<HTMLInputElement>(null);
	const thumbnailFile = thumbnailMap[fieldId] || null;
	const thumbnailUrl = bundleItem?.assetCover || null;
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const audioRef = useRef<HTMLAudioElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);

	// Load categories from global state
	useEffect(() => {
		if (gs && gs.categories) {
			setCategories(
				gs.categories.map((c) => ({ key: c.id, val: c.name }))
			);
		}
	}, [gs?.categories]);

	const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const file = e.target.files[0];
			const url = URL.createObjectURL(file);
			setThumbnailMap((prev) => ({ ...prev, [fieldId]: file }));
			setValue(`bundle.${index}.assetCover`, url);
			trigger(`bundle.${index}.assetCover`);
		}
	};

	const handleThumbnailClick = () => {
		thumbnailInputRef.current?.click();
	};

	const handleAddTag = () => {
		if (newTag.trim() && tags.length < 6) {
			setTags([...tags, newTag.trim()]);
			setNewTag('');
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		setTags(tags.filter((tag) => tag !== tagToRemove));
	};

	const handleAddCreator = () => {
		if (newCreator.trim()) {
			setCreators([...creators, newCreator.trim()]);
			setNewCreator('');
		}
	};

	const handleRemoveCreator = (creatorToRemove: string) => {
		setCreators(creators.filter((creator) => creator !== creatorToRemove));
	};

	const handleAddTrait = () => {
		setTraits([...traits, { key: '', value: '', edit: true }]);
	};

	const handleRemoveTrait = (index: number) => {
		const updatedTraits = traits.filter((_, i) => i !== index);
		setTraits(updatedTraits);
		// If removing the last trait, add a new empty one
		if (updatedTraits.length === 0) {
			setTraits([{ key: '', value: '', edit: true }]);
		}
	};

	const handlePlayPause = () => {
		if (IsAudio(bundleItem?.asset || '')) {
			if (audioRef.current) {
				if (isPlaying) {
					audioRef.current.pause();
				} else {
					audioRef.current.play();
				}
				setIsPlaying(!isPlaying);
			}
		} else if (IsVideo(bundleItem?.asset || '')) {
			if (videoRef.current) {
				if (isPlaying) {
					videoRef.current.pause();
				} else {
					videoRef.current.play();
				}
				setIsPlaying(!isPlaying);
			}
		}
	};

	const handleProgress = () => {
		if (IsAudio(bundleItem?.asset || '')) {
			if (audioRef.current) {
				const current = audioRef.current.currentTime;
				const duration = audioRef.current.duration;
				setProgress(duration ? (current / duration) * 100 : 0);
			}
		} else if (IsVideo(bundleItem?.asset || '')) {
			if (videoRef.current) {
				const current = videoRef.current.currentTime;
				const duration = videoRef.current.duration;
				setProgress(duration ? (current / duration) * 100 : 0);
			}
		}
	};

	const getFilePreview = () => {
		if (!bundleItem?.asset) return null;
		const fileName = bundleItem?.asset || '';

		if (IsImage(fileName)) {
			return (
				<div className='relative w-full h-[300px] rounded-lg overflow-hidden'>
					<Image
						src={bundleItem?.asset}
						alt='Preview'
						fill
						className='object-contain'
					/>
				</div>
			);
		} else if (IsVideo(fileName)) {
			return (
				<div className='relative w-full h-[300px] rounded-lg overflow-hidden bg-black flex items-center justify-center'>
					<video
						ref={videoRef}
						src={bundleItem?.asset}
						className='w-full h-full object-contain'
						onTimeUpdate={handleProgress}
						onEnded={() => setIsPlaying(false)}
					/>
					<button
						onClick={handlePlayPause}
						className='absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors'
					>
						<Image
							src={
								isPlaying
									? '/product/pause.svg'
									: '/product/play.svg'
							}
							alt={isPlaying ? 'Pause' : 'Play'}
							width={60}
							height={60}
						/>
					</button>
				</div>
			);
		} else if (IsAudio(fileName)) {
			return (
				<div className='relative w-full h-[300px] rounded-full overflow-hidden bg-[#323131] flex items-center justify-center border-4 border-[#F1F0EB]'>
					<audio
						ref={audioRef}
						src={bundleItem?.asset}
						onTimeUpdate={handleProgress}
						onEnded={() => setIsPlaying(false)}
					/>
					<button
						onClick={handlePlayPause}
						className='absolute inset-0 flex items-center justify-center'
					>
						<Image
							src={
								isPlaying
									? '/product/pause.svg'
									: '/product/play.svg'
							}
							alt={isPlaying ? 'Pause' : 'Play'}
							width={60}
							height={60}
						/>
					</button>
				</div>
			);
		}
		return null;
	};

	const getThumbnailPreview = () => {
		if (!thumbnailUrl)
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
				src={thumbnailUrl}
				alt='Thumbnail'
				width={128}
				height={128}
				className='w-full h-full object-cover '
			/>
		);
	};

	return (
		<div className='flex flex-row gap-8 w-full'>
			{/* Left Column */}
			<div className='flex flex-col gap-6 w-1/2'>
				{/* Preview Section */}
				<div className='flex flex-col gap-3'>
					<p className='text-[#F1F0EB] font-medium text-[16px]'>
						Preview
					</p>
					<div className='flex flex-col gap-3 border border-[#F1F0EB] rounded-lg bg-[#323131] p-4'>
						{getFilePreview()}
						{/* Progress Bar */}
						{(IsAudio(bundleItem?.asset || '') ||
							IsVideo(bundleItem?.asset || '')) && (
							<input
								type='range'
								min={0}
								max={100}
								value={progress}
								className='w-full h-1 bg-[#6E6E6E] rounded-lg appearance-none cursor-pointer'
								style={{
									background: `linear-gradient(to right, #11FF49 0%, #11FF49 ${progress}%, #6E6E6E ${progress}%, #6E6E6E 100%)`,
								}}
								readOnly
							/>
						)}
						<div className='flex flex-row gap-3 items-center justify-between '>
							<span className='text-[#F1F0EB] text-sm line-clamp-1'>
								{bundleItem?.asset}
							</span>
							{!isActionDisabled && (
								<Button
									size='sm'
									className='text-[#1A1A1A] bg-[#AFAB99] text-[13px] font-semibold rounded-lg w-24 h-7'
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
								<div className='border border-[#9E9E9D]  text-[13px] text-[#9E9E9D] flex items-center pl-2 font-light rounded-lg  w-full flex-1'>
									<Tooltip
										className='bg-black  text-[10px] '
										content={thumbnailUrl?.split('/').pop()}
									>
										<p className='line-clamp-1 '>
											{thumbnailUrl?.split('/').pop()}
										</p>
									</Tooltip>
								</div>
								{!isActionDisabled &&
									!IsImage(thumbnailUrl ?? '') && (
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
							{(errors.bundle as any)?.[index]?.assetCover
								?.message ?? ''}
						</p>
					</div>
				</div>

				{/* Tags Section */}
				<div>
					<p className='text-[#F1F0EB] font-medium text-[16px]'>
						Tags
					</p>
					<Input
						size='sm'
						variant='flat'
						placeholder='+ Add a maximum of 6 tags'
						value={newTag}
						disabled={isActionDisabled}
						className='mt-2'
						classNames={{
							base: 'bg-transparent',
							inputWrapper:
								'text-[#F1F0EB] border-b border-b-[#F1F0EB] rounded-none bg-transparent group-data-[focus=true]:bg-transparent group-data-[hover=true]:bg-transparent p-2 shadow-none',
							input: 'text-[#F1F0EB] text-[16px] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#F1F0EB] placeholder:text-[16px]',
						}}
						onChange={(e) => setNewTag(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								handleAddTag();
							}
						}}
					/>
					<div className='flex flex-row flex-wrap gap-3 mt-3'>
						{tags.map((tag, index) => (
							<Chip
								key={index}
								size='md'
								variant='bordered'
								classNames={{
									base: 'border border-[#F1F0EB] px-2 py-4 rounded-lg',
									content:
										'text-[16px] font-light text-[#F1F0EB] text-center',
									closeButton: 'ml-1 text-[#F1F0EB]',
								}}
								onClose={
									isActionDisabled
										? undefined
										: () => handleRemoveTag(tag)
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
				{/* Creator Section */}
				{/* <div className='flex flex-col gap-3'>
					<p className='text-[#F1F0EB] text-[16px]'>Creator</p>
					<div className='flex flex-col gap-2'>
						{creators.map((creator, index) => (
							<div
								key={index}
								className='flex flex-row gap-2 items-center'
							>
								<Input
									value={creator}
									disabled
									className='flex-1'
									classNames={{
										base: 'bg-transparent',
										input: 'text-[#F1F0EB]',
										inputWrapper:
											'border border-[#F1F0EB] bg-transparent',
									}}
								/>
								{!isActionDisabled && (
									<Button
										isIconOnly
										onClick={() =>
											handleRemoveCreator(creator)
										}
										className='bg-transparent hover:bg-[#323131]'
									>
										<Image
											src='/creator/trashGrey.svg'
											alt='Delete'
											width={20}
											height={20}
										/>
									</Button>
								)}
							</div>
						))}
						{!isActionDisabled && (
							<div className='flex flex-row gap-2 items-center'>
								<Input
									value={newCreator}
									onChange={(e) =>
										setNewCreator(e.target.value)
									}
									placeholder='Choose Creator'
									className='flex-1'
									classNames={{
										base: 'bg-transparent',
										input: 'text-[#F1F0EB] placeholder:text-[#6E6E6E]',
										inputWrapper:
											'border border-[#F1F0EB] bg-transparent',
									}}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											handleAddCreator();
										}
									}}
								/>
								<button
									type='button'
									onClick={handleAddCreator}
									className='text-[#F1F0EB] text-[16px] font-semibold hover:text-[#F1F0EB]/80'
								>
									+ Add Creator
								</button>
							</div>
						)}
					</div>
				</div> */}

				{/* Category Section */}
				<div className='flex flex-col gap-3'>
					<p className='text-[#F1F0EB] text-[16px]'>Category</p>
					<Controller
						name={`bundle.${index}.category`}
						control={control}
						rules={{ required: 'Please choose a category' }}
						render={({ field, fieldState }) => (
							<>
								<Select
									{...field}
									placeholder='Choose a category'
									disabled={isActionDisabled}
									isInvalid={!!fieldState.error}
									variant='bordered'
									classNames={{
										base: 'bg-[#1a1a1a] text-[#F1F0EB]',
										value: 'placeholder:!text-[#6E6E6E] !text-[#F1F0EB] rtl:text-right group-data-[has-value=true]:text-[#F1F0EB] text-[#F1F0EB] text-[16px] ',
										trigger:
											'border border-[#9E9E9D] data-[open=true]:border-[#9E9E9D] data-[focus=true]:border-[#9E9E9D]  data-[hover=true]:border-[#9E9E9D] group-data-[focus=true]:border-[#9E9E9D] rounded-lg',
										popoverContent:
											'bg-[#1a1a1a] border border-[#9E9E9D]',
										selectorIcon:
											'text-[#F1F0EB] h-[20px] w-[20px]',
										listbox: 'text-[#F1F0EB]',
									}}
									onChange={(e) => {
										field.onChange(e);
										trigger(`bundle.${index}.category`);
									}}
								>
									{categories.map((cat) => (
										<SelectItem
											key={cat.key}
											value={cat.val}
										>
											{cat.val}
										</SelectItem>
									))}
								</Select>
								{fieldState.error && (
									<p className='text-red-500 text-[12px] mt-1'>
										{fieldState.error.message}
									</p>
								)}
							</>
						)}
					/>
				</div>

				{/* Product Name */}
				<div className='flex flex-col'>
					<p className='text-[#F1F0EB] text-[16px] mb-3'>
						Product Name
					</p>
					<Controller
						name={`bundle.${index}.name`}
						control={control}
						rules={{ required: 'Name is required' }}
						render={({ field: formField, fieldState }) => (
							<>
								<Input
									{...formField}
									placeholder={`Name your product`}
									disabled={isActionDisabled}
									className='flex-1'
									isInvalid={!!fieldState.error}
									classNames={{
										input: 'text-[#F1F0EB] bg-transparent text-[16px] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] group-data-[focus=true]:bg-transparent',
										inputWrapper: `${
											fieldState.error
												? ' border-red-500 group-data-[focus=true]:border-red-500'
												: ' border-[#9E9E9D] group-data-[focus=true]:border-[#9E9E9D]'
										} border  rounded-lg !bg-transparent   group-data-[focus=true]:!bg-transparent  group-data-[hover=true]:!bg-transparent  p-2 shadow-none'`,
									}}
									onChange={(e) => {
										formField.onChange(e);
										trigger(`bundle.${index}.name`);
									}}
									onBlur={formField.onBlur}
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

				{/* Product Description - Public */}
				<div className='flex flex-col'>
					<p className='text-[#F1F0EB] text-[16px] mb-3'>
						Product Description - Public
						<span className='text-[#9E9E9D] ml-2'>
							(Max. of 500 characters)
						</span>
					</p>
					<Controller
						name={`bundle.${index}.description`}
						control={control}
						render={({ field }) => {
							// Count text characters (strip HTML tags)
							const textContent = field.value
								? field.value.replace(/<[^>]*>/g, '').trim()
								: '';
							const charCount = textContent.length;

							return (
								<>
									{!isActionDisabled ? (
										<Tiptap
											content={field.value || ''}
											onChange={(htmlContent) => {
												// Strip HTML to count characters
												const text = htmlContent
													.replace(/<[^>]*>/g, '')
													.trim();
												if (text.length <= 500) {
													field.onChange(htmlContent);
													trigger(
														`bundle.${index}.description`
													);
												}
											}}
											isLightMode={false}
										/>
									) : (
										<div
											className='border border-[#F1F0EB] rounded-lg bg-transparent p-3 min-h-[100px]'
											dangerouslySetInnerHTML={{
												__html: field.value || '',
											}}
										/>
									)}
									<p className='text-[#6E6E6E] text-[12px] mt-1 text-right'>
										{charCount}/500
									</p>
								</>
							);
						}}
					/>
				</div>

				{/* Product Description - Private */}
				<div className='flex flex-col'>
					<p className='text-[#F1F0EB] text-[16px] mb-3'>
						Product Description - Private
						<span className='text-[#9E9E9D] ml-2'>
							(Max. of 500 characters)
						</span>
					</p>
					<Controller
						name={`bundle.${index}.ownerDescription`}
						control={control}
						rules={{ required: "Owner's description is required" }}
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
													if (text.length <= 500) {
														field.onChange(
															htmlContent
														);
														trigger(
															`bundle.${index}.ownerDescription`
														);
													}
												}}
												isLightMode={false}
											/>
										</div>
									) : (
										<div
											className={`border rounded-lg bg-transparent p-3 min-h-[100px] ${
												fieldState.error
													? 'border-red-500'
													: 'border-[#F1F0EB]'
											}`}
											dangerouslySetInnerHTML={{
												__html: field.value || '',
											}}
										/>
									)}
									<div className='flex flex-row justify-between items-center mt-1'>
										{fieldState.error && (
											<p className='text-red-500 text-[12px]'>
												{fieldState.error.message}
											</p>
										)}
										<p className='text-[#6E6E6E] text-[12px] text-right ml-auto'>
											{charCount}/500
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
													setTraits([
														{
															key: val,
															value: '',
															edit: true,
														},
													]);
												}
											}}
										/>
									</div>
									<div>
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
													setTraits([
														{
															key: '',
															value: val,
															edit: true,
														},
													]);
												}
											}}
										/>
									</div>
									{!isActionDisabled && (
										<button
											onClick={() => {
												setTraits([
													{
														key: '',
														value: '',
														edit: false,
													},
												]);
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
						{traits.map((trait, index) => {
							if (!trait) return null;
							return trait.edit ? (
								<div key={index}>
									<div className='flex flex-row gap-3 mt-3 items-end'>
										<div>
											<Input
												value={trait.key || ''}
												size='md'
												variant='bordered'
												className='mt-2'
												placeholder='eg: Color'
												disabled={isActionDisabled}
												classNames={{
													base: 'bg-transparent',
													input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[16px] font-semibold',
													inputWrapper:
														'border border-[#F1F0EB] group-data-[focus=true]:border-[#F1F0EB] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
												}}
												onValueChange={(val) => {
													const updatedTraits = [
														...traits,
													];
													updatedTraits[index] = {
														...updatedTraits[index],
														key: val,
													};
													setTraits(updatedTraits);
												}}
											/>
										</div>
										<div>
											<Input
												value={trait.value || ''}
												size='md'
												variant='bordered'
												className=' mt-2 '
												placeholder='eg: Red'
												disabled={isActionDisabled}
												classNames={{
													base: 'bg-transparent',
													input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[16px] font-semibold',
													inputWrapper:
														'border border-[#F1F0EB] group-data-[focus=true]:border-[#F1F0EB] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
												}}
												onValueChange={(val) => {
													const updatedTraits = [
														...traits,
													];
													updatedTraits[index] = {
														...updatedTraits[index],
														value: val,
													};
													setTraits(updatedTraits);
												}}
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
													setTraits(updatedTraits);
												}}
												disabled={
													(trait.key?.length ?? 0) <
														2 ||
													(trait.value?.length ?? 0) <
														2
												}
												className={`${
													(trait.key?.length ?? 0) <
														2 ||
													(trait.value?.length ?? 0) <
														2
														? ' bg-[#F1F0EB]/50 opacity-50'
														: 'opacity-100 bg-[#A79755]'
												}  h-fit max-w-[100px] py-2 px-4  text-[16px] font-semibold text-[#F1F0EB] rounded-lg `}
											>
												Add
											</button>
										)}
									</div>
									{((trait.key?.length ?? 0) < 2 ||
										(trait.value?.length ?? 0) < 2) && (
										<p className='text-red-600 mt-1'>
											Type & Name should contain more than
											1 character
										</p>
									)}
								</div>
							) : (
								<div
									key={index}
									className='flex flex-row gap-3 mt-3 items-center'
								>
									<div className='bg-transparent border border-[#6E6E6E]  w-full rounded-lg flex items-center h-fit py-2 px-4'>
										<p className='text-[F1F0EB] text-[16px] font-semibold'>
											{trait.key} : {trait.value}
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
													setTraits(updatedTraits);
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
				</div>
			</div>
		</div>
	);
}
