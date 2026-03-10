'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useBreakpoint } from '../ResponsiveFinder';
import { useUpdateEffect } from 'react-use';
import { ImageType } from '../photo';
import { GridData } from './Grid1';

function Grid2({ data }: { data?: GridData }) {
	const { isSm } = useBreakpoint('sm');
	const { isMd } = useBreakpoint('md');
	const { isLg } = useBreakpoint('lg');
	const { isXl } = useBreakpoint('xl');
	const { is2xl } = useBreakpoint('2xl');
	const { is3xl } = useBreakpoint('3xl');

	const [total, setTotal] = useState(15);

	// htpp":/api-gateway.kami.ocu-napse.com/profile-server/

	const items = useMemo(() => {
		return Array.from(new Array(total), (x, i) => i + 1);
	}, [total]);

	// useUpdateEffect(() => {
	// 	setTotal(13);
	// 	console.log('sm', isSm);
	// }, [isSm]);

	useUpdateEffect(() => {
		setTotal(16);
	}, [isMd]);

	useUpdateEffect(() => {
		setTotal(12);
	}, [isLg]);

	useUpdateEffect(() => {
		if (isXl) setTotal(13);
		else setTotal(12);
	}, [isXl]);

	useUpdateEffect(() => {
		if (is2xl) setTotal(17);
		else setTotal(13);
	}, [is2xl]);

	useUpdateEffect(() => {
		setTotal(17);
	}, [is3xl]);

	const RowBox = ({ data }: { data?: ImageType }) => (
		<div className='bg-fuchsia-800 row-span-2'>
			<div className='bg-fuchsia-400 row-span-2 aspect-[auto_0.994/2]'>
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
			<div className=' bg-red-300 col-span-2 aspect-[auto_2/0.994]'>
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
				const colval = () => {
					let current = 11;
					if (isMd) current = 9;
					if (isXl) current = 12;
					if (is2xl) current = 11;
					return current;
				};
				const rowval = (i: number) => [1, 5].includes(i);
				// if (rowval(i)) return <RowBox key={i} />;
				// if (i === colval()) return <ColBox key={i} />;
				if (rowval(i))
					return (
						<RowBox key={i} data={data?.vertical[i == 1 ? 0 : 1]} />
					);
				if (i === colval())
					return <ColBox key={i} data={data?.horizontal[1]} />;
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

export default Grid2;
