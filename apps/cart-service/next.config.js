const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
	// API-only: app lives under src/; layout/not-found/global-error exist only for build.
	// Skip build-time type check: Next generates validator paths for ../../app/ but we use src/app/.
	typescript: { ignoreBuildErrors: true },
	turbopack: {
		root: path.resolve(__dirname),
	},
};

module.exports = nextConfig;
