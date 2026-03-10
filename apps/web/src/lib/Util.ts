import crypto from 'crypto';
import fileTypes from './fileType.json';
import { Blockchain, VoucherMetadata } from '@/types';
import { getBlockchains } from '@/apihandler/Wallet';

// Get formats from fileType.json
const getImageFormats = (): string[] => {
	const imageType = fileTypes.fileTypes.find((ft) => ft.key === 'images');
	return imageType ? imageType.formats.map((f) => f.toLowerCase()) : [];
};

const getVideoFormats = (): string[] => {
	const videoType = fileTypes.fileTypes.find((ft) => ft.key === 'video');
	return videoType ? videoType.formats.map((f) => f.toLowerCase()) : [];
};

const getAudioFormats = (): string[] => {
	const audioType = fileTypes.fileTypes.find((ft) => ft.key === 'audio');
	return audioType ? audioType.formats.map((f) => f.toLowerCase()) : [];
};

const imageExt = getImageFormats();
const videoExt = getVideoFormats();
const audioExt = getAudioFormats();

export const ImageMimeType = [
	'image/gif',
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/avif',
	'image/apng',
	'image/bmp',
	'image/tiff',
	'image/tif',
	'image/ico',
	'image/icon',
	'image/x-icon',
	'image/vnd.microsoft.icon',
	'image/svg+xml',
	'image/svg',
	'image/webp',
	'image/jfif',
];
export const VideoMimeType = [
	'video/mp4',
	'video/mpg',
	'video/mpeg',
	'video/mpe',
	'video/mpv',
	'video/webm',
	'video/ogg',
	'video/avi',
	'video/mov',
	'video/wmv',
	'video/flv',
	'video/mkv',
	'video/mp2',
	'video/mpeg',
	'video/mpe',
	'video/mpv',
	'video/webm',
	'video/ogg',
	'video/avi',
	'video/mov',
	'video/wmv',
	'video/flv',
	'video/mkv',
	'video/mp2',
	'video/mpeg',
	'video/mpe',
	'video/mpv',
];
export const AudioMimeType = [
	'audio/mp3',
	'audio/aac',
	'audio/wav',
	'audio/webm',
	'audio/ogg',
	'audio/flac',
	'audio/m4a',
	'audio/mp4',
	'audio/mpeg',
	'audio/mp2',
	'audio/mpe',
	'audio/mpv',
	'audio/webm',
	'audio/ogg',
	'audio/flac',
	'audio/m4a',
	'audio/mp4',
	'audio/mpeg',
	'audio/mp2',
	'audio/mpe',
	'audio/mpv',
];

export const IsImage = (fileName: string) => {
	if (!fileName) return false;
	const ext = fileName.split('?')[0];
	const extpart = ext.split(/([^.]*)$/);
	extpart.pop(); // pop last empty item
	// console.log(extpart);

	return extpart && extpart.length > 0
		? imageExt.includes(extpart.pop()!.toLowerCase())
		: false;
};

export const IsVideo = (fileName: string) => {
	const extpart = fileName.split(/([^.]*)$/);
	extpart.pop(); // pop last empty item
	return extpart && extpart.length > 0
		? videoExt.includes(extpart.pop()!.toLowerCase())
		: false;
};

export const IsAudio = (fileName: string) => {
	const extpart = fileName.split(/([^.]*)$/);
	extpart.pop(); // pop last empty item
	return extpart && extpart.length > 0
		? audioExt.includes(extpart.pop()!.toLowerCase())
		: false;
};

export function createSignature(message: string | object): string {
	const authToken = process.env.AUTH || '';
	const secretKey = authToken.slice(-10);
	const normalizedMessage =
		typeof message === 'object'
			? JSON.stringify(message).replace(/\s/g, '')
			: message;
	const hmac = crypto.createHmac('sha256', secretKey);
	hmac.update(normalizedMessage);
	return hmac.digest('hex');
}

export const numberFormat = (num: number, dp: number = 0) => {
	const lookup = [
		{ value: 1, symbol: '' },
		{ value: 1e3, symbol: 'k' },
		{ value: 1e6, symbol: 'M' },
		{ value: 1e9, symbol: 'B' },
		{ value: 1e12, symbol: 'T' },
		{ value: 1e15, symbol: ' x 10^15' },
		{ value: 1e18, symbol: ' x 10^18' },
		{ value: 1e21, symbol: ' x 10^21' },
		{ value: 1e24, symbol: ' x 10^24' },
		// { value: 1e15, symbol: 'P' },
		// { value: 1e18, symbol: 'E' },
	];
	const regexp = /\.0+$|(?<=\.[0-9]*[1-9])0+$/;
	const item = lookup.findLast((item) => num >= item.value);
	return item
		? (num / item.value).toFixed(dp).replace(regexp, '').concat(item.symbol)
		: num;
};

export const numberWithCommas = (
	value: number | string | null | undefined,
	dp?: number,
) => {
	if (value === null || value === undefined) return '';
	const num = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(num)) return '';
	return typeof dp === 'number'
		? num.toLocaleString('en-US', {
				minimumFractionDigits: dp,
				maximumFractionDigits: dp,
			})
		: num.toLocaleString('en-US');
};

const _evenDist = <T>(
	xs: T[],
	ys: T[],
	count = Math.round(ys.length / (xs.length + 1)),
): T[] =>
	xs.length === 0
		? [...ys]
		: [
				...ys.slice(0, count),
				xs[0],
				..._evenDist(xs.slice(1), ys.slice(count)),
			];

export const evenDist = (xs: any[], ys: any[]) =>
	xs.length > ys.length ? _evenDist(ys, xs) : _evenDist(xs, ys);

export const truncateTextCenter = (text: string, maxLength: number): string => {
	if (!text) return '';
	if (text.length <= maxLength) {
		return text;
	}

	const prefixLen = 6;
	const suffixLen = 4;

	if (text.length <= prefixLen + suffixLen) {
		return text;
	}

	return `${text.slice(0, prefixLen)}....${text.slice(-suffixLen)}`;
};

export const isValidFileFormat = (fileName: string): boolean => {
	if (!fileName) return false;

	// Extract file extension
	const ext = fileName.split('?')[0];
	const extpart = ext.split(/([^.]*)$/);
	extpart.pop(); // pop last empty item
	const fileExtension =
		extpart && extpart.length > 0 ? extpart.pop()!.toLowerCase() : '';

	if (!fileExtension) return false;

	// Collect all allowed formats from fileType.json
	const allAllowedFormats = fileTypes.fileTypes.flatMap((fileType) =>
		fileType.formats.map((format) => format.toLowerCase()),
	);

	// Check if the file extension is in the allowed formats
	return allAllowedFormats.includes(fileExtension);
};

/**
 * Convert IPFS URL to HTTPS gateway URL
 * @param url - URL that may start with ipfs://
 * @returns URL with ipfs:// replaced by https://ipfs.io/ipfs/
 */

export const convertIPFSUrl = (
	url: string | null | undefined,
): string | null => {
	if (!url || !url.startsWith('ipfs://')) {
		return url ?? null;
	}
	// Remove ipfs:// prefix and add HTTPS gateway prefix
	return `https://ipfs.io/ipfs/${url.replace('ipfs://', '')}`;
};

/**
 * Replace voucher with asset if voucher is null
 * This mutates the product object by setting voucher to asset when voucher is null
 * Also converts IPFS URLs to HTTPS gateway URLs
 */
export const replaceVoucherWithAsset = (
	product?: {
		voucher: any;
		asset: any;
	} | null,
) => {
	if (!product || typeof product !== 'object') {
		return product ?? null;
	}

	if (!product.voucher && product.asset) {
		// Deep clone the asset to avoid mutating the original
		const processedAsset = JSON.parse(JSON.stringify(product.asset));

		// Convert IPFS URLs in mediaUrl
		if (processedAsset.mediaUrl) {
			processedAsset.mediaUrl = convertIPFSUrl(processedAsset.mediaUrl);
		}
		if (processedAsset.animationUrl) {
			processedAsset.animationUrl = convertIPFSUrl(
				processedAsset.animationUrl,
			);
		}
		// Convert IPFS URLs in metadata if it exists
		if (processedAsset.metadata) {
			const metadata =
				typeof processedAsset.metadata === 'string'
					? JSON.parse(processedAsset.metadata)
					: processedAsset.metadata;

			if (metadata.image) {
				metadata.image = convertIPFSUrl(metadata.image);
			}
			if (metadata.animation_url) {
				metadata.animation_url = convertIPFSUrl(metadata.animation_url);
			}

			// Convert back to string if it was originally a string
			processedAsset.metadata =
				typeof product.asset.metadata === 'string'
					? JSON.stringify(metadata)
					: metadata;
		}

		product.voucher = processedAsset;
	}

	return product;
};

export function formatTime(seconds: number): string {
	if (isNaN(seconds) || seconds < 0) {
		return '00:00.000';
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	const milliseconds = Math.floor(
		(remainingSeconds - Math.floor(remainingSeconds)) * 1000,
	);

	return `${String(minutes).padStart(2, '0')}:${String(
		Math.floor(remainingSeconds),
	).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export const getChainIcons = async () => {
	try {
		const blockchainsRes = await getBlockchains();
		if (blockchainsRes.success && blockchainsRes.data) {
			// const chain = blockchains.find(
			// 	(b: Blockchain) => b.chainId === chainId
			// );
			const chain = blockchainsRes.data.reduce(
				(acc: { [chainId: string]: string }, chain: Blockchain) => {
					acc[chain.chainId] = chain.logoUrl;
					return acc;
				},
				{},
			);
			return chain;
		}
	} catch (error) {
		console.error('Error getting chain icon url:', error);
		return null;
	}
};

export function MetaDataParser(data: string) {
	return JSON.parse(data) as VoucherMetadata;
}
