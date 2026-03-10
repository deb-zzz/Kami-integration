'use client';
import { useEffect, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTags, postTag } from '@/apihandler/Tag'; // Import server actions
import { number } from 'yup';

export type OptionType = {
	id?: number;
	value: string | number;
	label: string;
};

const SearchableDropdown = ({
	defaultValue = [],
	name,
	isMulti = true,
	type,
	setValue,
}: {
	defaultValue?: OptionType[];
	name: string;
	type: 'Interest' | 'Skill';
	isMulti?: boolean;
	setValue: (selected: OptionType[]) => void;
}) => {
	const queryClient = useQueryClient();
	const { data: optionsData, isLoading } = useQuery({
		queryKey: ['tags'],
		queryFn: async () => {
			const res = await getTags();
			return res.tags
				.filter((f) => f.type === type)
				.map((item) => ({ value: Number(item.id), label: item.tag })); // Format for react-select
		},
	});

	const mutation = useMutation({
		mutationFn: async (newOption: OptionType) => {
			// Uncomment this if you want to save new tags
			// await postTag(newOption);
		},
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ['tags'] }); // Refetch data
		},
	});

	// 🔥 Ensure defaultValue is properly selected once options are loaded
	const [selected, setSelected] = useState<OptionType[]>(defaultValue || []);

	useEffect(() => {
		if (optionsData) {
			const formattedDefault = (defaultValue || [])
				.filter((f) => f.value !== undefined)
				.map(
					(d) =>
						optionsData.find(
							(o) => Number(o.value!) === Number(d.value!)
						) || { value: d.value!, label: d.label }
				);
			setSelected(
				formattedDefault.map((f) => ({
					value: Number(f.value),
					label: f.label,
				}))
			);
		}
	}, []);

	const handleChange = (newValue: OptionType[] | OptionType | null) => {
		const updatedValue = isMulti
			? (newValue as OptionType[])
			: ([newValue] as OptionType[]);
		setSelected(updatedValue);
		setValue(updatedValue);
	};

	const handleCreate = async (inputValue: string) => {
		const newOption: OptionType = {
			value: inputValue,
			label: inputValue.toUpperCase(),
		};
		setSelected([...selected, newOption]); // Add new tag locally
		setValue([...selected, newOption]); // Update parent state
		mutation.mutate(newOption); // Save to backend if needed
	};

	return (
		<CreatableSelect
			isMulti={isMulti}
			name={name}
			options={optionsData || []}
			isClearable
			isSearchable
			isLoading={isLoading}
			value={selected}
			onChange={(e) => handleChange(e as OptionType[])}
			onCreateOption={handleCreate}
			theme={(theme) => ({
				...theme,
				colors: {
					...theme.colors,
					neutral0: '#1a1a1a',
					primary: '#FFFFFF99',
					primary25: '#9797971a',
					dangerLight: '#DE350B1a',
					primary50: '#97979766',
				},
			})}
			styles={{
				control: (base) => ({
					...base,
					borderColor: '#FFFFFF99',
					borderWidth: '0.5px',
					borderRadius: 6,
					color: '#F1F0EB',
				}),
				option: (base, state) => ({
					...base,
					color: state.isFocused ? 'white' : '#979797',
				}),
				multiValue: (base) => ({
					...base,
					backgroundColor: '#1a1a1a',
					borderWidth: '0.5px',
					borderColor: '#04FF2C',
					paddingLeft: 2,
					color: '#F1F0EB',
				}),
				multiValueLabel: (base) => ({ ...base, color: '#f1f0eb' }),
				valueContainer: (base) => ({
					...base,
					gap: 4,
					color: '#F1F0EB',
				}),
				input: (base) => ({ ...base, color: '#B1B1B1' }),
			}}
			formatCreateLabel={(inputValue) =>
				`Add "${inputValue.toUpperCase()}"`
			}
		/>
	);
};

export default SearchableDropdown;
