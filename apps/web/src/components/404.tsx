import React from 'react';

function Section404() {
	return (
		<div className='w-full flex flex-col justify-center items-center h-72'>
			<h1 className='text-9xl font-extrabold  tracking-widest'>404</h1>
			<div className='bg-[#FF6A3D] px-2 text-sm rounded rotate-12 absolute -mt-14'>Page Not Found</div>

			<a
				href={'/home'}
				className='mt-5 relative inline-block text-sm font-medium group active:text-gray-400 focus:outline-none focus:ring'>
				<span className='absolute inset-0 transition-transform translate-x-0.5 translate-y-0.5 bg-gray-400 group-hover:translate-y-0 group-hover:translate-x-0'></span>
				<span className='relative block px-8 py-3 bg-[#1A2238] border border-current'>Go Home</span>
			</a>
		</div>
	);
}

export default Section404;
