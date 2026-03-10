'use client';

import { CollaboratorType, Profile } from '@/types';
import {
	Table,
	TableHeader,
	TableColumn,
	TableBody,
	TableRow,
	TableCell,
	Input,
	Button,
} from '@nextui-org/react';
import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { monetisationAction, saveMonetise } from '@/apihandler/Project';
import { ToastMessage } from '../ToastMessage';

type MonetiseProp = {
	collaborators: CollabType[];
	currentUserWalletAddress?: string;
	isActionDisabled: boolean;
	projectId: number;
	royaltyPercentage: number;
	getData: () => void;
};

type CollabType = {
	userProfile: {
		userName: string;
		walletAddress: string;
		avatarUrl: string;
		description: string;
	};
	userWalletAddress: string;
	primaryShare: number;
	secondaryShare: number;
	writeAccess?: boolean;
	status: string;
	role?: string;
	isCreator?: boolean;
	primaryStatus?: string;
	secondaryStatus?: string;
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
				role: yup.string().trim().required('Role is required'),
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
				role: yup.string().trim().required('Role is required'),
			})
		),
	}),
});

type FormData = yup.InferType<typeof monetiseSchema>;

export default function MonetiseTab(props: MonetiseProp) {
	const [collaboratorList, setCollaboratorList] = useState<CollabType[]>([]);

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
						role: '',
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
						role: '',
					},
				],
			},
		},
	});

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
		if (!props.currentUserWalletAddress) return;
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
							const originalRole = collaborator?.role || '';
							const newRole = beneficiary.role || '';

							// Include if either share or role has changed
							return (
								originalShare !== newShare ||
								originalRole !== newRole
							);
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
							const originalRole = collaborator?.role || '';
							const newRole = beneficiary.role || '';

							// Include if either share or role has changed
							return (
								originalShare !== newShare ||
								originalRole !== newRole
							);
						}
					),
				},
			};
			const response = await saveMonetise(
				props.currentUserWalletAddress,
				props.projectId,
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

	useEffect(() => {
		if (props.collaborators?.length > 0) {
			let arr = [...props.collaborators];
			arr.map((collab) => {
				collab.role = collab.role || '';
			});

			// Filter based on access level
			if (props.isActionDisabled && props.currentUserWalletAddress) {
				// Collaborators can only see their own details
				arr = arr.filter(
					(collab) =>
						collab.userWalletAddress ===
						props.currentUserWalletAddress
				);
			}
			// Owners can see all collaborators (no filtering needed)

			setCollaboratorList(arr);

			// Always set form values from collaborator data
			const mintBeneficiaries = arr.map((collab) => ({
				walletAddress: collab.userWalletAddress,
				percentage: collab.primaryShare || 0,
				role: collab.role || '',
			}));

			const royaltyBeneficiaries = arr.map((collab) => ({
				walletAddress: collab.userWalletAddress,
				percentage: collab.secondaryShare || 0,
				role: collab.role || '',
			}));

			setValue('mint.beneficiaries', mintBeneficiaries);
			setValue('royalties.beneficiaries', royaltyBeneficiaries);
		}
	}, [props, setValue]);

	// Call getData when component mounts to ensure fresh data
	useEffect(() => {
		props.getData();
	}, []);

	const revenue = [
		{
			creator: 'Logan Marquez',
			role: 'Primary Creator / Visual Artist',
			share: 50,
			status: 'approved',
		},
		{
			creator: 'Tommy Lee',
			role: 'Illustrator',
			share: 25,
			status: 'approved',
		},
		{
			creator: 'Headcracker',
			role: 'Animator',
			share: 25,
			status: 'approved',
		},
	];
	const royalties = [
		{
			creator: 'Logan Marquez',
			role: 'Primary Creator / Visual Artist',
			share: 4,
			status: 'approved',
		},
		{
			creator: 'Tommy Lee',
			role: 'Illustrator',
			share: 1.5,
			status: 'approved',
		},
		{
			creator: 'Headcracker',
			role: 'Animator',
			share: 1.5,
			status: 'approved',
		},
	];
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
			key: 'status',
			label: 'Share %',
		},
		{
			key: 'status',
			label: 'Status',
		},
	];

	const collabAction = async (action: string, isPrimary: boolean) => {
		if (!props.currentUserWalletAddress) return;
		try {
			const data: any = {};
			if (isPrimary) {
				data.primaryStatus = action;
			} else {
				data.secondaryStatus = action;
			}
			const res = await monetisationAction(
				props.currentUserWalletAddress,
				props.projectId,
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
						if (
							collab.userWalletAddress ===
							props.currentUserWalletAddress
						) {
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

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit(onSubmit)(e);
			}}
			className='h-full w-full p-10'
		>
			<p className='text-black text-[20px] font-light'>
				1. Set Revenue Split
			</p>
			<div className='mt-3'>
				<Table
					aria-label='Revenue Split'
					removeWrapper
					classNames={{
						th: 'bg-transparent text-black font-semibold px-0',
						tr: 'border-b border-b-black',
						td: 'text-black tetx-[13px] font-semibold capitalize py-3 px-0',
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
						{collaboratorList.map((data, index) => (
							<TableRow key={index}>
								<TableCell>
									{data.userProfile.userName}
								</TableCell>
								<TableCell className='pr-4'>
									<Input
										size='sm'
										variant='bordered'
										placeholder='Eg: Graphic Designer, Musician, Artist, Writer etc'
										className='flex-1'
										{...register(
											`mint.beneficiaries.${index}.role` as const
										)}
										value={
											watch(
												`mint.beneficiaries.${index}.role`
											) || ''
										}
										onChange={(e) => {
											// Update both fields with the same value
											setValue(
												`mint.beneficiaries.${index}.role`,
												e.target.value
											);
											setValue(
												`royalties.beneficiaries.${index}.role`,
												e.target.value
											);
										}}
										isDisabled={props.isActionDisabled}
										isInvalid={
											!!errors.mint?.beneficiaries?.[
												index
											]?.role
										}
										errorMessage={
											errors.mint?.beneficiaries?.[index]
												?.role?.message
										}
										classNames={{
											base: 'bg-transparent',
											input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
											inputWrapper:
												'border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] rounded-lg bg-transparent',
										}}
									/>
								</TableCell>
								<TableCell className='pr-4 w-1/5'>
									<Input
										size='sm'
										variant='bordered'
										className='flex-1'
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
												parseFloat(target.value) || 0;

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
												(e.target as HTMLInputElement)
													.value === ''
											) {
												setValue(
													`mint.beneficiaries.${index}.percentage`,
													0
												);
											}
										}}
										isDisabled={
											props.isActionDisabled ||
											data.isCreator
										}
										isInvalid={
											!!errors.mint?.beneficiaries?.[
												index
											]?.percentage
										}
										errorMessage={
											errors.mint?.beneficiaries?.[index]
												?.percentage?.message
										}
										classNames={{
											base: 'bg-transparent',
											input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
											inputWrapper:
												'border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] rounded-lg bg-transparent',
										}}
									/>
								</TableCell>
								<TableCell>
									{props.isActionDisabled &&
									!data.isCreator ? (
										<div className='flex gap-2'>
											{data.primaryStatus?.toLowerCase() ===
												'none' ||
											data.primaryStatus?.toLowerCase() ===
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
														data.primaryStatus?.toLowerCase() ===
														'accepted'
															? 'text-green-600'
															: 'text-red-600'
													}`}
												>
													{data.primaryStatus}
												</span>
											)}
										</div>
									) : data.isCreator ? (
										'-'
									) : data.primaryStatus?.toLowerCase() ===
											'none' ||
									  data.primaryStatus?.toLowerCase() ===
											'offered' ? (
										'Pending'
									) : (
										<span
											className={`text-xs font-semibold ${
												data.primaryStatus?.toLowerCase() ===
												'accepted'
													? 'text-green-600'
													: data.primaryStatus?.toLowerCase() ===
													  'rejected'
													? 'text-red-600'
													: ''
											}`}
										>
											{data.primaryStatus ?? '-'}
										</span>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			<div className='mt-14'>
				<p className='text-black text-[20px] font-light'>
					2. Set Creator Royalties
				</p>

				<div className='py-3  border-y-black border-y mt-5 flex flex-row gap-2'>
					<p className='text-black text-[18px] font-semibold'>
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
							step='0.1'
							placeholder='0'
							defaultValue={
								props.royaltyPercentage === null
									? '0'
									: props.royaltyPercentage.toString()
							}
							{...register('royalties.percentage', {
								valueAsNumber: true,
							})}
							onInput={(e) => {
								const target = e.target as HTMLInputElement;
								const value = parseFloat(target.value) || 0;

								// Prevent values > 20
								if (value > 20) {
									target.value = '20';
									setValue('royalties.percentage', 20);
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
									(e.target as HTMLInputElement).value === ''
								) {
									setValue('royalties.percentage', 0);
								}
							}}
							isDisabled={props.isActionDisabled}
							isInvalid={!!errors.royalties?.percentage}
							errorMessage={errors.royalties?.percentage?.message}
							classNames={{
								base: 'bg-transparent ',
								input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
								inputWrapper:
									'border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] rounded-lg bg-transparent',
							}}
						/>
						<span className='text-black text-[20px] font-light'>
							%
						</span>
						<p className='text-black font-normal'>(Max. of 20%)</p>
					</div>
				</div>

				<Table
					aria-label='Revenue Split'
					removeWrapper
					classNames={{
						th: 'bg-transparent text-black font-semibold px-0',
						tr: 'border-b border-b-black',
						td: 'text-black tetx-[13px] font-semibold capitalize py-3 px-0',
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
						{collaboratorList.map((data, index) => (
							<TableRow key={index}>
								<TableCell>
									{data.userProfile.userName}
								</TableCell>
								<TableCell className='pr-4'>
									<Input
										size='sm'
										variant='bordered'
										className='flex-1'
										placeholder='Eg: Graphic Designer, Musician, Artist, Writer etc'
										{...register(
											`royalties.beneficiaries.${index}.role` as const
										)}
										value={
											watch(
												`royalties.beneficiaries.${index}.role`
											) || ''
										}
										onChange={(e) => {
											// Update both fields with the same value
											setValue(
												`royalties.beneficiaries.${index}.role`,
												e.target.value
											);
											setValue(
												`mint.beneficiaries.${index}.role`,
												e.target.value
											);
										}}
										isDisabled={props.isActionDisabled}
										isInvalid={
											!!errors.royalties?.beneficiaries?.[
												index
											]?.role
										}
										errorMessage={
											errors.royalties?.beneficiaries?.[
												index
											]?.role?.message
										}
										classNames={{
											base: 'bg-transparent',
											input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
											inputWrapper:
												'border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] rounded-lg bg-transparent',
										}}
									/>
								</TableCell>
								<TableCell className='pr-4 w-1/5'>
									<Input
										size='sm'
										variant='bordered'
										className='flex-1'
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
												parseFloat(target.value) || 0;

											// Prevent values > 100
											if (value > 100) {
												target.value = '100';
												setValue(
													`royalties.beneficiaries.${index}.percentage`,
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
												(e.target as HTMLInputElement)
													.value === ''
											) {
												setValue(
													`royalties.beneficiaries.${index}.percentage`,
													0
												);
											}
										}}
										isDisabled={
											props.isActionDisabled ||
											data.isCreator
										}
										isInvalid={
											!!errors.royalties?.beneficiaries?.[
												index
											]?.percentage
										}
										errorMessage={
											errors.royalties?.beneficiaries?.[
												index
											]?.percentage?.message
										}
										classNames={{
											base: 'bg-transparent',
											input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
											inputWrapper:
												'border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] rounded-lg bg-transparent',
										}}
									/>
								</TableCell>
								<TableCell>
									{props.isActionDisabled &&
									!data.isCreator ? (
										<div className='flex gap-2'>
											{data.secondaryStatus?.toLowerCase() ===
												'none' ||
											data.secondaryStatus?.toLowerCase() ===
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
														data.secondaryStatus?.toLowerCase() ===
														'accepted'
															? 'text-green-600'
															: 'text-red-600'
													}`}
												>
													{data.secondaryStatus}
												</span>
											)}
										</div>
									) : data.isCreator ? (
										'-'
									) : data.secondaryStatus?.toLowerCase() ===
											'none' ||
									  data.secondaryStatus?.toLowerCase() ===
											'offered' ? (
										'Pending'
									) : (
										<span
											className={`text-xs font-semibold ${
												data.secondaryStatus?.toLowerCase() ===
												'accepted'
													? 'text-green-600'
													: data.secondaryStatus?.toLowerCase() ===
													  'rejected'
													? 'text-red-600'
													: ''
											}`}
										>
											{data.secondaryStatus ?? '-'}
										</span>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
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
						className='px-8 py-2 font-semibold w-full bg-[#11FF49] text-[#1A1A1A]'
					>
						Save
					</Button>
				</div>
			)}
		</form>
	);
}
