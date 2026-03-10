'use server';

export const EnvData = async () => {
	return {
		url: process.env.API_BASE_URL,
		third_D: process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN,
		third_C: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
		third_k: process.env.THIRDWEB_SECRET_KEY,
		third_p: process.env.THIRDWEB_ADMIN_PRIVATE_KEY,
	};
};
