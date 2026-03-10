'use client';
import { CollaboratorType } from '@/types';
import {
	Table,
	TableHeader,
	TableColumn,
	TableBody,
	TableRow,
	TableCell,
	Avatar,
	Input,
	Button,
} from '@nextui-org/react';
import Image from 'next/image';
import router from 'next/router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ToastMessage } from '@/components/ToastMessage';
import { monetisationAction, saveMonetise } from '@/apihandler/Project';

type MonetiseProp = {
	collaborators: (CollaboratorType & { role?: string })[];
	isActionDisabled: boolean;
	walletAddress: string;
	royaltyPercentage: number;
	getData: () => Promise<void>;
	project: { projectId: number; projectName: string };
};
// Validation schema
const monetiseSchema = yup.object({
	mint: yup.object({
		beneficiaries: yup.array().of(
			yup.object({
				walletAddress: yup
					.string()
					.required('Wallet address is required'),
				percentage: yup
					.number()
					.typeError('Percentage must be a number')
					.min(0, 'Percentage must be at least 0%')
					.max(100, 'Percentage cannot exceed 100%')
					.transform((value, originalValue) => {
						// Convert empty string to 0
						return originalValue === '' ? 0 : value;
					}),
			})
		),
	}),
	royalties: yup.object({
		percentage: yup
			.number()
			.typeError('Creator earnings must be a number')
			.required('Creator earnings percentage is required')
			.min(0, 'Creator earnings must be at least 0%')
			.max(100, 'Creator earnings cannot exceed 100%')
			.transform((value, originalValue) => {
				// Convert empty string to 0
				return originalValue === '' ? 0 : value;
			}),
		beneficiaries: yup.array().of(
			yup.object({
				walletAddress: yup
					.string()
					.required('Wallet address is required'),
				percentage: yup
					.number()
					.typeError('Percentage must be a number')
					.min(0, 'Percentage must be at least 0%')
					.max(100, 'Percentage cannot exceed 100%')
					.transform((value, originalValue) => {
						// Convert empty string to 0
						return originalValue === '' ? 0 : value;
					}),
			})
		),
	}),
});

type FormData = yup.InferType<typeof monetiseSchema>;
export default function MonetiseStep(props: MonetiseProp) {
	const [collaboratorList, setCollaboratorList] = useState<
		(CollaboratorType & { isCreator?: boolean })[]
	>([]);

	// React Hook Form setup
	const {
		control,
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		watch,
		setValue,
	} = useForm({
		resolver: yupResolver(monetiseSchema),
		defaultValues: {
			mint: {
				beneficiaries: [
					{
						walletAddress: '',
						percentage: 0,
					},
				],
			},
			royalties: {
				percentage:
					props.royaltyPercentage === null
						? 0
						: props.royaltyPercentage,
				beneficiaries: [
					{
						walletAddress: '',
						percentage: 0,
					},
				],
			},
		},
	});

	useEffect(() => {
		if (props.collaborators?.length > 0) {
			let arr = [...props.collaborators];
			arr.map((collab) => {
				collab.role = collab.role || '';
			});

			// Filter based on access level
			if (props.isActionDisabled && props.walletAddress) {
				// Collaborators can only see their own details
				arr = arr.filter(
					(collab) => collab.userWalletAddress === props.walletAddress
				);
			}
			// Owners can see all collaborators (no filtering needed)

			setCollaboratorList(arr);

			// Always set form values from collaborator data
			const mintBeneficiaries = arr.map((collab) => ({
				walletAddress: collab.userWalletAddress,
				percentage: collab.primaryShare || 0,
			}));

			const royaltyBeneficiaries = arr.map((collab) => ({
				walletAddress: collab.userWalletAddress,
				percentage: collab.secondaryShare || 0,
			}));

			setValue('mint.beneficiaries', mintBeneficiaries);
			setValue('royalties.beneficiaries', royaltyBeneficiaries);
		}
	}, [props, setValue]);

	// Helper function to adjust shares to total 100%
	const adjustShares = (
		index: number,
		newValue: number,
		fieldPath: 'mint.beneficiaries' | 'royalties.beneficiaries'
	) => {
		const currentValues = watch(fieldPath) || [];
		const creatorIndex = currentValues.findIndex(
			(_, idx) => collaboratorList[idx]?.isCreator
		);

		if (creatorIndex === -1 || creatorIndex === index) return; // No creator found or this is the creator

		// Calculate total of other collaborators (excluding creator and current index)
		const otherTotal = currentValues.reduce((sum, value, idx) => {
			if (idx === creatorIndex || idx === index) return sum;
			return sum + (value.percentage || 0);
		}, 0);

		// Calculate creator's new share
		const creatorNewShare = Math.max(0, 100 - otherTotal - newValue);

		// Update creator's share immediately
		setValue(`${fieldPath}.${creatorIndex}.percentage`, creatorNewShare);
	};

	// Helper function to save monetization data
	const onSubmit = async (data: FormData) => {
		if (!props.walletAddress) return;
		try {
			// Filter out collaborators where neither role nor share has changed
			const filteredData = {
				...data,
				mint: {
					...data.mint,
					beneficiaries: data.mint?.beneficiaries?.filter(
						(beneficiary, index) => {
							const collaborator = collaboratorList[index];
							const originalShare =
								collaborator?.primaryShare || 0;
							const newShare = beneficiary.percentage || 0;
							// const originalRole = collaborator?.role || '';
							// const newRole = beneficiary.role || '';

							// Include if either share or role has changed
							return originalShare !== newShare;
						}
					),
				},
				royalties: {
					...data.royalties,
					beneficiaries: data.royalties?.beneficiaries?.filter(
						(beneficiary, index) => {
							const collaborator = collaboratorList[index];
							const originalShare =
								collaborator?.secondaryShare || 0;
							const newShare = beneficiary.percentage || 0;
							// const originalRole = collaborator?.role || '';
							// const newRole = beneficiary.role || '';

							// Include if either share or role has changed
							return originalShare !== newShare;
						}
					),
				},
			};
			const response = await saveMonetise(
				props.walletAddress,
				props.project.projectId,
				filteredData
			);

			if (response.success) {
				// Update collaborator statuses to 'Offered' on success
				setCollaboratorList((prevCollaborators) =>
					prevCollaborators.map((collab) => ({
						...collab,
						primaryStatus: 'Offered',
						secondaryStatus: 'Offered',
					}))
				);

				// Show success toast
				ToastMessage(
					'success',
					'Monetization data saved successfully!'
				);
			} else {
				ToastMessage(
					'error',
					'Failed to save monetization data. Please try again.'
				);
			}
		} catch (error) {
			console.error('Error saving monetization data:', error);
			ToastMessage(
				'error',
				'Failed to save monetization data. Please try again.'
			);
		}
	};

	const collabAction = async (action: string, isPrimary: boolean) => {
		if (!props.walletAddress) return;
		try {
			const data: any = {};
			if (isPrimary) {
				data.primaryStatus = action;
			} else {
				data.secondaryStatus = action;
			}
			const res = await monetisationAction(
				props.walletAddress,
				props.project.projectId,
				data
			);

			if (res.success) {
				const statusType = isPrimary
					? 'Revenue split proposal'
					: 'Creator royalties proposal';
				const actionText =
					action.toLowerCase() === 'accepted'
						? 'accepted'
						: 'rejected';
				ToastMessage('success', `${statusType} ${actionText}`);
				setCollaboratorList((prevCollaborators) =>
					prevCollaborators.map((collab) => {
						if (collab.userWalletAddress === props.walletAddress) {
							return {
								...collab,
								...(isPrimary
									? { primaryStatus: action }
									: { secondaryStatus: action }),
							};
						}
						return collab;
					})
				);
			} else {
				const statusType = isPrimary
					? 'Revenue Share'
					: 'Royalty Share';
				const actionText =
					action.toLowerCase() === 'accepted'
						? 'accepting'
						: 'rejecting';
				ToastMessage(
					'error',
					`Failed to ${actionText} ${statusType.toLowerCase()}. Please try again.`
				);
			}
		} catch (error) {
			console.error('Error updating monetization status:', error);
			const statusType = isPrimary ? 'Revenue Share' : 'Royalty Share';
			const actionText =
				action.toLowerCase() === 'accepted' ? 'accepting' : 'rejecting';
			ToastMessage(
				'error',
				`An error occurred while ${actionText} ${statusType.toLowerCase()}. Please try again.`
			);
		}
	};

	const columns = [
		{
			key: 'name',
			label: 'Creator',
		},
		{
			key: 'role',
			label: 'Role',
		},
		{
			key: 'share',
			label: 'Share %',
		},
		{
			key: 'status',
			label: 'Status',
		},
		{ key: 'action', label: '' },
	];

	const collabColumns = [
		{
			key: 'name',
			label: 'Collaborator',
		},
		{
			key: 'role',
			label: 'Role',
		},
	];
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit(onSubmit)(e);
			}}
			className='h-full w-full flex flex-col gap-10'
		>
			<div>
				<p className='text-[#F1F0EB] text-[20px] font-semibold'>
					1. Set Revenue Split
				</p>
				<div className='mt-2 pl-10'>
					<Table
						aria-label='Revenue Split'
						removeWrapper
						classNames={{
							th: 'bg-transparent text-[#F1F0EB] font-semibold px-0',
							tr: 'border-b border-b-[F1F0EB',
							td: 'text-[#F1F0EB] text-[13px] font-semibold  py-3 px-0',
						}}
					>
						<TableHeader>
							{columns.map((column, index) => (
								<TableColumn key={index}>
									{column.label}
								</TableColumn>
							))}
						</TableHeader>
						<TableBody>
							{/* <TableRow>
							<TableCell>{props.owner?.userName}</TableCell>
							<TableCell className='pr-4'>
								<Input
									size='sm'
									variant='bordered'
									className='flex-1'
									classNames={{
										base: 'bg-transparent',
										input: 'group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
										inputWrapper:
											'border border-[#F1F0EB] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
									}}
								/>
							</TableCell>
							<TableCell className='pr-4 w-1/5'>
								<Input
									size='sm'
									variant='bordered'
									className='flex-1'
									classNames={{
										base: 'bg-transparent',
										input: 'group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
										inputWrapper:
											'border border-[#F1F0EB] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
									}}
								/>
							</TableCell>
							<TableCell>Pending</TableCell>
						</TableRow> */}
							{collaboratorList.map((collaborator, index) => (
								<TableRow key={index}>
									<TableCell>
										<div
											className='flex flex-row gap-3 items-center cursor-pointer w-full'
											onClick={() =>
												router.push(
													`/profile/${collaborator.userWalletAddress}`
												)
											}
										>
											<Avatar
												className='w-8 h-8'
												src={
													collaborator.userProfile
														.avatarUrl
												}
											/>
											<p className='text-[#F1F0EB] font-semibold'>
												{
													collaborator.userProfile
														.userName
												}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<p className='text-[#F1F0EB] font-semibold'>
											{collaborator.role !== ''
												? collaborator.role
												: '-'}
										</p>
										{/* <Input
												size='sm'
												variant='bordered'
												className='flex-1'
												classNames={{
													base: 'bg-transparent',
													input: 'group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
													inputWrapper:
														'border border-[#F1F0EB] group-data-[hover=true]:border-[#F1F0EB] rounded-lg bg-transparent',
												}}
											/> */}
									</TableCell>
									<TableCell>
										<Input
											size='sm'
											variant='bordered'
											type='number'
											min='0'
											max='100'
											step='0.1'
											placeholder='0'
											value={(
												watch(
													`mint.beneficiaries.${index}.percentage`
												) || 0
											).toString()}
											{...register(
												`mint.beneficiaries.${index}.percentage` as const,
												{ valueAsNumber: true }
											)}
											onInput={(e) => {
												const target =
													e.target as HTMLInputElement;
												const value =
													parseFloat(target.value) ||
													0;

												// Prevent values > 100
												if (value > 100) {
													target.value = '100';
													setValue(
														`mint.beneficiaries.${index}.percentage`,
														100
													);
													// Auto-adjust shares for non-creators
													if (
														!collaboratorList[index]
															?.isCreator
													) {
														adjustShares(
															index,
															100,
															'mint.beneficiaries'
														);
													}
													return;
												}

												// Update the field value
												setValue(
													`mint.beneficiaries.${index}.percentage`,
													value
												);

												// Auto-adjust shares for non-creators
												if (
													!collaboratorList[index]
														?.isCreator
												) {
													adjustShares(
														index,
														value,
														'mint.beneficiaries'
													);
												}
											}}
											onBlur={(e) => {
												// Set to 0 if empty
												if (
													(
														e.target as HTMLInputElement
													).value === ''
												) {
													setValue(
														`mint.beneficiaries.${index}.percentage`,
														0
													);
												}
											}}
											isDisabled={
												props.isActionDisabled ||
												collaborator.isCreator
											}
											isInvalid={
												!!errors.mint?.beneficiaries?.[
													index
												]?.percentage
											}
											errorMessage={
												errors.mint?.beneficiaries?.[
													index
												]?.percentage?.message
											}
											classNames={{
												base: 'bg-transparent w-20',
												input: 'group-data-[has-value=true]:text-[#1A1A1A] text-[16px] font-semibold',
												inputWrapper:
													'border-none group-data-[hover=true]:border-none rounded-lg bg-[#F1F0EB]',
											}}
										/>
									</TableCell>
									<TableCell>
										{props.isActionDisabled &&
										!collaborator.isCreator ? (
											<div className='flex gap-2'>
												{collaborator.primaryStatus?.toLowerCase() ===
													'none' ||
												collaborator.primaryStatus?.toLowerCase() ===
													'offered' ? (
													<>
														<Button
															size='sm'
															color='success'
															variant='flat'
															onClick={() =>
																collabAction(
																	'Accepted',
																	true
																)
															}
															className='text-xs px-2 py-1'
														>
															Accept
														</Button>
														<Button
															size='sm'
															color='danger'
															variant='flat'
															onClick={() =>
																collabAction(
																	'Rejected',
																	true
																)
															}
															className='text-xs px-2 py-1'
														>
															Reject
														</Button>
													</>
												) : (
													<span
														className={`text-xs font-semibold ${
															collaborator.primaryStatus?.toLowerCase() ===
															'accepted'
																? 'text-green-600'
																: 'text-red-600'
														}`}
													>
														{
															collaborator.primaryStatus
														}
													</span>
												)}
											</div>
										) : collaborator.isCreator ? (
											'-'
										) : collaborator.primaryStatus?.toLowerCase() ===
												'none' ||
										  collaborator.primaryStatus?.toLowerCase() ===
												'offered' ? (
											'Pending'
										) : (
											<span
												className={`text-xs font-semibold ${
													collaborator.primaryStatus?.toLowerCase() ===
													'accepted'
														? 'text-green-600'
														: collaborator.primaryStatus?.toLowerCase() ===
														  'rejected'
														? 'text-red-600'
														: ''
												}`}
											>
												{collaborator.primaryStatus ??
													'-'}
											</span>
										)}
									</TableCell>
									<TableCell>
										{!props.isActionDisabled &&
											!collaborator.isCreator && (
												<Image
													src={
														'/creator/trashGrey.svg'
													}
													alt={'delete'}
													width={25}
													height={25}
													className='cursor-pointer '
													onClick={() =>
														setValue(
															`mint.beneficiaries.${index}.percentage`,
															0
														)
													}
												/>
											)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{/* <div className='py-3 border-b border-b-[F1F0EB] flex flex-row gap-2 '>
						<p className='text-[#F1F0EB] text-[18px] font-semibold'>
							Affiliate bounty:
						</p>
						<div className='flex gap-2'>
							<Input
								size='sm'
								variant='flat'
								className='w-10'
								disabled={props.isActionDisabled}
								classNames={{
									base: 'bg-transparent ',
									input: 'group-data-[has-value=true]:text-[#1A1A1A]  text-[16px] font-semibold',
									inputWrapper:
										' border-none group-data-[hover=true]:border-none rounded-lg bg-[#F1F0EB]',
								}}
							/>
							<span className='text-[#F1F0EB] text-[20px] font-light'>
								%
							</span>
						</div>
					</div> */}
				</div>
			</div>
			<div>
				<p className='text-[#F1F0EB] text-[20px] font-semibold'>
					2. Set Creator Royalties
				</p>
				<div className='pl-10'>
					<div className='py-3  border-y-[#F1F0EB] border-y mt-5 flex flex-row gap-6 items-center'>
						<div className='flex flex-row gap-2 items-center'>
							<p className='text-[#F1F0EB] text-[18px] font-semibold'>
								Creator earnings:
							</p>
							<div className='flex gap-2 flex-row items-center'>
								<Input
									size='sm'
									variant='bordered'
									className='flex-1'
									type='number'
									min='0'
									max='100'
									step='1'
									placeholder='0'
									value={(
										watch('royalties.percentage') || 0
									).toString()}
									{...register('royalties.percentage', {
										valueAsNumber: true,
									})}
									onInput={(e) => {
										const target =
											e.target as HTMLInputElement;
										const value =
											parseFloat(target.value) || 0;

										// Prevent values > 20
										if (value > 20) {
											target.value = '20';
											setValue(
												'royalties.percentage',
												20
											);
											return;
										}

										// Prevent values < 0
										if (value < 0) {
											target.value = '0';
											setValue('royalties.percentage', 0);
											return;
										}

										// Update the field value
										setValue('royalties.percentage', value);
									}}
									onBlur={(e) => {
										// Set to 0 if empty
										if (
											(e.target as HTMLInputElement)
												.value === ''
										) {
											setValue('royalties.percentage', 0);
										}
									}}
									isDisabled={props.isActionDisabled}
									isInvalid={!!errors.royalties?.percentage}
									errorMessage={
										errors.royalties?.percentage?.message
									}
									classNames={{
										base: 'bg-transparent ',
										input: 'group-data-[has-value=true]:text-[#1A1A1A] text-[16px] font-semibold',
										inputWrapper:
											'border-none group-data-[hover=true]:border-none rounded-lg bg-[#F1F0EB]',
									}}
								/>
								<span className='text-[#F1F0EB] text-[20px] font-light'>
									%
								</span>
							</div>{' '}
							<p className='text-[#9E9E9D] text-[11px] font-normal'>
								Creator royalties on resale transactions. (Max.
								of 20%)
							</p>
						</div>

						{!props.isActionDisabled && (
							<div className='flex-1 justify-end w-full flex items-center pr-12'>
								<Image
									src={'/creator/trashGrey.svg'}
									alt={'delete'}
									width={30}
									height={30}
									className='cursor-pointer '
									onClick={() => {
										setValue('royalties.percentage', 0);
										// Set all beneficiaries' percentage to 0
										const currentBeneficiaries =
											watch('royalties.beneficiaries') ||
											[];
										const updatedBeneficiaries =
											currentBeneficiaries.map(
												(beneficiary: any) => ({
													...beneficiary,
													percentage: 0,
												})
											);
										setValue(
											'royalties.beneficiaries',
											updatedBeneficiaries
										);
									}}
								/>
							</div>
						)}
					</div>
					<Table
						aria-label='Revenue Split'
						removeWrapper
						classNames={{
							th: 'bg-transparent text-[#F1F0EB] font-semibold px-0',
							tr: 'border-b border-b-[F1F0EB',
							td: 'text-[#F1F0EB] text-[13px] font-semibold  py-3 px-0',
						}}
					>
						<TableHeader>
							{columns.map((column, index) => (
								<TableColumn key={index}>
									{column.label}
								</TableColumn>
							))}
						</TableHeader>
						<TableBody>
							{collaboratorList
								.filter(
									(collaborator) =>
										collaborator.status.toLowerCase() ===
										'accepted'
								)
								.map((collaborator, index) => (
									<TableRow key={index}>
										<TableCell>
											<div
												className='flex flex-row gap-3 items-center cursor-pointer'
												onClick={() =>
													router.push(
														`/profile/${collaborator.userWalletAddress}`
													)
												}
											>
												<Avatar
													className='w-8 h-8'
													src={
														collaborator.userProfile
															.avatarUrl
													}
												/>
												<p className='text-[#F1F0EB]  font-semibold'>
													{
														collaborator.userProfile
															.userName
													}
												</p>
											</div>
										</TableCell>
										<TableCell>
											<p className='text-[#F1F0EB] font-semibold'>
												{collaborator.role !== ''
													? collaborator.role
													: '-'}
											</p>
										</TableCell>
										<TableCell>
											<Input
												size='sm'
												variant='bordered'
												type='number'
												min='0'
												max='100'
												step='0.1'
												placeholder='0'
												value={(
													watch(
														`royalties.beneficiaries.${index}.percentage`
													) || 0
												).toString()}
												{...register(
													`royalties.beneficiaries.${index}.percentage` as const,
													{ valueAsNumber: true }
												)}
												onInput={(e) => {
													const target =
														e.target as HTMLInputElement;
													const value =
														parseFloat(
															target.value
														) || 0;

													// Prevent values > 100
													if (value > 100) {
														target.value = '100';
														setValue(
															`royalties.beneficiaries.${index}.percentage`,
															100
														);
														// Auto-adjust shares for non-creators
														if (
															!collaboratorList[
																index
															]?.isCreator
														) {
															adjustShares(
																index,
																100,
																'royalties.beneficiaries'
															);
														}
														return;
													}

													// Update the field value
													setValue(
														`royalties.beneficiaries.${index}.percentage`,
														value
													);

													// Auto-adjust shares for non-creators
													if (
														!collaboratorList[index]
															?.isCreator
													) {
														adjustShares(
															index,
															value,
															'royalties.beneficiaries'
														);
													}
												}}
												onBlur={(e) => {
													// Set to 0 if empty
													if (
														(
															e.target as HTMLInputElement
														).value === ''
													) {
														setValue(
															`royalties.beneficiaries.${index}.percentage`,
															0
														);
													}
												}}
												isDisabled={
													props.isActionDisabled ||
													collaborator.isCreator
												}
												isInvalid={
													!!errors.royalties
														?.beneficiaries?.[index]
														?.percentage
												}
												errorMessage={
													errors.royalties
														?.beneficiaries?.[index]
														?.percentage?.message
												}
												classNames={{
													base: 'bg-transparent w-20',
													input: 'group-data-[has-value=true]:text-[#1A1A1A] text-[16px] font-semibold',
													inputWrapper:
														'border-none group-data-[hover=true]:border-none rounded-lg bg-[#F1F0EB]',
												}}
											/>
										</TableCell>
										<TableCell>
											{props.isActionDisabled &&
											!collaborator.isCreator ? (
												<div className='flex gap-2'>
													{collaborator.secondaryStatus?.toLowerCase() ===
														'none' ||
													collaborator.secondaryStatus?.toLowerCase() ===
														'offered' ? (
														<>
															<Button
																size='sm'
																color='success'
																variant='flat'
																onClick={() =>
																	collabAction(
																		'Accepted',
																		false
																	)
																}
																className='text-xs px-2 py-1'
															>
																Accept
															</Button>
															<Button
																size='sm'
																color='danger'
																variant='flat'
																onClick={() =>
																	collabAction(
																		'Rejected',
																		false
																	)
																}
																className='text-xs px-2 py-1'
															>
																Reject
															</Button>
														</>
													) : (
														<span
															className={`text-xs font-semibold ${
																collaborator.secondaryStatus?.toLowerCase() ===
																'accepted'
																	? 'text-green-600'
																	: 'text-red-600'
															}`}
														>
															{
																collaborator.secondaryStatus
															}
														</span>
													)}
												</div>
											) : collaborator.isCreator ? (
												'-'
											) : collaborator.secondaryStatus?.toLowerCase() ===
													'none' ||
											  collaborator.secondaryStatus?.toLowerCase() ===
													'offered' ? (
												'Pending'
											) : (
												<span
													className={`text-xs font-semibold ${
														collaborator.secondaryStatus?.toLowerCase() ===
														'accepted'
															? 'text-green-600'
															: collaborator.secondaryStatus?.toLowerCase() ===
															  'rejected'
															? 'text-red-600'
															: ''
													}`}
												>
													{collaborator.secondaryStatus ??
														'-'}
												</span>
											)}
										</TableCell>
										<TableCell>
											{!props.isActionDisabled &&
												!collaborator.isCreator && (
													<Image
														src={
															'/creator/trashGrey.svg'
														}
														alt={'delete'}
														width={25}
														height={25}
														className='cursor-pointer '
														onClick={() =>
															setValue(
																`royalties.beneficiaries.${index}.percentage`,
																0
															)
														}
													/>
												)}
										</TableCell>
									</TableRow>
								))}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Save Button */}
			{!props.isActionDisabled && (
				<div className='w-full mt-8 flex justify-end'>
					<Button
						variant='solid'
						size='sm'
						type='submit'
						isDisabled={props.isActionDisabled || isSubmitting}
						isLoading={isSubmitting}
						className='px-8 py-2 font-semibold w-full bg-[#AFAB99] text-[#1A1A1A]'
					>
						Save
					</Button>
				</div>
			)}
		</form>
	);
}
