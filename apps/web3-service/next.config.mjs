// next.config.mjs
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
	async headers() {
		return [
			{
				source: '/api/:path*',
				headers: [
					{ key: 'Access-Control-Allow-Credentials', value: 'true' },
					{ key: 'Access-Control-Allow-Origin', value: '*' },
					{ key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
					{
						key: 'Access-Control-Allow-Headers',
						value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
					},
				],
			},
		];
	},
	webpack: (config, { isServer, dev }) => {
		if (isServer && !dev) {
			// Copy artifacts in production builds
			config.plugins.push({
				apply: (compiler) => {
					compiler.hooks.afterEmit.tap('CopyKamiArtifacts', () => {
						try {
							// ✅ FIXED: Use dist/ directory, not src/
							const sourceDir = path.join(
								process.cwd(),
								'node_modules/@paulstinchcombe/gasless-nft-tx/dist/KAMI-NFTs/artifacts'
							);

							// Copy to multiple locations to handle App Router path resolution
							const destDirs = [
								// Base location (for __dirname resolution from dist/)
								path.join(process.cwd(), '.next/server/KAMI-NFTs/artifacts'),
								// App Router API routes - copy to each API route that needs it
								path.join(process.cwd(), '.next/server/app/api/publish/KAMI-NFTs/artifacts'),
								// Fix for packages using ../src/KAMI-NFTs/ path resolution
								path.join(process.cwd(), '.next/server/app/api/src/KAMI-NFTs/artifacts'),
							];

							if (fs.existsSync(sourceDir)) {
								destDirs.forEach((destDir) => {
									fs.mkdirSync(destDir, { recursive: true });
									fs.cpSync(sourceDir, destDir, { recursive: true, force: true });
									console.log(`✅ KAMI artifacts copied to ${destDir.replace(process.cwd(), '.')}`);
								});
								console.log('✅ All KAMI artifacts copied successfully');
							} else {
								console.warn('⚠️  KAMI artifacts not found at:', sourceDir);
								console.warn('   Make sure @paulstinchcombe/gasless-nft-tx is installed');
							}
						} catch (error) {
							console.error('❌ Failed to copy KAMI artifacts:', error);
						}
					});
				},
			});
		}

		return config;
	},
};

export default nextConfig;
