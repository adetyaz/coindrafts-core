// Sponsors and track ads (GAMEPLAY_FLOWS.md, F12). Booking → invoice → the
// operator marks it paid → approves (or rejects) → live on its dates.
//
// Payment isn't wired to a provider yet, so nothing here takes money: a new
// booking is "awaiting payment" with a quote, and only an admin moves it on.
// Admins are the user ids in ADMIN_USER_IDS (comma-separated).
import { env } from '$env/dynamic/private';
import { and, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sponsorBookings, sponsors, tournaments } from '$lib/server/schema';
import { CIRCUITS } from '$lib/race/circuits';
import {
	AD_SLOT_IDS,
	MAX_ARTWORK_BYTES,
	MAX_BOOKING_DAYS,
	MAX_DAYS_AHEAD,
	TOURNAMENT_SPONSOR_CENTS,
	adQuoteCents,
	daysBetween,
	type AdSlot,
	type TrackAd
} from '$lib/sponsors';

export class SponsorError extends Error {}

export function isAdmin(userId: string): boolean {
	return (env.ADMIN_USER_IDS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
		.includes(userId);
}

const today = () => new Date().toISOString().slice(0, 10);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

function checkDates(start: string, end: string) {
	if (!DATE.test(start) || !DATE.test(end)) throw new SponsorError('Pick a start and end date');
	if (start < today()) throw new SponsorError('Dates must be today or later');
	const days = daysBetween(start, end);
	if (days < 1) throw new SponsorError('The end date is before the start date');
	if (days > MAX_BOOKING_DAYS)
		throw new SponsorError(`Book up to ${MAX_BOOKING_DAYS} days at a time`);
	if (daysBetween(today(), start) > MAX_DAYS_AHEAD)
		throw new SponsorError(`Bookings open ${MAX_DAYS_AHEAD} days ahead`);
}

function checkImage(image: unknown, what: string): string {
	const s = String(image ?? '');
	if (!IMAGE.test(s)) throw new SponsorError(`Upload the ${what} as a PNG, JPEG or WebP image`);
	if (s.length > MAX_ARTWORK_BYTES * 1.37) throw new SponsorError(`The ${what} is too large`);
	return s;
}

/** The sponsor profile for a user, created on their first booking. */
async function sponsorFor(userId: string, name?: string, email?: string) {
	const [existing] = await db.select().from(sponsors).where(eq(sponsors.userId, userId));
	if (existing) return existing;
	const n = String(name ?? '')
		.trim()
		.slice(0, 80);
	const e = String(email ?? '')
		.trim()
		.slice(0, 160);
	if (!n) throw new SponsorError('Add your company or brand name');
	if (!EMAIL.test(e)) throw new SponsorError('Add an email for the invoice');
	const [created] = await db
		.insert(sponsors)
		.values({ userId, name: n, contactEmail: e })
		.onConflictDoNothing()
		.returning();
	return created ?? (await db.select().from(sponsors).where(eq(sponsors.userId, userId)))[0];
}

/** Date ranges already taken for a circuit's slot (anything not rejected). */
export async function bookedRanges(circuit: string, slot: AdSlot) {
	return db
		.select({ start: sponsorBookings.startDate, end: sponsorBookings.endDate })
		.from(sponsorBookings)
		.where(
			and(
				eq(sponsorBookings.kind, 'ad'),
				eq(sponsorBookings.circuit, circuit),
				eq(sponsorBookings.slot, slot),
				ne(sponsorBookings.status, 'rejected'),
				gte(sponsorBookings.endDate, today())
			)
		);
}

export async function bookAd(
	userId: string,
	input: {
		name?: string;
		email?: string;
		circuit: string;
		slot: string;
		start: string;
		end: string;
		artwork: string;
	}
) {
	if (!CIRCUITS.some((c) => c.id === input.circuit)) throw new SponsorError('Pick a circuit');
	if (!AD_SLOT_IDS.includes(input.slot as AdSlot)) throw new SponsorError('Pick a slot');
	const slot = input.slot as AdSlot;
	checkDates(input.start, input.end);
	const artwork = checkImage(input.artwork, 'artwork');
	const sponsor = await sponsorFor(userId, input.name, input.email);

	// Booked dates are unavailable: refuse any overlap with a live request.
	const clash = (await bookedRanges(input.circuit, slot)).some(
		(r) => r.start <= input.end && r.end >= input.start
	);
	if (clash) throw new SponsorError('Those dates are already booked for this slot');

	const [booking] = await db
		.insert(sponsorBookings)
		.values({
			sponsorId: sponsor.id,
			kind: 'ad',
			circuit: input.circuit,
			slot,
			startDate: input.start,
			endDate: input.end,
			artwork,
			priceCents: adQuoteCents(slot, input.start, input.end)
		})
		.returning({ id: sponsorBookings.id, priceCents: sponsorBookings.priceCents });
	return booking;
}

export async function bookTournament(
	userId: string,
	input: {
		name?: string;
		email?: string;
		title: string;
		start: string;
		end: string;
		prize: string;
		logo: string;
		livery: string;
	}
) {
	const title = String(input.title ?? '')
		.trim()
		.slice(0, 80);
	if (!title) throw new SponsorError('Name the tournament');
	checkDates(input.start, input.end);
	const prize = String(input.prize ?? '')
		.trim()
		.slice(0, 200);
	if (!prize) throw new SponsorError('Say what the winner gets');
	if (!COLOR.test(String(input.livery ?? ''))) throw new SponsorError('Pick a livery colour');
	const logo = checkImage(input.logo, 'logo');
	const sponsor = await sponsorFor(userId, input.name, input.email);
	const [booking] = await db
		.insert(sponsorBookings)
		.values({
			sponsorId: sponsor.id,
			kind: 'tournament',
			title,
			prize,
			livery: input.livery,
			artwork: logo,
			startDate: input.start,
			endDate: input.end,
			priceCents: TOURNAMENT_SPONSOR_CENTS
		})
		.returning({ id: sponsorBookings.id, priceCents: sponsorBookings.priceCents });
	return booking;
}

/** The sponsor dashboard: profile and every booking (without the heavy artwork). */
export async function sponsorDashboard(userId: string) {
	const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.userId, userId));
	if (!sponsor) return { sponsor: null, bookings: [] };
	const bookings = await db
		.select({
			id: sponsorBookings.id,
			kind: sponsorBookings.kind,
			status: sponsorBookings.status,
			startDate: sponsorBookings.startDate,
			endDate: sponsorBookings.endDate,
			circuit: sponsorBookings.circuit,
			slot: sponsorBookings.slot,
			title: sponsorBookings.title,
			tournamentId: sponsorBookings.tournamentId,
			priceCents: sponsorBookings.priceCents,
			views: sponsorBookings.views,
			note: sponsorBookings.note,
			createdAt: sponsorBookings.createdAt,
			paidAt: sponsorBookings.paidAt
		})
		.from(sponsorBookings)
		.where(eq(sponsorBookings.sponsorId, sponsor.id))
		.orderBy(desc(sponsorBookings.createdAt));
	return { sponsor: { name: sponsor.name, contactEmail: sponsor.contactEmail }, bookings };
}

// ── Operator ────────────────────────────────────────────────────────────────

export async function adminBookings() {
	return db
		.select({
			id: sponsorBookings.id,
			kind: sponsorBookings.kind,
			status: sponsorBookings.status,
			startDate: sponsorBookings.startDate,
			endDate: sponsorBookings.endDate,
			circuit: sponsorBookings.circuit,
			slot: sponsorBookings.slot,
			title: sponsorBookings.title,
			prize: sponsorBookings.prize,
			livery: sponsorBookings.livery,
			artwork: sponsorBookings.artwork,
			priceCents: sponsorBookings.priceCents,
			views: sponsorBookings.views,
			sponsor: sponsors.name,
			email: sponsors.contactEmail,
			createdAt: sponsorBookings.createdAt
		})
		.from(sponsorBookings)
		.innerJoin(sponsors, eq(sponsors.id, sponsorBookings.sponsorId))
		.orderBy(desc(sponsorBookings.createdAt))
		.limit(100);
}

/**
 * Moves a booking on: 'paid' (awaiting payment → awaiting approval),
 * 'approve' or 'reject'. Approving a tournament creates it: public, closing on
 * its start date, presented by the sponsor.
 */
export async function decideBooking(id: string, action: string, note?: string) {
	const [b] = await db.select().from(sponsorBookings).where(eq(sponsorBookings.id, id));
	if (!b) throw new SponsorError('Booking not found');
	if (action === 'paid') {
		if (b.status !== 'awaiting_payment') throw new SponsorError('Not awaiting payment');
		await db
			.update(sponsorBookings)
			.set({ status: 'awaiting_approval', paidAt: new Date() })
			.where(eq(sponsorBookings.id, id));
		return;
	}
	if (action === 'reject') {
		await db
			.update(sponsorBookings)
			.set({ status: 'rejected', decidedAt: new Date(), note: note?.slice(0, 300) ?? null })
			.where(eq(sponsorBookings.id, id));
		return;
	}
	if (action !== 'approve') throw new SponsorError('Unknown action');
	if (b.status !== 'awaiting_approval') throw new SponsorError('Mark it paid first');
	let tournamentId = b.tournamentId;
	if (b.kind === 'tournament' && !tournamentId) {
		const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, b.sponsorId));
		const [t] = await db
			.insert(tournaments)
			.values({
				name: b.title ?? `${sponsor?.name ?? 'Sponsored'} Cup`,
				accessType: 'public',
				fundingMode: 'free',
				groupSize: 5,
				minPlayers: 1,
				durationMinutes: 15,
				groupTrack: CIRCUITS[0].id,
				finalTrack: CIRCUITS[CIRCUITS.length - 1].id,
				registrationClosesAt: new Date(`${b.startDate}T18:00:00Z`),
				status: 'open'
			})
			.returning({ id: tournaments.id });
		tournamentId = t.id;
	}
	await db
		.update(sponsorBookings)
		.set({
			status: 'approved',
			decidedAt: new Date(),
			tournamentId,
			note: note?.slice(0, 300) ?? null
		})
		.where(eq(sponsorBookings.id, id));
}

// ── On the track ────────────────────────────────────────────────────────────

/** Approved ads running today on a circuit (one per slot). */
export async function activeAds(circuit: string | null | undefined): Promise<TrackAd[]> {
	if (!circuit) return [];
	const day = today();
	const rows = await db
		.select({ slot: sponsorBookings.slot, image: sponsorBookings.artwork, sponsor: sponsors.name })
		.from(sponsorBookings)
		.innerJoin(sponsors, eq(sponsors.id, sponsorBookings.sponsorId))
		.where(
			and(
				eq(sponsorBookings.kind, 'ad'),
				eq(sponsorBookings.status, 'approved'),
				eq(sponsorBookings.circuit, circuit),
				lte(sponsorBookings.startDate, day),
				gte(sponsorBookings.endDate, day)
			)
		)
		.catch(() => []);
	return rows
		.filter((r) => r.slot && r.image)
		.map((r) => ({ slot: r.slot as AdSlot, image: r.image!, sponsor: r.sponsor }));
}

/** A race started on `circuit` with `drivers` watching: each running ad gets those views. */
export async function countAdViews(circuit: string | null | undefined, drivers: number) {
	if (!circuit || drivers <= 0) return;
	const day = today();
	await db
		.update(sponsorBookings)
		.set({ views: sql`${sponsorBookings.views} + ${drivers}` })
		.where(
			and(
				eq(sponsorBookings.kind, 'ad'),
				eq(sponsorBookings.status, 'approved'),
				eq(sponsorBookings.circuit, circuit),
				lte(sponsorBookings.startDate, day),
				gte(sponsorBookings.endDate, day)
			)
		)
		.catch(() => null);
}

/** "Presented by" for a sponsored tournament, if any. */
export async function tournamentSponsor(tournamentId: string) {
	const [row] = await db
		.select({
			name: sponsors.name,
			logo: sponsorBookings.artwork,
			livery: sponsorBookings.livery,
			prize: sponsorBookings.prize
		})
		.from(sponsorBookings)
		.innerJoin(sponsors, eq(sponsors.id, sponsorBookings.sponsorId))
		.where(
			and(
				eq(sponsorBookings.tournamentId, tournamentId),
				inArray(sponsorBookings.status, ['approved'])
			)
		)
		.catch(() => []);
	return row ?? null;
}
