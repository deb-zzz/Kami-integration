import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	eslint: { ignoreDuringBuilds: true },
	crossOrigin: 'anonymous',
};

export default nextConfig;
