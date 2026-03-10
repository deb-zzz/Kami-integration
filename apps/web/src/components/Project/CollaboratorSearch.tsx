'use client';

import {
	Modal,
	Input,
	Card,
	Avatar,
	Button,
	Spacer,
	ModalHeader,
	ModalBody,
	CardBody,
	ModalContent,
	Tooltip,
} from '@nextui-org/react';
import { useEffect, useState } from 'react';
import InviteCollaborator from './InviteCollaborator';
import { searchProfiles } from '@/apihandler/Project';
import { Profile } from '@/types';
import router from 'next/router';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { set } from 'date-fns';

const CollaboratorSearch = ({
	projectId,
	walletAddress,
	projectName,
	color = '#F1F0EB',
	isProjectPage = false,
}: {
	projectId: number;
	walletAddress: string;
	projectName: string;
	color?: string;
	isProjectPage?: boolean;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const router = useRouter();

	useEffect(() => {
		const fetchProfiles = async () => {
			if (searchQuery.length === 0) {
				setProfiles([]);
				return;
			}
			const result = await searchProfiles(walletAddress, searchQuery);
			const filteredUsers = result.users?.filter(
				(user) => user.walletAddress !== walletAddress
			);
			setProfiles(filteredUsers ?? []);
		};
		fetchProfiles();
	}, [searchQuery, walletAddress]);

	const handleSearch = async (value: string) => {
		setSearchQuery(value);

		// Implement actual search logic here
	};

	return (
		<>
			{isProjectPage ? (
				<Button
					size='sm'
					className='bg-[#AFAB99] rounded-lg w-full text-[14px] font-semibold text-[#1A1A1A] '
					onClick={() => setIsOpen(true)}
					isIconOnly
				>
					+ Invite
				</Button>
			) : (
				<Button
					className='bg-transparent text-white'
					onClick={() => setIsOpen(true)}
					size='md'
					isIconOnly
				>
					<svg
						width='23'
						height='21'
						viewBox='0 0 23 21'
						fill='none'
						xmlns='http://www.w3.org/2000/svg'
					>
						<path
							d='M18.7913 19.8242V13.5742M15.6663 16.6992H21.9163M11.4997 13.5742H7.33301C5.39158 13.5742 4.42087 13.5742 3.65516 13.8914C2.63421 14.3143 1.82307 15.1254 1.40018 16.1464C1.08301 16.9121 1.08301 17.8828 1.08301 19.8242M15.1455 1.37709C16.6725 1.9952 17.7497 3.49225 17.7497 5.24089C17.7497 6.98952 16.6725 8.48657 15.1455 9.10468M13.0622 5.24089C13.0622 7.54207 11.1967 9.40755 8.89551 9.40755C6.59432 9.40755 4.72884 7.54207 4.72884 5.24089C4.72884 2.9397 6.59432 1.07422 8.89551 1.07422C11.1967 1.07422 13.0622 2.9397 13.0622 5.24089Z'
							stroke={color}
							strokeWidth='1.5'
							strokeLinecap='round'
							strokeLinejoin='round'
						/>
					</svg>
				</Button>
			)}

			<Modal
				isOpen={isOpen}
				onOpenChange={() => setIsOpen(!isOpen)}
				className='bg-[#D9D9D9] rounded-none shadow-none p-0 m-0 h-fit z-50 '
				classNames={{
					closeButton: 'hidden',
					// 'border-none text-black hover:bg-black/20  z-50 right-0 top-1 text-[15px] fixed self-end ',
					body: '',
					backdrop: '',
					wrapper: '',
				}}
				size='2xl'
			>
				<ModalContent className=' overflow-y-scroll scrollbar-thumb-rounded-3xl  scrollbar-thin  scrollbar-track-transparent scrollbar-thumb-neutral-600 max-h-[60vh]'>
					<ModalHeader className='flex flex-col text-black gap-1 sticky top-0 bg-[#D9D9D9] z-40 p-0'>
						<div className='relative mt-3'>
							<Image
								alt='close'
								draggable='false'
								width={30}
								height={30}
								src={'/close.svg'}
								className='cursor-pointer absolute -top-1 right-0  hover:bg-black/20 rounded-full p-1'
								onClick={() => {
									setIsOpen(false);
								}}
							/>
						</div>

						<div className=' pt-3 pb-3'>
							<h3 className='pl-6'>Find Collaborators</h3>
							<Input
								isClearable
								fullWidth
								placeholder='Search by username or skill'
								value={searchQuery}
								className='pl-5 pt-2 pr-2'
								onChange={(e) => handleSearch(e.target.value)}
								onClear={() => setSearchQuery('')}
							/>
							<Spacer y={1} />
						</div>
					</ModalHeader>
					<ModalBody className=''>
						{profiles.length > 0 &&
							profiles.map((profile) => (
								<Card
									key={profile.idNumber}
									style={{ marginBottom: '1rem' }}
								>
									<CardBody>
										<div className='flex flex-row items-center justify-between gap-4'>
											<div>
												<Avatar
													size='lg'
													src={profile.avatarUrl}
													color='primary'
												/>
											</div>
											<div className='flex w-[80%] flex-col'>
												<h4
													style={{
														marginBottom: '0.5rem',
														maxLines: 1,
													}}
												>
													{profile.userName}
												</h4>
												<p className='text-sm text-gray-500 line-clamp-2 wordWrap'>
													<span
														dangerouslySetInnerHTML={{
															__html: profile.description,
														}}
													></span>
												</p>
												{profile.tags &&
													profile.tags.length > 0 && (
														<div className='flex flex-wrap gap-1 mt-2'>
															{profile.tags.map(
																(
																	tag,
																	index
																) => (
																	<span
																		key={
																			index
																		}
																		className='px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full'
																	>
																		{
																			tag.tag
																		}
																	</span>
																)
															)}
														</div>
													)}
											</div>
											<div className='flex flex-col gap-2'>
												<Button
													size='sm'
													onClick={() => {
														setIsOpen(false);
														router.push(
															`/profile/${profile.walletAddress}`
														);
													}}
												>
													View Profile
												</Button>
												<InviteCollaborator
													mode='invite'
													projectId={projectId}
													walletAddress={
														profile.walletAddress
													}
													projectName={projectName}
													avatar={profile.avatarUrl}
													username={profile.userName}
													description={
														profile.description
													}
												/>
											</div>
										</div>
									</CardBody>
								</Card>
							))}
					</ModalBody>
				</ModalContent>
			</Modal>
		</>
	);
};

export default CollaboratorSearch;
