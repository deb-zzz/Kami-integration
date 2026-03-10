'use client';

import { Button } from '@nextui-org/react';
import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import MainProduct from '../MainProduct';
import { AllProjectType, BundleType, MetaDataBundleType } from '@/types';
import { IsAudio, IsImage, isValidFileFormat, IsVideo } from '@/lib/Util';
import { ToastMessage } from '@/components/ToastMessage';
import { useLazyNFT } from '@/lib/VoucherContext';
import { useForm, Control, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import BundleProduct from '../BundleProduct';
import BundleAccordion from '../BundleAccordion';
import Collection from '../Collection';
import VideoEditorModal from '../VideoEditorModal';
import AudioEditorModal from '../AudioEditorModal';
import { useChunkedUpload } from '@paulstinchcombe/chunked-upload';

type TraitsType = {
	key: string;
	value: string;
	edit?: boolean;
};

type BaseFormData = {
	name: string;
	description: string;
	tags: string[];
	traits: TraitsType[];
	coverImg?: string;
};

type PackageFormData = BaseFormData & {
	bundle: {
		name: string;
		description?: string;
		ownerDescription: string;
		asset: string;
		category: string;
		assetCover?: string;
		// tags: { tag: string; type: string }[];
	}[];
	collection: {
		name: string;
		type: string;
		symbol: string;
		description: string;
		bannerUrl?: string;
		avatarUrl?: string;
	};
};

const schema = yup.object({
	name: yup
		.string()
		.trim()
		.max(50, 'Must not exceed 50 characters')
		.required('Product name is required'),
	description: yup
		.string()
		.required('Description is required')
		.max(1000, 'Description must not exceed 1000 characters')
		.default(''),
	tags: yup
		.array()
		.of(yup.string().required())
		.min(1, 'At least one tag is required')
		.max(6, 'Maximum of 6 tags allowed')
		.default([]),
	traits: yup
		.array()
		.of(
			yup.object().shape({
				key: yup.string().default(''),
				value: yup.string().default(''),
				edit: yup.boolean().optional(),
			})
		)
		.min(1, 'At least one trait is required')
		.test(
			'valid-traits',
			'At least one trait with both key and value is required',
			(items) => {
				if (!items || items.length === 0) {
					return false;
				}
				// Check if at least one trait has both key and value filled
				return items.some(
					(item) =>
						item.key &&
						item.key.trim() !== '' &&
						item.value &&
						item.value.trim() !== ''
				);
			}
		)
		.required('At least one trait is required')
		.default([]),
	coverImg: yup.string().when('upload', (uriFile: any, schema: any) => {
		const fileName =
			uriFile?.length > 0 && uriFile[0] ? uriFile[0].toLowerCase() : '';
		const isNotImage =
			uriFile.length > 0 && uriFile[0] && !IsImage(fileName);
		return isNotImage
			? schema.required('Asset cover is required')
			: schema.optional();
	}),
	bundle: yup
		.array()
		.of(
			yup.object().shape({
				name: yup
					.string()
					.trim()
					.max(50, 'Must not exceed 50 characters')
					.required('Name is required'),
				description: yup.string().optional(),
				ownerDescription: yup
					.string()
					.required("Owner's description is required"),
				asset: yup
					.string()
					.required('Please select an asset to upload'),
				category: yup
					.string()
					.required('Please choose a category')
					.default(''),
				assetCover: yup.string().optional(),
			})
		)
		.required(),
	collection: yup.object().shape({
		name: yup
			.string()
			.trim()
			.min(2, 'Should be more than 2 characters')
			.max(100, 'Must not exceed 100 characters')
			.required(),
		type: yup.string().required('Type is required'),
		symbol: yup
			.string()
			.min(2, 'Should be more than 2 characters')
			.matches(/^\S*$/, 'Spaces are not allowed')
			.matches(
				/^[^\d\W][a-zA-Z0-9]*$/,
				'First character cannot be a number or symbol, and following can be alphanumeric'
			)
			.max(7, 'Recommended to keep the symbol less than 7 character')
			.required(),
		description: yup
			.string()
			.required('Collection description is required'),
		bannerUrl: yup.string().optional(),
		avatarUrl: yup.string().optional(),
	}),
});

type PackageProp = {
	project?: AllProjectType;
	isActionDisabled: boolean;
};

export default function PackageStep({
	project,
	isActionDisabled,
}: PackageProp) {
	const [isDragOver, setIsDragOver] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [voucher, setVoucher] = useLazyNFT();
	const [isVideoEditorModalOpen, setIsVideoEditorModalOpen] = useState(false);
	const [isAudioEditorModalOpen, setIsAudioEditorModalOpen] = useState(false);
	const [isUploaded, setIsUploaded] = useState(false);
	const { uploadFile, isUploading, currentUpload, error } =
		useChunkedUpload();

	// Initialize form with voucher data
	const {
		control,
		handleSubmit,
		watch,
		setValue,
		getValues,
		trigger,
		formState: { errors },
	} = useForm<PackageFormData>({
		resolver: yupResolver(schema),
		mode: 'all', // Validate on change, blur, submit, and mount
		reValidateMode: 'onChange', // Re-validate on change after first error
		defaultValues: {
			name: voucher?.metadata?.name || '',
			description: voucher?.metadata?.description || '',
			tags: (voucher?.tags as unknown as string[]) || [],
			traits:
				voucher?.metadata?.attributes?.map((attr) => ({
					key: attr.trait_type,
					value: attr.value,
					edit: false,
				})) || [],
			coverImg: voucher?.coverUrl || '',
			bundle: voucher?.metadata?.properties?.bundle || [],
			collection: {
				name: '',
				type: '',
				symbol: '',
				description: '',
			},
		},
	});

	const bundleFieldArray = useFieldArray({
		control,
		name: 'bundle',
	});

	// Trigger validation on mount to show errors immediately
	useEffect(() => {
		trigger(); // Validate all fields on mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Watch form values and errors for debugging
	useEffect(() => {
		const subscription = watch((value, { name, type }) => {
			if (name) {
				trigger(name);
			}
		});
		return () => subscription.unsubscribe();
	}, [watch, trigger]);

	// Sync form with voucher when voucher changes
	useEffect(() => {
		console.log('typing ...', voucher);
		if (voucher) {
			if (voucher.metadata?.name) {
				setValue('name', voucher.metadata.name);
			}
			if (voucher.metadata?.description) {
				setValue('description', voucher.metadata.description);
			}
			if (voucher.tags && voucher.tags.length > 0) {
				const voucherTagStrings = voucher.tags as unknown as string[];
				setValue('tags', voucherTagStrings);
			}
			if (
				voucher.metadata?.attributes &&
				voucher.metadata.attributes.length > 0
			) {
				setValue(
					'traits',
					voucher.metadata.attributes.map((attr) => ({
						key: attr.trait_type,
						value: attr.value,
						edit: false,
					}))
				);
			}
			if (voucher.coverUrl) {
				setValue('coverImg', voucher.coverUrl);
			}
		}
		// Trigger validation after syncing voucher data
		setTimeout(() => {
			trigger();
		}, 100);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [voucher?.metadata, voucher?.tags, voucher?.coverFile]);

	useEffect(() => {
		const mediaUrl = voucher?.mediaUrl;
		if (mediaUrl) {
			setSelectedFile(new File([], mediaUrl));
			// If mediaUrl is a URL string, use it directly; otherwise create object URL
			if (
				mediaUrl.startsWith('http://') ||
				mediaUrl.startsWith('https://') ||
				mediaUrl.startsWith('blob:')
			) {
				setSelectedFileUrl(mediaUrl);
			}
		} else {
			setSelectedFile(null);
			// Note: Don't clean up selectedFileUrl here as it might be from a user-selected file
		}
	}, [voucher?.mediaUrl]);

	// Cleanup object URL on component unmount
	useEffect(() => {
		return () => {
			if (selectedFileUrl && selectedFileUrl.startsWith('blob:')) {
				URL.revokeObjectURL(selectedFileUrl);
			}
		};
	}, [selectedFileUrl]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			const files = Array.from(e.dataTransfer.files);
			if (files.length > 0) {
				const file = files[0];
				setSelectedFile(file);
				// Create object URL for the dropped file
				if (selectedFileUrl && selectedFileUrl.startsWith('blob:')) {
					URL.revokeObjectURL(selectedFileUrl);
				}
				const fileUrl = URL.createObjectURL(file);
				setSelectedFileUrl(fileUrl);
			}
		},
		[selectedFileUrl]
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				if (!isValidFileFormat(e.target.files[0].name)) {
					ToastMessage(
						'error',
						'File format not supported. Please upload a file with an allowed format.'
					);
					// Reset the input
					e.target.value = '';
					setSelectedFile(null);
					return;
				}

				const selectedFile = e.target.files[0];
				setSelectedFile(selectedFile); // Only take the first file
				console.log('selectedFile', selectedFile.name);

				// Create object URL for the selected file
				if (selectedFile) {
					// Clean up previous object URL if exists
					if (
						selectedFileUrl &&
						selectedFileUrl.startsWith('blob:')
					) {
						URL.revokeObjectURL(selectedFileUrl);
					}
					const fileUrl = URL.createObjectURL(selectedFile);
					setSelectedFileUrl(fileUrl);

					// Check if the selected file is a video
					if (IsVideo(selectedFile.name)) {
						setIsVideoEditorModalOpen(true);
					}
					// Check if the selected file is an audio
					if (IsAudio(selectedFile.name)) {
						setIsAudioEditorModalOpen(true);
					}
				}
			}
		},
		[selectedFileUrl]
	);

	const handleButtonClick = () => {
		fileInputRef.current?.click();
	};

	const removeFile = () => {
		// Clean up object URL to prevent memory leaks
		if (selectedFileUrl) {
			URL.revokeObjectURL(selectedFileUrl);
			setSelectedFileUrl(null);
		}
		setSelectedFile(null);
	};
	const handleUpload = async (startTime: number, duration: number) => {
		if (!selectedFile || !project?.id) return;
		try {
			const result = await uploadFile(selectedFile, {
				projectId: project?.id.toString(),
				category: 'project',
				startTime: startTime, // Optional: Start preview at 0 seconds (default: 0)
				duration: duration, // Optional: 30 second preview (default: 30, min: 5, max: 60)
				onProgress: (progress) => {
					console.log(`Upload progress: ${progress.progress}%`);
				},
				onComplete: (result) => {
					console.log('Upload completed!', result);
					if (result.previewCdn) {
						console.log('Preview URL:', result.previewCdn);
					}
				},
				onError: (error) => {
					console.error('Upload failed:', error);
				},
			});
			console.log('result', result);
		} catch (err) {
			console.error('Upload error:', err);
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	const handleSaveAsDraft = () => {
		const formValues = getValues();
		console.log('save as draft', formValues, errors);
		// Map traits to attributes format
		const attributes = formValues.traits
			.filter((trait) => trait.key && trait.value)
			.map((trait) => ({
				trait_type: trait.key,
				value: trait.value,
			}));

		// Set voucher with form values
		setVoucher({
			metadata: {
				...voucher?.metadata,
				name: formValues.name,
				description: formValues.description,
				attributes: attributes.length > 0 ? attributes : undefined,
			},
			tags: formValues.tags as unknown as any,
			coverUrl: formValues.coverImg || voucher?.coverUrl,
		});
	};

	return (
		<form
			onSubmit={handleSubmit((data) => console.log('data', data, errors))}
		>
			<div className='w-full '>
				<div className='mb-8'>
					<h2 className='text-xl font-bold text-[#F1F0EB] mb-2'>
						Main Product
					</h2>
				</div>
				{!isActionDisabled && (
					<div
						className={`relative border-2  rounded-lg px-8 pt-8 pb-4 text-center transition-all duration-200 ${
							isDragOver
								? 'border-[#11FF49]/30 bg-[#F1F0EB]/10'
								: 'border-[#F1F0EB]/30 hover:border-[#11FF49]/30'
						}`}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					>
						<input
							ref={fileInputRef}
							type='file'
							className='hidden'
							onChange={handleFileSelect}
							accept='*/*'
							disabled={isUploading}
						/>

						<div className='flex flex-col items-center gap-12 '>
							<div className='flex flex-col justify-center items-center gap-4'>
								<div className='w-16 h-16 bg-[#A79755] rounded-full flex items-center justify-center'>
									<Image
										src='/uploadIconWhite.svg'
										alt='Upload'
										width={32}
										height={32}
										className='opacity-70'
									/>
								</div>
								{isUploading && currentUpload ? (
									<div>
										<p>
											Uploading: {currentUpload.fileName}
										</p>
										<p>
											Progress:{' '}
											{currentUpload.receivedChunks}/
											{currentUpload.totalChunks} chunks
										</p>
										{error && <p>Error: {error}</p>}
									</div>
								) : (
									<div>
										<p className='text-[15px] font-semibold text-[#9E9E9D]'>
											Drag and drop files to upload
										</p>
										<p className='text-[#9E9E9D] mb-4'>
											Your content will be private until
											you publish them
										</p>
									</div>
								)}
							</div>

							{!isActionDisabled && (
								<div>
									<Button
										size='sm'
										onClick={handleButtonClick}
										variant='flat'
										className='bg-[#F1F0EB] text-black font-medium hover:bg-[#F1F0EB]/90'
									>
										Select File
									</Button>
								</div>
							)}
							<p className='text-[#9E9E9D] text-[10px] mt-5 mx-10 text-center'>
								By submitting your content to KAMI, you
								acknowledge that you agree to KAMI&apos;s Terms
								of Service and Community Guidelines. Please be
								sure not to violate others&apos; copyright or
								privacy rights.
							</p>
						</div>
					</div>
				)}
				{/* Selected File */}
				{/* {isUploaded && project && selectedFile && (
					<>
						<MainProduct
							file={selectedFile}
							project={project}
							isActionDisabled={isActionDisabled}
							control={control as any}
							setValue={setValue as any}
							trigger={trigger as any}
							watch={watch as any}
							errors={errors}
							setVoucher={setVoucher}
							voucher={voucher}
						/>

						<BundleAccordion
							isActionDisabled={isActionDisabled}
							control={control as any}
							setValue={setValue as any}
							trigger={trigger as any}
							watch={watch as any}
							errors={errors}
							bundleFieldArray={bundleFieldArray}
						/>
						<Collection
							onCollectionChange={(data) =>
								console.log('collection data', data)
							}
						/>
					</>
				)} */}

				{!isActionDisabled && (
					<div className='w-full justify-end mt-8'>
						<Button
							variant='flat'
							size='sm'
							className='bg-[#AFAB99] text-black rounded-lg font-medium w-full'
							disabled={isActionDisabled}
							type='submit'
							onClick={() => console.log('save as draft')}
						>
							Save as Draft
						</Button>
					</div>
				)}

				<VideoEditorModal
					isOpen={isVideoEditorModalOpen}
					onClose={() => {
						setIsVideoEditorModalOpen(false);
						removeFile();
					}}
					setIsOpen={(isOpen) => setIsVideoEditorModalOpen(isOpen)}
					url={selectedFileUrl || ''}
					onTrimUpdate={async (times) => {
						await handleUpload(
							times.startTime,
							times.endTime - times.startTime
						);
					}}
				/>
				<AudioEditorModal
					isOpen={isAudioEditorModalOpen}
					onClose={() => {
						setIsAudioEditorModalOpen(false);
						removeFile();
					}}
					url={selectedFileUrl || ''}
					setIsOpen={(isOpen) => setIsAudioEditorModalOpen(isOpen)}
					onTrimUpdate={async (times) => {
						await handleUpload(
							times.startTime,
							times.endTime - times.startTime
						);
					}}
				/>
			</div>
		</form>
	);
}
