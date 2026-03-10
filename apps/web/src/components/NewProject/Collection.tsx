'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
	Input,
	Select,
	SelectItem,
	RadioGroup,
	Radio,
} from '@nextui-org/react';
import { useGlobalState } from '@/lib/GlobalContext';
import { getAllCollectionForProfile } from '@/apihandler/Collections';
import { CollectionType } from '@/types';
import Tiptap from '@/components/Tiptap';

type CollectionProps = {
	onCollectionChange?: (data: {
		mode: 'create' | 'existing';
		collectionId?: number;
		name?: string;
		description?: string;
		bannerUrl?: string;
		profileUrl?: string;
	}) => void;
};

export default function Collection({ onCollectionChange }: CollectionProps) {
	const [gs] = useGlobalState();
	const [mode, setMode] = useState<'create' | 'existing'>('create');
	const [collections, setCollections] = useState<CollectionType[]>([]);
	const [selectedCollectionId, setSelectedCollectionId] =
		useState<string>('');
	const [collection, setCollection] = useState<{
		name: string;
		symbol: string;
		description: string;
		bannerUrl: string;
		profileUrl: string;
	}>({
		name: '',
		symbol: '',
		description: '',
		bannerUrl: '',
		profileUrl: '',
	});
	const [bannerFile, setBannerFile] = useState<File | null>(null);
	const [bannerPreview, setBannerPreview] = useState<string | null>(null);
	const [profileFile, setProfileFile] = useState<File | null>(null);
	const [profilePreview, setProfilePreview] = useState<string | null>(null);

	const bannerInputRef = useRef<HTMLInputElement>(null);
	const profileInputRef = useRef<HTMLInputElement>(null);
	const onCollectionChangeRef = useRef(onCollectionChange);

	// Update ref when callback changes
	useEffect(() => {
		onCollectionChangeRef.current = onCollectionChange;
	}, [onCollectionChange]);

	// Fetch collections when mode is 'existing'
	useEffect(() => {
		if (gs?.walletAddress) {
			const fetchCollections = async () => {
				try {
					const result = await getAllCollectionForProfile(
						gs.walletAddress!,
						undefined
					);
					const sortedCollections = (result.collections || []).sort(
						(a, b) => b.createdAt - a.createdAt
					);
					setCollections(sortedCollections);
					console.log('collections', sortedCollections);
				} catch (error) {
					console.error('Error fetching collections:', error);
				}
			};
			fetchCollections();
			// Clear selected collection when switching to existing mode to show empty previews
			setSelectedCollectionId('');
		}
	}, [gs?.walletAddress]);

	// Populate collection data when an existing collection is selected
	useEffect(() => {
		if (
			mode === 'existing' &&
			selectedCollectionId &&
			collections.length > 0
		) {
			const selectedCollection = collections.find(
				(c) => c.collectionId.toString() === selectedCollectionId
			);
			if (selectedCollection) {
				setCollection({
					name: selectedCollection.name || '',
					symbol: selectedCollection.symbol || '',
					description: selectedCollection.description || '',
					bannerUrl: selectedCollection.bannerUrl || '',
					profileUrl: selectedCollection.avatarUrl || '',
				});
				// Set previews for existing images
				if (selectedCollection.bannerUrl) {
					setBannerPreview(selectedCollection.bannerUrl);
				} else {
					setBannerPreview(null);
				}
				if (selectedCollection.avatarUrl) {
					setProfilePreview(selectedCollection.avatarUrl);
				} else {
					setProfilePreview(null);
				}
				// Clear any uploaded files when loading existing collection
				setBannerFile(null);
				setProfileFile(null);
				if (bannerInputRef.current) {
					bannerInputRef.current.value = '';
				}
				if (profileInputRef.current) {
					profileInputRef.current.value = '';
				}
			}
		} else if (mode === 'existing' && !selectedCollectionId) {
			// Reset collection data when no collection is selected - show empty previews
			setCollection({
				name: '',
				symbol: '',
				description: '',
				bannerUrl: '',
				profileUrl: '',
			});
			setBannerPreview(null);
			setProfilePreview(null);
			setBannerFile(null);
			setProfileFile(null);
		} else if (mode === 'create') {
			// Reset everything when switching to create mode
			setSelectedCollectionId('');
			setCollection({
				name: '',
				symbol: '',
				description: '',
				bannerUrl: '',
				profileUrl: '',
			});
			setBannerPreview(null);
			setProfilePreview(null);
			setBannerFile(null);
			setProfileFile(null);
			if (bannerInputRef.current) {
				bannerInputRef.current.value = '';
			}
			if (profileInputRef.current) {
				profileInputRef.current.value = '';
			}
		}
	}, [selectedCollectionId, collections, mode]);

	// Notify parent of changes
	useEffect(() => {
		if (onCollectionChangeRef.current) {
			if (mode === 'existing') {
				onCollectionChangeRef.current({
					mode: 'existing',
					collectionId: selectedCollectionId
						? parseInt(selectedCollectionId)
						: undefined,
					name: selectedCollectionId ? collection.name : undefined,
					description: selectedCollectionId
						? collection.description
						: undefined,
					bannerUrl: selectedCollectionId
						? bannerPreview || collection.bannerUrl
						: undefined,
					profileUrl: selectedCollectionId
						? profilePreview || collection.profileUrl
						: undefined,
				});
			} else {
				onCollectionChangeRef.current({
					mode: 'create',
					name: collection.name,
					description: collection.description,
					bannerUrl: bannerPreview || collection.bannerUrl,
					profileUrl: profilePreview || collection.profileUrl,
				});
			}
		}
	}, [mode, selectedCollectionId, collection, bannerPreview, profilePreview]);

	const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			// Validate file size (5MB = 5 * 1024 * 1024 bytes)
			if (file.size > 5 * 1024 * 1024) {
				alert('File size must be less than 5MB');
				return;
			}
			setBannerFile(file);
			setBannerPreview(URL.createObjectURL(file));
		}
	};

	const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			// Validate file size (5MB = 5 * 1024 * 1024 bytes)
			if (file.size > 5 * 1024 * 1024) {
				alert('File size must be less than 5MB');
				return;
			}
			setProfileFile(file);
			setProfilePreview(URL.createObjectURL(file));
		}
	};

	const handleBannerClick = () => {
		bannerInputRef.current?.click();
	};

	const handleProfileClick = () => {
		profileInputRef.current?.click();
	};

	const handleRemoveBanner = () => {
		setBannerFile(null);
		// In existing mode, restore from collection data instead of clearing
		if (mode === 'existing' && collection.bannerUrl) {
			setBannerPreview(collection.bannerUrl);
		} else {
			setBannerPreview(null);
		}
		if (bannerInputRef.current) {
			bannerInputRef.current.value = '';
		}
	};

	const handleRemoveProfile = () => {
		setProfileFile(null);
		// In existing mode, restore from collection data instead of clearing
		if (mode === 'existing' && collection.profileUrl) {
			setProfilePreview(collection.profileUrl);
		} else {
			setProfilePreview(null);
		}
		if (profileInputRef.current) {
			profileInputRef.current.value = '';
		}
	};

	return (
		<div className='flex flex-col gap-6 w-full mt-10'>
			<h2 className='text-[#F1F0EB] text-[20px] font-semibold'>
				Collection
			</h2>
			{/* Radio Button Options */}
			<RadioGroup
				value={mode}
				onValueChange={(value) =>
					setMode(value as 'create' | 'existing')
				}
				classNames={{
					base: 'gap-4',
					wrapper: 'gap-4',
				}}
			>
				{/* Add to Existing Collection Page */}
				<Radio
					value='existing'
					classNames={{
						base: 'items-start gap-3',
						wrapper:
							'mt-1 group-data-[selected=true]:border-[#F1F0EB] ',
						label: 'flex-1 text-[#F1F0EB]',
						control: ' border-[#F1F0EB] bg-[#F1F0EB]',
					}}
				>
					<div className='flex flex-col gap-2 flex-1'>
						<span className='text-[#F1F0EB] text-[16px] font-medium'>
							Add to Existing Collection Page
						</span>
					</div>
				</Radio>
				{/* Create New Collection Page */}
				<Radio
					value='create'
					classNames={{
						base: 'items-start gap-3  ',
						wrapper:
							'mt-1 group-data-[selected=true]:border-[#F1F0EB] ',
						label: 'flex-1 text-[#F1F0EB]',
						control: ' border-[#F1F0EB] bg-[#F1F0EB]',
					}}
				>
					<div className='flex flex-col gap-2 flex-1'>
						<span className='text-[#F1F0EB] text-[16px] font-medium'>
							Create New Collection Page
						</span>
						<p className='text-[#9E9E9D] text-[13px] font-light'>
							Organise your products into Collections for better
							housekeeping and amplify discoverability.
						</p>
					</div>
				</Radio>
			</RadioGroup>

			{/* Unified Content - Values change based on mode */}
			<div className='flex flex-col gap-6'>
				{/* Collection Selector - Only shown in existing mode */}
				{mode === 'existing' && (
					<div className='flex flex-col gap-2'>
						<label className='text-[#F1F0EB] text-[16px] font-medium'>
							Select Collection
						</label>
						<Select
							selectedKeys={
								selectedCollectionId
									? [selectedCollectionId]
									: []
							}
							onSelectionChange={(keys) => {
								const selected = Array.from(keys)[0] as string;
								setSelectedCollectionId(selected || '');
							}}
							placeholder='Choose a collection'
							variant='bordered'
							classNames={{
								base: 'bg-[#1a1a1a] text-[#F1F0EB]',
								value: 'placeholder:!text-[#6E6E6E] rtl:text-right group-data-[has-value=true]:text-[#F1F0EB] text-[#F1F0EB] text-[16px] ',
								trigger:
									'border border-[#9E9E9D] data-[open=true]:border-[#9E9E9D] data-[focus=true]:border-[#9E9E9D]  data-[hover=true]:border-[#9E9E9D] group-data-[focus=true]:border-[#9E9E9D] rounded-lg',
								popoverContent:
									'bg-[#1a1a1a] border border-[#9E9E9D]',
								selectorIcon:
									'text-[#F1F0EB] h-[20px] w-[20px]',
								listbox: 'text-[#F1F0EB]',
							}}
						>
							{collections.map((collection) => (
								<SelectItem
									key={collection.collectionId.toString()}
									value={collection.collectionId.toString()}
								>
									{collection.name}
								</SelectItem>
							))}
						</Select>
					</div>
				)}

				{/* Collection Banner */}
				<div className='flex flex-col gap-2'>
					<div
						className='relative w-full border border-[#F1F0EB] overflow-hidden cursor-pointer group transition-all'
						onClick={handleBannerClick}
					>
						<input
							ref={bannerInputRef}
							type='file'
							accept='image/*'
							className='hidden'
							onChange={handleBannerUpload}
						/>
						{bannerPreview ? (
							<div className='relative w-full aspect-[1340/300]'>
								<Image
									src={bannerPreview}
									alt='Collection Banner'
									fill
									className='object-cover'
								/>
								<button
									type='button'
									onClick={(e) => {
										e.stopPropagation();
										handleRemoveBanner();
									}}
									className='absolute top-2 right-2 p-2 bg-[#AFAB99] rounded-lg hover:bg-[#AFAB99] transition-colors'
								>
									<Image
										src='/creator/trash.svg'
										alt='Remove'
										width={18}
										height={18}
									/>
								</button>
								<div className='absolute top-2 right-12 p-2 bg-[#AFAB99] rounded-lg hover:bg-[#AFAB99] transition-colors'>
									<Image
										src='/edit.svg'
										alt='Edit'
										width={18}
										height={18}
									/>
								</div>
							</div>
						) : (
							<div className='w-full aspect-[1340/300] flex flex-col items-center justify-center gap-3 bg-[#1A1A1A]'>
								<div className='flex items-center justify-center'>
									<Image
										src='/emptyState/emptyimg3.svg'
										alt='empty'
										width={60}
										height={60}
									/>
								</div>
								<div className='flex flex-col items-center italic  text-[#6E6E6E] text-[14px] font-light'>
									<p>Collection Banner</p>
									<p>1340 x 300 pixels</p>
									<p>less than 5Mb</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Collection Profile Photo and Form Fields */}
				<div className='flex flex-row gap-6 items-end '>
					{/* Collection Profile Photo */}
					<div className='flex flex-col gap-2'>
						<div
							className='relative w-[250px] h-[250px] border border-[#F1F0EB] overflow-hidden cursor-pointer group  transition-all'
							onClick={handleProfileClick}
						>
							<input
								ref={profileInputRef}
								type='file'
								accept='image/*'
								className='hidden'
								onChange={handleProfileUpload}
							/>
							{profilePreview ? (
								<div className='relative w-full h-full'>
									<Image
										src={profilePreview}
										alt='Collection Profile Photo'
										fill
										className='object-cover'
									/>
									<button
										type='button'
										onClick={(e) => {
											e.stopPropagation();
											handleRemoveProfile();
										}}
										className='absolute top-2 right-2 p-2 bg-[#AFAB99] rounded-lg hover:bg-[#AFAB99] transition-colors'
									>
										<Image
											src='/creator/trash.svg'
											alt='Remove'
											width={18}
											height={18}
										/>
									</button>
									<div className='absolute top-2 right-12 p-2 bg-[#AFAB99] rounded-lg hover:bg-[#AFAB99] transition-colors'>
										<Image
											src='/edit.svg'
											alt='Edit'
											width={18}
											height={18}
										/>
									</div>
								</div>
							) : (
								<div className='w-full h-full flex flex-col items-center justify-center gap-3 bg-[#1A1A1A]'>
									<div className='w-20 h-20 flex items-center justify-center'>
										<Image
											src='/emptyState/emptyimg3.svg'
											alt='empty'
											width={60}
											height={60}
										/>
									</div>
									<div className='flex flex-col items-center italic  text-[#6E6E6E] text-[14px] font-light'>
										<p>Collection Profile Photo</p>
										<p>250 x 250 pixels</p>
										<p>less than 5Mb</p>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Collection Name and Description */}
					<div className='flex-1 flex flex-col gap-4'>
						<div className='flex flex-col gap-2'>
							<label className='text-[#F1F0EB] text-[16px] font-medium'>
								Collection Name
							</label>
							<Input
								value={collection.name}
								onChange={(e) =>
									setCollection({
										...collection,
										name: e.target.value,
									})
								}
								placeholder='Enter collection name'
								variant='bordered'
								classNames={{
									base: 'bg-transparent',
									input: 'text-[#F1F0EB] bg-transparent text-[16px] group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] group-data-[focus=true]:bg-transparent',
									inputWrapper:
										'border border-[##F1F0EB] group-data-[focus=true]:border-[##F1F0EB] rounded-lg !bg-transparent group-data-[focus=true]:!bg-transparent group-data-[hover=true]:!bg-transparent p-2 shadow-none',
								}}
							/>
						</div>

						<div className='flex flex-col gap-2'>
							<label className='text-[#F1F0EB] text-[16px] font-medium'>
								Collection Description
							</label>
							<Tiptap
								content={collection.description || ''}
								onChange={(htmlContent) => {
									setCollection({
										...collection,
										description: htmlContent,
									});
								}}
								isLightMode={false}
								autoFocus={false}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
