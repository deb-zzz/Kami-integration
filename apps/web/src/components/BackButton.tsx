'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useGlobalState } from '@/lib/GlobalContext';

interface BackButtonProps {
	className?: string;
	width?: number;
	height?: number;
	onClick?: () => void;
}

export default function BackButton({
	className = 'cursor-pointer -mb-1',
	width = 35,
	height = 35,
	onClick,
}: BackButtonProps) {
	const router = useRouter();
	const [gs] = useGlobalState();

	const handleClick = () => {
		if (onClick) {
			onClick();
		} else {
			router.back();
		}
	};

	// Only show the back button if user is logged in
	if (!gs || !gs.walletAddress) {
		return null;
	}

	return (
		<Image
			src={'/back-icon.svg'}
			alt={'back'}
			width={width}
			height={height}
			className={className}
			onClick={handleClick}
		/>
	);
}
