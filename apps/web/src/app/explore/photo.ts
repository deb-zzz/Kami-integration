import type { Photo } from 'react-photo-album';

const breakpoints = [1080, 640, 384, 256, 128, 96, 64, 48];

export enum MediaType {
	Video,
	Image,
}

export type ImageType = {
	url: string;
	alt: string;
	type: MediaType;
};

const images = [
	{ url: '/explore/img1.png', width: 230, height: 230, alt: 'img1' },
	{ url: '/explore/img2.png', width: 230, height: 230, alt: 'img2' },
	{ url: '/explore/img3.png', width: 230, height: 230, alt: 'img3' },
	{ url: '/explore/vid1.mp4', width: 927, height: 230, alt: 'vid1' },
	{ url: '/explore/img4.png', width: 230, height: 230, alt: 'img4' },
	{ url: '/explore/img5.png', width: 230, height: 230, alt: 'img5' },
	{ url: '/explore/vid3.mp4', width: 927, height: 230, alt: 'vid3' },
	{ url: '/explore/img6.png', width: 230, height: 230, alt: 'img6' },
	{ url: '/explore/img7.png', width: 230, height: 230, alt: 'img7' },
	{ url: '/explore/vid2.mp4', width: 927, height: 230, alt: 'vid2' },
	{ url: '/explore/img8.png', width: 230, height: 230, alt: 'img8' },
	{ url: '/explore/img9.png', width: 230, height: 230, alt: 'img9' },
	{ url: '/explore/img10.png', width: 230, height: 230, alt: 'img10' },
	{ url: '/explore/img1.png', width: 230, height: 230, alt: 'img1' },
	{ url: '/explore/img2.png', width: 230, height: 230, alt: 'img2' },
	{ url: '/explore/img3.png', width: 230, height: 230, alt: 'img3' },
	{ url: '/explore/img6.png', width: 230, height: 230, alt: 'img6' },
	{ url: '/explore/img7.png', width: 230, height: 230, alt: 'img7' },
	{ url: '/explore/vid2.mp4', width: 927, height: 230, alt: 'vid2' },
	{ url: '/explore/img8.png', width: 230, height: 230, alt: 'img8' },
	{ url: '/explore/img9.png', width: 230, height: 230, alt: 'img9' },
	{ url: '/explore/vid1.mp4', width: 927, height: 230, alt: 'vid1' },
	{ url: '/explore/img4.png', width: 230, height: 230, alt: 'img4' },
	{ url: '/explore/img5.png', width: 230, height: 230, alt: 'img5' },
	{ url: '/explore/vid3.mp4', width: 230, height: 463.5, alt: 'vid3' },
	{ url: '/explore/img6.png', width: 230, height: 230, alt: 'img6' },
	{ url: '/explore/img7.png', width: 230, height: 230, alt: 'img7' },
	{ url: '/explore/vid2.mp4', width: 230, height: 463.5, alt: 'vid2' },
	{ url: '/explore/img8.png', width: 230, height: 230, alt: 'img8' },
	{ url: '/explore/img9.png', width: 230, height: 230, alt: 'img9' },
	{ url: '/explore/img10.png', width: 230, height: 230, alt: 'img10' },
	{ url: '/explore/img1.png', width: 230, height: 230, alt: 'img1' },
	{ url: '/explore/img2.png', width: 230, height: 230, alt: 'img2' },
	{ url: '/explore/img3.png', width: 230, height: 230, alt: 'img3' },
	{ url: '/explore/img6.png', width: 230, height: 230, alt: 'img6' },
	{ url: '/explore/img7.png', width: 230, height: 230, alt: 'img7' },
	{ url: '/explore/vid2.mp4', width: 463.5, height: 463.5, alt: 'vid2' },
	{ url: '/explore/img8.png', width: 230, height: 230, alt: 'img8' },
	{ url: '/explore/img9.png', width: 230, height: 230, alt: 'img9' },
].map(
	({ url, alt, width, height }) =>
		({
			src: url,
			alt,
			width,
			height,
			srcSet: breakpoints.map((breakpoint) => ({
				src: url,
				width: breakpoint,
				height: Math.round((height / width) * breakpoint),
			})),
		} as Photo)
);

export default images;
