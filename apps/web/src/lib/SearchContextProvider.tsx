'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import React, { ReactNode, SetStateAction, createContext, useContext, useEffect, useState } from 'react';

type SearchContext =
	| {
			searchText: string | undefined;
			setSearchText: React.Dispatch<SetStateAction<string | undefined>>;
			isVisible: boolean;
			setIsVisible: React.Dispatch<SetStateAction<boolean>>;
			handleSearch: <T>(
				searchVal: string,
				searchData: T[],
				keys?: (keyof T)[],
				formatCallback?: <D>(key: keyof D, data: D) => D | string
			) => T[];
	  }
	| undefined
	| null;

type SearchContextProviderProps = {
	children: ReactNode;
};

const SearchContext = createContext<SearchContext>(null);

export default function SearchContextProvider({ children }: SearchContextProviderProps) {
	const [searchText, setSearchText] = useState<string | undefined>(undefined);
	const [isVisible, setIsVisible] = useState<boolean>(true);

	const pathName = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		setSearchText(undefined);
		setIsVisible(true);
	}, [pathName, searchParams]);

	return (
		<SearchContext.Provider
			value={{
				searchText,
				setSearchText,
				isVisible,
				setIsVisible,
				handleSearch,
			}}
		>
			{children}
		</SearchContext.Provider>
	);
}

type SearchCallback = (searchText: string | undefined) => void;

export function useSearch(cb?: SearchCallback | undefined, isVisible = true) {
	const context = useContext(SearchContext);
	if (!context || context === null) throw new Error('useSearchContext must be used inside a SearchContextProvider');

	useEffect(() => {
		cb ? cb(context.searchText ?? '') : '';
	}, [context.searchText, cb]);

	useEffect(() => {
		context.setIsVisible(isVisible);
	}, [isVisible, context]);

	return context;
}

function getProp<T, K extends keyof T>(item: T, keyname: K): T[K] {
	return item[keyname];
}

export function handleSearch<T>(
	searchVal: string,
	searchData: T[],
	keys?: (keyof T)[],
	formatCallback?: <D>(key: keyof D, data: D) => D | string
) {
	let results: T[] = [...searchData];
	const searchVals = searchVal.trim().split(' ');

	if (keys) {
		searchVals.forEach((v) => {
			if (v.length > 0) {
				let res: T[] = [];
				keys.forEach(
					(k) =>
						(res = [
							...res,
							...results.filter((obj) => {
								let prop: T | string = getProp(obj, k) as T;
								prop = formatCallback ? formatCallback(k, prop) : prop;
								return String(prop).toLowerCase().includes(v.toLowerCase());
							}),
						])
				);

				results = [...res];
			}
		});
	} else {
		searchVals.forEach((v) => {
			if (v.length > 0) {
				results = results.filter((obj) => {
					if (typeof obj === 'object')
						return Object.values(obj as object).some((val) => String(val).toLowerCase().includes(v.toLowerCase()));
				});
			}
		});
	}

	return Array.from(new Set(results));
}
