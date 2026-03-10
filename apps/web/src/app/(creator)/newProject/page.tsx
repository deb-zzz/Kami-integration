'use client';
import ProjectFolder from '@/components/Project/ProjectFolder';
import SortComponent from '@/components/Sort';
import {
	Accordion,
	AccordionItem,
	Checkbox,
	Input,
	Pagination,
} from '@nextui-org/react';
import Image from 'next/image';
import { AllProjectType } from '@/types';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { getProjects } from '@/apihandler/Project';
import useKamiWallet from '@/lib/KamiWalletHook';
import { useSearch } from '@/lib/SearchContextProvider';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';

export default function Project() {
	const [projects, setProjects] = useState<AllProjectType[]>();
	const wallet = useKamiWallet();
	const [projectCollab, setProjectCollab] = useState<AllProjectType[]>([]);
	const [filterValue, setFilterValue] = useState<string[]>(['owner']);
	const [activeTab, setActiveTab] = useState<'projects' | 'products'>(
		'projects'
	);
	const [sortedProjects, setSortedProjects] = useState<AllProjectType[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 9;
	useEffect(() => {
		// fetch projects
		const w = wallet?.getAccount();
		const address = w?.address;
		if (address && !projects) {
			const fetchProjects = async () => {
				try {
					const data = await getProjects(address);
					console.log(data);
					setProjects(data.projects);
					setProjectCollab(data.myCollaborations);
				} catch (error) {
					console.error('Error fetching projects:', error);
					// Optionally show error toast or set error state
				}
			};
			fetchProjects();
			// getCollaborationData(w.address);
		}
	}, [wallet, projects]);

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

	// Sort handler
	const handleSortProjects = (sortedData: AllProjectType[]) => {
		setSortedProjects(sortedData);
		setCurrentPage(1); // Reset to first page when sorting
	};

	// Reset sorted data and pagination when filter changes
	useEffect(() => {
		setSortedProjects([]);
		setCurrentPage(1);
	}, [filterValue, activeTab]);

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
	}, [searchText, filteredProjectData, handleSearch]);

	// Get filtered projects based on active tab
	// Projects: isPublished === false
	// Products: isPublished === true
	const allProjects = useMemo(() => {
		if (!searchProjectData) return [];
		const filtered = searchProjectData.filter((p) => {
			if (activeTab === 'projects') {
				return !p.isPublished; // Projects are unpublished
			} else {
				return p.isPublished; // Products are published
			}
		});
		// Sort by newest first by default
		return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
	}, [searchProjectData, activeTab]);

	// Use sorted data if available, otherwise use filtered data
	const displayProjects =
		sortedProjects.length > 0 ? sortedProjects : allProjects;

	// Pagination logic
	const totalPages = Math.ceil(displayProjects.length / itemsPerPage);

	const paginatedProjects = displayProjects.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Total count for display
	const totalCount = displayProjects.length;
	const router = useRouter();
	return (
		<main className='flex flex-col h-full  p-10'>
			<BackButton />
			<div className='pb-8 w-full flex flex-row gap-14 mt-10'>
				<div className='w-1/5'>
					<Filter
						filterFunction={filterFunction}
						setSearchText={setSearchText}
						activeTab={activeTab}
					/>
				</div>

				<div className='w-4/5 flex flex-col gap-5 -mt-2'>
					{/* Main heading with tabs functionality */}
					<div>
						<div className='flex flex-row items-center gap-4'>
							<button
								type='button'
								onClick={() => {
									setActiveTab('projects');
								}}
								className={`text-[32px] font-bold cursor-pointer transition-colors bg-transparent border-none p-0 outline-none hover:opacity-80 ${
									activeTab === 'projects'
										? 'text-[#A79755]'
										: 'text-[#6E6E6E]'
								}`}
							>
								Projects
							</button>
							<span className='text-[#A79755] text-[32px] font-bold'>
								|
							</span>
							<button
								type='button'
								onClick={() => {
									setActiveTab('products');
								}}
								className={`text-[32px] font-bold cursor-pointer transition-colors bg-transparent border-none p-0 outline-none hover:opacity-80 ${
									activeTab === 'products'
										? 'text-[#A79755]'
										: 'text-[#6E6E6E]'
								}`}
							>
								Products
							</button>
						</div>
					</div>
					<div className='flex flex-row items-center justify-between pb-2 border-b border-b-[#F1F0EB]'>
						<p className='text-[#F1F0EB] text-[18px] font-normal '>
							Count: {totalCount}
						</p>
						<div className='flex w-[20%] flex-row gap-2'>
							<SortComponent
								key={activeTab}
								page={activeTab}
								sorted={handleSortProjects}
								data={allProjects}
							/>
						</div>
					</div>

					{/* Content based on active tab */}
					<div className='mt-5 flex flex-row gap-20 mr-5'>
						{activeTab === 'projects' && (
							<div className='flex-1 flex flex-col gap-5'>
								<div className='flex flex-row flex-wrap gap-16'>
									<ProjectFolder isNew />
									{paginatedProjects?.map((p, i) => (
										<ProjectFolder
											key={i}
											data={p}
											isPublished={p.isPublished}
											isOwner={filterValue.includes(
												'owner'
											)}
										/>
									))}
								</div>
								{totalPages > 1 && (
									<div className='flex justify-center mt-5'>
										<Pagination
											total={totalPages}
											page={currentPage}
											onChange={setCurrentPage}
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
						)}
						{activeTab === 'products' && (
							<div className='flex-1 flex flex-col gap-5'>
								<div className='flex flex-row flex-wrap gap-16'>
									{paginatedProjects?.map((p, i) => (
										<ProjectFolder
											key={i}
											data={p}
											isPublished={p.isPublished}
											isOwner={filterValue.includes(
												'owner'
											)}
										/>
									))}
								</div>
								{totalPages > 1 && (
									<div className='flex justify-center mt-5'>
										<Pagination
											total={totalPages}
											page={currentPage}
											onChange={setCurrentPage}
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
						)}
					</div>
				</div>
			</div>
		</main>
	);
}

const Filter = ({
	filterFunction,
	setSearchText,
	activeTab,
}: {
	filterFunction: (filterValue: string[]) => void;
	setSearchText: Dispatch<SetStateAction<string | undefined>>;
	activeTab: 'projects' | 'products';
}) => {
	const [filter, setFilter] = useState([
		{
			title: 'Projects',
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
