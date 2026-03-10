import React, { ChangeEvent, useCallback, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { useSearch } from '@/lib/SearchContextProvider';
// import { useQueryState } from 'next-usequerystate';
import { useRouter } from 'next/router';

export default function SearchBar() {
	const searchBarRef = useRef<HTMLInputElement>(null);
	const { searchText, setSearchText, isVisible } = useSearch();
	// const [search, setSearch] = useQueryState('search');

	const router = useRouter();

	// useEffect(() => {
	// 	if (searchBarRef.current) {
	// 		searchBarRef.current.value = search ?? '';
	// 		setSearchText(search ?? '');
	// 	}
	// }, []);

	useEffect(() => {
		if (searchBarRef.current) {
			if (!searchText || searchText.length == 0) searchBarRef.current.value = '';
		}
	}, [searchText]);

	// useEffect(() => {
	// 	setSearch(searchText && searchText.length > 0 ? searchText : null);
	// }, [searchText, setSearch]);

	const doSearch = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			if (e.target.value.length > 0) setSearchText(e.target.value);
			else setSearchText('');
			// setSearch(e.target.value);
			// router.replace(`?search=${e.target.value}`, undefined, { shallow: true });
		},
		[setSearchText]
	);

	// bg-[#f5f5f5]
	return (
		<div className='flex items-center justify-between  h-20 py-4 pt-8 '>
			{isVisible ? (
				<div className='border-[1px] w-2/4 h-10 p-2 rounded-xl shadow-sm bg-white ml-6'>
					<FontAwesomeIcon icon={faSearch} color='gray' />
					<input
						ref={searchBarRef}
						type='search'
						name='search'
						placeholder='Search'
						className='h-full ml-4 w-[93%] border-none outline-none shadow-none drop-shadow-none focus:outline-none focus:border-none'
						onChange={(e) => doSearch(e)}
					/>
				</div>
			) : (
				<div className='w-2/4 h-10 p-2 '></div>
			)}
		</div>
	);
}
