"use server";

import { axiosInstance } from "./AxiosInstance";
import axios from "axios";

export const sendEmail = async (
	username: string,
	email: string,
	issueTypes: string[],
	description: string
) => {
	try {
		const res = await axiosInstance.post(
			`/comm-service/email/report-bug`,
			{ username, email, issueTypes, description },
			{
				headers: {
					Authorization: `Bearer ${process.env.AUTH}`,
					"Content-Type": "application/json",
				},
			}
		);

		return <any>res.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			return {
				success: false,
				error: error.response?.data?.error ?? "Failed to send bug report",
			};
		}

		return {
			success: false,
			error: "Unexpected error occurred",
		};
	}
};
