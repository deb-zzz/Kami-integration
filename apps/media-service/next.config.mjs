/** @type {import('next').NextConfig} */
const nextConfig = {
	// External packages for server components (Next.js 15+)
	serverExternalPackages: ['@aws-sdk/client-s3'],

	// For API services, output as standalone
	output: 'standalone',

	// Fix lockfile warning by setting the correct root
	outputFileTracingRoot: process.cwd(),

	// Large file uploads are handled by the multipart upload implementation
	// No additional configuration needed for Next.js 15
};

export default nextConfig;
