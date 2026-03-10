/** @type {import('next').NextConfig} */
const nextConfig = {
	eslint: {
		// Warning: This allows production builds to successfully complete even if
		// your project has ESLint errors.
		ignoreDuringBuilds: true,
	},
	// Add 5 minute (300000ms) request timeout
	serverRuntimeConfig: {
		timeout: 300000,
	},
};

export default nextConfig;
