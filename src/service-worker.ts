/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Installable app and notifications (GAMEPLAY_FLOWS.md, F11).
//
// Caching is deliberately narrow: only the built, content-hashed app files
// (they never change under the same name), so a returning player loads fast.
// Pages and every /api call always go to the network: prices, races and the
// economy must never be served stale from a cache.
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `coindraft-${version}`;
const ASSETS = [...build, ...files.filter((f) => f.startsWith('/icons/'))];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== sw.location.origin || !ASSETS.includes(url.pathname)) return;
	event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
});

// ── Notifications ───────────────────────────────────────────────────────────
// The server sends { title, body, url, tag }. Tapping opens (or focuses) the app there.
sw.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; url?: string; tag?: string };
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'CoinDraft', {
			body: data.body ?? '',
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			tag: data.tag,
			data: { url: data.url ?? '/dashboard' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = (event.notification.data?.url as string) ?? '/dashboard';
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
			const open = wins.find((w) => new URL(w.url).origin === sw.location.origin);
			if (open) return open.focus().then((w) => w.navigate(target));
			return sw.clients.openWindow(target);
		})
	);
});
