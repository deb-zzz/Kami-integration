'use client';

import CollabTab from '@/components/Project/CollabTab';
import CreateTab from '@/components/Project/CreateTab';
import MonetiseTab from '@/components/Project/MonetiseTab';
import PublishTab from '@/components/Project/PublishTab';
import { Input, Select, SelectItem, Tab, Tabs } from '@nextui-org/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLazyNFT } from '@/lib/VoucherContext';
import { createProject } from '@/apihandler/Project';
import useKamiWallet from '@/lib/KamiWalletHook';
import { AllProjectType } from '@/types';
import { useGlobalState } from '@/lib/GlobalContext';
import { getProfile } from '@/apihandler/Profile';
import BackButton from '@/components/BackButton';

export default function NewProject() {
	const [voucher, setVoucher] = useLazyNFT();
	const [selectedTab, setSelectedTab] = useState<string>('create');
	// const [projectId, setProjectId] = useState<number>(0);
	const [catogories, setCatogories] = useState<
		{ key: number; val: string }[]
	>([]);
	const [project, setProject] = useState<AllProjectType>();
	const [gs, setGs] = useGlobalState();

	const wallet = useKamiWallet();
	const router = useRouter();
	const categoryOption = [
		{ key: 'visual art', val: 'Visual Art' },
		{ key: 'digital art', val: 'Digital Art' },
		{ key: 'music', val: 'Music' },
	];

	useEffect(() => {
		const w = wallet?.getAccount();
		if (w?.address) {
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
		}
	}, [wallet?.getAccount()]);

	useEffect(() => {
		//c.replace(/\s+/g, '_').toLowerCase()
		if (gs && gs.categories)
			setCatogories(
				gs.categories.map((c) => ({ key: c.id, val: c.name }))
			);
	}, [gs?.categories]);

	useEffect(() => {
		const w = wallet?.getAccount();
		if (w?.address) getData(w.address);
	}, [wallet?.getAccount()]);

	const data = async (address: string) => {
		const data = await getProfile(address);
		if (data.success)
			setGs({ profile: data.profile, walletAddress: address });
	};

	const getData = async (address: string) => {
		// create a new project with untitled title and no description
		const response = await createProject(address, {
			name: 'Untitled @ ' + new Date().getTime(),
			description: 'Description',
		});
		// setProjectId(response.project.id);
		setProject(response.project);
		// await getProject(address, 7);
	};

	return (
		<>
			<BackButton />
			<main className='flex flex-col h-full pt-5 pb-20 px-10'>
				<div className='flex flex-col gap-5'>
					<p className='text-[32px] text-[#A79755] font-bold'>
						Project
					</p>
					<div className='flex flex-row  items-center pb-2 justify-between border-b border-b-[#F1F0EB]'>
						<div>
							<p className='text-[18px] font-bold'>Owner</p>
						</div>
						<div className='flex flex-row gap-2'>
							<p className='text-[12px] font-light'>filter</p>
						</div>
					</div>
					<div className='flex flex-row justify-between items-end'>
						<div className='w-2/3'>
							<p className='text-[10px] font-medium uppercase'>
								Title:
							</p>
							<Input
								size='md'
								variant='flat'
								className='mt-2 w-1/2'
								value={project?.name}
								onValueChange={(val) => setVoucher({})}
								classNames={{
									base: 'bg-transparent',
									inputWrapper:
										'bg-[#323131] group-data-[focus=true]:bg-[#323131] group-data-[hover=true]:bg-[#323131] rounded-[6px]',
									input: 'text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
								}}
							/>
						</div>
						<div className='w-1/3'>
							<p className='text-[10px] font-medium uppercase'>
								Category:
							</p>
							<Select
								size='md'
								variant='bordered'
								aria-label='type'
								className='mt-2'
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
								placeholder='Select One'
							>
								{categoryOption.map((val) => (
									<SelectItem key={val.key}>
										{val.val}
									</SelectItem>
								))}
							</Select>
						</div>
					</div>
					<div className='border-b border-b-[#F1F0EB] mt-10 mb-5 '></div>
					<div>
						<p className='text-[10px] font-medium uppercase'>
							{getTitle(selectedTab)}
						</p>
						<Tabs
							onSelectionChange={(e) => {
								if (e != null) setSelectedTab(e.toString());
							}}
							variant='underlined'
							aria-label='Tabs variants'
							fullWidth
							className='mt-5'
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
								title={
									<div
										className={`w-full mr-5 p-2 ${getColor(
											'collaborate'
										)} `}
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
											owner={gs?.profile}
											collaborators={
												project?.collaborators ?? []
											}
											projectName={project?.name ?? ''}
											projectId={project?.id ?? 0}
											isActionDisabled={false}
										/>
									)}
								</div>
							</Tab>
							<Tab
								key='monetise'
								title={
									<div
										className={`w-full mr-5 p-2 ${getColor(
											'monetise'
										)} `}
									>
										<p className='text-[15px] text-black'>
											Monetise
										</p>
									</div>
								}
							>
								<div className='bg-[#F1F0EB] w-full h-full'>
									<div className='monetise-strip'></div>
									{/* <MonetiseTab
										collaborators={
											project?.collaborators ?? []
										}
										isActionDisabled={false}
									/> */}
								</div>
							</Tab>
							<Tab
								key='publish'
								title={
									<div
										className={`w-full mr-5 p-2 ${getColor(
											'publish'
										)} `}
									>
										<p className='text-[15px] text-black'>
											Publish
										</p>
									</div>
								}
							>
								<div className='bg-[#F1F0EB] w-full h-full'>
									<div className='publish-strip'></div>
									{/* {project && <PublishTab project={project} />} */}
								</div>
							</Tab>
						</Tabs>
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
