'use client';
import {
	AllProjectType,
	ProjectType,
	CollaboratorType,
	Profile,
} from '@/types';
import Image from 'next/image';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import useKamiWallet from '@/lib/KamiWalletHook';
import { Modal, ModalBody, ModalContent, Spinner } from '@nextui-org/react';
import { useState } from 'react';
import { createProject } from '@/apihandler/Project';
import { useLazyNFT } from '@/lib/VoucherContext';
import { ToastMessage } from '../ToastMessage';

export default function ProjectFolder({
	isNew = false,
	isPublished = false,
	data,
	isOwner = true,
}: {
	isNew?: boolean;
	isPublished?: boolean;
	data?: AllProjectType;
	isOwner?: boolean;
}) {
	const router = useRouter();
	const wallet = useKamiWallet();
	const [isOpen, setIsOpen] = useState(false);
	const [, , newItemVoucher] = useLazyNFT();

	return (
		// <div className='w-[200px] h-[250px] relative'>
		// 	<>
		// 		<div className=' h-full bg-[#3a3a39] w-full absolute rounded-tr-[30px] rounded-lg bottom-0 -right-12   '></div>
		// 		<div className='h-full bg-[#555554] w-full  absolute rounded-tr-[30px] rounded-lg bottom-0  -right-6  '></div>
		// 	</>
		// 	<div
		// 		className={`${
		// 			isNew ? 'bg-[#6c6c6b]' : 'bg-[#F1F0EB]'
		// 		} w-full h-full  rounded-tr-[30px] absolute rounded-lg bottom-0 right-0 flex items-center justify-center `}
		// 	>
		// 		{isNew ? (
		// 			<Image
		// 				src={'/creator/plus-circle.svg'}
		// 				alt={'search'}
		// 				width={70}
		// 				height={70}
		// 			/>
		// 		) : (
		// 			<div className='flex flex-col h-full p-5 gap-2 justify-between'>
		// 				<div>
		// 					<p className='text-black text-[12px] font-medium'>
		// 						{format(
		// 							data?.date ? new Date() : new Date(),
		// 							'dd MMM yyyy'
		// 						)}
		// 					</p>
		// 					<p className='text-black text-[20px] font-medium'>
		// 						{data?.name}
		// 					</p>
		// 				</div>
		// 				<div className='flex flex-row self-end '>
		// 					{data?.scrapbook.map(
		// 						(item, i) =>
		// 							item.completed && (
		// 								<div
		// 									key={i}
		// 									className={`w-[25px] h-[25px] rounded-full border border-[#6E6E6E] -ml-3
		//                                ${getColor(item.type)}
		//                                 `}
		// 								></div>
		// 							)
		// 					)}
		// 				</div>
		// 			</div>
		// 		)}
		// 	</div>
		// </div>

		<div className='flex flex-row w-[200px] cursor-pointer'>
			<Modal isOpen={isOpen}>
				<ModalContent className='bg-[#6c6c6b] text-black text-center p-4 '>
					<ModalBody>
						<p className='text-white'>
							{isNew
								? 'Creating Project...'
								: 'Opening project...'}
						</p>
						<Spinner size='lg' color='default' />
					</ModalBody>
				</ModalContent>
			</Modal>
			<div
				className={`${
					isNew ? 'bg-[#6c6c6b]' : 'bg-[#F1F0EB]'
				} min-w-[200px] h-[250px] rounded-tr-[30px]  rounded-lg  flex items-center justify-center z-20 `}
			>
				{isNew ? (
					<Image
						src={'/creator/plus-circle.svg'}
						alt={'search'}
						width={70}
						height={70}
						className='cursor-pointer'
						onClick={async () => {
							newItemVoucher();

							const address = wallet?.getAccount()?.address;
							if (address) {
								setIsOpen(true);
								try {
									const response = await createProject(
										address,
										{
											name:
												'Untitled @ ' +
												new Date().getTime(),
											description: 'Description',
										}
									);

									if (response.project) {
										router.push(
											'/project/' + response.project.id
										);
									} else {
										setIsOpen(false);
										ToastMessage(
											'error',
											'Unable to create project. Please try again later.'
										);
									}
								} catch (error) {
									setIsOpen(false);
									console.error(
										'Error creating project:',
										error
									);
									ToastMessage(
										'error',
										'Failed to create project. Please try again later.'
									);
								}
							}
						}}
					/>
				) : (
					<div
						className='flex flex-col h-full py-5 pl-4 pr-4 gap-2 cursor-pointer justify-between w-full'
						onClick={() => {
							newItemVoucher();
							setIsOpen(true);
							router.push('/project/' + data?.id);
						}}
					>
						<div>
							<div className='flex flex-row justify-between items-center mb-1'>
								<p className='text-black text-[12px] font-medium'>
									{format(
										data?.createdAt
											? new Date(data?.createdAt * 1000)
											: new Date(),
										'dd MMM yyyy'
									)}
								</p>
								{isPublished && data?.isPublished && (
									<Image
										src={'/creator/published.svg'}
										alt={'published'}
										width={20}
										height={20}
										className='-mt-1'
									/>
								)}
							</div>
							<p className='text-black text-[20px] font-medium line-clamp-3'>
								{data?.name}
							</p>
						</div>
						{/* Bottom section with Add to Collection button and Collaborator profile pictures */}
						<div
							className={`flex flex-row  items-end ${
								isPublished && isOwner
									? 'justify-between'
									: 'justify-end'
							}`}
						>
							{isPublished && isOwner && (
								<div className='flex flex-row items-center gap-2 w-1/2'>
									<button
										className=' gap-2 cursor-pointer flex items-center justify-center bg-transparent hover:bg-transparent'
										onClick={(e) => {
											e.stopPropagation();
											router.push(
												`/project/${data?.id}?action=publish`
											);
										}}
									>
										<Image
											src={'/addPlusBlack.svg'}
											alt={'add'}
											width={22}
											height={22}
										/>
										<span className='text-black text-[12px] text-left font-medium'>
											Add to Collection
										</span>
									</button>
								</div>
							)}
							{/* Collaborator profile pictures */}
							{(() => {
								const acceptedCollaborators =
									data?.collaborators?.filter(
										(collaborator) =>
											collaborator.status.toLowerCase() ===
											'accepted'
									) || [];
								// Only show profile pictures if there's more than 1 collaborator
								// (meaning more than just the owner)
								const shouldShowPfp =
									acceptedCollaborators.length > 1;

								return (
									shouldShowPfp && (
										<div className='flex flex-row w-1/2 justify-end '>
											{acceptedCollaborators
												.sort((a, b) => {
													// Sort to put creator first
													const aIsCreator =
														a.userWalletAddress ===
														data?.walletAddress;
													const bIsCreator =
														b.userWalletAddress ===
														data?.walletAddress;
													if (
														aIsCreator &&
														!bIsCreator
													)
														return -1;
													if (
														!aIsCreator &&
														bIsCreator
													)
														return 1;
													return 0;
												})
												.slice(0, 4)
												.map((collaborator, i) => {
													// Check if this collaborator is the current logged-in user
													const isCurrentUser =
														collaborator.userWalletAddress ===
														wallet?.getAccount()
															?.address;

													const avatarUrl =
														collaborator.userProfile
															?.avatarUrl;
													const userName =
														collaborator.userProfile
															?.userName;

													return (
														<div
															key={i}
															className={`w-[25px] h-[25px] bg-[#F1F0EB] rounded-full border-2 ${
																isCurrentUser
																	? 'border-[#04FF2C]'
																	: 'border-[#F1F0EB]'
															} -ml-3 overflow-hidden ${
																i === 0
																	? 'ml-0'
																	: ''
															}`}
															style={{
																zIndex: 10 - i,
															}}
														>
															{avatarUrl ? (
																<Image
																	src={
																		avatarUrl
																	}
																	alt={
																		isCurrentUser
																			? 'Current User'
																			: `Collaborator ${
																					i +
																					1
																			  }`
																	}
																	width={25}
																	height={25}
																	className='w-full h-full object-cover'
																/>
															) : (
																<div className='w-full h-full bg-[#6E6E6E] flex items-center justify-center'>
																	<span className='text-white text-[10px] font-bold'>
																		{userName?.charAt(
																			0
																		) ||
																			'?'}
																	</span>
																</div>
															)}
														</div>
													);
												})}
											{acceptedCollaborators.length >
												4 && (
												<div className='w-[25px] font-bold text-white  h-[25px] rounded-full border-2 border-white -ml-3 bg-[#6E6E6E] flex items-center justify-center'>
													<span className='text-[10px] '>
														+
														<span className='ml-[1px] text-[10px] '>
															{acceptedCollaborators.length -
																4}
														</span>
													</span>
												</div>
											)}
										</div>
									)
								);
							})()}
						</div>
					</div>
				)}
			</div>
			<div
				className={`min-w-[200px] h-[250px]  rounded-lg  rounded-tr-[30px] -ml-[90%] z-10 ${
					isNew ? 'bg-[#555554]' : 'bg-[#AFAB99]'
				}`}
			></div>
			<div
				className={` min-w-[200px] h-[250px]  rounded-lg rounded-tr-[30px] -ml-[90%] z-0  ${
					isNew ? 'bg-[#3a3a39]' : 'bg-[#474745]'
				}`}
			></div>
		</div>
	);
}

const getColor = (type: string) => {
	switch (type) {
		case 'create':
			return 'bg-[#AFAB99]';
		case 'collaborate':
			return 'bg-[#C8C57F]';
		case 'monetise':
			return 'bg-[#93B2A0]';
		case 'publish':
			return 'bg-[#C79EAE]';
		default:
			return '';
	}
};
