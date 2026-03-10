import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		testTimeout: 300000, // 5 minutes for blockchain operations
		hookTimeout: 60000,
		setupFiles: ['./tests/setup.ts'],
		// Run tests sequentially to avoid blockchain race conditions
		sequence: {
			concurrent: false,
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/app/page.tsx', 'src/app/layout.tsx'],
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
