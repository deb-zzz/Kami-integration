'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
	Accordion,
	AccordionItem,
	Chip,
	Divider,
	Input,
	Modal,
	ModalBody,
	ModalContent,
	Select,
	SelectItem,
	Spinner,
	Textarea,
} from '@nextui-org/react';
import { useFieldArray, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { IsImage, isValidFileFormat } from '@/lib/Util';
import fileTypes from '@/lib/fileType.json';
// import { addTags } from '@/apihandler/Profile';
import { useLazyNFT } from '@/lib/VoucherContext';
import { useGlobalState } from '@/lib/GlobalContext';
import { AllProjectType, BundleType } from '@/types';
// import { uploadMedia } from '@/apihandler/Project'; // Replaced with chunked upload
import { ToastMessage } from '@/components/ToastMessage';
import { useChunkedUpload, UploadProgress } from '@/lib/chunked-upload-package';
import UploadProgressModal from './UploadProgressModal';

type FormType = {
	tags: { tag: string; type: string }[];
	bundle: {
		name: string;
		description?: string;
		ownerDescription: string;
		asset: string;
		category: string;
		assetCover?: string;
		// tags: { tag: string; type: string }[];
	}[];
	upload: string;
};

const accordionClass = {
	base: 'bg-transparent shadow-none border border-[#1A1A1A]',
	indicator: 'text-[#1A1A1A] text-[24px]',
};
export default function BundleStep({
	project,
	onVerify,
	isActionDisabled,
}: {
	project: AllProjectType;
	onVerify: (verified: boolean) => void;
	isActionDisabled: boolean;
}) {
	const [voucher, setVoucher] = useLazyNFT();
	// const { register, control, handleSubmit } = useForm<FormType>();
	const [gs, setGs] = useGlobalState();

	type OldProductItems = {
		label: string;
		key: number;
		bundle?: BundleType;
	};

	const [oldItems, setOldItems] = useState<OldProductItems[]>([]);
	const [isUploading, setisUploading] = useState<boolean>(false);

	// Chunked upload functionality
	const {
		uploadFile: chunkedUploadFile,
		isUploading: isChunkedUploading,
		currentUpload,
		error: uploadError,
	} = useChunkedUpload();
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [currentUploadingFile, setCurrentUploadingFile] =
		useState<File | null>(null);
	const [currentUploadingIndex, setCurrentUploadingIndex] =
		useState<number>(-1);

	// Helper function to determine if file should use chunked upload (files > 50MB)
	// const shouldUseChunkedUpload = (file: File): boolean => {
	// 	return file.size > 50 * 1024 * 1024; // 50MB threshold
	// };

	// Chunked upload handler
	const handleChunkedUpload = async (
		file: File,
		bundleIndex: number
	): Promise<UploadProgress | null> => {
		try {
			setCurrentUploadingFile(file);
			setCurrentUploadingIndex(bundleIndex);
			setShowUploadModal(true);
			setisUploading(true);

			const result = await chunkedUploadFile(file, {
				projectId: project.id.toString(),
				category: 'project',
				folder: 'bundle',
				onProgress: (progress) => {
					console.log('Chunk progress:', progress);
				},
				onStatusChange: (status) => {
					console.log('Upload status:', status);
				},
				onComplete: (result) => {
					console.log('Upload completed:', result);
					handleUploadSuccess(result, bundleIndex);
				},
				onError: (error) => {
					console.error('Upload error:', error);
					handleUploadError(error);
				},
			});
			return result;
		} catch (error) {
			console.error('Chunked upload failed:', error);
			handleUploadError(
				error instanceof Error ? error.message : 'Upload failed'
			);
			return null;
		}
	};

	// Handle successful upload
	const handleUploadSuccess = (
		result: UploadProgress,
		bundleIndex: number
	) => {
		// Handle special cases for different upload types
		if (bundleIndex === -1) {
			// Cover upload
			setVoucher({
				...voucher,
				coverUrl: result.key || result.cdn || '',
			});
		} else if (bundleIndex === -2) {
			// Main product upload
			setVoucher({
				...voucher,
				mediaUrl: result.key || result.cdn || '',
			});
		} else if (bundleIndex === -3) {
			// Bundle cover upload - this is handled in the calling function
			// No additional processing needed here
		} else {
			// Regular bundle item upload
			const field = bundleFA.fields[bundleIndex];
			const bundle = voucher?.metadata?.properties?.bundle ?? [];

			// Update the bundle with the uploaded file info
			bundle[bundleIndex] = {
				...field,
				uri: result.key || result.cdn || '',
				uriFile: currentUploadingFile || undefined,
				type: currentUploadingFile?.type.replace('/', '_') || '',
				assetCover: IsImage(currentUploadingFile?.name || '')
					? result.key || result.cdn || ''
					: undefined,
				assetCoverFile: IsImage(currentUploadingFile?.name || '')
					? currentUploadingFile || undefined
					: undefined,
			};

			bundleFA.update(bundleIndex, {
				...field,
				uri: result.key || result.cdn || '',
				uriFile: currentUploadingFile || undefined,
				assetCover: IsImage(currentUploadingFile?.name || '')
					? result.key || result.cdn || ''
					: undefined,
				assetCoverFile: IsImage(currentUploadingFile?.name || '')
					? currentUploadingFile || undefined
					: undefined,
			});

			setVoucher({
				...voucher,
				metadata: {
					...voucher?.metadata,
					properties: {
						...voucher?.metadata?.properties,
						bundle,
					},
				},
			});
		}

		// Reset upload state
		setShowUploadModal(false);
		setCurrentUploadingFile(null);
		setCurrentUploadingIndex(-1);
		setisUploading(false);
	};

	// Handle upload error
	const handleUploadError = (error: string) => {
		console.error('Upload error:', error);
		setShowUploadModal(false);
		setCurrentUploadingFile(null);
		setCurrentUploadingIndex(-1);
		setisUploading(false);
		// You can add toast notification here
	};

	const schema = yup.object({
		tags: yup.array().of(yup.string().required()).min(1, 'Tag is required'),
		bundle: yup.array().of(
			yup.object().shape({
				name: yup.string().trim().max(50, 'Must not exceed 50 characters').required('Name is required'),
				description: yup.string().required('Description is required'),
				ownerDescription: yup.string(),
				// .required("Owner's description is required"),
				uri: yup.string().required('Please select an asset to upload'),
				uriFile: yup.mixed<any>().optional(),
				category: yup
					.string()
					.required('Please choose a category')
					.default(voucher?.category),
				// if urifile not endswith .png or .jpg or .jpeg, then asset cover is required
				assetCover: yup
					.string()
					.when('uriFile', (uriFile: any, schema: any) => {
						const fileName = uriFile?.name?.toLowerCase() || '';
						const isNotImage = uriFile && !IsImage(fileName);
						return isNotImage
							? schema.required('Asset cover is required')
							: schema.optional();
					}),
				// assetCover: yup.string().optional(),
				assetCoverFile: yup.mixed<any>().optional(),
				oldItem: yup.number(),
			})
		),
		upload: yup.string().required('Please upload the asset.'),
		coverImg: yup.string().when('upload', (uriFile: any, schema: any) => {
			const fileName =
				uriFile?.length > 0 && uriFile[0]
					? uriFile[0].toLowerCase()
					: '';
			const isNotImage =
				uriFile.length > 0 && uriFile[0] && !IsImage(fileName);
			return isNotImage
				? schema.required('Asset cover is required')
				: schema.optional();
		}),
	});

	// useEffect(() => {
	// 	console.log(voucher);
	// }, [voucher]);

	const [tags, setTags] = useState<string[]>([]);
	const [tag, setTag] = useState<string>(''); // set base tag
	const [temptag, setTemptag] = useState<string>(); // set arcodian tag state
	const [coverImage, setCoverImage] = useState<any>();
	const [bundleFlipper, setBundleFlipper] = useState<boolean>(false);
	const [uploadProduct, setUploadProduct] = useState<any>();
	const isUpdatingTagsRef = useRef<boolean>(false);
	const inputRef = useRef<any>();
	const uploadRef = useRef<any>();
	const bundleInputRef = useRef<{ [key: number]: HTMLInputElement | null }>(
		{}
	);
	const bundleUploadRef = useRef<{ [key: number]: HTMLInputElement | null }>(
		{}
	);
	// const collabData = [gs?.profile?.userName];
	const [collabData, setCollabData] = useState<string[]>([]);
	const [catogories, setCatogories] = useState<
		{ key: number; val: string }[]
	>([]);
	useEffect(() => {
		// if (voucher?.collectionId) {
		// 	getACollection(
		// 		gs?.profile?.userName ?? '',
		// 		voucher?.collectionId ?? 0
		// 	).then((res) => {
		// 		console.log(res);
		// 	});
		// }
		const arr: string[] = [];

		const owner = project.user
			? project.user.userName
			: gs?.profile?.userName;

		if (owner) arr.push(owner);

		if (project.collaborators && project.collaborators?.length > 0) {
			const collab = project.collaborators
				.filter(
					(i) =>
						i.status.toLowerCase() === 'accepted' &&
						i.userProfile?.walletAddress !==
							project.user.walletAddress
				)
				.map((i) => i.userProfile?.userName);
			arr.push(...collab);
		}
		setCollabData(arr);
	}, []);

	const handleCoverUpload = (
		e: React.ChangeEvent<HTMLInputElement>,
		isUpload: boolean,
		getImageUrl?: (url: string) => void
	) => {
		const files = e.target.files;
		if (!files) return;
		const file = files[0];
		// if (file) console.log('here', file);
		if (IsImage(file.name)) {
			if (isUpload) {
				getImageUrl ?? setCoverImage(file);
				setUploadProduct(file);
			} else {
				getImageUrl ?? setCoverImage(file);
			}
		} else {
			setCoverImage(null);
			setUploadProduct(null);
		}
		// use the file
		// getImageUrl && getImageUrl(file);
	};

	const handleImageClick = (
		e: React.MouseEvent<HTMLDivElement>,
		isUpload: boolean
	) => {
		// e.preventDefault();
		if (isUpload) {
			if (!uploadRef || !uploadRef.current) return;
			uploadRef.current.value = null;
			uploadRef.current.click();
		} else {
			if (!inputRef || !inputRef.current) return;
			inputRef.current.value = null;
			inputRef.current.click();
		}
	};
	const handleBundleImageClick = (
		e: React.MouseEvent<HTMLDivElement>,
		isUpload: boolean,
		idx: number
	) => {
		// e.preventDefault();
		if (isUpload) {
			if (!bundleUploadRef || !bundleUploadRef.current[idx]) return;
			bundleUploadRef.current[idx]?.click();
		} else {
			if (!bundleInputRef || !bundleInputRef.current[idx]) return;

			bundleInputRef.current[idx]?.click();
		}
	};

	const {
		register,
		handleSubmit,
		control,
		trigger,
		getValues,
		formState: { errors },
		setValue,
	} = useForm({
		defaultValues: {
			upload: voucher?.mediaUrl,
			bundle: voucher?.metadata?.properties?.bundle,
			coverImg: voucher?.coverUrl,
			tags: (voucher?.tags as unknown as string[]) || [],
		},
		resolver: yupResolver(schema),
	});

	const onSubmit = (data: any) => {};
	const bundleFA = useFieldArray({
		name: 'bundle',
		control,
	});

	const validate = () => {
		trigger().then((val) => {
			// console.log('validate', voucher);
			onVerify(val);
		});
	};

	useEffect(() => {
		validate();
	}, [voucher, bundleFlipper]);

	useEffect(() => {
		//c.replace(/\s+/g, '_').toLowerCase()
		if (gs && gs.categories)
			setCatogories(
				gs.categories.map((c) => ({ key: c.id, val: c.name }))
			);
	}, [gs?.categories]);

	const flipBundle = () => {
		setBundleFlipper(!bundleFlipper);
	};

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
				// Update form value and local state
				setValue('tags', voucherTagStrings);
				setTags(voucherTagStrings);
				// Trigger validation to update button state
				trigger('tags');
			}
		} else if (!voucher?.tags || voucher.tags.length === 0) {
			// Only clear tags if we have current tags but no voucher tags
			if (tags.length > 0) {
				setValue('tags', []);
				setTags([]);
				// Trigger validation to show error
				trigger('tags');
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [voucher?.tags]);

	return (
		<div className='h-full w-full'>
			<form onSubmit={handleSubmit(onSubmit)}>
				<div>
					<div className='border-b border-b-[#1A1A1A] pb-2'>
						<p className='text-black text-[16px] font-semibold'>
							Main Product
						</p>
					</div>
					<div className='flex flex-row mt-10 gap-5'>
						<Modal isOpen={isUploading}>
							<ModalContent className='bg-[#6c6c6b] text-black text-center p-4 '>
								<ModalBody>
									<p className='text-white'>
										{'Uploading...'}
									</p>
									<Spinner size='lg' color='default' />
								</ModalBody>
							</ModalContent>
						</Modal>
						<div className='w-1/4 flex flex-row justify-center'>
							{voucher?.mediaUrl && (
								<div
									className={`flex flex-col gap-2 justify-center items-center rounded-lg w-full max-w-[250px] `}
								>
									<div
										onClick={(e) => {
											if (isActionDisabled) return;
											if (
												voucher?.mediaUrl ||
												(voucher?.mediaFile &&
													!IsImage(
														voucher?.mediaFile.name
													))
											)
												handleImageClick(e, false);
										}}
										className={`flex flex-col gap-2 justify-center items-center rounded-lg w-full max-w-[250px] h-[250px]  ${
											voucher?.mediaUrl &&
											!IsImage(
												voucher?.mediaFile?.name || ''
											) &&
											voucher?.coverUrl === undefined
												? // !IsImage(voucher?.coverFile?.name)
												  'border-[#11FF49]  border-2 cursor-pointer'
												: 'border-[#D9D9D9]  border-1 '
										} `}
									>
										{/* TODO: 19/3/25 need to double check with Herman the border color and all */}
										{voucher?.mediaFile &&
										IsImage(voucher?.mediaFile?.name) ? (
											<div className='h-full w-full relative'>
												<Image
													src={URL.createObjectURL(
														voucher?.mediaFile
													)}
													alt={'card1'}
													layout='fill'
													// objectFit='cover'
													className='rounded-lg'
													style={{
														objectFit: 'cover',
													}}
												/>
											</div>
										) : voucher.coverUrl ??
										  (getValues().coverImg &&
												voucher?.coverFile &&
												IsImage(
													voucher?.coverFile?.name
												)) ? (
											<div
												className='h-full w-full bg-black relative rounded-lg'
												onClick={(e) =>
													e.stopPropagation()
												}
											>
												<Image
													src={
														voucher?.coverUrl ??
														URL.createObjectURL(
															voucher?.coverFile!
														)
													}
													alt={'card1'}
													layout='fill'
													// objectFit='cover'
													className='rounded-lg'
													style={{
														objectFit: 'contain',
													}}
												/>
												{!isActionDisabled &&
													!IsImage(
														voucher?.mediaUrl
													) && (
														<>
															<Image
																onClick={(e) =>
																	handleImageClick(
																		e,
																		false
																	)
																}
																src={
																	'/publish/editPen.svg'
																}
																alt={'edit'}
																width={80}
																height={80}
																className='cursor-pointer absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2'
															/>
															<Image
																onClick={() => {
																	setValue(
																		'coverImg',
																		undefined
																	);
																	setVoucher({
																		coverFile:
																			undefined,
																		coverUrl:
																			undefined,
																	});
																}}
																src={
																	'/publish/cancel.svg'
																}
																alt={'edit'}
																width={20}
																height={20}
																className='absolute top-2 right-2 cursor-pointer'
															/>
														</>
													)}
											</div>
										) : (
											<>
												{voucher?.mediaUrl &&
												!IsImage(
													voucher?.mediaFile?.name ||
														''
												) ? (
													<Image
														src={
															'/addPlusGreen.svg'
														}
														alt={'add'}
														width={80}
														height={80}
													/>
												) : (
													<Image
														src={'/addPlus.svg'}
														alt={'add'}
														width={80}
														height={80}
													/>
												)}
												<p
													className={`text-black font-medium mt-2`}
												>
													Add Cover Art
												</p>
												<p className='text-[12px] text-black  -mt-2'>
													800 x 800
												</p>
											</>
										)}

										<input
											ref={inputRef}
											type='file'
											accept='image/*'
											hidden
											onChange={async (e) => {
												if (isActionDisabled) return;
												if (e.target.files) {
													const coverImgFile =
														e.target.files[0];

													setVoucher({
														coverFile: coverImgFile,
													});
													try {
														setisUploading(true);
														const result =
															await handleChunkedUpload(
																coverImgFile,
																-1
															); // -1 indicates cover upload
														setisUploading(false);

														if (
															result &&
															result.status ===
																'completed' &&
															result.cdn
														) {
															setVoucher({
																coverUrl:
																	result.cdn,
															});
															setValue(
																'coverImg',
																coverImgFile.name
															);
															ToastMessage(
																'success',
																'Upload Successful'
															);
														} else if (
															result &&
															result.status ===
																'failed'
														) {
															ToastMessage(
																'error',
																'Error in uploading media file'
															);
														} else if (
															result &&
															result.status ===
																'cancelled'
														) {
															ToastMessage(
																'error',
																'Upload cancelled'
															);
														} else {
															ToastMessage(
																'error',
																'Error in uploading media file'
															);
														}
													} catch (e) {
														console.log(e);
														ToastMessage(
															'error',
															'Error in uploading media file'
														);
														setisUploading(false);
														return;
													}
												}
											}}
										/>
									</div>
									{voucher?.mediaUrl &&
										!IsImage(
											voucher?.mediaFile?.name || ''
										) &&
										!voucher.coverUrl && (
											<p className='text-red-800 '>
												<span className='-mt-2'>*</span>
												Upload success, let&#39;s add a
												cover!
											</p>
										)}
								</div>
							)}
						</div>
						<div className='flex-1 flex flex-col gap-5'>
							<div>
								<div className='flex flex-row items-end gap-1'>
									<p className='text-black font-semibold text-[16px]  mb-1'>
										Creators
									</p>
									{/* <CollaboratorSearch
										projectId={project.id}
										walletAddress={gs?.profile?.walletAddress ?? ''}
										projectName={project.name}
										color='#000000'
									/> */}
								</div>
								<div className='flex flex-row flex-wrap gap-3 mt-2'>
									{collabData?.map((collab, index) => (
										<Chip
											key={index}
											size='md'
											variant='bordered'
											classNames={{
												base: 'border border-[#1A1A1A] px-2 py-4 rounded-lg',
												content:
													'text-[16px] text-[#1A1A1A] text-center ',
											}}
										>
											{collab}
										</Chip>
									))}
								</div>
							</div>
							{voucher?.category && (
								<div>
									<p className='text-black font-semibold text-[16px]'>
										Category
									</p>
									<div
										className={`flex flex-row  gap-3 mt-2 border border-[#1A1A1A] p-2 rounded-lg w-full ${
											isActionDisabled
												? 'opacity-50 border-[#1A1A1A]/30'
												: ''
										}`}
									>
										<p className='text-[16px] ml-2 italic text-[#9E9E9D] font-semibold text-left'>
											{voucher?.category ?? (
												<span className='text-transparent'>
													None
												</span>
											)}
										</p>
									</div>
								</div>
							)}
							<div>
								<p className='text-black font-semibold text-[16px] '>
									Tags
								</p>
								<Input
									size='sm'
									variant='flat'
									placeholder='+ Add a maximum of 6 tags'
									disabled={isActionDisabled}
									value={tag}
									className='mt-2'
									classNames={{
										base: 'bg-transparent',
										inputWrapper: ` ${
											isActionDisabled &&
											'opacity-50 border-b-[#1A1A1A]/70'
										} text-[#1A1A1A] border-b border-b-[#1A1A1A] rounded-none bg-[#F1F0EB] group-data-[focus=true]:bg-[#F1F0EB] group-data-[hover=true]:bg-[#F1F0EB]  p-2 shadow-none`,
										input: 'text-[#1A1A1A] text-[16px] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#1A1A1A] placeholder:text-[16px]',
									}}
									onChange={(e) => {
										setTag(e.target.value);
									}}
									onKeyDown={(event: any) => {
										if (event.key === 'Enter') {
											const newTags = event.target.value
												.split(',')
												.map((tag: string) =>
													tag.trim()
												)
												.filter((tag: string) => tag);

											// Validate each tag
											const validatedTags: string[] = [];
											const invalidTags: string[] = [];

											newTags.forEach((tag: string) => {
												// Check if tag contains only alphanumeric characters and spaces
												const alphanumericRegex =
													/^[a-zA-Z0-9\s]+$/;
												if (
													!alphanumericRegex.test(tag)
												) {
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
												const hasNonAlphanumeric =
													invalidTags.some(
														(tag: string) =>
															!/^[a-zA-Z0-9\s]+$/.test(
																tag
															)
													);
												const hasExcessCharacters =
													invalidTags.some(
														(tag: string) =>
															tag.length > 30
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

											// Check if any new tag is already in existingTags
											const duplicateTag = validatedTags.find((tag) => existingTags.includes(tag));
											if (duplicateTag) {
												ToastMessage("warning", "That tag has already been added, please try another.");
												setTag("");
												return;
											}

											const uniqueNewTags =
												validatedTags.filter(
													(tag: string) =>
														!existingTags.includes(
															tag
														)
												);

											if (
												existingTags.length +
													uniqueNewTags.length >
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

											// Update local state
											setTags(updatedTags);

											// Update form value
											setValue('tags', updatedTags);

											// Update voucher
											setVoucher({
												tags: updatedTags as unknown as any,
											});

											setTag('');

											// Reset flag after a short delay
											setTimeout(() => {
												isUpdatingTagsRef.current =
													false;
												// Trigger validation to clear error if tags are added
												trigger('tags');
											}, 100);
										}
									}}
								/>
								<p className='text-red-500 text-[11px] mt-1 ml-1'>
									{errors.tags?.message ?? ''}
								</p>

								<div className='flex flex-row flex-wrap gap-3 mt-3 '>
									{tags?.map((tagString, index) => (
										<Chip
											key={index}
											size='md'
											variant='bordered'
											classNames={{
												base: 'border border-[#1A1A1A] px-2 py-4 rounded-lg',
												content:
													'text-[16px] font-light text-[#1A1A1A] text-center ',
												closeButton: 'ml-1',
											}}
											onClose={() => {
												if (isActionDisabled) return;

												// Set flag to prevent infinite loop
												isUpdatingTagsRef.current =
													true;

												// Update local tags state
												const updatedTags = tags.filter(
													(item) => item !== tagString
												);
												setTags(updatedTags);

												// Update form value
												setValue('tags', updatedTags);

												// Update voucher
												setVoucher({
													tags: updatedTags as unknown as any,
												});

												// Reset flag after a short delay
												setTimeout(() => {
													isUpdatingTagsRef.current =
														false;
													// Trigger validation to show error if no tags left
													trigger('tags');
												}, 100);
											}}
										>
											{tagString}
										</Chip>
									))}
								</div>
							</div>

							<div>
								<p className='text-black font-semibold text-[16px]'>
									Upload
								</p>
								<div className='flex flex-row gap-4 items-center'>
									<div
										className={`flex flex-row justify-between gap-3 mt-2 border ${
											isActionDisabled
												? 'opacity-50 border-[#1A1A1A]/30'
												: 'border-[#1A1A1A]'
										} p-2 rounded-lg w-full`}
									>
										<div className=' flex-1 wordWrap'>
											<p
												className={`text-[16px] ml-2 italic font-medium text-left  ${
													voucher?.mediaUrl ??
													voucher?.mediaFile
														? 'text-[#1A1A1A] '
														: 'text-[#9e9e9d] '
												}`}
											>
												{voucher?.mediaUrl
													? voucher.mediaUrl
															.split('/')
															.pop() ||
													  voucher.mediaUrl
													: 'Choose your file'}
											</p>
										</div>
										{voucher?.mediaUrl ? (
											<Image
												className='cursor-pointer '
												src={'/creator/trashBlack.svg'}
												alt={'add'}
												width={23}
												height={23}
												onClick={async (e) => {
													if (isActionDisabled)
														return;
													setValue('upload', '');
													setVoucher({
														mediaFile: undefined,
														mediaUrl: undefined,
													});
													setValue(
														'coverImg',
														undefined
													);
													setVoucher({
														coverFile: undefined,
														coverUrl: undefined,
													});
												}}
											/>
										) : (
											<Image
												src={'/creator/trashGrey.svg'}
												alt={'add'}
												width={23}
												height={23}
											/>
										)}
									</div>
									{!isActionDisabled && (
										<div
											onClick={(e) =>
												handleImageClick(e, true)
											}
											className='w-[40px] h-[40px] mt-2 cursor-pointer bg-[#D9D9D9] rounded-lg flex justify-center items-center'
										>
											<Image
												src={'/uploadIcon.svg'}
												alt={'add'}
												width={18}
												height={18}
											/>
											<input
												ref={uploadRef}
												type='file'
												hidden
												onChange={async (e) => {
													// console.log(
													// 	'product',
													// 	e.target.files?.length,
													// 	e.target.files
													// );
													if (
														e.target.files &&
														e.target.files.length >
															0
													) {
														const mediaFile =
															e.target.files[0];

														// Validate file format before uploading
														if (
															!isValidFileFormat(
																mediaFile.name
															)
														) {
															ToastMessage(
																'error',
																'File format not supported. Please upload a file with an allowed format.'
															);
															// Reset the input
															e.target.value = '';
															setisUploading(
																false
															);
															return;
														}

														setisUploading(true);
														setValue(
															'upload',
															mediaFile.name
														);
														setVoucher({
															mediaFile:
																mediaFile,
														});

														try {
															const result =
																await handleChunkedUpload(
																	mediaFile,
																	-2
																); // -2 indicates main product upload

															if (
																result &&
																result.status ===
																	'completed' &&
																result.cdn
															) {
																setVoucher({
																	mediaUrl:
																		result.cdn,
																	// Automatically set cover for image files
																	...(IsImage(
																		mediaFile.name
																	) && {
																		coverUrl:
																			result.cdn,
																		coverFile:
																			mediaFile,
																	}),
																});
																ToastMessage(
																	'success',
																	'Upload Successful'
																);
															} else if (
																result &&
																result.status ===
																	'failed'
															) {
																ToastMessage(
																	'error',
																	'Error in uploading media file'
																);
															} else if (
																result &&
																result.status ===
																	'cancelled'
															) {
																ToastMessage(
																	'error',
																	'Upload cancelled'
																);
															} else {
																ToastMessage(
																	'error',
																	'Error in uploading media file'
																);
															}
														} catch (e) {
															console.log(e);
															ToastMessage(
																'error',
																'Error in uploading media file'
															);
															setisUploading(
																false
															);
														}
													} else {
														setisUploading(false);
													}
												}}
											/>
										</div>
									)}
								</div>
								<p className='text-red-500   text-[11px] mt-1 ml-1'>
									{errors.upload?.message ?? ''}
								</p>
								<div className='bg-[#D9D9D9] rounded-lg p-3 mt-3 w-[calc(100%-52px)]'>
									<p className='text-[#6E6E6E] text-[13px] font-bold mb-1 italic'>
										Accepted formats:
									</p>
									<div className='w-full h-[1px] bg-[#6E6E6E]/50 mb-2'></div>
									<div className='flex flex-col gap-1'>
										{fileTypes.fileTypes.map((fileType) => {
											const formats =
												fileType.formats.join(', ');
											return (
												<p
													key={fileType.key}
													className='text-[#6E6E6E]'
												>
													<span className='font-bold italic'>
														{fileType.category}
													</span>
													{' - '}
													<span className=' font-normal'>
														{formats}
													</span>
												</p>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className='mt-5'>
					<div className='border-b border-b-[#1A1A1A] pb-2 mb-4'>
						<p className='text-black text-[16px] font-semibold'>
							Items (optional)
						</p>
					</div>

					<div className='mb-4'>
						<Accordion
							variant='splitted'
							onSelectionChange={(k) => setTemptag('')}
						>
							{bundleFA.fields.map((field, idx) => {
								return (
									<AccordionItem
										key={idx}
										aria-label={`Bundle ${idx + 1}`}
										title={
											<div className='flex flex-row  items-center'>
												<p className='text-[#9E9E9D] text-[18px] italic font-light '>
													Bundle {idx + 1}
												</p>
												{!isActionDisabled && (
													<>
														<Divider
															orientation='vertical'
															className='bg-[#9E9E9D] h-5  ml-3 mr-2'
														/>
														<Image
															className=''
															src={
																'/creator/trashGrey.svg'
															}
															alt={'add'}
															width={23}
															height={23}
															onClick={(e) => {
																e.stopPropagation();
																bundleFA.remove(
																	idx
																);
																let bundle =
																	voucher
																		?.metadata
																		?.properties
																		?.bundle ??
																	[];

																bundle.splice(
																	idx,
																	1
																);
																setVoucher({
																	metadata: {
																		...voucher?.metadata,
																		properties:
																			{
																				...voucher
																					?.metadata
																					?.properties,
																				bundle: bundle,
																			},
																	},
																});
															}}
														/>
													</>
												)}
											</div>
										}
										classNames={accordionClass}
									>
										<div className='flex flex-row pt-4 pb-10 gap-5'>
											<div className='w-1/4 flex flex-col  gap-2  items-center '>
												{(field.uri ||
													field.uriFile) && (
													<div
														onClick={(e) => {
															if (
																isActionDisabled
															)
																return;
															if (
																field?.uri &&
																!IsImage(
																	field?.uri
																)
															)
																handleBundleImageClick(
																	e,
																	false,
																	idx
																);
														}}
														className={`flex flex-col gap-2 justify-center items-center rounded-lg w-full max-w-[250px] h-[250px] cursor-pointer ${
															field.uriFile &&
															!IsImage(
																field.uriFile
																	.name
															) &&
															field.assetCoverFile ===
																undefined
																? 'border-[#11FF49]  border-2 cursor-pointer'
																: 'border-[#D9D9D9]  border-2 '
														}  `}
													>
														{field.uriFile &&
														IsImage(
															field.uriFile.name
														) ? (
															<div className='h-full w-full relative'>
																<Image
																	src={
																		field.uri.startsWith(
																			'http'
																		)
																			? field.uri
																			: URL.createObjectURL(
																					field.uriFile
																			  )
																	}
																	alt={
																		'card1'
																	}
																	layout='fill'
																	// objectFit='cover'
																	className='rounded-lg'
																	style={{
																		objectFit:
																			'cover',
																	}}
																/>
															</div>
														) : field.assetCover ??
														  (field.assetCoverFile &&
																IsImage(
																	field
																		.assetCoverFile
																		.name
																)) ? (
															<div
																className='h-full w-full relative'
																onClick={(e) =>
																	e.stopPropagation()
																}
															>
																<Image
																	src={
																		field.assetCover?.startsWith(
																			'http'
																		)
																			? field.assetCover
																			: URL.createObjectURL(
																					field.assetCoverFile
																			  )
																	}
																	alt={'card'}
																	layout='fill'
																	style={{
																		objectFit:
																			'cover',
																	}}
																	className='rounded-lg'
																/>
																{!isActionDisabled && (
																	<>
																		<Image
																			onClick={(
																				e
																			) =>
																				handleBundleImageClick(
																					e,
																					false,
																					idx
																				)
																			}
																			src={
																				'/publish/editPen.svg'
																			}
																			alt={
																				'edit'
																			}
																			width={
																				80
																			}
																			height={
																				80
																			}
																			className='cursor-pointer absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2'
																		/>
																		<Image
																			onClick={() => {
																				const currentBundle =
																					[
																						...(voucher
																							?.metadata
																							?.properties
																							?.bundle ??
																							[]),
																					];

																				currentBundle[
																					idx
																				] =
																					{
																						...currentBundle[
																							idx
																						],
																						assetCover:
																							undefined,
																						assetCoverFile:
																							undefined,
																					};

																				bundleFA.update(
																					idx,
																					{
																						...field,
																						assetCover:
																							undefined,
																						assetCoverFile:
																							undefined,
																					}
																				);

																				setVoucher(
																					{
																						metadata:
																							{
																								...voucher?.metadata,
																								properties:
																									{
																										...voucher
																											?.metadata
																											?.properties,
																										bundle: currentBundle,
																									},
																							},
																					}
																				);
																			}}
																			src={
																				'/publish/cancel.svg'
																			}
																			alt={
																				'edit'
																			}
																			width={
																				20
																			}
																			height={
																				20
																			}
																			className='absolute top-2 right-2 cursor-pointer'
																		/>
																	</>
																)}
															</div>
														) : (
															<>
																{field.uri &&
																!IsImage(
																	field
																		.uriFile
																		?.name ||
																		''
																) ? (
																	<Image
																		src={
																			'/addPlusGreen.svg'
																		}
																		alt={
																			'add'
																		}
																		width={
																			80
																		}
																		height={
																			80
																		}
																	/>
																) : (
																	<Image
																		src={
																			'/addPlus.svg'
																		}
																		alt={
																			'add'
																		}
																		width={
																			80
																		}
																		height={
																			80
																		}
																	/>
																)}

																<p
																	className={`${
																		(field.assetCover ||
																			field.uri) &&
																		!IsImage(
																			field.assetCover
																				? field.assetCover
																				: field
																						.uriFile
																						?.name ||
																						''
																		)
																			? 'text-black'
																			: 'text-[#D9D9D9]'
																	} font-medium mt-2`}
																>
																	Add Cover
																	Art
																</p>
																<p className='text-[12px] text-black  -mt-2'>
																	800 x 800
																</p>
															</>
														)}
														<input
															ref={(el) => {
																if (
																	isActionDisabled
																)
																	return;
																bundleInputRef.current[
																	idx
																] = el;
															}}
															type='file'
															accept='image/*'
															hidden
															onChange={
																async (e) => {
																	if (
																		isActionDisabled
																	)
																		return;
																	if (
																		e.target
																			.files
																	) {
																		const cFile =
																			e
																				.target
																				.files[0];

																		// bundleFA.update(
																		// 	idx,
																		// 	{
																		// 		...field,
																		// 		assetCover:
																		// 			cFile.name,
																		// 		assetCoverFile:
																		// 			cFile,
																		// 	}
																		// );

																		// const bundle =
																		// 	voucher
																		// 		?.metadata
																		// 		?.properties
																		// 		?.bundle ??
																		// 	[];

																		try {
																			const result =
																				await handleChunkedUpload(
																					cFile,
																					-3
																				); // -3 indicates bundle cover upload

																			if (
																				result &&
																				result.status ===
																					'completed' &&
																				result.cdn
																			) {
																				const currentBundle =
																					[
																						...(voucher
																							?.metadata
																							?.properties
																							?.bundle ??
																							[]),
																					];

																				currentBundle[
																					idx
																				] =
																					{
																						...currentBundle[
																							idx
																						],
																						assetCover:
																							result.cdn,
																						assetCoverFile:
																							cFile,
																					};

																				bundleFA.update(
																					idx,
																					{
																						...field,
																						assetCover:
																							result.cdn,
																						assetCoverFile:
																							cFile,
																					}
																				);

																				setVoucher(
																					{
																						metadata:
																							{
																								...voucher?.metadata,
																								properties:
																									{
																										...voucher
																											?.metadata
																											?.properties,
																										bundle: currentBundle,
																									},
																							},
																					}
																				);
																			} else if (
																				result &&
																				result.status ===
																					'failed'
																			) {
																				ToastMessage(
																					'error',
																					'Error in uploading media file'
																				);
																			} else if (
																				result &&
																				result.status ===
																					'cancelled'
																			) {
																				ToastMessage(
																					'error',
																					'Upload cancelled'
																				);
																			} else {
																				ToastMessage(
																					'error',
																					'Error in uploading media file'
																				);
																			}
																		} catch (e) {
																			console.log(
																				e
																			);
																			ToastMessage(
																				'error',
																				'Error in uploading media file'
																			);
																			return;
																		}
																	}
																}
																// handleCoverUpload(e, false)
															}
														/>
													</div>
												)}
												{field.uri &&
													!IsImage(
														field.uriFile?.name ||
															''
													) &&
													!field.assetCover && (
														<p className='text-red-800 '>
															<span className='-mt-2'>
																*
															</span>
															Upload success,
															let&#39;s add a
															cover!
														</p>
													)}
											</div>

											<div className='flex-1 flex flex-col gap-5'>
												<div>
													<p className='text-black font-semibold text-[16px] '>
														Product Name
													</p>
													<Input
														size='md'
														variant='bordered'
														className='flex-1 mt-2'
														disabled={
															isActionDisabled
														}
														onValueChange={(
															val
														) => {
															bundleFA.update(
																idx,
																{
																	...field,
																	name: val,
																}
															);
															const bundle =
																voucher
																	?.metadata
																	?.properties
																	?.bundle ??
																[];
															bundle[idx] = {
																...field,
																name: val,
															};

															setVoucher({
																metadata: {
																	...voucher?.metadata,
																	properties:
																		{
																			...voucher
																				?.metadata
																				?.properties,
																			bundle: bundle,
																		},
																},
															});
														}}
														value={field.name}
														classNames={{
															base: 'bg-transparent',
															input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
															inputWrapper: `${
																isActionDisabled
																	? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
																	: ' border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] '
															}  rounded-lg border `,
														}}
													/>
													<p className='text-red-500  text-[11px] mt-1 ml-1'>
														{errors.bundle?.length
															? errors.bundle[idx]
																	?.name
																	?.message
															: ''}
													</p>
												</div>
												<div>
													<p className='text-black font-semibold text-[16px] '>
														Product Description
														(Public)
													</p>
													<Textarea
														size='md'
														maxRows={20}
														variant='bordered'
														className='mt-2'
														disabled={
															isActionDisabled
														}
														value={
															field.description
														}
														placeholder='Information that is visible to the public.'
														classNames={{
															base: 'bg-transparent',
															input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:font-light placeholder:italic text-[16px] font-semibold',
															inputWrapper: `${
																isActionDisabled
																	? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
																	: ' border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] '
															}  rounded-lg border `,
														}}
														onValueChange={(
															val
														) => {
															bundleFA.update(
																idx,
																{
																	...field,
																	description:
																		val,
																}
															);
															const bundle =
																voucher
																	?.metadata
																	?.properties
																	?.bundle ??
																[];
															bundle[idx] = {
																...field,
															};

															setVoucher({
																metadata: {
																	...voucher?.metadata,
																	properties:
																		{
																			...voucher
																				?.metadata
																				?.properties,
																			bundle: bundle,
																		},
																},
															});
														}}
													/>
													<p className='text-red-500  text-[11px] mt-1 ml-1'>
														{errors.bundle?.length
															? errors.bundle[idx]
																	?.description
																	?.message
															: ''}
													</p>
												</div>

												<div>
													<p className='text-black font-semibold text-[16px] '>
														Product Description
														(Private) - Optional
													</p>
													<Textarea
														size='md'
														maxRows={20}
														variant='bordered'
														disabled={
															isActionDisabled
														}
														value={
															field.ownerDescription
														}
														className='mt-2'
														placeholder='Leave a private message that only the product owner can see. This can be private access links, promo codes, vouchers etc'
														classNames={{
															base: 'bg-transparent',
															input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:font-light placeholder:italic text-[16px] font-semibold',
															inputWrapper: `${
																isActionDisabled
																	? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
																	: ' border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] '
															}  rounded-lg border `,
														}}
														onValueChange={(
															val
														) => {
															bundleFA.update(
																idx,
																{
																	...field,
																	ownerDescription:
																		val,
																}
															);
															const bundle =
																voucher
																	?.metadata
																	?.properties
																	?.bundle ??
																[];
															bundle[idx] = {
																...field,
															};

															setVoucher({
																metadata: {
																	...voucher?.metadata,
																	properties:
																		{
																			...voucher
																				?.metadata
																				?.properties,
																			bundle: bundle,
																		},
																},
															});
														}}
													/>
													{/* <p className='text-red-500 capitalize text-[11px] mt-1 ml-1'>
														{errors.bundle?.length
															? errors.bundle[idx]
																	?.ownerDescription
																	?.message
															: ''}
													</p> */}
												</div>
												<div>
													<p className='text-black font-semibold text-[16px] '>
														Category
													</p>
													<Select
														size='md'
														variant='bordered'
														aria-label='Speed'
														isDisabled={
															isActionDisabled
														}
														// value={'AI'}
														defaultSelectedKeys={
															field.category
																.length > 0
																? [
																		catogories
																			.find(
																				(
																					t
																				) =>
																					t.val ===
																					(field.category ??
																						voucher
																							?.metadata
																							?.properties
																							?.bundle?.[
																							idx
																						]
																							?.category)
																			)
																			?.key.toString() ??
																			'0',
																  ]
																: []
														}
														className='mt-3 '
														classNames={{
															base: `bg-transparent text-[#1A1A1A] ${
																isActionDisabled
																	? 'opacity-20'
																	: ''
															}`,
															value: 'placeholder:text-[#9E9E9D]  text-[16px] font-semibold',
															trigger:
																'border border-[#1A1A1A]  data-[hover=true]:border-[#1A1A1A] group-data-[focus=true]:border-[#1A1A1A] rounded-lg',
															popoverContent:
																'bg-[#f1f0eb] border border-[#1A1A1A]',
															selectorIcon:
																'text-[#1A1A1A] h-[20px] w-[20px]',
															listbox:
																'text-[#1A1A1A]',
														}}
														onChange={(e) => {
															const selectedCat =
																catogories.find(
																	(i) =>
																		i.key ===
																		Number(
																			e
																				.target
																				.value
																		)
																);
															bundleFA.update(
																idx,
																{
																	...field,
																	category:
																		selectedCat!
																			.val,
																}
															);
															const bundle =
																voucher
																	?.metadata
																	?.properties
																	?.bundle ??
																[];
															bundle[idx] = {
																...field,
																category:
																	selectedCat!
																		.val,
															};

															setVoucher({
																metadata: {
																	...voucher?.metadata,
																	properties:
																		{
																			...voucher
																				?.metadata
																				?.properties,
																			bundle: bundle,
																		},
																},
															});
														}}
													>
														{catogories.map(
															(val) => (
																<SelectItem
																	key={
																		val.key
																	}
																>
																	{val.val}
																</SelectItem>
															)
														)}
													</Select>
													<p className='text-red-500  text-[11px] mt-1 ml-1'>
														{errors.bundle
															?.length &&
														typeof errors.bundle[
															idx
														]?.category === 'object'
															? errors.bundle[idx]
																	?.category
																	?.message
															: ''}
													</p>
												</div>

												<div>
													<p className='text-black font-semibold text-[16px]'>
														Upload
													</p>
													<div className='flex flex-row gap-4 items-center'>
														<div
															className={`flex flex-row  gap-3 mt-2 border ${
																isActionDisabled
																	? 'opacity-50 border-[#1A1A1A]/30'
																	: 'border-[#1A1A1A]'
															} p-2 rounded-lg w-full`}
														>
															<p
																className={`text-[16px] ml-2 italic  font-semibold text-left
																${field.uri ? `text-[#1A1A1A]` : `text-[#9E9E9D]`}
																`}
															>
																{field.uri
																	? field
																			.uriFile
																			?.name
																	: 'Choose your asset'}
															</p>
														</div>
														{!isActionDisabled && (
															<div
																onClick={(e) =>
																	handleBundleImageClick(
																		e,
																		true,
																		idx
																	)
																}
																className='w-[40px] h-[40px] mt-2 cursor-pointer bg-[#D9D9D9] rounded-lg flex justify-center items-center'
															>
																<Image
																	src={
																		'/uploadIcon.svg'
																	}
																	alt={'add'}
																	width={18}
																	height={18}
																/>
																<input
																	ref={(
																		el
																	) => {
																		bundleUploadRef.current[
																			idx
																		] = el;
																	}}
																	type='file'
																	hidden
																	onChange={async (
																		e
																	) => {
																		if (
																			e
																				.target
																				.files &&
																			e
																				.target
																				.files
																				.length >
																				0
																		) {
																			const mFile =
																				e
																					.target
																					.files[0];

																			setisUploading(
																				true
																			);
																			const result =
																				await handleChunkedUpload(
																					mFile,
																					idx
																				);
																			setisUploading(
																				false
																			);
																			if (
																				result
																			) {
																				if (
																					result.status ===
																						'completed' &&
																					result.cdn
																				) {
																					const bundle =
																						voucher
																							?.metadata
																							?.properties
																							?.bundle ??
																						[];
																					bundleFA.update(
																						idx,
																						{
																							...field,
																							uri: result.cdn,
																							uriFile:
																								mFile,
																							assetCover:
																								IsImage(
																									mFile.name
																								)
																									? result.cdn
																									: undefined,
																							assetCoverFile:
																								IsImage(
																									mFile.name
																								)
																									? mFile
																									: undefined,
																						}
																					);
																					bundle[
																						idx
																					] =
																						{
																							...field,
																							uri: result.cdn,
																							uriFile:
																								mFile,
																							type: mFile.type.replace(
																								'/',
																								'_'
																							),
																							assetCover:
																								IsImage(
																									mFile.name
																								)
																									? result.cdn
																									: undefined,
																							assetCoverFile:
																								IsImage(
																									mFile.name
																								)
																									? mFile
																									: undefined,
																						};
																					setVoucher(
																						{
																							metadata:
																								{
																									...voucher?.metadata,
																									properties:
																										{
																											...voucher
																												?.metadata
																												?.properties,
																											bundle: bundle,
																										},
																								},
																						}
																					);
																				} else if (
																					result.status ===
																					'failed'
																				) {
																					ToastMessage(
																						'error',
																						'Error in uploading media file'
																					);
																				} else if (
																					result.status ===
																					'cancelled'
																				) {
																					ToastMessage(
																						'error',
																						'Upload cancelled'
																					);
																				} else {
																					ToastMessage(
																						'error',
																						'Error in uploading media file'
																					);
																				}
																			}
																		} else {
																			setisUploading(
																				false
																			);
																		}
																		setisUploading(
																			false
																		);
																	}}
																/>
															</div>
														)}
													</div>
													<p className='text-red-500   text-[11px] mt-1 ml-1'>
														{errors.bundle?.length
															? errors.bundle[idx]
																	?.uri
																	?.message
															: ''}
													</p>
												</div>
											</div>
										</div>
									</AccordionItem>
								);
							})}
						</Accordion>
					</div>
					{!isActionDisabled && (
						<button
							className='text-black mx-4 my-0'
							type='button'
							onClick={() => {
								bundleFA.append({
									name: '',
									description: '',
									ownerDescription: '',
									uri: '',
									category: '',
									assetCoverFile: undefined,
									uriFile: undefined,
									assetCover: '',
									oldItem: 0,
									// tags: [],
								});
								flipBundle();
							}}
						>
							+ Add Item
						</button>
					)}
				</div>
			</form>

			{/* Upload Progress Modal */}
			<UploadProgressModal
				isOpen={showUploadModal}
				uploadProgress={currentUpload}
				onClose={() => {
					setShowUploadModal(false);
					setCurrentUploadingFile(null);
					setCurrentUploadingIndex(-1);
					setisUploading(false);
				}}
			/>
		</div>
	);
}
