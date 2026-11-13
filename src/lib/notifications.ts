// Notifications (GAMEPLAY_FLOWS.md, F11). Client-safe: the settings screen and
// the server read the kinds and the quiet-hours rule from here.

export const NOTIFY_KINDS = {
	match: { label: 'Match found · result is in' },
	trivia: { label: "Today's trivia is live (when you have a streak going)" },
	tournament: { label: 'Tournament draw is out · your race is starting' },
	league: { label: 'League night is open' },
	challenge: { label: 'Challenges, from players and from bots with a grudge' },
	carSold: { label: 'Your car sold in the Car Market' }
} as const;

export type NotifyKind = keyof typeof NOTIFY_KINDS;
export const NOTIFY_KIND_IDS = Object.keys(NOTIFY_KINDS) as NotifyKind[];

/** Default quiet hours, local time: nothing between 22:00 and 08:00. */
export const DEFAULT_QUIET = { start: 22, end: 8 };

export type NotifySettings = {
	notifications?: boolean;
	notify?: Partial<Record<NotifyKind, boolean>>;
	quietStart?: number;
	quietEnd?: number;
	/** Minutes to add to UTC to get the player's local time (−getTimezoneOffset()). */
	tzOffset?: number;
};

/** Is it quiet hours for this player right now? Handles ranges that wrap midnight. */
export function inQuietHours(s: NotifySettings, now = new Date()): boolean {
	const start = s.quietStart ?? DEFAULT_QUIET.start;
	const end = s.quietEnd ?? DEFAULT_QUIET.end;
	if (start === end) return false;
	const local = new Date(now.getTime() + (s.tzOffset ?? 0) * 60_000);
	const h = local.getUTCHours();
	return start < end ? h >= start && h < end : h >= start || h < end;
}
