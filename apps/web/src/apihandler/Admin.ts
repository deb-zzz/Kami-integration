'use server';
import axios from 'axios';
import { axiosInstance } from './AxiosInstance';
import { Currency, PlatformFeeType } from '@/types';

type WhiteObject = {
	id: number;
	walletAddress: string | null;
	email: string | null;
	phoneNumber: string | null;
	createdAt: number;
};

export const getWhiteList = async () => {
	const res = await axiosInstance.get(`/admin-service/whitelist`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	return <WhiteObject[]>res.data;
};

export const getChargeByLocation = async (location: string) => {
    const res = await axiosInstance.get(`/admin-service/charges/by-location?location=${location}`, {
        headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
    });
    return <PlatformFeeType[]>res.data;
};

export const fetchCurrency = async (symbol: string) => {
    const res = await axiosInstance.get(`/admin-service/currency/${symbol}`, {
        headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
    });
    return <Currency>res.data;
}