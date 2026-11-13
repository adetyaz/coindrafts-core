// Per-second prices in the browser, for the race view's accelerator.
//
// The server's /live endpoint is the source of truth (scoring always uses
// locked entry prices), but it's polled every few seconds and samples every 6s
// — too coarse for a car that should react every second. Binance's public
// market-data stream pushes a mini-ticker for each symbol once a second, and
// it's the same exchange our server prices come from (src/lib/server/prices.ts),
// so the two never disagree by more than a tick.
//
// data-stream.binance.vision is Binance's market-data-only mirror; the main
// stream host is geo-blocked in some regions (same reason prices.ts uses
// data-api.binance.vision).

const STREAM_HOST = 'wss://data-stream.binance.vision/stream';
const QUOTE = 'USDT';
const RECONNECT_MS = 3000;

type MiniTicker = { stream: string; data: { s: string; c: string } };

/**
 * Subscribes to live prices for `symbols` (e.g. ['BTC', 'ETH']). Calls
 * `onPrice(symbol, price)` as updates arrive (about once a second each).
 * Reconnects on drop. Returns a function that closes the stream.
 */
export function streamPrices(
	symbols: string[],
	onPrice: (symbol: string, price: number) => void
): () => void {
	const unique = [...new Set(symbols.map((s) => s.toUpperCase()))].filter((s) => s !== QUOTE);
	if (unique.length === 0 || typeof WebSocket === 'undefined') return () => {};

	const streams = unique
		.map((s) => `${s.toLowerCase()}${QUOTE.toLowerCase()}@miniTicker`)
		.join('/');
	let socket: WebSocket | null = null;
	let closed = false;
	let retry: ReturnType<typeof setTimeout> | null = null;

	function connect() {
		socket = new WebSocket(`${STREAM_HOST}?streams=${streams}`);
		socket.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data as string) as MiniTicker;
				const price = Number(msg.data?.c);
				const pair = msg.data?.s ?? '';
				if (!Number.isFinite(price) || price <= 0 || !pair.endsWith(QUOTE)) return;
				onPrice(pair.slice(0, -QUOTE.length), price);
			} catch {
				// A malformed frame is skipped; the next one arrives within a second.
			}
		};
		socket.onclose = () => {
			if (!closed) retry = setTimeout(connect, RECONNECT_MS);
		};
		socket.onerror = () => socket?.close();
	}

	connect();
	return () => {
		closed = true;
		if (retry) clearTimeout(retry);
		socket?.close();
	};
}
