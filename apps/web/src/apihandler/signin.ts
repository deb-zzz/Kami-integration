'use server';

import { axiosInstance, createSignature } from './AxiosInstance';
import { AxiosError } from 'axios';

type SigninSuccessResponse = {
	success: true;
	message: string;
	walletAddress?: string;
};

type SigninErrorResponse = {
	success: false;
	error: string;
};

export const generateOTP = async (
	email: string
): Promise<SigninSuccessResponse | SigninErrorResponse> => {
	try {
		const res = await axiosInstance.post(`/signin-service/otp/generate`, {
			email,
		});
		return {
			success: res.data.success,
			message: res.data.message,
			error: res.data.error,
		};
	} catch (error) {
		return {
			success: false,
			error: (error as Error).message,
		};
	}

	// return {
	// 	success: false,
	// 	error: res.data.error,
	// };
};

export const validateOTP = async (
	email: string,
	otp: string
): Promise<SigninSuccessResponse | SigninErrorResponse> => {
	const res = await axiosInstance.post(`/signin-service/otp/validate`, {
		email,
		otp,
	});
	if (res.status === 200) {
		return {
			success: true,
			message: res.data.message,
			walletAddress: res.data.walletAddress,
		};
	}
	return {
		success: false,
		error: res.data.error,
	};
};
