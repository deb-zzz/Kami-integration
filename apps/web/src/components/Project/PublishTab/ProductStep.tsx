'use client';

import Image from 'next/image';
import { Input, Textarea } from '@nextui-org/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, FieldError } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useLazyNFT } from '@/lib/VoucherContext';
import { AllProjectType } from '@/types';
import Tiptap from '@/components/Tiptap';

type TraitsType = {
	type: string;
	name: string;
};

type FormType = {
	project: {
		collection: {
			name: string;
			symbol: string;
			description: string;
			product: {
				description: string;
				traits?: { key: string; value: string; edit?: boolean }[];
			};
		};
	};
};

const schema = yup
	.object({
		project: yup.object().shape({
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
						/^(?=.*[a-zA-Z])[a-zA-Z0-9]+$/,
						'Please use 2-5 alphanumeric characters, with a min. of 1 alphabet'
					)
					.max(
						7,
						'Recommended to keep the symbol less than 7 character'
					)
					.required(),
				description: yup
					.string()
					.required('Collection description is required'),
				product: yup.object().shape({
					name: yup.string().trim().max(50, 'Must not exceed 50 characters').required('Product name is required'),
					description: yup.string(),
					traits: yup
						.array()
						.of(
							yup.object().shape({
								key: yup.string(),
								value: yup.string(),
								edit: yup.boolean().optional(),
							})
						)
						.min(1, 'At least one item is required') // Ensure at least one item exists in the array
						.test(
							'all-empty-fields',
							'At least one name or value field must be filled if there are items',
							(items) => {
								// If there are no items, this test doesn't apply (min(1) handles that)
								if (!items || items.length === 0) {
									return true;
								}

								// Check if ALL items have both key and value as empty strings
								const allFieldsAreEmpty = items.every(
									(item) =>
										(item.key === '' ||
											item.key === undefined ||
											item.key === null) &&
										(item.value === '' ||
											item.value === undefined ||
											item.value === null)
								);

								// If all fields are empty, return false (validation fails)
								return !allFieldsAreEmpty;
							}
						),
				}),
			}),
		}),
	})
	.required();

const productType: {
	type: 'Standard' | 'Claimable' | 'Series';
	name: string;
	description: string;
	contractType: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
	typeName: string;
}[] = [
	{
		type: 'Standard',
		contractType: 'ERC721C',
		name: 'Single product, single ID',
		description: 'Eg: 1/1 Art, Generative Art',
		typeName: 'Type 1',
	},

	{
		type: 'Claimable',
		contractType: 'ERC721AC',
		name: ' Multiple products, multiple IDs',
		description: 'Eg: Membership cards, Event tickets',
		typeName: 'Type 2',
	},
] as const;

// {
// 	type: 'Series',
// 	contractType: 'ERC1155C',
// 	name: ' Multiple products, single ID',
// 	description: 'Eg: Music, Comics, Movie, Podcast, Game Assets',
// 	typeName: 'Type 2',
// },

export default function ProductStep({
	project,
	onVerify,
	isActionDisabled,
}: {
	project: AllProjectType;
	onVerify: (verified: boolean) => void;
	isActionDisabled: boolean;
}) {
	// const [trait, setTrait] = useState<TraitsType[]>([]);
	// const [isTraits, setIsTraits] = useState<boolean>(false);

	const [voucher, setVoucher] = useLazyNFT();
	const [choosen, setChoosen] = useState<string | null>(
		voucher?.createType ?? null
	);

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
			project: {
				collection: {
					name: project.collection?.name,
					type: project.collection?.contractType,
					symbol: project.collection?.symbol,
					description: project.collection?.description,
					product: {
						traits: voucher?.metadata?.attributes?.map((i) => ({
							edit: false,
							key: i.trait_type,
							value: i.value,
						})),
					},
				},
			},
		},
		resolver: yupResolver(schema),
	});

	const traits = useFieldArray({
		name: 'project.collection.product.traits',
		control,
	});

	useEffect(() => {
		if (traits.fields.length === 0) {
			traits.replace({
				key: '',
				value: '',
				edit: true,
			});
		}
		// if (traits.fields.length === 2) {
		// 	traits.remove(traits.fields.length - 1);
		// }
	}, []);

	const createOption = [
		{ key: 'new', val: 'New Collection' },
		{ key: 'exist', val: 'Existing Collection' },
	];

	const onSubmit = (rawData: FormType | any) => {
		// console.log('trihgger');
		const data = {
			...rawData,
			traits:
				rawData.project.collection.product.traits?.filter(
					(d: { edit: any }) => !d.edit
				) ?? [],
		};
		// console.log(rawData);
	};

	useEffect(() => {
		if (project) {
			const collectionType = productType.find(
				(f) => f.contractType === project.collection?.contractType
			);
			const val = project.collection ? 'exist' : 'new';
			setVoucher({
				createType: val,
				type: collectionType?.type,
				contractType: collectionType?.contractType,
			});
			collectionType?.contractType &&
				setValue(
					'project.collection.type',
					collectionType?.contractType
				);
			setChoosen(val);
		}
	}, [project]);

	const validate = () => {
		trigger().then((val) => {
			onVerify(val);
		});
	};

	useEffect(() => {
		validate();
	}, [voucher]);

	const typeChoosen = useMemo(() => {
		if (voucher?.collection?.type) {
			setValue('project.collection.type', voucher?.collection?.type);
		}
		return (
			productType.find((f) => f.contractType === voucher?.contractType)
				?.contractType ?? voucher?.collection?.type
		);
	}, [voucher?.collection?.type, voucher?.contractType]);

	return (
		<div className='h-full w-full'>
			<div className='w-1/2'>
				{/* {project.collection ? '' : ''} */}
				{/* <p className='text-black font-semibold text-[16px] '>What are you creating today?</p>
				<Select
					size='md'
					variant='bordered'
					aria-label='type'
					defaultSelectedKeys={choosen ? [choosen] : []}
					className='mt-3'
					classNames={{
						base: 'bg-transparent text-[#1A1A1A]',
						value: 'placeholder:text-[#9E9E9D]  text-[16px] font-semibold',
						trigger:
							'border border-[#1A1A1A]  data-[hover=true]:border-[#1A1A1A] group-data-[focus=true]:border-[#1A1A1A] rounded-lg',
						popoverContent: 'bg-[#f1f0eb] border border-[#1A1A1A]',
						selectorIcon: 'text-[#1A1A1A] h-[20px] w-[20px]',
						listbox: 'text-[#1A1A1A]',
					}}
					placeholder='Select One'
					onChange={(e) => {
						// console.log('valooo', e.target.value);
						setVoucher({
							createType: e.target.value === 'new' ? 'new' : 'exist',
						});
						setChoosen(e.target.value);
					}}>
					{createOption.map((val) => (
						<SelectItem key={val.key}>{val.val}</SelectItem>
					))}
				</Select> */}
			</div>
			{choosen !== null && (
				<div className='flex flex-col gap-5 mt-6'>
					<form>
						<div>
							<p className='text-black font-semibold text-[16px]'>
								Select Product Type
								{!typeChoosen && (
									<span className='text-2xl text-red-600'>
										*
									</span>
								)}
							</p>
							<div className='flex flex-row gap-5 mt-3'>
								{productType.map((val, index) => (
									<div key={index} className='w-full'>
										<span className='text-[15px] font-semibold mb-2 text-black'>
											{val.typeName}:
										</span>
										<div
											key={val.type}
											onClick={() => {
												if (isActionDisabled)
													return false;
												if (
													project.collection ||
													project.collection !== null
												)
													return false;
												// setTypeChoosen(val.type);
												setValue(
													'project.collection.type',
													val.contractType
												);
												setVoucher({
													type: val.type,
													collection: {
														type: val.contractType,
													},
												});
											}}
											className={`flex-1 mt-2   flex flex-col gap-10 justify-between border border-[#1A1A1A] p-5 rounded-lg  ${
												typeChoosen === val.contractType
													? 'bg-[#11FF49]'
													: 'bg-transparent'
											} ${
												(project.collection &&
													val.contractType !==
														typeChoosen) ||
												isActionDisabled
													? 'opacity-50 border-gray-300'
													: 'opacity-100'
											} ${
												project.collection ||
												isActionDisabled
													? ''
													: 'cursor-pointer'
											} 
										${choosen === 'exist' ? 'opacity-50 border-gray-300' : ''}
										`}
										>
											<p
												className={`text-[16px] font-semibold ${
													project.collection &&
													typeChoosen !==
														val.contractType
														? 'text-gray-300'
														: 'text-black'
												}`}
											>
												{val.name
													.split(', ')
													.map((part, index) => (
														<React.Fragment
															key={index}
														>
															{part}
															{index <
																val.name.split(
																	', '
																).length -
																	1 && (
																<>
																	,<br />
																</>
															)}
														</React.Fragment>
													))}
											</p>
											<p
												className={`text-[13px] font-medium ${
													project.collection &&
													typeChoosen !==
														val.contractType
														? 'text-gray-300'
														: 'text-[#6E6E6E]'
												}`}
											>
												{val.description}
											</p>
										</div>
									</div>
								))}
							</div>
							<p className='text-red-500  text-[11px] mt-1 ml-1'>
								{(
									errors.project?.collection
										?.type as FieldError
								)?.message ?? ''}
							</p>
						</div>
						<div className='w-full flex flex-row gap-5 mt-4'>
							<div className='w-full'>
								<p className='text-black font-semibold text-[16px]'>
									Collection Name
								</p>
								{!project.collection && (
									<p className='font-light text-[12px] text-[#6E6E6E]  w-[90%] xl:w-[80%]'>
										What your Collection will be called in
										the marketplace. Collection names cannot
										be changed after it has been published.
									</p>
								)}
								<Input
									size='md'
									variant='bordered'
									className='mt-4'
									placeholder='eg: Lucha Loco'
									disabled={
										!!project.collection || isActionDisabled
									}
									onValueChange={
										(val) => {
											setVoucher({
												collection: {
													...voucher?.collection,
													name: val,
												},
											});
										}
										// updateProject(project)
									}
									classNames={{
										base: 'bg-transparent',
										input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
										inputWrapper: `border ${
											project.collection ||
											isActionDisabled
												? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
												: 'border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A]'
										} group-data-[focus=true]:border-[#0D6EFD]  rounded-lg bg-transparent`,
									}}
									{...register('project.collection.name')}
									defaultValue={
										project.collection
											? project.collection.name
											: voucher?.collection?.name
									}
								/>
								<p className='text-red-500  text-[11px] mt-1 ml-1'>
									{errors.project?.collection?.name
										?.message ?? ''}
								</p>
								{/* <ErrorMessage errors={errors} name='singleErrorInput' /> */}
							</div>
							<div className='w-full'>
								<p className='text-black font-semibold text-[16px]'>
									Collection Identifier
								</p>
								{!project.collection && (
									<p className='font-light text-[12px] text-[#6E6E6E] w-[90%] xl:w-[80%]'>
										The shorthand identifier used to
										identify your Collection. Collection
										identifier cannot be changed after your
										Collection has been published.
									</p>
								)}
								<Input
									size='md'
									variant='bordered'
									className=' mt-4'
									style={{ textTransform: 'uppercase' }}
									placeholder='eg: LOCO'
									disabled={
										!!project.collection || isActionDisabled
									}
									{...register('project.collection.symbol')}
									onValueChange={(val) =>
										setVoucher({
											collection: {
												...voucher?.collection,
												symbol: val,
											},
										})
									}
									defaultValue={
										project.collection
											? project.collection.symbol
											: voucher?.collection?.symbol
									}
									classNames={{
										base: 'bg-transparent',
										input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
										inputWrapper: `border ${
											project.collection ||
											isActionDisabled
												? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
												: 'border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A]'
										}  group-data-[focus=true]:border-[#0D6EFD] rounded-lg bg-transparent`,
									}}
								/>
								<p className='text-red-500  text-[11px] mt-1 ml-1'>
									{errors.project?.collection?.symbol
										?.message ?? ''}
								</p>
							</div>
						</div>
						<div className='w-full flex flex-row gap-5 mt-4'>
							<div className='w-full'>
								<p className='text-black font-semibold text-[16px]'>
									Collection Description
								</p>
								<Textarea
									size='md'
									maxRows={20}
									variant='bordered'
									disabled={
										!!project.collection || isActionDisabled
									}
									className='mt-3'
									{...register(
										'project.collection.description'
									)}
									defaultValue={
										project.collection
											? project.collection.description
											: voucher?.collection?.description
									}
									onValueChange={(val) =>
										setVoucher({
											collection: {
												...voucher?.collection,
												description: val,
											},
										})
									}
									placeholder='Tell the story behind your Collection idea.'
									classNames={{
										base: 'bg-transparent',
										input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[13px] placeholder:text-[#9E9E9D] placeholder:font-light placeholder:italic text-[16px] font-semibold',
										inputWrapper: `border ${
											project.collection ||
											isActionDisabled
												? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
												: 'border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A]'
										} group-data-[focus=true]:border-[#0D6EFD]  rounded-lg`,
									}}
								/>
								<p className='text-red-500  text-[11px] mt-1 ml-1'>
									{errors.project?.collection?.description
										?.message ?? ''}
								</p>
							</div>
						</div>

						{/* <hr /> */}

						<div className='w-full mt-4'>
							<p className='text-black font-semibold text-[16px]'>
								Product Name
							</p>

							<Textarea
								size='md'
								maxRows={20}
								variant='bordered'
								className='mt-3'
								disabled={isActionDisabled}
								{...register('project.collection.product.name')}
								defaultValue={voucher?.metadata?.name}
								onValueChange={(val) =>
									setVoucher({
										metadata: {
											...voucher?.metadata,
											name: val,
										},
									})
								}
								placeholder='Name a specific product within the Collection.'
								classNames={{
									base: 'bg-transparent',
									input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[13px] placeholder:text-[#9E9E9D] placeholder:font-light placeholder:italic text-[16px] font-semibold',
									inputWrapper: `${
										isActionDisabled
											? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
											: ' border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] '
									}  rounded-lg border `,
								}}
							/>
							<p className='text-red-500  text-[11px] mt-1 ml-1'>
								{errors.project?.collection?.product?.name
									?.message ?? ''}
							</p>
						</div>

						<div className='w-full mt-4'>
							<p className='text-black font-semibold text-[16px]'>
								Product Description (Optional)
							</p>
							<p className='font-light text-[12px] text-[#6E6E6E] w-[90%] xl:w-[80%]'>
								Tell the story of a specific product within the
								Collection. Leave this blank if you want it to
								be the same as Collection Description.
							</p>
							{/* <Textarea
									size='md'
									maxRows={20}
									variant='bordered'
									className='mt-3'
									disabled={isActionDisabled}
									{...register(
										'project.collection.product.description'
									)}
									defaultValue={
										voucher?.metadata?.description
									}
									onValueChange={(val) =>
										setVoucher({
											metadata: {
												...voucher?.metadata,
												description: val,
											},
										})
									}
									placeholder='Tell the story of a specific product within the Collection. Leave this blank if you want it to be the same as Collection Description.'
									classNames={{
										base: 'bg-transparent',
										input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[13px] placeholder:text-[#9E9E9D] placeholder:font-light placeholder:italic text-[16px] font-semibold',
										inputWrapper: `${
											isActionDisabled
												? 'opacity-50 border-[#1A1A1A]/30 group-data-[hover=true]:border-[#1A1A1A]/30'
												: ' border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] '
										}  rounded-lg border `,
									}}
								/> */}
							<div className='mt-3'>
								<Tiptap
									content={voucher?.metadata?.description}
									onChange={(newContent: string) =>
										setVoucher({
											metadata: {
												...voucher?.metadata,
												description: newContent,
											},
										})
									}
									isLightMode
								/>
							</div>
							<p className='text-red-500  text-[11px] mt-1 ml-1'>
								{errors.project?.collection?.product
									?.description?.message ?? ''}
							</p>
						</div>
						<div className='w-1/2  mt-4'>
							<p className='text-black font-semibold text-[16px]'>
								Traits
							</p>
							<p className='font-light text-[12px] text-[#6E6E6E] w-[90%]'>
								Describe the attributes of your product. These
								will be used as filters in your Collection page
								and listed out on your product page.
							</p>
							{/* {console.log(errors)} */}

							{traits.fields.length > 0 &&
								traits.fields.map((data, index) =>
									data.edit ? (
										<div key={index}>
											{!isActionDisabled && (
												<>
													<div className='flex flex-row gap-3 mt-3 items-end'>
														<div>
															<p className='text-black font-semibold text-[16px]'>
																Type
															</p>
															<Input
																size='md'
																variant='bordered'
																className='mt-2'
																value={data.key}
																placeholder='eg: Color'
																classNames={{
																	base: 'bg-transparent',
																	input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
																	inputWrapper:
																		'border border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] rounded-lg bg-transparent',
																}}
																onValueChange={(
																	val
																) =>
																	traits.update(
																		index,
																		{
																			...data,
																			key: val,
																		}
																	)
																}
															/>
														</div>
														<div>
															<p className='text-black font-semibold text-[16px] '>
																Name
															</p>
															<Input
																size='md'
																variant='bordered'
																className=' mt-2 '
																value={
																	data.value
																}
																placeholder='eg: Red'
																classNames={{
																	base: 'bg-transparent',
																	input: 'text-[#1A1A1A] group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
																	inputWrapper:
																		'border border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] group-data-[hover=true]:border-[#1A1A1A] rounded-lg bg-transparent',
																}}
																onValueChange={(
																	val
																) =>
																	traits.update(
																		index,
																		{
																			...data,
																			value: val,
																		}
																	)
																}
															/>
														</div>
														<button
															onClick={() => {
																traits.update(
																	index,
																	{
																		...data,
																		edit: false,
																	}
																);
																setVoucher({
																	...voucher,
																	metadata: {
																		...voucher?.metadata,
																		attributes:
																			getValues()
																				.project.collection.product.traits?.filter(
																					(
																						d
																					) =>
																						d.key !==
																							undefined &&
																						d.value !==
																							undefined &&
																						d.edit !==
																							undefined
																				)
																				.map(
																					(
																						d
																					) => ({
																						trait_type:
																							d.key as string,
																						value: d.value as string,
																					})
																				) ??
																			[],
																	},
																});
																validate();
															}}
															disabled={
																(data.key
																	?.length ??
																	0) < 2 ||
																(data.value
																	?.length ??
																	0) < 2
															}
															className={`${
																(data.key
																	?.length ??
																	0) < 2 ||
																(data.value
																	?.length ??
																	0) < 2
																	? 'opacity-50 bg-[#D9D9D9]'
																	: 'opacity-100 bg-[#11FF49]'
															}  h-fit max-w-[100px] py-2 px-4  text-[16px] font-semibold text-black rounded-lg `}
														>
															Add
														</button>
														{/* <button className='h-fit max-w-[100px] py-2 px-4 bg-[#D9D9D9] text-[16px] font-semibold text-black rounded-lg '>
										Remove
									</button> */}
													</div>
													{((data.key?.length ?? 0) <
														2 ||
														(data.value?.length ??
															0) < 2) && (
														<p className='text-red-600 mt-1'>
															Type & Name should
															contain more than 1
															character
														</p>
													)}
												</>
											)}
										</div>
									) : (
										<div
											key={index}
											className='flex flex-row gap-3 mt-3'
										>
											<div className='bg-[#D9D9D9]  w-full rounded-lg flex items-center h-fit py-2 px-4'>
												<p className='text-black text-[16px] font-semibold'>
													{data.key} : {data.value}
												</p>
											</div>
											{!isActionDisabled && (
												<>
													<button
														type='button'
														onClick={() => {
															traits.update(
																index,
																{
																	...data,
																	edit: true,
																}
															);
														}}
														className='h-fit max-w-[100px] p-2 bg-[#D9D9D9] text-[16px] font-semibold text-black rounded-lg '
													>
														<Image
															src={'/edit.svg'}
															alt={'edit'}
															width={30}
															height={30}
														/>
													</button>
													<button
														type='button'
														onClick={() => {
															traits.remove(
																index
															);
															setVoucher({
																...voucher,
																metadata: {
																	...voucher?.metadata,
																	attributes:
																		getValues()
																			.project.collection.product.traits?.filter(
																				(
																					d
																				) =>
																					d.key !==
																						undefined &&
																					d.value !==
																						undefined &&
																					d.edit !==
																						undefined
																			)
																			.map(
																				(
																					d
																				) => ({
																					trait_type:
																						d.key as string,
																					value: d.value as string,
																				})
																			) ??
																		[],
																},
															});

															if (
																traits.fields
																	.length ===
																1
															) {
																traits.append({
																	key: '',
																	value: '',
																	edit: true,
																});
															}
															validate();
														}}
														className='h-fit max-w-[100px] p-2 bg-[#D9D9D9] text-[16px] font-semibold text-black rounded-lg '
													>
														<Image
															src={
																'/creator/trash.svg'
															}
															alt={'delete'}
															width={30}
															height={30}
														/>
													</button>
												</>
											)}
										</div>
									)
								)}
							{!isActionDisabled && (
								<p
									className='text-black font-semibold text-[16px] cursor-pointer mt-3'
									onClick={() => {
										// setTraits((oldArray) => [...oldArray, emnptyTraits]);
										traits.append({
											key: '',
											value: '',
											edit: true,
										});
									}}
								>
									+ Add trait
								</p>
							)}
						</div>
					</form>
				</div>
			)}
		</div>
	);
}
