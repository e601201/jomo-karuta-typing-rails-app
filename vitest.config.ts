import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./app/frontend', import.meta.url)),
			'~': fileURLToPath(new URL('./app/frontend', import.meta.url))
		}
	},
	test: {
		environment: 'happy-dom',
		globals: true,
		passWithNoTests: true,
		setupFiles: ['./app/frontend/test/setup.ts'],
		include: ['app/frontend/**/*.{test,spec}.{js,ts,jsx,tsx}'],
		coverage: {
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'app/frontend/test/', 'public/', '*.config.*']
		}
	}
});
