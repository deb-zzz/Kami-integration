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
import BundleProduct from './BundleProduct';

type BundleAccordionProps = {
	isActionDisabled?: boolean;
	control: Control<any>;
	setValue: UseFormSetValue<any>;
	trigger: UseFormTrigger<any>;
	watch: UseFormWatch<any>;
	errors: FieldErrors<any>;
	bundleFieldArray: UseFieldArrayReturn<any, 'bundle', 'id'>;
};

export default function BundleAccordion({
	isActionDisabled = false,
	control,
	setValue,
	trigger,
	watch,
	errors,
	bundleFieldArray,
}: BundleAccordionProps) {
	// Watch bundle array from form
	const bundleItems = watch('bundle') || [];

	// Local state for File objects (form only stores URLs)
	const [fileMap, setFileMap] = useState<Record<string, File | null>>({});
	const [thumbnailMap, setThumbnailMap] = useState<
		Record<string, File | null>
	>({});
	const nextOrderRef = useRef<number>(1);

	// Initialize with default item if bundle is empty
	useEffect(() => {
		if (bundleItems.length === 0) {
			nextOrderRef.current = 1; // Reset to 1 when starting fresh
			bundleFieldArray.append({
				name: '',
				ownerDescription: '',
				asset: '',
				category: '',
				order: 1,
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Initialize order numbers for existing items that don't have one yet
	useEffect(() => {
		// Calculate the next order number based on existing orders
		const maxOrder = bundleItems.reduce((max: number, item: any) => {
			return item?.order && item.order > max ? item.order : max;
		}, 0);
		nextOrderRef.current = maxOrder + 1;

		bundleFieldArray.fields.forEach((field, index) => {
			const bundleItem = bundleItems[index];
			if (bundleItem && !bundleItem.order) {
				setValue(`bundle.${index}.order`, nextOrderRef.current++);
			}
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bundleFieldArray.fields.length]);

	// Get stable order number for an index
	const getOrder = (index: number) => {
		return bundleItems[index]?.order || index + 1;
	};
	const [expandedIndex, setExpandedIndex] = useState<number | null>(
		bundleItems.length > 0 ? 0 : null
	);
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [isDragOver, setIsDragOver] = useState<Record<string, boolean>>({});
	const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>(
		{}
	);

	// Update expanded index when bundle items change
	useEffect(() => {
		if (bundleItems.length === 0) {
			setExpandedIndex(null);
			nextOrderRef.current = 1; // Reset to 1 when array becomes empty
		} else if (
			expandedIndex !== null &&
			expandedIndex >= bundleItems.length
		) {
			// If the expanded index is out of bounds, adjust it
			setExpandedIndex(Math.max(0, bundleItems.length - 1));
		}
		// Removed auto-open logic to allow closing all accordions
	}, [bundleItems.length, expandedIndex]);

	const getIsDragOver = (fieldId: string): boolean => {
		return isDragOver[fieldId] ?? false;
	};

	const handleAddBundle = () => {
		const newIndex = bundleFieldArray.fields.length;
		// Calculate the next order number based on existing orders
		const maxOrder = bundleItems.reduce((max: number, item: any) => {
			return item?.order && item.order > max ? item.order : max;
		}, 0);
		const nextOrder = maxOrder + 1;
		nextOrderRef.current = nextOrder + 1;

		bundleFieldArray.append({
			name: '',
			ownerDescription: '',
			asset: '',
			category: '',
			order: nextOrder,
		});
		setExpandedIndex(newIndex);
		trigger('bundle');
	};

	const handleDelete = (index: number) => {
		const fieldId = bundleFieldArray.fields[index]?.id;
		bundleFieldArray.remove(index);
		if (expandedIndex === index) {
			const newLength = bundleItems.length - 1;
			setExpandedIndex(newLength > 0 ? Math.max(0, index - 1) : null);
		} else if (expandedIndex !== null && expandedIndex > index) {
			setExpandedIndex(expandedIndex - 1);
		}
		// Clean up file maps
		if (fieldId) {
			setFileMap((prev) => {
				const newMap = { ...prev };
				delete newMap[fieldId];
				return newMap;
			});
			setThumbnailMap((prev) => {
				const newMap = { ...prev };
				delete newMap[fieldId];
				return newMap;
			});
		}
		trigger('bundle');
	};

	const handleToggle = (index: number) => {
		// If clicking the same item, close it; otherwise open the clicked one
		setExpandedIndex(expandedIndex === index ? null : index);
	};

	const handleDragStart = (e: React.DragEvent, index: number) => {
		if (bundleItems.length <= 1) return; // Don't allow drag if only one item
		setDraggedIndex(index);
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/html', '');
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.stopPropagation();
		if (draggedIndex !== null && draggedIndex !== index) {
			setDragOverIndex(index);
		}
	};

	const handleDragLeave = () => {
		setDragOverIndex(null);
	};

	const handleDrop = (e: React.DragEvent, dropIndex: number) => {
		e.preventDefault();
		e.stopPropagation();

		if (draggedIndex === null || draggedIndex === dropIndex) {
			setDraggedIndex(null);
			setDragOverIndex(null);
			return;
		}

		// Use bundleFieldArray.move to reorder items
		bundleFieldArray.move(draggedIndex, dropIndex);

		// Update expanded index if needed
		if (expandedIndex === draggedIndex) {
			setExpandedIndex(dropIndex);
		} else if (expandedIndex === dropIndex) {
			setExpandedIndex(draggedIndex);
		}

		setDraggedIndex(null);
		setDragOverIndex(null);
		trigger('bundle');
	};

	const handleFileDragOver = useCallback(
		(e: React.DragEvent, fieldId: string) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver((prev) => ({ ...prev, [fieldId]: true }));
		},
		[]
	);

	const handleFileDragLeave = useCallback(
		(e: React.DragEvent, fieldId: string) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver((prev) => ({ ...prev, [fieldId]: false }));
		},
		[]
	);

	const handleFileSelect = (file: File, index: number) => {
		if (!isValidFileFormat(file.name)) {
			ToastMessage(
				'error',
				'File format not supported. Please upload a file with an allowed format.'
			);
			return;
		}

		const fileUrl = URL.createObjectURL(file);
		const fieldId = bundleFieldArray.fields[index]?.id;

		// Store file in local state
		if (fieldId) {
			setFileMap((prev) => ({ ...prev, [fieldId]: file }));
		}

		// Update form with file URL
		setValue(`bundle.${index}.asset`, fileUrl);
		trigger(`bundle.${index}.asset`);
	};

	const handleFileDrop = useCallback(
		(e: React.DragEvent, index: number) => {
			e.preventDefault();
			e.stopPropagation();
			const fieldId = bundleFieldArray.fields[index]?.id;
			if (fieldId) {
				setIsDragOver((prev) => ({ ...prev, [fieldId]: false }));
			}

			const files = Array.from(e.dataTransfer.files);
			if (files.length > 0) {
				handleFileSelect(files[0], index);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[bundleFieldArray.fields]
	);

	const handleFileInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		index: number
	) => {
		if (e.target.files && e.target.files.length > 0) {
			handleFileSelect(e.target.files[0], index);
		}
	};

	const handleButtonClick = (fieldId: string) => {
		fileInputRefs.current[fieldId]?.click();
	};
	const handleDuplicate = (index: number) => {
		// Calculate the next order number based on existing orders
		const maxOrder = bundleItems.reduce((max: number, item: any) => {
			return item?.order && item.order > max ? item.order : max;
		}, 0);
		const nextOrder = maxOrder + 1;
		nextOrderRef.current = nextOrder + 1;

		bundleFieldArray.append({
			name: bundleItems[index]?.name || '',
			description: bundleItems[index]?.description || '',
			ownerDescription: bundleItems[index]?.ownerDescription || '',
			asset: bundleItems[index]?.asset || '',
			category: bundleItems[index]?.category || '',
			assetCover: bundleItems[index]?.assetCover || '',
			order: nextOrder,
		});
		// // Duplicate the item
		// bundleFieldArray.append({
		// 	name: bundleItem?.name || '',
		// 	description:
		// 		bundleItem?.description ||
		// 		'',
		// 	ownerDescription:
		// 		bundleItem?.ownerDescription ||
		// 		'',
		// 	asset: bundleItem?.asset || '',
		// 	category:
		// 		bundleItem?.category || '',
		// 	assetCover:
		// 		bundleItem?.assetCover ||
		// 		'',
		// });
		trigger('bundle');
	};
	return (
		<div className='flex flex-col gap-4 w-full mt-8'>
			{/* Header */}
			<div className='flex flex-col gap-2'>
				<p className='text-[#9E9E9D] text-[12px] font-light'>
					OPTIONAL
				</p>
				<h2 className='text-[#F1F0EB] text-[20px] font-semibold'>
					Bundle Products
				</h2>
			</div>

			{/* Bundle Items */}
			<div className='flex flex-col gap-4'>
				{bundleFieldArray.fields.map((field, index) => {
					const bundleItem = bundleItems[index];
					const fieldId = field.id;
					const isExpanded = expandedIndex === index;
					const isDragging = draggedIndex === index;
					const isDragOver = dragOverIndex === index;
					const file = fileMap[fieldId] || null;
					const fileUrl = bundleItem?.asset || null;

					return (
						<div
							key={fieldId}
							draggable={
								bundleItems.length > 1 &&
								!isActionDisabled &&
								!isExpanded
							}
							onDragStart={(e) => handleDragStart(e, index)}
							onDragOver={(e) => handleDragOver(e, index)}
							onDragLeave={handleDragLeave}
							onDrop={(e) => handleDrop(e, index)}
							className={`border rounded-lg transition-all ${
								isDragging
									? 'border-[#11FF49] bg-[#11FF49]/10 opacity-70'
									: 'border-[#F1F0EB]'
							} ${isDragOver ? 'border-[#11FF49]' : ''}`}
							style={{
								cursor:
									bundleItems.length > 1 && !isExpanded
										? 'move'
										: 'default',
							}}
						>
							{/* Accordion Header */}
							<div className='flex items-center gap-3 p-3 '>
								{/* Drag Handle */}
								{bundleItems.length > 1 &&
									!isActionDisabled && (
										<Image
											src='/arrows/drag.svg'
											alt='drag'
											width={10}
											height={10}
											draggable={false}
										/>
									)}

								{/* Name */}
								<div className='flex-1 flex flex-col'>
									{bundleItem?.name ||
										`Bundle Product #${getOrder(index)}`}
								</div>

								{/* Copy Icon */}
								{!isActionDisabled && (
									<button
										type='button'
										onClick={() => {
											// Duplicate the item
											handleDuplicate(index);
										}}
										className='p-1 hover:bg-[#323131] rounded transition-colors'
									>
										<Image
											src='/copy.svg'
											alt='Copy'
											width={20}
											height={20}
										/>
									</button>
								)}

								{/* Expand/Collapse Icon */}
								<button
									type='button'
									onClick={() => handleToggle(index)}
									disabled={isActionDisabled}
									className='p-1 hover:bg-[#323131] rounded transition-colors mt-1'
								>
									<Image
										src='/arrows/chevron-down.svg'
										alt={'chevron-down'}
										width={15}
										height={15}
										className={`transition-transform ${
											isExpanded ? 'rotate-180' : ''
										}`}
									/>
								</button>

								{/* Delete Icon */}
								{!isActionDisabled && (
									<button
										type='button'
										onClick={() => handleDelete(index)}
										className='p-1 hover:bg-[#323131] rounded transition-colors'
									>
										<Image
											src='/creator/trashGrey.svg'
											alt='Delete'
											width={20}
											height={20}
										/>
									</button>
								)}
							</div>

							{/* Accordion Content */}
							{isExpanded && (
								<div className='p-6'>
									{/* Upload Area */}
									{!bundleItem?.asset &&
										(() => {
											const isItemDragOver =
												getIsDragOver(fieldId);
											return (
												<div
													className={`relative  rounded-lg px-8 pt-12 pb-8 text-center transition-all duration-200 ${
														isItemDragOver
															? 'border-[#A79755] bg-[#A79755]/10'
															: 'border-[#F1F0EB]/30 hover:border-[#A79755]/50'
													}`}
													onDragOver={(e) =>
														handleFileDragOver(
															e,
															fieldId
														)
													}
													onDragLeave={(e) =>
														handleFileDragLeave(
															e,
															fieldId
														)
													}
													onDrop={(e) =>
														handleFileDrop(e, index)
													}
												>
													<input
														ref={(el) => {
															fileInputRefs.current[
																fieldId
															] = el;
														}}
														type='file'
														className='hidden'
														onChange={(e) =>
															handleFileInputChange(
																e,
																index
															)
														}
														accept='*/*'
													/>

													<div className='flex flex-col items-center gap-6'>
														<div className='flex flex-col justify-center items-center gap-4'>
															<div className='w-20 h-20 bg-[#A79755] rounded-full flex items-center justify-center'>
																<Image
																	src='/uploadIconWhite.svg'
																	alt='Upload'
																	width={40}
																	height={40}
																	className='opacity-70'
																/>
															</div>
															<div>
																<p className='text-[15px] font-semibold text-[#F1F0EB] mb-2'>
																	Drag and
																	drop files
																	to upload
																</p>
																<p className='text-[#9E9E9D] text-[13px]'>
																	Your content
																	will be
																	private
																	until you
																	publish them
																</p>
															</div>
														</div>

														{!isActionDisabled && (
															<Button
																size='sm'
																onClick={() =>
																	handleButtonClick(
																		fieldId
																	)
																}
																variant='bordered'
																className='border border-[#F1F0EB] text-[#F1F0EB] font-medium hover:bg-[#323131]'
															>
																Select file
															</Button>
														)}
													</div>
													{/* Terms of Service */}
													<p className='text-[#9E9E9D] text-[10px] mt-6 text-center'>
														By submitting your
														content to KAMI, you
														acknowledge that you
														agree to KAMI&apos;s
														Terms of Service and
														Community Guidelines.
														Please be sure not to
														violate others&apos;
														copyright or privacy
														rights.
													</p>
												</div>
											);
										})()}

									{/* File Upload Error - shown when no file is uploaded */}
									{!bundleItem?.asset &&
										(errors.bundle as any)?.[index]
											?.asset && (
											<div className='mt-2'>
												<p className='text-red-500 text-[12px]'>
													{(errors.bundle as any)[
														index
													]?.asset?.message ||
														'Please select an asset to upload'}
												</p>
											</div>
										)}

									{/* File Preview */}
									{bundleItem?.asset && (
										<BundleProduct
											index={index}
											fieldId={fieldId}
											bundleItem={bundleItem}
											isActionDisabled={isActionDisabled}
											control={control}
											setValue={setValue}
											trigger={trigger}
											errors={errors}
											thumbnailMap={thumbnailMap}
											setThumbnailMap={setThumbnailMap}
										/>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Add Bundle Button */}
			{!isActionDisabled && (
				<div className='flex flex-row gap-2 items-center '>
					<button
						type='button'
						onClick={handleAddBundle}
						className='text-[#F1F0EB] text-[16px] font-semibold hover:text-[#F1F0EB]/80 transition-colors text-left self-start'
					>
						+ Add Bundle Product
					</button>
					{bundleFieldArray.fields.length > 0 && (
						<>
							<span className='text-[#9E9E9D] text-[12px]'>
								{' '}
								|{' '}
							</span>
							<button
								type='button'
								onClick={() =>
									handleDuplicate(
										bundleFieldArray.fields.length - 1
									)
								}
								className='text-[#F1F0EB] text-[16px] font-semibold hover:text-[#F1F0EB]/80 transition-colors text-left self-start'
							>
								Duplicate
							</button>
						</>
					)}
				</div>
			)}
		</div>
	);
}
