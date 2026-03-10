'use server';
import { createSignature } from '@/lib/Util';
import {
	AllProjectType,
	BundleType,
	CollaboratorType,
	MetaDataBundleType,
	PlatformFeeType,
	Profile,
	VoucherContextType,
} from '@/types';
import { axiosInstance } from './AxiosInstance';
import { getMimeType } from 'mime-detector';
import { markNotificationAsRead } from './Notification';

export type UploadReturn = {
	url: string;
	path: string;
	error?: string;
};

export type CurrencyResponse = {
	symbol: string;
	name: string;
	type: string;
	isActive: boolean;
	createdAt: number;
	updatedAt: number;
	updatedById: string;
	deletedAt: number | null;
	updatedBy: {
		email: string;
		name: string;
	};
};

export type PublishReturnType = {
	success: boolean;
	projectId: number;
	collectionId: number;
	productId: number;
	product: {
		id: number;
		name: string;
		description: string;
		type: string;
		price: string;
		availableQuantity: number;
		ownerWalletAddress: string;
		canSubscribe: boolean;
		subscriptionValue: string;
		audience: string;
		consumerAction: string;
		spotlight: boolean;
		projectId: number;
		collectionId: number;
		createdAt: number;
	};
	voucher: {
		id: number;
		walletAddress: string;
		contractAddress: string;
		tokenId: string;
		mediaUrl: string;
		animationUrl: string;
		metadata: string;
		projectId: number;
		productId: number;
		collectionId: number;
		contractType: string;
		createdAt: number;
	};
};

export const createProject = async (
	address: string,
	data: { name: string; description: string },
) => {
	const res = await axiosInstance.post(
		`/project-service/${address}`,
		{ ...data },
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	// const res = await apiHandler.post(`project-service/${address}`, data, {
	// 	headers: { Authorization: `Bearer ${String(process.env.AUTH)}`, signature: createSignature(data) },
	// });
	// const res = await axios.post(`/project-service/${address}`, data, {
	// 	headers: { Authorization: `Bearer ${String(process.env.AUTH)}`, signature: createSignature(data) },
	// });
	if (res.status !== 200) {
		throw new Error('Failed to create project');
		console.error('Failed to create project');
	}

	return <{ success: boolean; project: AllProjectType }>res.data;
};

export const updateProject = async (
	address: string,
	projectId: number,
	data: AllProjectType,
) => {
	const res = await axiosInstance.put(
		`/project-service/${address}/${projectId}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	return <{ success: boolean; project: AllProjectType }>res.data;

	// return <{ success: boolean; project: AllProjectType }>res.data;
};

export const getProject = async (address: string, projectId: number) => {
	const res = await axiosInstance.get(
		`/project-service/${address}/${projectId}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	return <{ success: boolean; project: AllProjectType }>res.data;
};

export const getProjects = async (address: string) => {
	// console.log("getting projects for",address);
	const res = await axiosInstance.get(`/project-service/${address}`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	// console.log("getting project",res.data);
	return <
		{
			success: boolean;
			projects: AllProjectType[];
			myCollaborations: AllProjectType[];
		}
	>res.data;
};

export const searchProfiles = async (address: string, query: string) => {
	const res = await axiosInstance.get(
		`/collaboration-service/search/${address}?s=${query}`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	return <{ success: boolean; users: Profile[] }>res.data;
};

export const getProjectCollaborators = async (projectId: number) => {
	const res = await axiosInstance.get(`/collaboration-service/${projectId}`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	return <{ sucess: boolean; collaborators: CollaboratorType[] }>res.data;
};

export const inviteCollaborator = async (
	projectId: number,
	walletAddress: string,
	message: string,
) => {
	const data = {
		projectId: projectId,
		message: message,
		status: 'Invited',
		writeAccess: true,
	};
	const res = await axiosInstance.post(
		`/collaboration-service/${projectId}/${walletAddress}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	if (res.status !== 200) {
		console.error('Failed to invite collaborator');
		return <{ success: boolean }>{ success: false };
	}
	return <{ success: boolean }>res.data;
};

export const acceptCollaborator = async (
	projectId: number,
	walletAddress: string,
	notificationId?: number,
) => {
	if (notificationId) await markNotificationAsRead(notificationId);
	const data = {
		projectId: projectId,
		status: 'Accepted',
		writeAccess: true,
	};
	const res = await axiosInstance.put(
		`/collaboration-service/${projectId}/${walletAddress}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	return <{ success: boolean }>res.data;
};

export const rejectCollaborator = async (
	projectId: number,
	walletAddress: string,
	notificationId?: number,
) => {
	if (notificationId) await markNotificationAsRead(notificationId);
	const data = {
		projectId: projectId,
		status: 'Rejected',
		writeAccess: true,
	};
	const res = await axiosInstance.put(
		`/collaboration-service/${projectId}/${walletAddress}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	return <{ success: boolean }>res.data;
};

export const removeCollaborator = async (
	projectId: number,
	walletAddress: string,
) => {
	const res = await axiosInstance.put(
		`/collaboration-service/${projectId}/${walletAddress}`,
		{
			status: 'Removed',
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature({}),
			},
		},
	);
	return <{ success: boolean }>res.data;
};

export const withdrawCollaborator = async (
	projectId: number,
	walletAddress: string,
) => {
	const res = await axiosInstance.put(
		`/collaboration-service/${projectId}/${walletAddress}`,
		{
			status: 'Withdrawn',
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature({}),
			},
		},
	);
	return <{ success: boolean }>res.data;
};

export const establishUploadLink = async (
	fileName: string,
	mimetype: string,
	profileName: string,
	folder: string,
	projectId: number,
) => {
	const data = {
		folder: folder,
		name: fileName,
		type: mimetype,
	};
	// console.log('establishing upload link', data);
	const res = await axiosInstance.post(
		`/media-service/s3/url?c=${profileName}&id=${projectId}`,
		data,
		{
			headers: {
				Authorization: `Bearer ${String(process.env.AUTH)}`,
				signature: createSignature(data),
			},
		},
	);
	// console.log(res.data);
	return <UploadReturn>res.data;
};

export const getAllProject = async (address: string) => {
	const res = await axiosInstance.get(`/project-service/${address}`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	return <{ success: boolean; projects: AllProjectType[] }>res.data;
};

export const publish = async (
	data: VoucherContextType,
	colab: { address: string; name: string; share: number }[],
) => {
	const bundle = data.metadata?.properties?.bundle
		? await Promise.all<MetaDataBundleType>(
				data.metadata.properties.bundle.map(async (bund) => ({
					...bund,
					type: (await getMimeType(bund.uri!)).replace('/', '_'),
				})),
			)
		: [];
	const requestData = {
		walletAddress: data.walletAddress,
		tokenId: undefined,
		collectionId: data.collectionId ?? undefined,
		newCollection: data.newCollection ?? undefined,
		projectId: data.projectId,
		price: data.price,
		currency: data.currency,
		type: data.type,
		quantity: data.quantity,
		spotlight: false,
		audience: 'Public',
		consumerAction: 'Buy',
		tags: data.tags,
		metadata: {
			name: data.metadata?.name,
			description: data.metadata?.description,
			image: data.metadata?.image,
			animation_url: data.metadata?.animation_url,
			attributes: data.metadata?.attributes,
			properties: {
				bundle,
				creators: colab,
			},
		},
	};

	// console.log('Publish -- ', JSON.stringify(requestData, null, 2));
	try {
		const res = await axiosInstance.post(
			`/web3-service/publish`,
			requestData,
			{
				headers: {
					Authorization: `Bearer ${String(process.env.AUTH)}`,
				},
			},
		);
		return <PublishReturnType>res.data;
	} catch (e) {
		console.log(e);
		return undefined;
	}
};

type ImageReturn = {
	url: string;
	path: string;
	error?: string;
};

export const uploadMedia = async (
	fileName: string,
	mimetype: string,
	collectionId: number,
	isProject: boolean = false,
) => {
	const data = {
		folder: 'Collection',
		name: fileName,
		type: mimetype,
	};

	let url = `/media-service/s3/url?c=${'Product'}&id=${collectionId}`;
	if (isProject) {
		url = `/media-service/s3/url?c=${'Project'}&id=${collectionId}`;
	}
	const res = await axiosInstance.post(url, data, {
		headers: {
			Authorization: `Bearer ${String(process.env.AUTH)}`,
			signature: createSignature(data),
		},
	});
	// console.log(res.data);
	return <ImageReturn>res.data;
};

export const getPlatformFeeForPublish = async () => {
	const res = await axiosInstance.get(
		`/admin-service/charges/by-location?location=Publish`,
		{
			headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
		},
	);
	return <PlatformFeeType[]>res.data;
};

export const deleteCollaborator = async (
	projectId: number,
	walletAddress: string,
) => {
	const res = await axiosInstance.delete(
		`/collaboration-service/${projectId}/${walletAddress}`,
	);
	return res.data;
};

export const saveMonetise = async (
	walletAddress: string,
	projectId: number,
	data: any,
) => {
	const res = await axiosInstance.post(
		`/project-service/${walletAddress}/${projectId}/beneficiaries`,
		data,
	);
	return res.data;
};

export const saveRole = async (
	walletAddress: string,
	projectId: number,
	data: { walletAddress: string; role: string }[],
) => {
	const res = await axiosInstance.post(
		`/project-service/${walletAddress}/${projectId}/beneficiaries/role`,
		data,
	);
	return res.data;
};

export const monetisationAction = async (
	walletAddress: string,
	projectId: number,
	data: { monitizationStatus: string },
) => {
	const res = await axiosInstance.put(
		`/collaboration-service/${projectId}/${walletAddress}`,
		data,
	);

	return res.data;
};

export const getWalletBalanceApi = async (walletAddress: string) => {
	const res = await axiosInstance.get(
		`/wallet-service/balances/0x14a34?address=${walletAddress}`,
	);
	// The API returns: { success, data, message }
	return <
		{
			success: boolean;
			data: {
				address: string;
				ethBalance: string;
				usdcBalance: string;
				ethBalanceFormatted: string;
				usdcBalanceFormatted: string;
			};
			message: string;
		}
	>res.data;
};

export const sponsoredTransferUsdcApi = async (data: {
	fromAddress: string;
	toAddress: string;
	amount: string;
}) => {
	const res = await axiosInstance.post(
		`/wallet-service/sponsored-transfer/0x14a34/usdc`,
		data,
	);
	return <{ success: boolean; message: string }>res.data;
};

export const getCurrency = async () => {
	const res = await axiosInstance.get(`admin-service/currency`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});

	return <{ data: CurrencyResponse[] }>res.data;
};
