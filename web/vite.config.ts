import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			external: ['bun', 'node-pty']
		}
	},
	ssr: {
		external: ['bun', 'node-pty']
	}
});
