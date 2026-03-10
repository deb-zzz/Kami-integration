'use server';

import { Tag } from '@/types';
import axios from 'axios';
import { axiosInstance } from './AxiosInstance';

export const getTags = async () => {
	const res = await axiosInstance.get(`/tag-service`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	// console.log(res.data);
	return <{ sucess: boolean; tags: Tag[] }>res.data;
};

export const postTag = async () => {
	const res = await axiosInstance.get(`/tag-service`, {
		headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
	});
	// console.log(res.data);
	return <{ sucess: boolean; tags: Tag[] }>res.data;
};
