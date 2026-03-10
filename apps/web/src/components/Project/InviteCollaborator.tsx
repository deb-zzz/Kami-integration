'use client';

import { acceptCollaborator, getProjects, inviteCollaborator, rejectCollaborator } from '@/apihandler/Project';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Textarea, Avatar, SelectItem, Select } from '@nextui-org/react';
import { RefObject, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AllProjectType } from '@/types';
import { ToastMessage } from '../ToastMessage';
import { useGlobalState } from '@/lib/GlobalContext';

// Dummy data

export default function InviteCollaborator({
	projectId,
	walletAddress,
	myWalletAddress,
	projectName,
	avatar,
	username,
	description,
	notificationId,
	inviteMessageSrc,
	mode,
	buttonRef,
}: {
	projectId: number;
	walletAddress: string;
	myWalletAddress?: string;
	projectName: string;
	avatar: string;
	username: string;
	description?: string;
	inviteMessageSrc?: string;
	notificationId?: number;
	mode: 'invite' | 'accept' | 'profile';
	buttonRef?: RefObject<HTMLButtonElement>;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [inviteMessage, setInviteMessage] = useState(inviteMessageSrc ?? '');
	const [projects, setProjects] = useState<AllProjectType[]>([]);
	const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
	const router = useRouter();
	const [gs] = useGlobalState();

	useEffect(() => {
		if (mode !== 'profile') return;
		const getAllProjects = async () => {
			const project = await getProjects(myWalletAddress ?? '0x0000000000000000000000000000000000000000');
			project.projects = project.projects.filter((p: AllProjectType) => p.isPublished !== true && p.ownedByMe === true);
			setProjects(project.projects);
		};
		getAllProjects();
	}, [projectId]);

	useEffect(() => {
		if (inviteMessageSrc) {
			setInviteMessage(inviteMessageSrc);
		} else {
			setInviteMessage('');
		}
	}, [projectId, inviteMessageSrc]);

	const handleInvite = async (message: string) => {
		switch (mode) {
			case 'invite':
				//console.log('Sending invitation with message:', message);
				sendInvite(projectId, walletAddress, message);
				setIsOpen(false);
				break;
			case 'profile':
				//console.log('Sending invitation with message:', message);
				sendInvite(selectedProjectId, walletAddress, message);
				setIsOpen(false);
				break;
			case 'accept':
				//console.log('Accepting invitation with message:', message);
				await acceptCollaborator(projectId, gs?.walletAddress ?? '', notificationId);
				setIsOpen(false);
				break;
			default:
				console.log('Invalid mode:', mode);
				break;
		}
	};

	const sendInvite = async (id: number, address: string, msg: string) => {
		try {
			const res = await inviteCollaborator(id, address, msg);
			if (res.success) {
				ToastMessage('success', 'Collaboration invite sent successfully!');
			} else {
				ToastMessage('error', 'Unable to send invite. Please try again later.');
			}
		} catch (error) {
			console.log('Error sending invite:', error);
			ToastMessage('error', 'Unable to send invite. Please try again later.');
			return;
		}
	};
	return (
		<>
			<Button
				ref={buttonRef}
				aria-hidden={mode === 'accept'}
				className={`${mode === 'profile' ? 'bg-[#323131] text-white w-full' : 'bg-[#11FF49]'} ${mode === 'accept' && 'hidden'}`}
				onPress={() => setIsOpen(true)}
				size='sm'>
				{mode === 'invite' && 'Invite'}
				{mode === 'accept' && 'View'}
				{mode === 'profile' && (
					<>
						<Image alt='heart' aria-hidden='true' width={20} height={20} className='mr-2' src='/profile/info/heart.svg' />
						Invite to Collaborate
					</>
				)}
			</Button>

			<Modal
				isOpen={isOpen}
				onOpenChange={() => setIsOpen(!isOpen)}
				className='bg-[#D9D9D9] rounded-none shadow-none p-4 m-0 h-fit '
				classNames={{
					closeButton: 'top-0  text-black hover:bg-black/20',
					body: 'z-[1000]',
					backdrop: 'z-[1000]',
					wrapper: 'z-[1000]',
					base: 'bg-yellow-500',
				}}
				size='2xl'>
				<ModalContent>
					<ModalHeader className='flex flex-col gap-1'>
						<h2 className='text-xl font-bold text-black'>
							{mode === 'invite' && 'Invite Collaborator'}
							{mode === 'accept' && 'Collaboration Request'}
							{mode === 'profile' && 'Invite to Collaborate'}
						</h2>
					</ModalHeader>
					<ModalBody>
						{/* Project Details */}
						<div className='mb-6'>
							<h3 className='text-lg font-semibold mb-2 text-black'>Project Name :</h3>
							<div className='bg-content2 p-4 rounded-lg'>
								{mode !== 'profile' && <p className='text-sm text-default-500 mt-1'>{projectName}</p>}
								{mode === 'profile' && (
									<Select
										aria-label='Select Project'
										placeholder='Select Project'
										className='text-black'
										onChange={(e) => {
											const value = parseInt(e.target.value, 10);
											if (!isNaN(value)) {
												setSelectedProjectId(value);
											}
										}}>
										{projects.map((project, i) => (
											<SelectItem className='text-black' key={project.id.toString()}>
												{project.name}
											</SelectItem>
										))}
									</Select>
								)}
							</div>
						</div>

						{/* Invited User Profile */}
						<div className='mb-6'>
							<h3 className='text-lg font-semibold mb-2 text-black'>Inviting User</h3>
							<div className='bg-content2 p-4 rounded-lg items-center flex gap-4'>
								<Avatar
									src={avatar}
									className={`w-16 h-16 ${walletAddress !== '' ? 'cursor-pointer' : null}`}
									alt={username}
									onClick={() => {
										if (walletAddress !== '') router.push(`/profile/${walletAddress}`);
									}}
								/>
								<div className='flex-1'>
									<h4 className='text-default-500 font-semibold text-medium'>{username}</h4>
									<p
										className='text-sm text-default-500 mt-1 line-clamp-6 wordWrap'
										dangerouslySetInnerHTML={{
											__html: description ?? '',
										}}></p>
								</div>
							</div>
						</div>

						{/* Invite Message */}
						<div>
							<h3 className='text-lg font-semibold mb-2 text-black'>Invitation Message</h3>

							{mode === 'accept' ? (
								<div className='bg-content2 p-4 rounded-lg overflow-y-scroll scrollbar-thumb-rounded-3xl  scrollbar-thin  scrollbar-track-transparent scrollbar-thumb-neutral-400 max-h-[200px]'>
									<p className='text-default-500'>{inviteMessage ? inviteMessage : 'No message provided.'}</p>
								</div>
							) : (
								<Textarea
								    className="caret-black focus-visible:outline-none"
									placeholder='Write a message to invite the collaborator...'
									value={inviteMessage}
									onValueChange={setInviteMessage}
									minRows={3}
									maxRows={6}
								/>
							)}
						</div>
					</ModalBody>
					<ModalFooter>
						{mode === 'accept' && (
							<Button
								className='bg-[#11FF49] text-black'
								onPress={() => {
									router.push(`/project/${projectId}`);
									setIsOpen(false);
								}}>
								View Project
							</Button>
						)}
						<Button
							color='danger'
							variant='light'
							onPress={async () => {
								setIsOpen(false);
								setInviteMessage('');
								await rejectCollaborator(projectId, gs?.walletAddress ?? '', notificationId);
							}}
							isDisabled={!inviteMessage.trim()}>
							{mode === 'invite' && 'Cancel'}
							{mode === 'accept' && 'Reject'}
							{mode === 'profile' && 'Cancel'}
						</Button>
						<Button
							className='bg-[#11FF49] text-black'
							onPress={() => handleInvite(inviteMessage)}
							isDisabled={!inviteMessage.trim()}>
							{mode === 'invite' && 'Send Invitation'}
							{mode === 'accept' && 'Accept'}
							{mode === 'profile' && 'Send Invitation'}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
}
