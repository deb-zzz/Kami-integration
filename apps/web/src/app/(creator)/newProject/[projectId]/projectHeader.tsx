import { useGlobalState } from '@/lib/GlobalContext';
import {
	Avatar,
	Button,
	Input,
	Select,
	SelectItem,
	Tooltip,
} from '@nextui-org/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type HeaderProps = {
	collaborators: { avatarUrl: string; userWalletAddress: string }[];
	creator: { avatarUrl: string; userWalletAddress: string };
	project: { projectId?: number; projectName?: string; status?: string };
	category: { categoryId?: number; categoryName?: string };
	isActionDisabled: boolean;
};

export default function ProjectHeader({
	collaborators,
	creator,
	project,
	category,
	isActionDisabled,
}: HeaderProps) {
	const [catogories, setCatogories] = useState<
		{ key: number; val: string }[]
	>([]);
	const [gs, setGs] = useGlobalState();
	const [projectCat, setProjectCat] = useState<string>();
	const [projectName, setProjectName] = useState<string>('');
	useEffect(() => {
		//c.replace(/\s+/g, '_').toLowerCase()
		console.log('collah', collaborators);
		if (gs && gs.categories)
			setCatogories(
				gs.categories.map((c) => ({ key: c.id, val: c.name }))
			);
		// console.log('Categories', gs?.categories);
	}, [gs?.categories]);

	useEffect(() => {
		if (project?.projectName) {
			setProjectName(project.projectName);
		}
	}, [project]);

	useEffect(() => {
		if (category?.categoryId) {
			setProjectCat(category.categoryId.toString());
		}
	}, [category]);

	// const projectCat = useMemo(() => {
	// 	return category?.categoryId ? [category?.categoryId.toString()] : [];
	// }, [category?.categoryId]);

	const router = useRouter();
	return (
		<>
			<div
				className={`flex flex-row items-center pb-2 border-b border-b-[#F1F0EB] justify-between`}
			>
				<div className='flex flex-row items-center'>
					<Avatar
						className='w-8 h-8 z-50 border-2 border-[#F1F0EB] cursor-pointer'
						src={creator?.avatarUrl}
						onClick={() =>
							router.push(
								`/profile/${creator?.userWalletAddress}`
							)
						}
					/>

					{collaborators.map((collab, index) => (
						<Avatar
							key={collab.userWalletAddress}
							className={`w-8 h-8 -ml-4 border-2 border-[#F1F0EB] cursor-pointer`}
							style={{ zIndex: 40 - index }}
							src={collab?.avatarUrl}
							onClick={() =>
								router.push(
									`/profile/${collab?.userWalletAddress}`
								)
							}
						/>
					))}
				</div>

				<div className='flex flex-row gap-2'>
					{/* <CollaboratorSearch projectId={project?.id ?? 0} walletAddress={project?.walletAddress ?? ''} projectName={project?.name ?? ''} /> */}
					<Tooltip
						content='Save Draft'
						placement='top'
						className='bg-black  text-[10px] mb-2'
					>
						<Image
							src={'/profile/save.svg'}
							alt={'heart'}
							width={20}
							height={20}
							// onClick={() => {
							// 	setProject({
							// 		...project!,
							// 		draft: JSON.stringify({
							// 			collection: {
							// 				...voucher?.collection,
							// 			},
							// 			product: {
							// 				name: voucher?.metadata?.name,
							// 				description:
							// 					voucher?.metadata?.description,
							// 				attributes:
							// 					voucher?.metadata?.attributes,
							// 				image: voucher?.metadata?.image,
							// 				animation_url:
							// 					voucher?.metadata?.animation_url,
							// 			},
							// 		}),
							// 	});

							// 	setVoucher({
							// 		projectTitle: project?.name ?? '',
							// 		collectionId: project?.collection?.collectionId,
							// 	});
							// 	console.log(voucher?.coverUrl);

							// 	update_project({
							// 		...project!,
							// 		draft: JSON.stringify({
							// 			collection: {
							// 				...voucher?.collection,
							// 			},
							// 			product: {
							// 				name: voucher?.metadata?.name,
							// 				description:
							// 					voucher?.metadata?.description,
							// 				attributes:
							// 					voucher?.metadata?.attributes,
							// 				image: voucher?.metadata?.image,
							// 				animation_url:
							// 					voucher?.metadata?.animation_url,
							// 				price: voucher?.price,
							// 				items: voucher?.metadata?.properties
							// 					?.bundle,
							// 				coverUrl: voucher?.coverUrl,
							// 				mediaUrl: voucher?.mediaUrl,
							// 			},
							// 		}),
							// 	});
							// }}
						/>
					</Tooltip>
				</div>
			</div>
			<div className='flex flex-row gap-10 justify-between items-end pt-3 pb-5 border-b border-b-[#F1F0EB]'>
				<div className='flex flex-1 flex-col'>
					<p className='text-[10px] font-medium uppercase'>Title:</p>

					<Input
						size='lg'
						variant='flat'
						placeholder='Name your Project'
						disabled={
							project?.status === 'Publish' || isActionDisabled
						}
						className='mt-2  bg-transparent'
						value={projectName}
						maxLength={50}
						onValueChange={(value) => {
							console.log('value change', value);
							setProjectName(value);
							// setProject({
							// 	...project!,
							// 	name: value,
							// });
							// setVoucher({
							// 	...voucher!,
							// 	projectTitle: value,
							// });
						}}
						// Double check with Viki about the update project
						// onFocusChange={(e) => {
						// 	if (!e) {
						// 		console.log('on focus change', project);
						// 		if (project?.name) {
						// 			update_project({
						// 				...project!,
						// 				draft: JSON.stringify({
						// 					collection: {
						// 						...voucher?.collection,
						// 					},
						// 					product: {
						// 						name: voucher?.metadata?.name,
						// 						description:
						// 							voucher?.metadata
						// 								?.description,
						// 						attributes:
						// 							voucher?.metadata
						// 								?.attributes,
						// 						image: voucher?.metadata?.image,
						// 						animation_url:
						// 							voucher?.metadata
						// 								?.animation_url,
						// 						price: voucher?.price,
						// 						items: voucher?.metadata
						// 							?.properties?.bundle,
						// 						coverUrl: voucher?.coverUrl,
						// 						mediaUrl: voucher?.mediaUrl,
						// 					},
						// 				}),
						// 			});
						// 		}
						// 	}
						// }}
						classNames={{
							base: 'bg-transparent',
							inputWrapper:
								'pl-0 bg-transparent group-data-[focus=true]:bg-transparent group-data-[hover=true]:bg-transparent group-data-[focus=true]:border-b group-data-[focus=true]:border-[#323131] rounded-none ',
							input: 'placeholder:text-[#6E6E6E] placeholder:font-semibold text-[22px] text-[#F1F0EB] group-data-[has-value=true]:text-[#F1F0EB]',
						}}
						endContent={
							<span className='text-xs text-[#AFAB99]'>
								{projectName?.length || 0}/50
							</span>
						}
					/>
				</div>
				<div className='flex flex-1 flex-col'>
					<div>
						<p className='text-[10px] font-medium uppercase'>
							Category :{' '}
						</p>
						<Select
							size='lg'
							variant='bordered'
							aria-label='type'
							className='mt-2'
							selectionMode='single'
							isDisabled={
								project?.status === 'Publish' ||
								isActionDisabled
							}
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
								setProjectCat(e.target.value);
							}}
							// onChange={(e) => {
							// 	// console.log('more');
							// 	if (
							// 		project?.status ===
							// 		'Publish'
							// 	)
							// 		return;
							// 	const cat = catogories.find(
							// 		(f) =>
							// 			f.key ===
							// 			Number(
							// 				e.target.value
							// 			)
							// 	);
							// 	setVoucher({
							// 		...voucher,
							// 		category: cat?.val,
							// 		collectionId:
							// 			project?.collection
							// 				?.collectionId,
							// 	});
							// 	update_project({
							// 		...project!,
							// 		draft: JSON.stringify({
							// 			collection: {
							// 				...voucher?.collection,
							// 			},
							// 			product: {
							// 				name: voucher
							// 					?.metadata
							// 					?.name,
							// 				description:
							// 					voucher
							// 						?.metadata
							// 						?.description,
							// 				attributes:
							// 					voucher
							// 						?.metadata
							// 						?.attributes,
							// 				image: voucher
							// 					?.metadata
							// 					?.image,
							// 				animation_url:
							// 					voucher
							// 						?.metadata
							// 						?.animation_url,
							// 				price: voucher?.price,
							// 				items: voucher
							// 					?.metadata
							// 					?.properties
							// 					?.bundle,
							// 				coverUrl:
							// 					voucher?.coverUrl,
							// 				mediaUrl:
							// 					voucher?.mediaUrl,
							// 			},
							// 		}),
							// 		category: undefined,
							// 		categoryId: Number(
							// 			e.target.value
							// 		),
							// 	});
							// }}
							placeholder='Select One'
						>
							{catogories.map((val) => (
								<SelectItem key={val.key}>{val.val}</SelectItem>
							))}
						</Select>
					</div>
				</div>
			</div>
		</>
	);
}
