import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [UnoCSS(), sveltekit()],
	server: {
		allowedHosts: ['dev.stemm1.org', 'dlrg.stemm1.org']
	}
});