import {heroui} from '@heroui/theme';
import type { Config } from 'tailwindcss';
import { nextui } from '@nextui-org/react';

export const screens = {
	sm: '640px',
	md: '768px',
	lg: '1024px',
	xl: '1280px',
	'2xl': '1536px',
	'3xl': '1700px',
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/components/spinner.js"
  ],
	theme: {
		extend: {
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
			},
			keyframes: {
				'marquee-left': {
					from: { transform: 'translateX(0)' },
					to: { transform: 'translateX(-50%)' },
				},
			},
			animation: {
				'marquee-left': 'marquee-left 12s linear infinite',
			},
		},
		screens,
	},
  plugins: [nextui(),require('tailwind-scrollbar')({ nocompatible: true }),heroui()],
};
export default config;
