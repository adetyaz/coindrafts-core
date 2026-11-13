// Browser side of notifications (GAMEPLAY_FLOWS.md, F11): permission, the push
// subscription, and telling the server. iPhones only allow web push once the
// app has been added to the home screen, so `pushSupport` says why it can't.
import { env } from '$env/dynamic/public';

export type PushSupport = 'ok' | 'ios-install' | 'unsupported' | 'no-key';

export function isStandalone(): boolean {
	return (
		window.matchMedia?.('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

export function isIos(): boolean {
	return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function pushSupport(): PushSupport {
	if (!env.PUBLIC_VAPID_KEY) return 'no-key';
	if (isIos() && !isStandalone()) return 'ios-install';
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
		return 'unsupported';
	return 'ok';
}

function keyBytes(base64: string): Uint8Array {
	const pad = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Current subscription for this browser, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!('serviceWorker' in navigator)) return null;
	const reg = await navigator.serviceWorker.getRegistration();
	return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Asks permission, subscribes this browser and registers it with the server. */
export async function enablePush(): Promise<'on' | 'denied'> {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return 'denied';
	const reg = await navigator.serviceWorker.ready;
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyBytes(env.PUBLIC_VAPID_KEY!) as BufferSource
		}));
	const res = await fetch('/api/push', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ subscription: sub.toJSON(), tzOffset: -new Date().getTimezoneOffset() })
	});
	if (!res.ok) throw new Error("Couldn't turn on notifications");
	return 'on';
}

export async function disablePush(): Promise<void> {
	const sub = await currentSubscription();
	if (!sub) return;
	await fetch('/api/push', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: sub.endpoint })
	}).catch(() => null);
	await sub.unsubscribe().catch(() => false);
}

// ── Install (add to home screen) ────────────────────────────────────────────
// Chrome/Android fire `beforeinstallprompt` once, early; keep it for later.
type InstallEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: string }>;
};
let deferred: InstallEvent | null = null;

export function listenForInstall() {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferred = e as InstallEvent;
	});
}

export const canPromptInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
	if (!deferred) return false;
	await deferred.prompt();
	const { outcome } = await deferred.userChoice;
	deferred = null;
	return outcome === 'accepted';
}
