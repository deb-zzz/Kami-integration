import React, { HTMLAttributes } from 'react';
import { Barlow_Condensed } from 'next/font/google';
const barlow = Barlow_Condensed({ subsets: ['latin'], weight: ['400', '500'] });
export default function Duration({ seconds }: { seconds: number }) {
	return (
		<time
			dateTime={`P${Math.round(seconds)}S`}
			className={`text-[15px] text-[#F1F0EB] font-light ${barlow.className} `}
		>
			{format(seconds)}
		</time>
	);
}

function format(seconds: number) {
	const date = new Date(seconds * 1000);
	const hh = date.getUTCHours();
	const mm = date.getUTCMinutes();
	const ss = pad(date.getUTCSeconds());
	if (hh) {
		return `${hh}:${pad(mm)}:${ss}`;
	}
	return `${mm}:${ss}`;
}

function pad(string: any) {
	return ('0' + string).slice(-2);
}
