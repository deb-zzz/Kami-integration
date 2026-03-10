'use client';

import CollabTab from '@/components/Project/CollabTab';
import CreateTab from '@/components/Project/CreateTab';
import MonetiseTab from '@/components/Project/MonetiseTab';
import PublishTab from '@/components/Project/PublishTab';
import UnauthorizedAccess from '@/components/Project/UnauthorizedAccess';
import {
	Button,
	Input,
	Select,
	SelectItem,
	SharedSelection,
	Tab,
	Tabs,
	Tooltip,
} from '@nextui-org/react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLazyNFT } from '@/lib/VoucherContext';
import { getProject, updateProject } from '@/apihandler/Project';
import useKamiWallet from '@/lib/KamiWalletHook';
import { getProfile } from '@/apihandler/Profile';
import { useGlobalState } from '@/lib/GlobalContext';

import { AllProjectType, VoucherContextType } from '@/types';
import { ToastMessage } from '@/components/ToastMessage';
import BackButton from '@/components/BackButton';

export type ProjectDraft = {
	collection: {
		name?: string;
		symbol?: string;
		description?: string;
		type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
	};
	product: {
		name: string;
		description: string;
		attributes: string;
		image: string;
		animation_url: string;
		price: string;
	};
};

export default function OpenProject() {
	const [voucher, setVoucher] = useLazyNFT();
	const [selectedTab, setSelectedTab] = useState<string>('create');
	const params = useParams<{
		projectId: string;
		writeAccess: string;
	}>();

	const [project, setProject] = useState<AllProjectType>();
	const [catogories, setCatogories] = useState<
		{ key: number; val: string }[]
	>([]);
	// const [chooseCat, setChooseCat] = useState<string[]>(project?.categoryId ? [project?.categoryId.toString()] : []);
	const [gs, setGs] = useGlobalState();
	const [updateTriger, setUpdateTriger] = useState<{
		timer: number;
		pullUpdate: boolean;
	}>({ pullUpdate: false, timer: 0 });
	const [hasAccess, setHasAccess] = useState<boolean | null>(null); // null = loading, true = has access, false = no access
	const [userAccessLevel, setUserAccessLevel] = useState<
		'owner' | 'collaborator' | 'invited' | 'none' | null
	>(null);
	const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

	const wallet = useKamiWallet();
	const router = useRouter();
	const searchParams = useSearchParams();

	// Debounced auto-save hook
	const debouncedSaveRef = useRef<NodeJS.Timeout>();
	const debouncedUntitledRef = useRef<NodeJS.Timeout>();

	const debouncedSave = useCallback((projectData: any) => {
		if (debouncedSaveRef.current) {
			clearTimeout(debouncedSaveRef.current);
		}

		debouncedSaveRef.current = setTimeout(() => {
			update_project(projectData);
		}, 1000); // Save 1 second after user stops typing
	}, []);

	const debouncedSetUntitled = useCallback(() => {
		if (debouncedUntitledRef.current) {
			clearTimeout(debouncedUntitledRef.current);
		}
		debouncedUntitledRef.current = setTimeout(() => {
			if (project) {
				const newProject = {
					...project,
					collaborators: project?.collaborators,
					name: 'Untitled',
				};
				const newVoucher = voucher
					? {
							...voucher,
							projectTitle: 'Untitled',
					  }
					: null;

				setProject(newProject);
				if (newVoucher) {
					setVoucher(newVoucher);
				}

				// Save the project with 'Untitled' name
				debouncedSave({
					...newProject,
					draft: JSON.stringify({
						collection: {
							...newVoucher?.collection,
						},
						product: {
							name: newVoucher?.metadata?.name,
							description: newVoucher?.metadata?.description,
							attributes: newVoucher?.metadata?.attributes,
							image: newVoucher?.metadata?.image,
							animation_url: newVoucher?.metadata?.animation_url,
							price: newVoucher?.price,
							items: newVoucher?.metadata?.properties?.bundle,
							coverUrl: newVoucher?.coverUrl,
							mediaUrl: newVoucher?.mediaUrl,
						},
					}),
				});
			}
			// Show toast notification
			ToastMessage('info', 'We recommend giving your project a title!');
		}, 2000); // Set to 'Untitled' 2 seconds after field is empty (gives time for pasting)
	}, [project, voucher, setProject, setVoucher, debouncedSave]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (debouncedSaveRef.current) {
				clearTimeout(debouncedSaveRef.current);
			}
			if (debouncedUntitledRef.current) {
				clearTimeout(debouncedUntitledRef.current);
			}
		};
	}, []);

	// Handle query parameter for add-to-collection action
	useEffect(() => {
		const action = searchParams.get('action');
		if (action === 'publish') {
			setSelectedTab('publish');
		}
	}, [searchParams]);

	const projectCat = useMemo(() => {
		return project?.categoryId ? [project?.categoryId.toString()] : [];
	}, [project?.categoryId]);

	useEffect(() => {
		if (project || hasAttemptedFetch) return; // Don't retry if we already have project or have attempted fetch
		const w = wallet?.getAccount();
		// console.log(w);
		if (!w?.address) {
			return;
		}

		setHasAttemptedFetch(true);
		getData(w.address);
		data(w.address);

		// getProfile(w.address).then((data) => {
		// 	setGs({ profile: data.profile });
		// });
		// getProject(w.address, params.projectId as unknown as number).then((response) => {
		// 	setProject(response.project);
		// 	console.log('Got Project', response);
		// 	console.log('Global State', gs);
		// });
	}, [wallet?.getAccount()?.address, project, hasAttemptedFetch]);

	useEffect(() => {
		//c.replace(/\s+/g, '_').toLowerCase()
		if (gs && gs.categories)
			setCatogories(
				gs.categories.map((c) => ({ key: c.id, val: c.name }))
			);
		// console.log('Categories', gs?.categories);
	}, [gs?.categories]);

	useEffect(() => {
		if (project) {
			setVoucher({ category: project.category?.name });
		}
	}, [project?.categoryId]);

	const update_project = async (prjt: AllProjectType) => {
		// console.log('real Update', prjt?.categoryId);
		// setUpdateTriger({ timer: 0, pullUpdate: false });
		// console.log('draft', prjt);
		//prjt.user is going missing when click save as draft
		// if (prjt.status === 'Publish') return;
		try {
			const val = await updateProject(
				prjt?.walletAddress ?? '',
				prjt?.id ?? 0,
				{
					id: prjt?.id ?? 0,
					name: prjt?.name ?? '',
					description: prjt?.description ?? '',
					categoryId: prjt?.categoryId ?? undefined,
					collaborators: prjt?.collaborators ?? [],
					user: prjt?.user,
					draft: prjt?.draft,
				}
			);

			setProject({
				...val.project,
				collaborators: project?.collaborators,
				user: val.project.user || prjt.user,
			});
		} catch (error) {
			console.error('Failed to update project:', error);
			// You could add toast notification here if you have a toast system
			// toast.error('Failed to save project changes');
		}
	};

	const data = async (address: string) => {
		const data = await getProfile(address);
		if (data.success)
			setGs({ profile: data.profile, walletAddress: address });
	};

	const getData = async (address: string) => {
		try {
			const response = await getProject(
				address,
				Number(params.projectId)
			);
			if (response.success && response.project) {
				setProject(response.project);
				setVoucher({
					collectionId: response.project.collection?.collectionId,
					collection: response.project.collection,
					chainId: response.project.collection?.chainId,
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
					} else if (
						collaborator.status.toLowerCase() === 'invited'
					) {
						accessLevel = 'invited';
						userHasAccess = true; // They can view but with limited access
					}
				}

				setUserAccessLevel(accessLevel);
				setHasAccess(userHasAccess);

				// Only load project data if user has access
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
								chainId: draft.collection?.chainId,
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
							chainId: draft.product?.chainId,
							currency: draft.product?.currency,
							quantity: draft.product?.quantity,
						});
					}
				}
			} else {
				// If project not found or error, user doesn't have access
				setHasAccess(false);
			}

			params.writeAccess = (
				response?.project?.walletAddress === address ||
				response?.project?.collaborators?.filter(
					(c) => c.userProfile.walletAddress === address
				) ||
				false
			).toString();
		} catch (error) {
			console.error('Error fetching project data:', error);
			ToastMessage('error', 'Error fetching project data');
		}
	};

	// Show loading state while checking access
	if (hasAccess === null) {
		return (
			<div className='flex items-center justify-center min-h-screen'>
				<div className='text-center'>
					<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[#A79755] mx-auto mb-4'></div>
					<p className='text-[#6E6E6E]'>Loading project...</p>
				</div>
			</div>
		);
	}

	// Show unauthorized access message if user doesn't have permission
	if (hasAccess === false) {
		return <UnauthorizedAccess />;
	}

	// Show main content if user has access
	return (
		<>
			<BackButton className='mx-10 cursor-pointer' />
			<main className='flex flex-col h-full pt-5 pb-20 px-10'>
				<div className='flex flex-col gap-5'>
					<p className='text-[32px] text-[#A79755] font-bold'>
						Project
					</p>
					<div className='flex flex-row  items-center pb-2 justify-between border-b border-b-[#F1F0EB]'>
						<div>
							<p className='text-[18px] font-bold'>Owner</p>
						</div>
						{userAccessLevel === 'owner' && (
							<div className='flex flex-row gap-2'>
								{/* <CollaboratorSearch projectId={project?.id ?? 0} walletAddress={project?.walletAddress ?? ''} projectName={project?.name ?? ''} /> */}

								<Button
									size='sm'
									variant='flat'
									className='bg-[#323131] w-full text-[#F1F0EB] px-4 text-[13px] font-light m-1'
									startContent={
										<Image
											src={'/profile/save.svg'}
											alt={'heart'}
											width={20}
											height={20}
										/>
									}
									onClick={() => {
										if (!project) return;

										setVoucher({
											...voucher,
											projectTitle: project?.name ?? '',
											collectionId:
												project?.collection
													?.collectionId,
										});

										update_project({
											...project,
											user: project.user,
											draft: JSON.stringify({
												collection: {
													...voucher?.collection,
												},
												product: {
													name: voucher?.metadata
														?.name,
													description:
														voucher?.metadata
															?.description,
													attributes:
														voucher?.metadata
															?.attributes,
													image: voucher?.metadata
														?.image,
													animation_url:
														voucher?.metadata
															?.animation_url,
													price: voucher?.price,
													chainId: voucher?.chainId,
													currency: voucher?.currency,
													quantity: voucher?.quantity,
													items: voucher?.metadata
														?.properties?.bundle,
													coverUrl: voucher?.coverUrl,
													mediaUrl: voucher?.mediaUrl,
													tags: voucher?.tags,
												},
											}),
										});
									}}
								>
									Save As Draft
								</Button>
							</div>
						)}
					</div>
					<div className='flex flex-row justify-between items-end'>
						<div className='w-2/3'>
							<p className='text-[10px] font-medium uppercase'>
								Title:
							</p>
							{project?.status === 'Publish' ||
							userAccessLevel !== 'owner' ? (
								<div>{project?.name}</div>
							) : (
								<Input
									size='md'
									variant='flat'
									disabled={
										project?.status === 'Publish' ||
										userAccessLevel !== 'owner'
									}
									className='mt-2 w-1/2'
									maxLength={50}
									value={project?.name}
									onValueChange={(value) => {
										// Enforce 50 character limit
										if (value.length <= 50) {
											const newProject = {
												...project!,
												collaborators:
													project?.collaborators,
												name: value,
											};
											const newVoucher = {
												...voucher!,
												projectTitle: value,
											};

											setProject(newProject);
											setVoucher(newVoucher);

											// Auto-save after user stops typing (only if not empty)
											if (
												newProject?.name &&
												newProject.name.trim() !== ''
											) {
												// Cancel the "Untitled" timer if user starts typing
												if (
													debouncedUntitledRef.current
												) {
													clearTimeout(
														debouncedUntitledRef.current
													);
												}

												debouncedSave({
													...newProject,
													draft: JSON.stringify({
														collection: {
															...newVoucher?.collection,
														},
														product: {
															name: newVoucher
																?.metadata
																?.name,
															description:
																newVoucher
																	?.metadata
																	?.description,
															attributes:
																newVoucher
																	?.metadata
																	?.attributes,
															image: newVoucher
																?.metadata
																?.image,
															animation_url:
																newVoucher
																	?.metadata
																	?.animation_url,
															price: newVoucher?.price,
															items: newVoucher
																?.metadata
																?.properties
																?.bundle,
															coverUrl:
																newVoucher?.coverUrl,
															mediaUrl:
																newVoucher?.mediaUrl,
															tags: newVoucher?.tags,
														},
													}),
												});
											} else if (value.trim() === '') {
												// Set to 'Untitled' after 3 seconds if empty
												debouncedSetUntitled();
											}
										}
									}}
									classNames={{
										base: 'bg-transparent',
										inputWrapper:
											'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
										input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
									}}
									endContent={
										<span className='text-xs text-[#AFAB99]'>
											{project?.name?.length || 0}/50
										</span>
									}
								/>
							)}
						</div>
						<div className='w-1/3'>
							{project &&
							project.status === 'Publish' &&
							project.categoryId === null ? (
								<></>
							) : (
								<div
									className={
										project?.status === 'Publish'
											? 'flex gap-3 items-center'
											: ''
									}
								>
									<p className='text-[10px] font-medium uppercase'>
										Category :{' '}
									</p>
									{(project &&
										project?.status === 'Publish') ||
									userAccessLevel !== 'owner' ? (
										<div>
											{
												gs?.categories?.find(
													(c) =>
														c.id ===
														project?.categoryId
												)?.name
											}
										</div>
									) : (
										catogories.length > 0 &&
										projectCat &&
										// projectCat.length > 0 &&
										project && (
											<Select
												size='md'
												isDisabled={
													project?.status ===
													'Publish'
												}
												variant='bordered'
												aria-label='type'
												className='mt-2'
												selectionMode='single'
												selectedKeys={projectCat}
												classNames={{
													base: 'bg-[#1a1a1a] text-[#F1F0EB]',
													value: 'placeholder:text-[#F1F0EB] rtl:text-right group-data-[has-value=true]:text-[#F1F0EB] text-[#F1F0EB] text-[16px] font-semibold italic',
													trigger:
														'border border-[#F1F0EB] data-[open=true]:border-[#F1F0EB] data-[focus=true]:border-[#F1F0EB]  data-[hover=true]:border-[#F1F0EB] group-data-[focus=true]:border-[#F1F0EB] rounded-lg',
													popoverContent:
														'bg-[#1a1a1a] border border-[#F1F0EB]',
													selectorIcon:
														'text-[#F1F0EB] h-[20px] w-[20px]',
													listbox: 'text-[#F1F0EB]',
												}}
												onChange={(e) => {
													// console.log('more');
													if (
														project?.status ===
														'Publish'
													)
														return;
													const cat = catogories.find(
														(f) =>
															f.key ===
															Number(
																e.target.value
															)
													);
													setVoucher({
														...voucher,
														category: cat?.val,
														collectionId:
															project?.collection
																?.collectionId,
													});
													update_project({
														...project!,
														draft: JSON.stringify({
															collection: {
																...voucher?.collection,
															},
															product: {
																name: voucher
																	?.metadata
																	?.name,
																description:
																	voucher
																		?.metadata
																		?.description,
																attributes:
																	voucher
																		?.metadata
																		?.attributes,
																image: voucher
																	?.metadata
																	?.image,
																animation_url:
																	voucher
																		?.metadata
																		?.animation_url,
																price: voucher?.price,
																items: voucher
																	?.metadata
																	?.properties
																	?.bundle,
																coverUrl:
																	voucher?.coverUrl,
																mediaUrl:
																	voucher?.mediaUrl,
															},
														}),
														category: undefined,
														categoryId: Number(
															e.target.value
														),
													});
												}}
												placeholder='Select One'
											>
												{catogories.map((val) => (
													<SelectItem key={val.key}>
														{val.val}
													</SelectItem>
												))}
											</Select>
										)
									)}
								</div>
							)}
						</div>
					</div>
					<div
						className={`border-b border-b-[#F1F0EB]  ${
							userAccessLevel !== 'owner' ||
							project?.status === 'Publish'
								? 'mt-0'
								: ' mt-10 '
						} `}
					></div>

					{/* Show notice for invited collaborators */}
					{/* {userAccessLevel === 'invited' && (
						<div className='mb-5 p-4 bg-[#FFF3CD] border border-[#FFEAA7] rounded-lg'>
							<div className='flex items-center gap-3'>
								<div className='w-6 h-6 bg-[#FFC107] rounded-full flex items-center justify-center'>
									<span className='text-white text-sm font-bold'>
										!
									</span>
								</div>
								<div>
									<p className='text-[#856404] font-semibold text-[14px]'>
										Limited Access
									</p>
									<p className='text-[#856404] text-[12px]'>
										You have been invited to collaborate but
										haven&apos;t accepted yet. You can only
										view the Create tab.
									</p>
								</div>
							</div>
						</div>
					)} */}

					<div>
						<div className='flex flex-col gap-[2px] '>
							<p className='text-[10px] font-medium uppercase'>
								{getTitle(selectedTab)}
							</p>
							{selectedTab === 'create' ? (
								<p className='h-[15px] text-[13px] font-medium text-[#AFAB99] italic normal-case  '>
									Take note: Maximum file size per upload for
									this scrapbook is 10Mb.
								</p>
							) : (
								<div className='h-[15px]' />
							)}
						</div>
						{userAccessLevel !== null && selectedTab !== '' ? (
							<Tabs
								selectedKey={selectedTab}
								onSelectionChange={(e) => {
									// Prevent tab switching for invited collaborators
									if (userAccessLevel === 'invited') {
										return;
									}
									// Ensure we're working with a string value
									const newTab =
										typeof e === 'string' ? e : String(e);
									setSelectedTab(newTab);
								}}
								variant='underlined'
								aria-label='Tabs variants'
								fullWidth
								className='mt-4'
								classNames={{
									panel: 'p-0 h-full',
									tab: 'p-0 w-full',
									tabList:
										'w-full relative rounded-none p-0  text-[#F1F0EB]',
									cursor: 'w-full  text-[#F1F0EB] p-0',
									tabContent:
										'w-full group-data-[selected=true]:text-[#F1F0EB]  group-data-[selected=true]:font-semibold ',
								}}
							>
								<Tab
									key='create'
									title={
										<div
											className={`w-full mr-5 p-2 ${getColor(
												'create'
											)} `}
										>
											<p className='text-[15px] text-black'>
												Create
											</p>
										</div>
									}
								>
									<div className='bg-[#F1F0EB] w-full h-[600px]'>
										<div className='create-strip'></div>
										<CreateTab />
									</div>
								</Tab>
								<Tab
									key='collaborate'
									isDisabled={userAccessLevel === 'invited'}
									title={
										<div
											className={`w-full mr-5 p-2 ${getColor(
												'collaborate'
											)} ${
												userAccessLevel === 'invited'
													? 'opacity-50'
													: ''
											}`}
										>
											<p className='text-[15px] text-black'>
												Collaborate
											</p>
										</div>
									}
								>
									<div className='bg-[#F1F0EB] w-full h-full'>
										<div className='collab-strip'></div>
										{gs?.profile && (
											<CollabTab
												owner={project?.user}
												collaborators={
													project?.collaborators ?? []
												}
												projectName={
													project?.name ?? ''
												}
												projectId={project?.id ?? 0}
												isActionDisabled={
													userAccessLevel ===
														'collaborator' ||
													project?.status ===
														'Publish'
												}
											/>
										)}
									</div>
								</Tab>
								<Tab
									key='monetise'
									isDisabled={
										userAccessLevel === 'invited' ||
										!hasAccess
									}
									// isDisabled={true}
									title={
										<div
											className={`w-full mr-5 p-2 ${getColor(
												'monetise'
											)} ${
												userAccessLevel === 'invited'
													? 'opacity-50'
													: ''
											}`}
										>
											<p className='text-[15px] text-black'>
												Monetise
											</p>
										</div>
									}
								>
									<div className='bg-[#F1F0EB] w-full h-full'>
										<div className='monetise-strip'></div>
										<MonetiseTab
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
														if (
															a.isCreator &&
															!b.isCreator
														)
															return -1;
														if (
															!a.isCreator &&
															b.isCreator
														)
															return 1;
														return 0;
													}) ?? []
											}
											currentUserWalletAddress={
												wallet?.getAccount()?.address
											}
											isActionDisabled={
												userAccessLevel ===
												'collaborator'
											}
											projectId={project?.id ?? 0}
											royaltyPercentage={
												project?.royaltyPercentage ?? 0
											}
											getData={() =>
												getData(gs?.walletAddress ?? '')
											}
										/>
									</div>
								</Tab>
								<Tab
									key='publish'
									isDisabled={userAccessLevel === 'invited'}
									title={
										<div
											className={`w-full mr-5 p-2 ${getColor(
												'publish'
											)} ${
												userAccessLevel === 'invited'
													? 'opacity-50'
													: ''
											}`}
										>
											<p className='text-[15px] text-black'>
												Publish
											</p>
										</div>
									}
								>
									<div className='bg-[#F1F0EB] w-full h-full'>
										<div className='publish-strip'></div>
										{project && (
											<PublishTab
												project={project}
												getData={() =>
													getData(
														gs?.walletAddress ?? ''
													)
												}
												isActionDisabled={
													userAccessLevel ===
													'collaborator'
												}
											/>
										)}
									</div>
								</Tab>
							</Tabs>
						) : (
							<div className='flex items-center justify-center h-[600px]'>
								<div className='text-center'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[#A79755] mx-auto mb-2'></div>
									<p className='text-[#6E6E6E] text-sm'>
										Loading tabs...
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>
		</>
	);
}

const getTitle = (name: string) => {
	switch (name) {
		case 'create':
			return 'SCRAPBOOK';
		case 'collaborate':
			return 'COLLABORATION INVITATION';
		case 'monetise':
			return 'MONEY MATTERS';
		case 'publish':
			return 'FINAL DETAILS';
		default:
			return 'SCRAPBOOK';
	}
};

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

const draftToProject = (
	project: AllProjectType,
	draft: any
): AllProjectType => {
	return { ...project, draft: JSON.stringify(draft) };
};
