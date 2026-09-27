import { randomInt } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from './db';
import { rpsMatches } from './schema';
import {
	compare,
	isShape,
	SHAPES,
	THROW_SECONDS,
	WINS_NEEDED,
	type RpsRoundResult,
	type RpsShape,
	type RpsVariant,
	type RpsView
} from '$lib/rps';

type RpsRow = typeof rpsMatches.$inferSelect;

type HistoryEntry = {
	round: number;
	a: RpsShape;
	b: RpsShape;
	winner: 'a' | 'b' | null;
	timedOutA: boolean;
	timedOutB: boolean;
};

// Time for the client to play the reveal before the next round's clock starts,
// so the 10s a player gets is 10s of actually being able to throw.
const REVEAL_MS = 3000;
const THROW_MS = THROW_SECONDS * 1000;

function variantOf(row: RpsRow): RpsVariant {
	return row.variant === 'classic' ? 'classic' : 'spock';
}

function randomShape(variant: RpsVariant): RpsShape {
	const shapes = SHAPES[variant];
	return shapes[randomInt(shapes.length)];
}

export async function createRpsMatch(
	playerA: string,
	playerB: string,
	variant: RpsVariant = 'spock'
) {
	const [row] = await db
		.insert(rpsMatches)
		.values({
			playerA,
			playerB,
			variant,
			roundDeadline: new Date(Date.now() + REVEAL_MS + THROW_MS)
		})
		.returning();
	return row;
}

async function load(id: string): Promise<RpsRow | null> {
	const [row] = await db.select().from(rpsMatches).where(eq(rpsMatches.id, id)).limit(1);
	return row ?? null;
}

/**
 * Resolves the current round once both throws are in or the deadline has
 * passed (a missing throw becomes a random one — never a forfeit, so lag or a
 * dropped connection doesn't hand the other player the round). Safe to call
 * from both players' requests at once: the update only lands if the round
 * hasn't already moved on.
 */
async function settleIfDue(row: RpsRow): Promise<RpsRow> {
	if (row.winnerId) return row;
	const bothIn = row.throwA != null && row.throwB != null;
	if (!bothIn && row.roundDeadline.getTime() > Date.now()) return row;

	const variant = variantOf(row);
	const a = isShape(row.throwA, variant) ? row.throwA : randomShape(variant);
	const b = isShape(row.throwB, variant) ? row.throwB : randomShape(variant);
	const result = compare(a, b);
	const scoreA = row.scoreA + (result === 1 ? 1 : 0);
	const scoreB = row.scoreB + (result === -1 ? 1 : 0);
	const entry: HistoryEntry = {
		round: row.round,
		a,
		b,
		winner: result === 1 ? 'a' : result === -1 ? 'b' : null,
		timedOutA: row.throwA == null,
		timedOutB: row.throwB == null
	};
	const winnerId = scoreA >= WINS_NEEDED ? row.playerA : scoreB >= WINS_NEEDED ? row.playerB : null;

	await db
		.update(rpsMatches)
		.set({
			round: row.round + 1,
			scoreA,
			scoreB,
			throwA: null,
			throwB: null,
			history: [...(row.history as HistoryEntry[]), entry],
			winnerId,
			roundDeadline: new Date(Date.now() + REVEAL_MS + THROW_MS)
		})
		.where(and(eq(rpsMatches.id, row.id), eq(rpsMatches.round, row.round)));

	return (await load(row.id)) ?? row;
}

export async function getRpsState(id: string, userId: string) {
	const row = await load(id);
	if (!row || (row.playerA !== userId && row.playerB !== userId)) return null;
	return toView(await settleIfDue(row), userId);
}

export async function submitThrow(id: string, userId: string, shape: unknown) {
	let row = await load(id);
	if (!row || (row.playerA !== userId && row.playerB !== userId)) {
		return { error: 'Match not found', status: 404 } as const;
	}
	row = await settleIfDue(row);
	if (row.winnerId) return { error: 'Match is over', status: 409 } as const;
	if (!isShape(shape, variantOf(row))) return { error: 'Invalid throw', status: 400 } as const;

	const isA = row.playerA === userId;
	const column = isA ? rpsMatches.throwA : rpsMatches.throwB;
	await db
		.update(rpsMatches)
		.set(isA ? { throwA: shape } : { throwB: shape })
		.where(
			and(
				eq(rpsMatches.id, id),
				eq(rpsMatches.round, row.round),
				isNull(column),
				gt(rpsMatches.roundDeadline, new Date())
			)
		);

	const fresh = await load(id);
	return { state: toView(await settleIfDue(fresh ?? row), userId) } as const;
}

/** The requesting player's view — the opponent's current throw is never included. */
function toView(row: RpsRow, userId: string): RpsView {
	const isA = row.playerA === userId;
	const history = (row.history as HistoryEntry[]).map(
		(h): RpsRoundResult => ({
			round: h.round,
			mine: isA ? h.a : h.b,
			theirs: isA ? h.b : h.a,
			outcome: h.winner === null ? 'tie' : (h.winner === 'a') === isA ? 'win' : 'loss',
			iTimedOut: isA ? h.timedOutA : h.timedOutB,
			theyTimedOut: isA ? h.timedOutB : h.timedOutA
		})
	);
	return {
		id: row.id,
		variant: variantOf(row),
		round: row.round,
		deadline: row.roundDeadline.toISOString(),
		serverNow: new Date().toISOString(),
		myScore: isA ? row.scoreA : row.scoreB,
		theirScore: isA ? row.scoreB : row.scoreA,
		myThrow: (isA ? row.throwA : row.throwB) as RpsShape | null,
		theyHaveThrown: (isA ? row.throwB : row.throwA) != null,
		opponentId: isA ? row.playerB : row.playerA,
		history,
		winnerId: row.winnerId,
		iWon: row.winnerId ? row.winnerId === userId : null
	};
}
