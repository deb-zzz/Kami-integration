'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpoint } from '../ResponsiveFinder';
import { useUpdateEffect } from 'react-use';
import { ImageType } from '../photo';

export type GridData = {
	horizontal: ImageType[];
	vertical: ImageType[];
	square: ImageType[];
};

export type Counter = {
	horizontal: number;
	vertical: number;
	square: number;
};

function Grid1({ data }: { data?: GridData }) {
	const { isSm } = useBreakpoint('sm');
	const { isMd } = useBreakpoint('md');
	const { isLg } = useBreakpoint('lg');
	const { isXl } = useBreakpoint('xl');
	const { is2xl } = useBreakpoint('2xl');
	const { is3xl } = useBreakpoint('3xl');

	const [total, setTotal] = useState(16);
	const counter = useRef<Counter>({
		horizontal: data?.horizontal.length ?? 0,
		vertical: data?.vertical.length ?? 0,
		square: data?.square.length ?? 0,
	});

	// htpp":/api-gateway.kami.ocu-napse.com/profile-server/

	const items = useMemo(() => {
		return Array.from(new Array(total), (x, i) => i + 1);
	}, [total]);

	// useUpdateEffect(() => {
	// 	setTotal(16);
	// 	console.log('sm', isSm);
	// }, [isSm]);

	useUpdateEffect(() => {
		setTotal(16);
	}, [isMd]);

	useUpdateEffect(() => {
		setTotal(13);
	}, [isLg]);

	useUpdateEffect(() => {
		if (isXl) setTotal(14);
		else setTotal(13);
	}, [isXl]);

	useUpdateEffect(() => {
		if (is2xl) setTotal(18);
		else setTotal(14);
	}, [is2xl]);

	useUpdateEffect(() => {
		setTotal(18);
	}, [is3xl]);

	const RowBox = ({ data }: { data?: ImageType }) => (
		<div className='bg-fuchsia-800 row-span-2'>
			<div className={`bg-fuchsia-400 row-span-2 aspect-[auto_0.994/2] `}>
				<video
					style={{
						width: '100%',
						height: '100%',
						objectFit: 'cover',
						cursor: 'pointer',
					}}
					loop
					muted
					autoPlay
					// onClick={() => setIsOpen(!isOpen)}
				>
					<source src={data?.url} type='video/mp4' />
				</video>
			</div>
		</div>
	);

	const ColBox = ({ data }: { data?: ImageType }) => (
		<div className=' bg-red-800 col-span-2'>
			<div className='bg-red-300 col-span-2 aspect-[auto_2/0.994]'>
				<video
					style={{
						width: '100%',
						height: '100%',
						objectFit: 'cover',
						cursor: 'pointer',
					}}
					muted
					loop
					autoPlay
					// onClick={() => setIsOpen(!isOpen)}
				>
					<source src={data?.url} type='video/mp4' />
				</video>
			</div>
		</div>
	);
	return (
		<div className='bg-white gap-1 justify-evenly h-full grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
			{items.map((i) => {
				const val = isXl ? 12 : isMd ? 7 : 9;
				if (i === 2) return <RowBox key={i} data={data?.vertical[0]} />;
				if (i === val)
					return <ColBox key={i} data={data?.horizontal[0]} />;
				const index = i % (data?.square.length ?? 0);
				return (
					<div key={i} className='bg-yellow-500 aspect-square'>
						<img
							src={data?.square[index]?.url}
							alt={data?.square[index]?.alt}
							style={{
								width: '100%',
								height: '100%',
								display: 'block',
								objectFit: 'cover',
							}}
						/>
					</div>
				);
			})}
		</div>
	);
}

export default Grid1;
