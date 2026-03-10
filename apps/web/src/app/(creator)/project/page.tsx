'use client';
import ProjectFolder from '@/components/Project/ProjectFolder';
import SortComponent from '@/components/Sort';
import {
	Accordion,
	AccordionItem,
	Checkbox,
	Input,
	Pagination,
	Radio,
	RadioGroup,
} from '@nextui-org/react';
import Image from 'next/image';
import { AllProjectType } from '@/types';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { getProjects } from '@/apihandler/Project';
import useKamiWallet from '@/lib/KamiWalletHook';
import { getCollaboration } from '@/apihandler/Profile';
import { useSearch } from '@/lib/SearchContextProvider';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';

export default function Project() {
	const [projects, setProjects] = useState<AllProjectType[]>();
	const wallet = useKamiWallet();
	const [projectCollab, setProjectCollab] = useState<AllProjectType[]>([]);
	const [filterValue, setFilterValue] = useState<string[]>(['owner']);
	const [sortedOpenProjects, setSortedOpenProjects] = useState<
		AllProjectType[]
	>([]);
	const [sortedPublishedProjects, setSortedPublishedProjects] = useState<
		AllProjectType[]
	>([]);
	const [currentOpenPage, setCurrentOpenPage] = useState(1);
	const [currentPublishedPage, setCurrentPublishedPage] = useState(1);
	const itemsPerPage = 6;
	useEffect(() => {
		// fetch projects
		const w = wallet?.getAccount();
		if (w && w.address && !projects) {
			getProjects(w.address).then((data) => {
				setProjects(data.projects);
				setProjectCollab(data.myCollaborations);
			});
			// getCollaborationData(w.address);
		}
	}, [wallet?.getAccount().address, projects]);

	// const getCollaborationData = async (walletAddress: string) => {
	// 	const res = await getCollaboration(walletAddress);
	// 	if (res.success) {
	// 		setProjectCollab(res.collaborations.projects);
	// 		console.log(res.collaborations.projects);
	// 	}
	// };

	const filteredProjectData = useMemo(() => {
		if (filterValue.includes('owner')) {
			return projects;
		}
		if (filterValue.includes('collab')) {
			return projectCollab;
		}
		// if (filterValue.includes('collab')) {
		// 	return projectCollab;
		// }
	}, [filterValue, projects, projectCollab]);

	// Sort handlers
	const handleSortOpenProjects = (sortedData: AllProjectType[]) => {
		setSortedOpenProjects(sortedData);
		setCurrentOpenPage(1); // Reset to first page when sorting
	};

	const handleSortPublishedProjects = (sortedData: AllProjectType[]) => {
		setSortedPublishedProjects(sortedData);
		setCurrentPublishedPage(1); // Reset to first page when sorting
	};

	// Reset sorted data and pagination when filter changes
	useEffect(() => {
		setSortedOpenProjects([]);
		setSortedPublishedProjects([]);
		setCurrentOpenPage(1);
		setCurrentPublishedPage(1);
	}, [filterValue]);

	//TODO: i dont know how to filter the collaborator

	const filterFunction = (filterValue: string[]) => {
		setFilterValue(filterValue);
	};

	const { searchText, setSearchText, handleSearch } = useSearch();

	const searchProjectData = useMemo(() => {
		if (searchText && searchText.length > 0 && filteredProjectData) {
			const results = handleSearch(searchText, filteredProjectData, [
				'name',
			]);

			return results;
		} else return filteredProjectData;
	}, [searchText, filteredProjectData]);

	// Get open and published projects for sorting
	const openProjects = useMemo(() => {
		const filtered = searchProjectData?.filter((p) => !p.isPublished) || [];
		// Sort by newest first by default
		return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
	}, [searchProjectData]);

	const publishedProjects = useMemo(() => {
		const filtered = searchProjectData?.filter((p) => p.isPublished) || [];
		// Sort by newest first by default
		return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
	}, [searchProjectData]);

	// Use sorted data if available, otherwise use filtered data
	const displayOpenProjects =
		sortedOpenProjects.length > 0 ? sortedOpenProjects : openProjects;
	const displayPublishedProjects =
		sortedPublishedProjects.length > 0
			? sortedPublishedProjects
			: publishedProjects;

	// Pagination logic
	const totalOpenPages = Math.ceil(displayOpenProjects.length / itemsPerPage);
	const totalPublishedPages = Math.ceil(
		displayPublishedProjects.length / itemsPerPage
	);

	const paginatedOpenProjects = displayOpenProjects.slice(
		(currentOpenPage - 1) * itemsPerPage,
		currentOpenPage * itemsPerPage
	);

	const paginatedPublishedProjects = displayPublishedProjects.slice(
		(currentPublishedPage - 1) * itemsPerPage,
		currentPublishedPage * itemsPerPage
	);
	const router = useRouter();
	return (
		<main className='flex flex-col h-full  p-10'>
			<BackButton />
			<div className=' pb-8 w-full flex flex-row gap-14 '>
				<div className='w-1/5'>
					<div className='h-10'></div>
					<Filter
						filterFunction={filterFunction}
						setSearchText={setSearchText}
					/>
				</div>

				<div className='w-4/5 flex flex-col gap-5'>
					<p className='text-[32px] text-[#A79755] font-bold'>
						Project
					</p>

					<div>
						<div className='flex flex-row  items-center pb-2 justify-between border-b border-b-[#F1F0EB]'>
							<div>
								<p className='text-[18px] font-bold'>
									Open:{' '}
									{filterValue.includes('owner')
										? projects?.filter(
												(p) => !p.isPublished
										  ).length
										: projectCollab?.filter(
												(p) => !p.isPublished
										  ).length}
								</p>
							</div>
							<div className='flex flex-row gap-2 w-[20%] justify-end'>
								<SortComponent
									page='projects'
									sorted={handleSortOpenProjects}
									data={openProjects}
								/>
							</div>
						</div>

						<div className='mt-5 flex flex-row gap-20 mr-5'>
							<ProjectFolder isNew />
							<div className='flex-1 flex flex-col gap-5'>
								<div className='flex flex-row flex-wrap gap-16'>
									{paginatedOpenProjects?.map((p, i) => (
										<ProjectFolder
											key={i}
											data={p}
											isOwner={filterValue.includes(
												'owner'
											)}
										/>
									))}
								</div>
								{totalOpenPages > 1 && (
									<div className='flex justify-center mt-5'>
										<Pagination
											total={totalOpenPages}
											page={currentOpenPage}
											onChange={setCurrentOpenPage}
											size='sm'
											showControls
											classNames={{
												base: 'text-[#F1F0EB] text-[13px] ',
												wrapper:
													'gap-0 overflow-visible h-8 ',
												item: 'w-8 h-8  text-[#F1F0EB] rounded-none bg-transparent',
												cursor: 'bg-[#11FF49] rounded-full from-[#A79755] to-[#A79755] text-[#1A1A1A] font-bold',
												prev: 'data-[disabled=true]:opacity-30 text-[#11FF49] bg-transparent [&[data-hover=true]:not([data-active=true])]:bg-transparent  ',
												next: 'data-[disabled=true]:opacity-30 text-[#11FF49] bg-transparent [&[data-hover=true]:not([data-active=true])]:bg-transparent ',
											}}
										/>
									</div>
								)}
							</div>
						</div>
					</div>
					<div className='mt-20'>
						<div className=' flex flex-row  items-center pb-2 justify-between border-b border-b-[#F1F0EB]'>
							<div>
								<p className='text-[18px] font-bold'>
									Published:{' '}
									{filterValue.includes('owner')
										? projects?.filter((p) => p.isPublished)
												.length
										: projectCollab?.filter(
												(p) => p.isPublished
										  ).length}
								</p>
							</div>
							<div className='flex flex-row gap-2 w-[20%] justify-end'>
								<SortComponent
									page='projects'
									sorted={handleSortPublishedProjects}
									data={publishedProjects}
								/>
							</div>
						</div>

						<div className='mt-5 flex flex-row gap-20 mr-5'>
							<div className='w-[200px]' />
							<div className='flex-1 flex flex-col gap-5'>
								<div className='flex flex-row flex-wrap gap-16'>
									{paginatedPublishedProjects?.map((p, i) => (
										<ProjectFolder
											key={i}
											data={p}
											isPublished
											isOwner={filterValue.includes(
												'owner'
											)}
										/>
									))}
								</div>
								{totalPublishedPages > 1 && (
									<div className='flex justify-center mt-5'>
										<Pagination
											total={totalPublishedPages}
											page={currentPublishedPage}
											onChange={setCurrentPublishedPage}
											size='sm'
											showControls
											classNames={{
												base: 'text-[#F1F0EB] text-[13px] ',
												wrapper:
													'gap-0 overflow-visible h-8 ',
												item: 'w-8 h-8  text-[#F1F0EB] rounded-none bg-transparent',
												cursor: 'bg-[#11FF49] rounded-full from-[#A79755] to-[#A79755] text-[#1A1A1A] font-bold',
												prev: 'data-[disabled=true]:opacity-30 text-[#11FF49] bg-transparent [&[data-hover=true]:not([data-active=true])]:bg-transparent  ',
												next: 'data-[disabled=true]:opacity-30 text-[#11FF49] bg-transparent [&[data-hover=true]:not([data-active=true])]:bg-transparent ',
											}}
										/>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

const Filter = ({
	filterFunction,
	setSearchText,
}: {
	filterFunction: (filterValue: string[]) => void;
	setSearchText: Dispatch<SetStateAction<string | undefined>>;
}) => {
	const [filter, setFilter] = useState([
		{
			title: 'Project',
			filterList: [
				{ label: 'Owner', value: 'owner', selected: true },
				{ label: 'Collaborator', value: 'collab', selected: false },
			],
		},
	]);
	return (
		<div>
			<div className='w-full flex flex-row items-center gap-2 '>
				<Input
					isClearable
					// label='Search'
					// labelPlacement={'outside'}
					size='sm'
					className='flex-1'
					placeholder='Search...'
					classNames={{
						base: 'bg-transparent',
						input: 'group-data-[has-value=true]:text-[#F1F0EB] placeholder:text-[#6E6E6E] placeholder:italic text-[13px]',
						inputWrapper:
							'group-data-[hover=true]:bg-[#323131]  group-data-[focus=true]:bg-[#323131] group-data-[focus=true]:border-[0.5px]  group-data-[focus=true]:border-[#979797] rounded-[6px] bg-[#323131]',
					}}
					onChange={(e) => setSearchText(e.target.value)}
					onClear={() => setSearchText('')}
				/>
				<Image
					src={'/search.svg'}
					alt={'search'}
					width={20}
					height={20}
				/>
			</div>
			<div className='mt-5'>
				<div>
					<Accordion
						className='p-0'
						selectionMode='multiple'
						defaultExpandedKeys={['1']}
					>
						{filter.map((fil, i) => (
							<AccordionItem
								key={i + 1}
								aria-label={fil.title}
								title={fil.title}
								classNames={{
									title: 'text-[#F1F0EB] text-[13px] font-bold',
									base: 'm-0 p-0 my-5',
									titleWrapper: 'm-0 p-0 ',
									heading:
										'border-b border-b-[#F1F0EB] w-full p-0 ',
									content: 'p-0',
								}}
								//disableIndicatorAnimation
								// indicator={<MinusIcon />}s
							>
								{fil.filterList.map((item, j) => (
									<div
										key={j}
										className='border-b  border-b-[#6E6E6E] w-full  py-1'
									>
										<Checkbox
											isSelected={item.selected}
											defaultValue={['owner']}
											onValueChange={(e) => {
												// Check if this is the only selected item and user is trying to uncheck it
												const selectedCount =
													fil.filterList.filter(
														(f) => f.selected
													).length;
												if (
													!e &&
													selectedCount === 1 &&
													item.selected
												) {
													// Don't allow unchecking the last selected item
													return;
												}

												// Deselect all other items first
												fil.filterList.forEach((f) => {
													f.selected = false;
												});
												// Then select only the current item if it's being checked
												if (e) {
													item.selected = true;
												}
												setFilter([...filter]);
												filterFunction(
													fil.filterList
														.filter(
															(f) => f.selected
														)
														.map((f) => f.value)
												);
											}}
											radius='full'
											classNames={{
												label: 'text-[#6E6E6E] text-[12px] font-light ml-1',
												icon: 'hidden bg-[#F1F0EB]',
												wrapper:
													'after:bg-[#F1F0EB] after:border-[#F1F0EB] before:border-[#6E6E6E] before:border w-3 h-3 ',
											}}
											className='m-0 p-0 ml-2'
											size='sm'
										>
											{item.label}
										</Checkbox>
									</div>
								))}
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</div>
		</div>
	);
};
