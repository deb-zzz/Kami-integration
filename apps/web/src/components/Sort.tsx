import { Select, SelectItem } from '@nextui-org/react';
import { useEffect, useState } from 'react';

const SortComponent = ({
	page,
	sorted,
	data,
}: {
	page: string;
	sorted: (e: any) => void;
	data: any;
}) => {
	const [selected, setSelected] = useState('new');
	const [options, setOptions] = useState([
		{ key: 'new', label: 'Newest' },
		{ key: 'old', label: 'Oldest' },
	]);

	useEffect(() => {
		if (page) {
			// setSelected('new');
			handleSelection({ target: { value: 'new' } });
			if (page === 'inventory' || page == 'collectionsPage') {
				setOptions([
					...options,
					{ key: 'high', label: 'Price (Highest)' },
					{ key: 'low', label: 'Price (Lowest)' },
				]);
			} else {
				setOptions([
					{ key: 'new', label: 'Newest' },
					{ key: 'old', label: 'Oldest' },
				]);
			}
		}
	}, [page]);

	const handleSelection = (value: any) => {
		setSelected(value.target.value);
		sortData(value.target.value);
		// Handle sorting logic here based on the selected value
	};

	const sortData = (sort: string) => {
		// Create a copy of the data array to avoid mutating the original
		const dataCopy = [...data];

		switch (sort) {
			case 'new':
				sorted(
					dataCopy.sort((a: any, b: any) => b.createdAt - a.createdAt)
				);
				break;
			case 'old':
				sorted(
					dataCopy.sort((a: any, b: any) => a.createdAt - b.createdAt)
				);
				break;
			case 'high':
				sorted(dataCopy.sort((a: any, b: any) => b.price - a.price));
				break;
			case 'low':
				sorted(dataCopy.sort((a: any, b: any) => a.price - b.price));
				break;
			default:
				sorted(
					dataCopy.sort((a: any, b: any) => b.createdAt - a.createdAt)
				);
				break;
		}
	};
	return (
		<div className='flex flex-row w-full items-center'>
			{selected && (
				<div className='flex-[0.3]'>
					<p>Sort by</p>
				</div>
			)}
			<Select
				aria-label='sort'
				selectedKeys={[selected]}
				onChange={handleSelection}
				size='sm'
				className='flex-[0.7]'
				variant='flat'
				disallowEmptySelection
				classNames={{
					label: 'group-data-[filled=true]:-translate-y-5 text-[#F1F0EB]',
					popoverContent: ' bg-[#1A1A1A]',
					trigger: 'bg-[#1A1A1A]  data-[hover=true]:bg-[#1A1A1A] ',
					innerWrapper: 'text-[#F1F0EB]',
					value: 'text-[#F1F0EB] text-[13px] group-data-[has-value=true]:text-[#F1F0EB]',
					listboxWrapper: 'border border-[#AFAB994d] rounded-lg',
				}}
			>
				{options.map((option) => (
					<SelectItem key={option.key} value={option.key}>
						{option.label}
					</SelectItem>
				))}
			</Select>
		</div>
	);
};

export default SortComponent;
