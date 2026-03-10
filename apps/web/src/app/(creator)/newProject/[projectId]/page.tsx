'use client';

import CollaborateStep from '@/components/NewProject/steps/CollaborateStep';
import CreateStep from '@/components/NewProject/steps/CreateStep';
import MonetiseStep from '@/components/NewProject/steps/MonetiseStep';
import PackageStep from '@/components/NewProject/steps/PackageStep';
import PublishStep from '@/components/NewProject/steps/PublishStep';

import { Button, Skeleton, Spinner } from '@nextui-org/react';
import { steps, useStepStore } from './useStepStore';
import Stepper from '@/components/NewProject/Stepper';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import ProjectHeader from './projectHeader';
import { getProject } from '@/apihandler/Project';
import { AllProjectType } from '@/types';
import { useEffect, useState } from 'react';
import useKamiWallet from '@/lib/KamiWalletHook';
import UnauthorizedAccess from '@/components/Project/UnauthorizedAccess';
import { useLazyNFT } from '@/lib/VoucherContext';

export default function NewOpenProject() {
	const { steps, activeStepId, setActiveStepId, activeStepIndex, hydrated } =
		useStepStore();
	const wallet = useKamiWallet();
	const router = useRouter();
	const params = useParams<{ projectId: string; writeAccess: string }>();
	const [project, setProject] = useState<AllProjectType>();
	const [userAccessLevel, setUserAccessLevel] = useState<
		'owner' | 'collaborator' | 'invited' | 'none' | null
	>(null);
	const [hasAccess, setHasAccess] = useState<boolean | null>(null); // null = loading, true = has access, false = no access
	const [voucher, setVoucher] = useLazyNFT();

	// Restrict invited users to only the 'create' step
	useEffect(() => {
		if (userAccessLevel === 'invited' && activeStepId !== 'create') {
			setActiveStepId('create');
		}
	}, [userAccessLevel, activeStepId, setActiveStepId]);

	useEffect(() => {
		if (project) return;
		const w = wallet?.getAccount();
		console.log(w);
		if (w?.address) {
			getData(w.address);
		}
	}, [wallet?.getAccount()]);

	const getData = async (address: string) => {
		const response = await getProject(address, Number(params.projectId));

		if (response.success && response.project) {
			setProject(response.project);
			setVoucher({
				collectionId: response.project.collection?.collectionId,
				collection: response.project.collection,
			});
			// Check if user has access to this project
			const isOwner = response.project.walletAddress === address;
			const collaborator = response.project.collaborators?.find(
				(collaborator) =>
					collaborator.userProfile.walletAddress === address
			);

			let accessLevel: 'owner' | 'collaborator' | 'invited' | 'none' =
				'none';
			let userHasAccess = false;
			if (isOwner) {
				accessLevel = 'owner';

				userHasAccess = true;
			} else if (collaborator) {
				if (collaborator.status.toLowerCase() === 'accepted') {
					accessLevel = 'collaborator';
					userHasAccess = true;
				} else if (collaborator.status.toLowerCase() === 'invited') {
					accessLevel = 'invited';
					userHasAccess = true;
				}
			}

			setUserAccessLevel(accessLevel);
			setHasAccess(userHasAccess);

			if (userHasAccess) {
				if (
					response.project.draft !== null &&
					response.project.draft !== undefined
				) {
					const draft = JSON.parse(
						JSON.stringify(response.project.draft ?? '')
					);

					setVoucher({
						coverUrl: draft?.product?.coverUrl,
						mediaUrl: draft?.product?.mediaUrl,
						collection: {
							...voucher?.collection,
							name: draft.collection?.name,
							description: draft.collection?.description,
							symbol: draft.collection?.symbol,
							type: draft.collection?.type,
						},
						metadata: {
							name: draft.product?.name,
							description: draft.product?.description,
							attributes: draft.product?.attributes,
							image: draft.product?.image,
							animation_url: draft.product?.animation_url,
							properties: {
								bundle: draft.product?.items,
							},
						},
						price: draft.product?.price,
						tags: draft.product?.tags,
					});
				}
			}
		}
	};

	// Calculate isActionDisabled: true if user is a collaborator or invited (not owner)
	const isActionDisabled =
		userAccessLevel === 'collaborator' || userAccessLevel === 'invited';

	// Wrapper for setActiveStepId that prevents invited users from navigating away from 'create'
	const handleSetActiveStepId = (stepId: string) => {
		if (userAccessLevel === 'invited' && stepId !== 'create') {
			return; // Prevent navigation for invited users
		}
		setActiveStepId(stepId);
	};

	const renderStepContent = () => {
		switch (activeStepId) {
			case 'create':
				return <CreateStep isActionDisabled={isActionDisabled} />;
			case 'collaborate':
				return (
					<CollaborateStep
						creator={project?.user}
						collaborators={
							project?.collaborators?.filter(
								(collaborator) =>
									collaborator.userWalletAddress !==
										project?.user?.walletAddress &&
									collaborator.status.toLowerCase() ===
										'accepted'
							) ?? []
						}
						project={{
							projectId: project?.id,
							projectName: project?.name,
						}}
						isActionDisabled={isActionDisabled}
						walletAddress={wallet?.getAccount()?.address!}
						getData={() => getData(wallet?.getAccount()?.address!)}
					/>
				);
			case 'monetise':
				return (
					<MonetiseStep
						collaborators={
							project?.collaborators
								?.filter(
									(collaborator, index) =>
										collaborator.status.toLowerCase() ===
										'accepted'
								)
								?.map((collab) => ({
									...collab,
									isCreator:
										collab.userWalletAddress ===
										project?.walletAddress,
								}))
								?.sort((a, b) => {
									// Put creator first
									if (a.isCreator && !b.isCreator) return -1;
									if (!a.isCreator && b.isCreator) return 1;
									return 0;
								}) ?? []
						}
						isActionDisabled={isActionDisabled}
						getData={() => getData(wallet?.getAccount()?.address!)}
						walletAddress={wallet?.getAccount()?.address!}
						royaltyPercentage={project?.royaltyPercentage ?? 0}
						project={{
							projectId: project?.id ?? 0,
							projectName: project?.name ?? '',
						}}
					/>
				);
			case 'package':
				return (
					<PackageStep
						project={project}
						isActionDisabled={isActionDisabled}
					/>
				);
			case 'publish':
				return <PublishStep isActionDisabled={isActionDisabled} />;
			default:
				return <CreateStep isActionDisabled={isActionDisabled} />;
		}
	};

	const renderStepTitle = () => {
		switch (activeStepId) {
			case 'create':
				return <p>IDEA SCRAPBOOK</p>;
			case 'collaborate':
				return <p>PROJECT MEMBERS</p>;

			case 'monetise':
				return <p>SHARE ALLOCATION</p>;

			case 'package':
				return <p>PRODUCT DETAILS</p>;

			case 'publish':
				return <p>PRODUCT SPECIFICATION</p>;
			default:
				return <p>IDEA SCRAPBOOK</p>;
		}
	};

	// Show unauthorized access message if user doesn't have permission
	if (hasAccess === false) {
		return <UnauthorizedAccess />;
	}

	const handleNext = () => {
		if (userAccessLevel === 'invited') {
			return; // Prevent navigation for invited users
		}
		if (activeStepIndex < steps.length - 1) {
			setActiveStepId(steps[activeStepIndex + 1].id);
		}
	};

	const handleBack = () => {
		if (userAccessLevel === 'invited') {
			return; // Prevent navigation for invited users
		}
		if (activeStepIndex > 0) {
			setActiveStepId(steps[activeStepIndex - 1].id);
		}
	};

	if (!hydrated) {
		return (
			<main className='flex min-h-screen'>
				<div className='loadingOverlay w-full h-full'>
					<div className=' w-full h-full '>
						<Spinner
							color='default'
							className='justify-self-center valign '
						/>
					</div>
				</div>
				{/* <div className='w-1/4 flex-col space-y-10  p-8'>
					<Skeleton className='h-8 w-1/2' />
					<div className='space-y-8'>
						<Skeleton className='h-10 w-full' />
						<Skeleton className='h-10 w-full' />
						<Skeleton className='h-10 w-full' />
						<Skeleton className='h-10 w-full' />
						<Skeleton className='h-10 w-full' />
					</div>
				</div>
				<div className='w-3/4 p-8'>
					<Skeleton className='h-[400px] w-full' />
				</div> */}
			</main>
		);
	}
	const previousStep =
		activeStepIndex > 0 ? steps[activeStepIndex - 1] : null;
	const nextStep =
		activeStepIndex < steps.length - 1 ? steps[activeStepIndex + 1] : null;

	return (
		<>
			<Image
				src={'/back-icon.svg'}
				alt={'back'}
				width={35}
				height={35}
				className='cursor-pointer mx-10 '
				onClick={() => router.back()}
			/>
			<main className='flex h-full  pb-20  gap-20'>
				<aside className='  p-8 '>
					<Stepper
						steps={steps}
						activeStepIndex={activeStepIndex}
						setActiveStepId={handleSetActiveStepId}
						disabledSteps={
							userAccessLevel === 'invited'
								? steps
										.filter((s) => s.id !== 'create')
										.map((s) => s.id)
								: []
						}
					/>
				</aside>
				<section className='flex flex-1 flex-col p-4 md:p-8'>
					<div className='mb-5 -mt-16'>
						<div className='flex flex-row items-center gap-4'>
							<button
								type='button'
								onClick={() => {
									router.push(`/newProject`);
								}}
								className={`text-[32px] text-[#6E6E6E] focus:text-[#A79755] hover:text-[#AFAB99] font-bold cursor-pointer transition-colors bg-transparent border-none p-0 outline-none hover:opacity-80`}
							>
								Projects
							</button>
							<span className='text-[#6E6E6E] text-[32px] font-bold'>
								|
							</span>
							<button
								type='button'
								onClick={() => {
									router.push(`/newProject`);
								}}
								className={`text-[32px] text-[#6E6E6E] focus:text-[#A79755] hover:text-[#AFAB99] font-bold cursor-pointer transition-colors bg-transparent border-none p-0 outline-none hover:opacity-80`}
							>
								Products
							</button>
						</div>
					</div>

					<ProjectHeader
						collaborators={
							project?.collaborators
								?.filter(
									(collaborator) =>
										collaborator.userWalletAddress !==
											project?.user?.walletAddress &&
										collaborator.status.toLowerCase() ===
											'accepted'
								)
								?.map(({ userProfile, userWalletAddress }) => ({
									avatarUrl: userProfile.avatarUrl,
									userWalletAddress,
								})) ?? []
						}
						creator={{
							avatarUrl: project?.user?.avatarUrl ?? '',
							userWalletAddress:
								project?.user?.walletAddress ?? '',
						}}
						project={{
							projectId: project?.id,
							projectName: project?.name,
							status: project?.status,
						}}
						category={{
							categoryId: project?.categoryId,
							categoryName: project?.category?.name,
						}}
						isActionDisabled={isActionDisabled}
					/>
					<div className='pt-8'>{renderStepTitle()}</div>
					<div
						key={activeStepId}
						className='animate-in fade-in-50 duration-500 flex-1 pt-4'
					>
						{userAccessLevel === 'invited' &&
						activeStepId !== 'create' ? (
							<CreateStep isActionDisabled={isActionDisabled} />
						) : (
							renderStepContent()
						)}
					</div>
					<div
						className={`flex flex-row mt-8 ${
							!previousStep
								? 'justify-end'
								: !nextStep
								? 'justify-start'
								: 'justify-between'
						}`}
					>
						{previousStep && (
							<Button
								variant='flat'
								className='text-[#F1F0EB] font-light text-[13px] bg-transparent p-0'
								onClick={handleBack}
								disabled={
									activeStepIndex === 0 ||
									userAccessLevel === 'invited'
								}
							>
								<div className='bg-transparent border border-[0.5] w-[20px] h-[20px] border-[#F1F0EB] rounded-full flex justify-center items-center '>
									<Image
										src={'/arrows/chevron-left.svg'}
										alt={'back'}
										width={5}
										height={5}
										className='justify-self-center '
									/>
								</div>
								{previousStep.label}
							</Button>
						)}
						{nextStep && (
							<Button
								variant='flat'
								className='text-[#F1F0EB] font-light text-[13px] bg-transparent p-0'
								onClick={handleNext}
								disabled={
									activeStepIndex === steps.length - 1 ||
									userAccessLevel === 'invited'
								}
							>
								{nextStep.label}
								<div className='bg-transparent border border-[0.5] w-[20px] h-[20px]  border-[#F1F0EB] rounded-full flex justify-center items-center '>
									<Image
										src={'/arrows/chevron-right.svg'}
										alt={'next'}
										width={5}
										height={5}
										className='justify-self-center'
									/>
								</div>
							</Button>
						)}
					</div>
				</section>
			</main>
		</>
	);
}
