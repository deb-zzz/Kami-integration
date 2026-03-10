'use server';
import { createSignature } from '@/lib/Util';
import axios, { Axios, AxiosError } from 'axios';
import { decodeJwt } from 'jose';
import { axiosInstance } from './AxiosInstance';
import { cookies } from 'next/headers';

type LoginData = {
	walletAddress: string;
	email?: string;
	phoneNumber?: string;
};

type DecodedToken = {
	categories: { id: number; name: string; description: string }[];
	userName: string;
	email?: string;
	phoneNumber?: string;
	walletAddress: string;
	exp: number;
};

type LoginResponse = {
	success: true;
	token: string;
	profile: {
		walletAddress: string;
		userName: string;
		tagLine?: string;
		description?: string;
		firstName?: string;
		lastName?: string;
		avatarUrl?: string;
		bannerUrl?: string;
		idNumber?: string;
		createdAt: number;
		updatedAt?: number;
		nftAddresses?: string;
		nftTokenId?: string;
		tbaAddresses?: string;
		fbUrl?: string;
		instagramUrl?: string;
		xUrl?: string;
		linkedInUrl?: string;
		farcasterId?: string;
		todaysFilm?: string;
		todaysMusic?: string;
		todaysGame?: string;
		todaysFood?: string;
		todaysBeverage?: string;
		todaysArt?: string;
	};
	decodedToken?: DecodedToken;
};

type FailedLoginResponse = {
	success: false;
	error: string;
	status?: number;
};

export const login = async (
	loginData: LoginData
): Promise<LoginResponse | FailedLoginResponse> => {
	try {
		const res = await axiosInstance.post(`/auth-service`, loginData, {
			headers: {
				Authorization: `Bearer ${String(process.env.NEXT_PUBLIC_AUTH)}`,
				signature: createSignature(loginData),
			},
		});
		if (res.data.token) cookies().set('jwt', res.data.token);
		return (<{ success: boolean }>{
			...res.data,
			decodedToken: await decodeJWT(res.data.token),
		}) as LoginResponse | FailedLoginResponse;
	} catch (e) {
		console.error(e, 'here');
		return {
			success: false,
			error: (e as Error).message,
			status: (e as AxiosError).status,
		};
	}
};

export async function decodeJWT(
	token: string
): Promise<DecodedToken | undefined> {
	try {
		const decoded = decodeJwt(token);
		// Check if token is expired
		// const currentTime = Math.floor(Date.now() / 1000);
		// if (decoded.exp && decoded.exp < currentTime) {
		// 	console.log('Token has expired');
		// 	return undefined;
		// }
		return decoded as DecodedToken;
	} catch (error) {
		console.error('Failed to decode JWT:', error);
		return undefined;
	}
}
