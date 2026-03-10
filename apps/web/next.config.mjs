/** @type {import('next').NextConfig} */
const nextConfig = {
	eslint: { ignoreDuringBuilds: true },
	reactStrictMode: true,
	redirects: async () => [
		{
			source: '/',
			destination: '/profile',
			permanent: true,
		},
	],
	images: {
		remotePatterns: [
			{
				hostname: 'trucsdenfants.com', // testing route
				protocol: 'https',
			},
			{
				hostname: 'i.seadn.io', // testing route
				protocol: 'https',
			},
			{
				hostname: 'img.freepik.com', // testing route
				protocol: 'https',
			},
			{
				hostname: 'ocunapse-kami.s3.ap-southeast-1.amazonaws.com', // testing route
				protocol: 'https',
			},
			{ protocol: 'https', hostname: '**', port: '', pathname: '**' },
		],
	},
	webpack: (config) => {
		config.resolve.fallback = { fs: false, net: false, tls: false };
		config.externals.push('pino-pretty', 'encoding');
		config.module.rules.push({
			test: /\.mp3$/,
			use: {
				loader: 'url-loader',
			},
		});
		return config;
	},
	async rewrites() {
		return [
			{
				source: '/ingest/static/:path*',
				destination: 'https://us-assets.i.posthog.com/static/:path*',
			},
			{
				source: '/ingest/:path*',
				destination: 'https://us.i.posthog.com/:path*',
			},
			{
				source: '/ingest/decide',
				destination: 'https://us.i.posthog.com/decide',
			},
			{
				source: '/api/upload/:path*',
				destination:
					'https://upload.kami.ocu-napse.com/api/upload/:path*',
			},
		];
	},
	// This is required to support PostHog trailing slash API requests
	skipTrailingSlashRedirect: true,
};

export default nextConfig;
