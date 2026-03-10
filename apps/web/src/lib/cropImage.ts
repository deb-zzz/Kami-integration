import { Area } from 'react-easy-crop';

export const createImage = (url: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener('load', () => resolve(image));
		image.addEventListener('error', (error) => reject(error));
		image.src = url;
	});

export const getCroppedImg = async (
	imageSrc: string,
	pixelCrop: Area
): Promise<string> => {
	const image = await createImage(imageSrc);
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('No 2d context');
	}

	// Set canvas size to match the cropped area
	canvas.width = pixelCrop.width;
	canvas.height = pixelCrop.height;

	// Draw the cropped image
	ctx.drawImage(
		image,
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height,
		0,
		0,
		pixelCrop.width,
		pixelCrop.height
	);

	// Return as a blob URL
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error('Canvas is empty'));
				return;
			}
			const url = URL.createObjectURL(blob);
			resolve(url);
		}, 'image/png');
	});
};
