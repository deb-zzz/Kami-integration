import axios from 'axios';
import crypto from 'crypto';

// Create an instance using the config defaults provided by the library
// At this point the timeout config value is `0` as is the default for the library
export const axiosInstance = axios.create({
	baseURL: process.env.API_BASE_URL,
	timeout: 30000,
	headers: {
		'Content-type': 'application/json',
		Authorization: 'Bearer ' + process.env.AUTH,
	},
});

axiosInstance.interceptors.request.use(
	async function (config) {
		// Do something before request is sent
		// console.log(config.data);
		const sig = await createSignature(config.data ?? '{}');
		config.headers.set('Signature', sig);
		return config;
	},
	function (error) {
		// Do something with request error
		return Promise.reject(error);
	},
);

axiosInstance.interceptors.response.use(
	function (response) {
		// Do something with response data
		// console.log('Response:', response);
		return response;
	},
	function (error) {
		// Do something with response error
		return Promise.reject(error);
	},
);

export function createSignature(message: string | object): string {
	const authToken = process.env.NEXT_PUBLICAUTH || '';
	const secretKey = authToken;
	const normalizedMessage = typeof message === 'object' ? JSON.stringify(message).replace(/\s/g, '') : message;
	const hmac = crypto.createHmac('sha256', secretKey);
	hmac.update(normalizedMessage);
	return hmac.digest('hex');
}
