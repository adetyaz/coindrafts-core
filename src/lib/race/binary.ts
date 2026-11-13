// Binary race mode (GAMEPLAY_FLOWS.md, F9). Client-safe: scoring, the race
// screen and the result all use these, so the gates on track agree with the
// result.
//
// Pick any 5 coins, call each up or down. Solo (vs the market): 3 of 5 right
// wins. Against others: most correct calls; a tie goes to whoever was right by
// more, then a coin flip. A flat price counts as wrong.

export type Call = 'up' | 'down';

/** contests.mode values. Null is a normal draft race. */
export const BINARY_SOLO = 'binary_solo';
export const BINARY_VERSUS = 'binary';
export const isBinaryMode = (mode: string | null | undefined) =>
	mode === BINARY_SOLO || mode === BINARY_VERSUS;

export const BINARY_LENGTHS = [
	{ minutes: 5, label: '5 minutes' },
	{ minutes: 60, label: '1 hour' },
	{ minutes: 1440, label: '24 hours' }
];
export const SOLO_TO_WIN = 3;
export const BINARY_PICKS = 5;

export const isCall = (v: unknown): v is Call => v === 'up' || v === 'down';

/** Right now (or at the finish): is this call on the right side? Flat is wrong. */
export function callRight(call: string | null | undefined, entry: number, now: number): boolean {
	if (!(entry > 0) || !(now > 0) || now === entry) return false;
	return call === 'up' ? now > entry : call === 'down' ? now < entry : false;
}

/** How far a call is on its side, in % (negative when wrong). */
export function callMargin(call: string | null | undefined, entry: number, now: number): number {
	if (!(entry > 0)) return 0;
	const pct = ((now - entry) / entry) * 100;
	return call === 'down' ? -pct : pct;
}

export type CallPick = { call: string | null; entryPrice: number; currentPrice: number };

/** Correct calls, and the total margin of the correct ones (the first tie-break). */
export function tallyCalls(picks: CallPick[]) {
	let correct = 0;
	let margin = 0;
	for (const p of picks) {
		if (callRight(p.call, p.entryPrice, p.currentPrice)) {
			correct++;
			margin += callMargin(p.call, p.entryPrice, p.currentPrice);
		}
	}
	return { correct, margin };
}

/**
 * The number the race screen orders cars by: correct calls first, margin as
 * a small tiebreak. One right call is worth a whole step on track.
 */
export function binaryPace(picks: CallPick[]): number {
	const { correct, margin } = tallyCalls(picks);
	return correct + Math.min(0.9, Math.max(0, margin) / 10);
}
