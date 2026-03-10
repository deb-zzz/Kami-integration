import { useEffect, useState } from 'react';
import Image from 'next/image';

export const FallbackImage = ({
	alt,
	src,
	width,
	height,
	className,
}: {
	alt: string;
	src: string;
	width: number;
	height: number;
	className: string;
}) => {
	const [imgSrc, setImgSrc] = useState(src);

	useEffect(() => {
		setImgSrc(src);
	}, [src]);

	return (
		<Image
			src={imgSrc ? imgSrc : '/emptyState/emptyimg2.svg'}
			alt={alt}
			onError={() => {
				setImgSrc('emptyState/emptyimg2.svg');
			}}
			height={height}
			width={width}
			className={className}
		/>
	);
};
