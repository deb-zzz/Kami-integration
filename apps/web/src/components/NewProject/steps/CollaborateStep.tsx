'use client';
import { deleteCollaborator, saveRole } from '@/apihandler/Project';
import ConfirmationModal from '@/components/ConfirmationModal';
import CollaboratorSearch from '@/components/Project/CollaboratorSearch';
import { ToastMessage } from '@/components/ToastMessage';
import { CollaboratorType, Profile } from '@/types';
import { Avatar, Button, Divider, Input } from '@nextui-org/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
type CollabProp = {
	creator?: Profile;
	collaborators: (CollaboratorType & { role?: string })[];
	project: { projectId?: number; projectName?: string };
	isActionDisabled: boolean;
	walletAddress: string;
	getData: () => Promise<void>;
};

export default function CollaborateStep(props: CollabProp) {
	const [collaboratorList, setCollaboratorList] = useState<
		(CollaboratorType & { role?: string })[]
	>([]);
	const [selectedCollaborator, setSelectedCollaborator] =
		useState<CollaboratorType | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [editingCollaborator, setEditingCollaborator] = useState<
		string | null
	>(null);

	useEffect(() => {
		props.getData();
	}, []);

	useEffect(() => {
		if (props.collaborators) {
			let arr = [...props.collaborators];

			// Filter based on access level
			if (props.isActionDisabled && props.walletAddress) {
				// Collaborators can only see their own details
				arr = arr.filter(
					(collab) => collab.userWalletAddress === props.walletAddress
				);
			}
			setCollaboratorList(arr);
		}
	}, [props.collaborators, props.isActionDisabled, props.walletAddress]);

	const saveRoleApi = async (walletAddress: string, role: string) => {
		const data = [
			{
				walletAddress: walletAddress,
				role: role,
			},
		];
		if (props.project.projectId) {
			try {
				const res = await saveRole(
					props.walletAddress,
					props.project.projectId,
					data
				);
				if (res.success) {
					ToastMessage('success', 'Role saved successfully!');
				} else {
					ToastMessage(
						'error',
						'Unable to save role. Please try again later.'
					);
				}
			} catch (error) {
				console.error('Error saving role:', error);
				ToastMessage(
					'error',
					'Unable to save role. Please try again later.'
				);
			}
		}
	};

	const handleConfirm = async (confirmed: boolean) => {
		if (confirmed) {
			await removeCollaboratorApi(
				selectedCollaborator?.userWalletAddress ?? ''
			);
		}
		setIsOpen(false);
	};

	const removeCollaboratorApi = async (walletAddress: string) => {
		console.log(walletAddress);
		try {
			const res = await deleteCollaborator(
				props.project.projectId!,
				walletAddress
			);
			if (res.success) {
				ToastMessage('success', 'Collaborator removed successfully!');
				setCollaboratorList(
					collaboratorList.filter(
						(collaborator) =>
							collaborator.userWalletAddress !== walletAddress
					)
				);
			} else {
				ToastMessage(
					'error',
					'Unable to remove collaborator. Please try again later.'
				);
			}
		} catch (error) {
			console.error('Error deleting collaborator:', error);
			ToastMessage(
				'error',
				'Unable to remove collaborator. Please try again later.'
			);
		}
	};

	const router = useRouter();
	return (
		<div className='flex flex-col gap-10'>
			<div className='flex flex-col gap-4'>
				<p className='text-[24px] font-bold'>Creator</p>
				<div
					className='flex flex-row gap-4 items-center cursor-pointer'
					onClick={() =>
						router.push(`/profile/${props?.creator?.walletAddress}`)
					}
				>
					<Avatar
						className='w-16 h-16'
						src={props?.creator?.avatarUrl}
					/>
					<p className='text-[#F1F0EB] text-[20px] font-semibold'>
						{props?.creator?.userName}
					</p>
				</div>
			</div>
			<div className='flex flex-col gap-10'>
				<div className='flex flex-row justify-between items-center'>
					<div>
						<p className='text-[24px] font-bold'>Collaborators</p>
						<p>Team up with your favourite creators</p>
					</div>
					{!props.isActionDisabled && (
						<div className='w-[15%]'>
							<CollaboratorSearch
								projectId={props.project.projectId!}
								walletAddress={
									props.creator?.walletAddress ?? ''
								}
								projectName={props.project.projectName!}
								color='#000000'
								isProjectPage={true}
							/>
						</div>
					)}
				</div>
				{collaboratorList.length > 0 &&
					collaboratorList.map((collab, index) => (
						<div
							key={index}
							className='flex flex-row justify-between items-center'
						>
							<div className='flex flex-row gap-4 items-center'>
								{!props.isActionDisabled &&
									collab.status.toLowerCase() ===
										'accepted' &&
									collab.userWalletAddress !==
										props.creator?.walletAddress && (
										<div className=' p-1 rounded-md'>
											<Image
												src={'/creator/trashGrey.svg'}
												alt={'delete'}
												width={24}
												height={24}
												onClick={() => {
													setSelectedCollaborator(
														collab
													);
													setIsOpen(true);
												}}
												className='cursor-pointer'
											/>
										</div>
									)}
								<div
									className='flex flex-row gap-4 items-center cursor-pointer'
									onClick={() =>
										router.push(
											`/profile/${collab.userWalletAddress}`
										)
									}
								>
									<Avatar
										className='w-16 h-16'
										src={collab.userProfile.avatarUrl}
									/>
									<p className='text-[#F1F0EB] text-[20px] font-semibold'>
										{collab.userProfile.userName}
									</p>
								</div>
							</div>

							<div className='flex flex-row gap-2 items-center'>
								{!props.isActionDisabled ? (
									<>
										<div className='w-fit px-2 bg-[#F1F0EB] rounded-lg items-center'>
											<Input
												size='sm'
												className='flex-1'
												placeholder='Assign Role'
												value={collab.role || ''}
												defaultValue={collab.role || ''}
												isDisabled={
													editingCollaborator !==
													collab.userWalletAddress
												}
												classNames={{
													base: 'bg-transparent',
													input: 'group-data-[has-value=true]:text-[#1A1A1A] pr-0 placeholder:text-[#1A1A1A] placeholder:text-left text-left text-[13px] font-semibold',
													inputWrapper:
														'group-data-[hover=true]:bg-transparent h-[15px] p-0   group-data-[focus=true]:bg-transparent group-data-[focus=true]:border-b-none rounded-none border-b-none   bg-transparent',
												}}
												onValueChange={(value) => {
													setCollaboratorList(
														(prev) =>
															prev.map((item) =>
																item.userWalletAddress ===
																collab.userWalletAddress
																	? {
																			...item,
																			role: value,
																	  }
																	: item
															)
													);
												}}
											/>
										</div>

										<Button
											size='sm'
											variant='flat'
											className={`${
												editingCollaborator ===
												collab.userWalletAddress
													? 'bg-[#9E9E9D]'
													: 'bg-[#F1F0EB]'
											} px-2 min-w-fit  text-[#1A1A1A] text-[13px] font-semibold rounded-lg`}
											onClick={() => {
												if (
													editingCollaborator ===
													collab.userWalletAddress
												) {
													// Save the role
													saveRoleApi(
														collab.userWalletAddress,
														collab.role || ''
													);
													setEditingCollaborator(
														null
													);
												} else {
													// Enable editing
													setEditingCollaborator(
														collab.userWalletAddress
													);
												}
											}}
										>
											<Image
												src={
													editingCollaborator ===
													collab.userWalletAddress
														? '/saveDark.svg'
														: '/edit.svg'
												}
												alt={
													editingCollaborator ===
													collab.userWalletAddress
														? 'save'
														: 'edit'
												}
												width={18}
												height={18}
												className='cursor-pointer'
											/>
										</Button>
									</>
								) : (
									<div className='flex-1 py-[6px] w-fit px-4 bg-[#323131] rounded-md items-center'>
										<p className='text-[#F1F0EB] italic text-center font-semibold'>
											{collab.role !== ''
												? collab.role
												: '-'}
										</p>
									</div>
								)}
							</div>
						</div>
					))}
			</div>
			<ConfirmationModal
				isOpen={isOpen}
				setIsOpen={setIsOpen}
				onResult={handleConfirm}
				title='Remove Collaborator'
				message='Are you sure you want to remove this collaborator?'
				confirmText='Confirm'
				cancelText='Cancel'
			/>
		</div>
	);
}
