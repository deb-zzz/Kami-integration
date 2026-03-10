import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	eslint: { ignoreDuringBuilds: true },
	async headers() {
		return [
			{
				// Allow CORS for the API routes
				source: '/api/:path*',
				headers: [
					{ key: 'Access-Control-Allow-Credentials', value: 'true' },
					{ key: 'Access-Control-Allow-Origin', value: '*' },
					{ key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
					{ key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
				],
			},
		];
	},
};

export default nextConfig;
