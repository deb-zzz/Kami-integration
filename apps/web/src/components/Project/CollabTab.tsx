'use client';

import { Avatar } from '@nextui-org/react';
import SocialCard from '../Profile/SocialCard';
import CollaboratorSearch from './CollaboratorSearch';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CollaboratorType, Profile } from '@/types';
import Image from 'next/image';
import { deleteCollaborator } from '@/apihandler/Project';
import { ToastMessage } from '../ToastMessage';

interface CollabProp {
	owner?: Profile;
	collaborators: CollaboratorType[];
	projectName: string;
	projectId: number;
	isActionDisabled: boolean;
}

export default function CollabTab(props: CollabProp) {
	const router = useRouter();
	const [collaborators, setCollaborators] = useState<CollaboratorType[]>(
		props.collaborators
	);
	const deleteCollaboratorAPI = async (walletAddress: string) => {
		try {
			const res = await deleteCollaborator(
				props.projectId,
				walletAddress
			);

			if (res.success) {
				ToastMessage('success', 'Collaborator removed successfully!');
				setCollaborators(
					collaborators.filter(
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
	return (
		<div className='h-full w-full p-10'>
			<div className='flex lg:flex-row flex-col gap-4'>
				<p className='text-black text-3xl font-bold pr-8'>
					Team
					<br /> Members
				</p>
				<div className='flex w-full flex-col gap-4'>
					<p className='text-black text-lg font-semibold'>
						Main Creator
					</p>
					<div className='w-full'>
						<div className='h-[1px] w-full bg-black' />
					</div>
					<div className=''>
						{props.owner && (
							<CollabProfile
								collaborator={props.owner}
								isCreator
								isActionDisabled={props.isActionDisabled}
								deleteCollaboratorAPI={deleteCollaboratorAPI}
							/>
						)}
					</div>
					<div className='flex flex-row gap-4 items-center justify-between'>
						<p className='text-black text-lg font-semibold'>
							Collaborators
						</p>
						{!props.isActionDisabled && (
							<CollaboratorSearch
								projectId={props.projectId}
								walletAddress={props.owner?.walletAddress ?? ''}
								projectName={props.projectName}
								color='#000000'
							/>
						)}
					</div>
					<div className='w-full'>
						<div className='h-[1px] w-full bg-black' />
					</div>
					<div className='flex flex-col gap-8'>
						{collaborators.map(
							(collaborator, index) =>
								collaborator.status.toLowerCase() ===
									'accepted' &&
								collaborator.userWalletAddress !==
									props.owner?.walletAddress && (
									<CollabProfile
										key={index}
										collaborator={collaborator.userProfile}
										isCreator={false}
										isActionDisabled={
											props.isActionDisabled
										}
										deleteCollaboratorAPI={
											deleteCollaboratorAPI
										}
									/>
								)
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export const CollabProfile = ({
	collaborator,
	isCreator,
	isActionDisabled,
	deleteCollaboratorAPI,
}: {
	collaborator: Profile;
	isCreator: boolean;
	isActionDisabled: boolean;
	deleteCollaboratorAPI: (walletAddress: string) => void;
}) => {
	const router = useRouter();
	const [isReadMore, setIsReadMore] = useState(true);

	return (
		<div className='flex flex-col gap-2'>
			<div className='flex flex-row gap-4 items-center justify-between'>
				<div
					className='flex flex-row gap-4 items-center cursor-pointer flex-1'
					onClick={() =>
						router.push(`/profile/${collaborator.walletAddress}`)
					}
				>
					<Avatar
						className='w-16 h-16'
						src={collaborator.avatarUrl}
					/>
					<p className='text-black text-lg font-semibold'>
						{collaborator.userName}
					</p>
				</div>
				{!isCreator && !isActionDisabled && (
					<Image
						src={'/creator/trash.svg'}
						alt={'delete'}
						width={20}
						height={20}
						className='cursor-pointer hover:opacity-70'
						onClick={(e) => {
							e.stopPropagation();
							// Add delete functionality here
							deleteCollaboratorAPI(collaborator.walletAddress);
						}}
					/>
				)}
			</div>
			<div className=''>
				<div className={'text-black'}>
					{collaborator.description &&
						collaborator.description.length > 300 && (
							<span
								dangerouslySetInnerHTML={{
									__html: collaborator.description,
								}}
								className={`text-overflow-ellipsis wordWrap  ${
									!isReadMore
										? 'line-clamp-none'
										: 'line-clamp-4'
								}`}
							/>
						)}
					{collaborator.description &&
						collaborator.description.length <= 300 && (
							<span
								dangerouslySetInnerHTML={{
									__html: collaborator.description,
								}}
								className='wordWrap'
							/>
						)}
				</div>
				{collaborator.description &&
					collaborator.description.length > 300 && (
						<button
							onClick={() => setIsReadMore(!isReadMore)}
							className='text-black text-sm hover:text-blue-800 mt-2'
						>
							{isReadMore ? 'Read More' : 'Show Less'}
						</button>
					)}
			</div>
		</div>
	);
};
