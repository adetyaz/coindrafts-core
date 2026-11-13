// Renders the PWA / home-screen icons from the app-icon logo.
// Usage: node scripts/make-icons.mjs   (re-run whenever the logo changes)
import sharp from 'sharp';

const SRC = 'src/lib/assets/images/logo_v4_appicon.svg';
const OUT = 'static/icons';
const sizes = [
	['icon-192.png', 192, 0],
	['icon-512.png', 512, 0],
	// Maskable: the logo inset so Android's circle/squircle crop never cuts it.
	['maskable-512.png', 512, 0.12],
	['apple-touch-icon.png', 180, 0]
];

for (const [name, size, pad] of sizes) {
	const inner = Math.round(size * (1 - pad * 2));
	const logo = await sharp(SRC, { density: 384 }).resize(inner, inner).png().toBuffer();
	await sharp({
		// Background is the logo's own coral, so its rounded corners blend in.
		create: { width: size, height: size, channels: 4, background: '#f78e79' }
	})
		.composite([{ input: logo, gravity: 'center' }])
		.png()
		.toFile(`${OUT}/${name}`);
	console.log('wrote', name);
}
