import axios, {
	AxiosError,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from 'axios';

const apiHandler = axios.create({
	baseURL: process.env.API_BASE_URL + '/api',
	timeout: 10 * 1000, // 10 seconds
});

const requestHandler = async (config: InternalAxiosRequestConfig) => {
	const token = process.env.AUTH;
	config.headers.Authorization = `Bearer ${token}`;

	return config;
};

const responseHandler = (response: AxiosResponse) => {
	if (response?.request?.responseURL?.includes('auth/login')) {
		return response;
	}
	return response?.data;
};

const responseErrorHandler = async (error: AxiosError) => {
	if (error?.response?.status === 401 || error?.response?.status === 403) {
		window.location.href = '/';
	}
	if (error?.response?.status === 406 || error?.response?.status === 408) {
		throw error;
	}
	return error?.response?.data;
};

apiHandler.interceptors.request.use(requestHandler);
apiHandler.interceptors.response.use(responseHandler, responseErrorHandler);

export default apiHandler;
