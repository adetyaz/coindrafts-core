// Sponsors and track ads (GAMEPLAY_FLOWS.md, F12). Client-safe: the booking
// pages, the 3D track and the server all read slots and prices from here.
//
// Payment isn't wired up (the method is still a separate decision), so a
// booking is a request: the sponsor gets a quote and an invoice, the
// operator marks it paid and approves it, and it goes live on its dates.

export type AdSlot = 'billboard' | 'banner' | 'arch';

export const AD_SLOTS: Record<
	AdSlot,
	{
		label: string;
		blurb: string;
		/** Where on the lap it stands (0 = start/finish), for the map and the 3D track. */
		at: number;
		/** Artwork aspect ratio, width / height. */
		aspect: number;
		/** Price per day, in US cents. */
		perDayCents: number;
	}
> = {
	billboard: {
		label: 'Billboard',
		blurb: 'A big board beside the fastest straight',
		at: 0.3,
		aspect: 2,
		perDayCents: 5000
	},
	banner: {
		label: 'Trackside banner',
		blurb: 'A long banner along the barrier',
		at: 0.62,
		aspect: 10,
		perDayCents: 3000
	},
	arch: {
		label: 'Start/finish arch',
		blurb: 'Over the line every car crosses',
		at: 0,
		aspect: 6,
		perDayCents: 12000
	}
};

export const AD_SLOT_IDS = Object.keys(AD_SLOTS) as AdSlot[];

/** Sponsoring a tournament: a flat fee, in US cents. */
export const TOURNAMENT_SPONSOR_CENTS = 50000;

/** Longest single booking, and how far ahead one can start. */
export const MAX_BOOKING_DAYS = 31;
export const MAX_DAYS_AHEAD = 120;

/** Artwork is stored with the booking: keep it small. */
export const MAX_ARTWORK_BYTES = 400_000;

export type BookingStatus = 'awaiting_payment' | 'awaiting_approval' | 'approved' | 'rejected';

export const STATUS_LABEL: Record<BookingStatus, string> = {
	awaiting_payment: 'Invoice sent · awaiting payment',
	awaiting_approval: 'Paid · awaiting approval',
	approved: 'Approved',
	rejected: 'Not approved'
};

/** An ad the track shows: its slot and artwork (a data: URL). */
export type TrackAd = { slot: AdSlot; image: string; sponsor: string };

/** Days in an inclusive YYYY-MM-DD range. */
export function daysBetween(start: string, end: string): number {
	const a = Date.parse(`${start}T00:00:00Z`);
	const b = Date.parse(`${end}T00:00:00Z`);
	return Math.round((b - a) / 86_400_000) + 1;
}

export function adQuoteCents(slot: AdSlot, start: string, end: string): number {
	return AD_SLOTS[slot].perDayCents * Math.max(0, daysBetween(start, end));
}

export const usd = (cents: number) =>
	`$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
