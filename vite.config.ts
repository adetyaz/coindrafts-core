import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Folders that are part of the repo but not of the app. contracts/near/target
// is ~2 GB of Rust build output; watching it (and Design System/, the design
// exploration files) ran the dev server out of memory. So did a build run
// while dev was up: .vercel/output is dozens of function bundles, each with
// its own copy of node_modules, all rewritten per build.
const NOT_APP = [
	'**/.vercel/**',
	'**/.svelte-kit/output/**',
	'**/assets-src/**',
	'**/static/models/**',
	'**/contracts/**',
	'**/Design System/**',
	'**/stitch_exports/**',
	'**/docs-project/**',
	'**/scripts/**'
];

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: { watch: { ignored: NOT_APP } }
});
