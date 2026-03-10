import { uploadToIPFS } from './ipfs2';
import { Metadata } from './types';

// Add file to IPFS
/**
 * Uploads the provided file data to IPFS.
 * @param fileUrl - The file url to upload.
 * @returns Promise<string> - The IPFS hash of the uploaded file.
 */
export async function addFileToIPFS(fileUrl: string): Promise<{ ipfsPath: string }> {
	console.log('addFileToIPFS', fileUrl);
	let imageName = 'image';
	try {
		const urlObj = new URL(fileUrl);
		imageName = urlObj.pathname.split('/').pop() || 'image';
	} catch (error) {
		console.error('Error parsing file url:', error);
	}

	const result = await uploadToIPFS(fileUrl);
	if (!result.success) throw new Error(`Failed to upload file to IPFS: ${result.error}`);

	// Assuming the backend returns { results: [{ cid: <ipfs-cid>, ... }] }
	const ipfsPath = result.url;
	if (!ipfsPath) throw new Error('No IPFS CID returned from upload');

	return { ipfsPath };
}

export async function addFilesToIPFS(fileUrls: string[]): Promise<{ ipfsPaths: string[] }> {
	const results = await Promise.all(fileUrls.map(async (fileUrl) => addFileToIPFS(fileUrl)));
	return { ipfsPaths: results.map((result) => result.ipfsPath) };
}

export async function addMetadataToIPFS(metadata: string): Promise<{ ipfsPath: string }> {
	let metadataObj = getMetadata(metadata);
	if (typeof metadataObj === 'string') metadataObj = JSON.parse(metadataObj);
	if (!metadataObj) throw new Error('Invalid metadata');
	console.log('metadataObj', JSON.stringify(metadataObj, null, 2));

	const blob = new Blob([JSON.stringify(metadataObj)], { type: 'application/json' });
	const file = new File([blob], `${metadataObj.name ? metadataObj.name.replace(/[^a-zA-Z0-9]/g, '_') : 'metadata'}-metadata.json`, {
		type: 'application/json',
	});

	const result = await uploadToIPFS(file);
	if (!result.success) throw new Error(`Failed to upload metadata to IPFS: ${result.error}`);
	const ipfsPath = result.url;
	if (!ipfsPath) throw new Error('No IPFS CID returned from upload');

	return { ipfsPath };
}

export function getMetadata(metadata: string): Metadata | undefined {
	try {
		return JSON.parse(metadata) as Metadata;
	} catch (error) {
		console.error('Error parsing metadata:', error);
		return undefined;
	}
}
