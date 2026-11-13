// Shrinks an uploaded image in the browser to a small data: URL, so sponsor
// artwork can be stored with its booking (see MAX_ARTWORK_BYTES).
import { MAX_ARTWORK_BYTES } from '$lib/sponsors';

export async function fileToDataUrl(file: File, maxWidth = 1200): Promise<string> {
	if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use a PNG, JPEG or WebP image');
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, maxWidth / bitmap.width);
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	// PNG keeps logos with transparency crisp; fall back to JPEG when it's too big.
	let url = canvas.toDataURL('image/png');
	for (const q of [0.9, 0.8, 0.65, 0.5]) {
		if (url.length <= MAX_ARTWORK_BYTES * 1.33) break;
		url = canvas.toDataURL('image/jpeg', q);
	}
	if (url.length > MAX_ARTWORK_BYTES * 1.37)
		throw new Error('That image is too large; try a smaller one');
	return url;
}
