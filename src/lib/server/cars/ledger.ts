// The car + Gears ledger. One interface for the whole game, two backends:
//
// - CAR_LEDGER=db   → Postgres only.
// - CAR_LEDGER=near → Postgres first (the game's fast read model), then the same
//   change is queued in `near_outbox` and replayed on the NEP-245 garage
//   contract, where it's the record of who owns what.
//
// The game never waits on the chain to stay playable: a slow or failing RPC
// leaves rows pending in the outbox, and the next flush (sign-in, garage view,
// the daily cron) picks them up in order.
import { and, asc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cars, nearOutbox, users } from '$lib/server/schema';
import {
	botAccountId,
	callContract,
	createBotAccount,
	explorerUrl,
	nearConfig,
	newImplicitAccount
} from './near';

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const STARTER_MODELS = ['Viper', 'Comet', 'Bolt', 'Drift', 'Nova', 'Rally'];
const PLAYER_STARTER_GEARS = 500;
const BOT_STARTER_GEARS = 800;
const MAX_ATTEMPTS = 5;

/** Seeded bot accounts are stored with `wallet_address = 'seed:<username>'`. */
function isBot(user: { walletAddress: string }) {
	return user.walletAddress.startsWith('seed:');
}

function pick<T>(list: T[]): T {
	return list[Math.floor(Math.random() * list.length)];
}

async function enqueue(tx: Tx, method: string, args: Record<string, unknown>) {
	if (!nearConfig()) return;
	await tx.insert(nearOutbox).values({ method, args });
}

// ── Accounts ─────────────────────────────────────────────────────────────────

/**
 * Gives a user their NEAR account, once. Players get an implicit account
 * (instant, free, nothing to approve). Bots get a named account under the
 * operator, created on chain, so the explorer shows `nina.coindraft.testnet`.
 * Returns null when NEAR is off.
 */
export async function ensureNearAccount(userId: string): Promise<string | null> {
	if (!nearConfig()) return null;
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!user) throw new Error(`User ${userId} not found`);
	if (user.nearAccountId) return user.nearAccountId;

	let accountId: string;
	let keyCipher: string | null = null;
	if (isBot(user)) {
		accountId = botAccountId(user.username)!;
		await createBotAccount(accountId);
	} else {
		({ accountId, keyCipher } = newImplicitAccount());
	}

	// Only set it if still unset, so two sign-ins racing can't give one user two accounts.
	const [updated] = await db
		.update(users)
		.set({ nearAccountId: accountId, nearKeyCipher: keyCipher })
		.where(and(eq(users.id, userId), isNull(users.nearAccountId)))
		.returning({ nearAccountId: users.nearAccountId });
	if (updated) return updated.nearAccountId;
	const [again] = await db
		.select({ id: users.nearAccountId })
		.from(users)
		.where(eq(users.id, userId));
	return again?.id ?? null;
}

async function nearIdOf(tx: Tx, userId: string): Promise<string | null> {
	const [row] = await tx
		.select({ id: users.nearAccountId })
		.from(users)
		.where(eq(users.id, userId));
	return row?.id ?? null;
}

// ── Cars and Gears ───────────────────────────────────────────────────────────

async function mintCarIn(tx: Tx, ownerId: string, model: string, rarity: Rarity) {
	const [car] = await tx
		.insert(cars)
		.values({ tokenId: `car:${crypto.randomUUID()}`, ownerId, model, rarity })
		.returning();
	const owner = await nearIdOf(tx, ownerId);
	if (owner) {
		await enqueue(tx, 'mint_car', {
			car_id: car.tokenId.slice('car:'.length),
			owner_id: owner,
			model,
			rarity
		});
	}
	return car;
}

async function grantGearsIn(tx: Tx, userId: string, amount: number, memo: string) {
	if (amount <= 0) return;
	await tx
		.update(users)
		.set({ gears: sql`${users.gears} + ${amount}` })
		.where(eq(users.id, userId));
	const owner = await nearIdOf(tx, userId);
	if (owner) await enqueue(tx, 'mint_gears', { owner_id: owner, amount: String(amount), memo });
}

export async function mintCar(ownerId: string, model: string, rarity: Rarity) {
	await ensureNearAccount(ownerId);
	return db.transaction((tx) => mintCarIn(tx, ownerId, model, rarity));
}

/** Race winnings and other rewards. */
export async function grantGears(userId: string, amount: number, memo: string) {
	await ensureNearAccount(userId);
	await db.transaction((tx) => grantGearsIn(tx, userId, amount, memo));
}

/** Paint, decals, garage space. Throws if the user can't afford it. */
export async function spendGears(userId: string, amount: number, memo: string) {
	await db.transaction(async (tx) => {
		const [row] = await tx
			.update(users)
			.set({ gears: sql`${users.gears} - ${amount}` })
			.where(and(eq(users.id, userId), gte(users.gears, amount)))
			.returning({ id: users.id });
		if (!row) throw new Error('Not enough Gears');
		const owner = await nearIdOf(tx, userId);
		if (owner) await enqueue(tx, 'burn_gears', { owner_id: owner, amount: String(amount), memo });
	});
}

/** One Car Market sale: Gears buyer → seller, car seller → buyer, all or nothing. */
export async function tradeCar(carId: string, buyerId: string, price: number) {
	await ensureNearAccount(buyerId);
	return db.transaction(async (tx) => {
		const [car] = await tx.select().from(cars).where(eq(cars.id, carId)).for('update');
		if (!car) throw new Error('Car not found');
		if (car.stakedInRace) throw new Error('This car is staked in a race');
		if (car.ownerId === buyerId) throw new Error('You already own this car');
		const [paid] = await tx
			.update(users)
			.set({ gears: sql`${users.gears} - ${price}` })
			.where(and(eq(users.id, buyerId), gte(users.gears, price)))
			.returning({ id: users.id });
		if (!paid) throw new Error('Not enough Gears');
		await tx
			.update(users)
			.set({ gears: sql`${users.gears} + ${price}` })
			.where(eq(users.id, car.ownerId));
		await tx.update(cars).set({ ownerId: buyerId }).where(eq(cars.id, carId));
		const [seller, buyer] = [await nearIdOf(tx, car.ownerId), await nearIdOf(tx, buyerId)];
		if (seller && buyer) {
			await enqueue(tx, 'trade_car', {
				car_token_id: car.tokenId,
				seller_id: seller,
				buyer_id: buyer,
				price: String(price)
			});
		}
		return { ...car, ownerId: buyerId };
	});
}

// ── Car-for-car races ────────────────────────────────────────────────────────

/** Stakes one car per entrant. All cars must share a rarity. */
export async function openCarRace(raceId: string, entries: { userId: string; carId: string }[]) {
	if (entries.length < 2) throw new Error('A car race needs at least 2 entrants');
	for (const e of entries) await ensureNearAccount(e.userId);
	await db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(cars)
			.where(
				inArray(
					cars.id,
					entries.map((e) => e.carId)
				)
			)
			.for('update');
		if (rows.length !== entries.length) throw new Error('Car not found');
		const rarity = rows[0].rarity;
		const nearEntries: [string, string][] = [];
		for (const e of entries) {
			const car = rows.find((r) => r.id === e.carId)!;
			if (car.ownerId !== e.userId) throw new Error('You can only stake your own car');
			if (car.stakedInRace) throw new Error('Car is already staked in a race');
			if (car.rarity !== rarity) throw new Error('All cars in a car race must share a rarity');
			const owner = await nearIdOf(tx, e.userId);
			if (owner) nearEntries.push([owner, car.tokenId]);
		}
		await tx
			.update(cars)
			.set({ stakedInRace: raceId })
			.where(
				inArray(
					cars.id,
					entries.map((e) => e.carId)
				)
			);
		if (nearEntries.length === entries.length) {
			await enqueue(tx, 'open_car_race', { race_id: raceId, entries: nearEntries });
		}
	});
}

/** The winner takes every staked car; each car's race count goes up, the winner's own car gets the win. */
export async function settleCarRace(raceId: string, winnerId: string) {
	await db.transaction(async (tx) => {
		const staked = await tx.select().from(cars).where(eq(cars.stakedInRace, raceId)).for('update');
		if (staked.length === 0) throw new Error('No open car race with that id');
		const winnersCar = staked.find((c) => c.ownerId === winnerId);
		if (!winnersCar) throw new Error('Winner did not enter this race');
		for (const car of staked) {
			await tx
				.update(cars)
				.set({
					ownerId: winnerId,
					stakedInRace: null,
					races: sql`${cars.races} + 1`,
					wins: car.id === winnersCar.id ? sql`${cars.wins} + 1` : cars.wins
				})
				.where(eq(cars.id, car.id));
		}
		const winner = await nearIdOf(tx, winnerId);
		if (winner) await enqueue(tx, 'settle_car_race', { race_id: raceId, winner_id: winner });
	});
}

export async function cancelCarRace(raceId: string) {
	await db.transaction(async (tx) => {
		const released = await tx
			.update(cars)
			.set({ stakedInRace: null })
			.where(eq(cars.stakedInRace, raceId))
			.returning({ id: cars.id });
		if (released.length > 0) await enqueue(tx, 'cancel_car_race', { race_id: raceId });
	});
}

// ── Starter kit ──────────────────────────────────────────────────────────────

/**
 * First sign-in (or first bot run): a NEAR account, a free Common car and some
 * Gears. Bots start richer so the Car Market has stock on day one. Idempotent:
 * `starter_kit_at` is claimed atomically before anything is granted.
 */
export async function grantStarterKit(userId: string): Promise<boolean> {
	await ensureNearAccount(userId);
	return db.transaction(async (tx) => {
		const [claimed] = await tx
			.update(users)
			.set({ starterKitAt: new Date() })
			.where(and(eq(users.id, userId), isNull(users.starterKitAt)))
			.returning({ walletAddress: users.walletAddress });
		if (!claimed) return false;

		if (isBot(claimed)) {
			await mintCarIn(tx, userId, pick(STARTER_MODELS), 'Common');
			await mintCarIn(tx, userId, pick(STARTER_MODELS), 'Common');
			await mintCarIn(tx, userId, pick(STARTER_MODELS), 'Rare');
			await grantGearsIn(tx, userId, BOT_STARTER_GEARS, 'starter kit');
		} else {
			await mintCarIn(tx, userId, pick(STARTER_MODELS), 'Common');
			await grantGearsIn(tx, userId, PLAYER_STARTER_GEARS, 'starter kit');
		}
		return true;
	});
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getGarage(userId: string) {
	const [user] = await db
		.select({ gears: users.gears, nearAccountId: users.nearAccountId })
		.from(users)
		.where(eq(users.id, userId));
	if (!user) return null;
	const owned = await db
		.select()
		.from(cars)
		.where(eq(cars.ownerId, userId))
		.orderBy(asc(cars.createdAt));
	const cfg = nearConfig();
	return {
		gears: user.gears,
		cars: owned.map((c) => ({
			id: c.id,
			tokenId: c.tokenId,
			model: c.model,
			rarity: c.rarity,
			races: c.races,
			wins: c.wins,
			stakedInRace: c.stakedInRace
		})),
		near: cfg
			? {
					network: cfg.network,
					contractId: cfg.contractId,
					accountId: user.nearAccountId,
					accountUrl: user.nearAccountId ? explorerUrl(user.nearAccountId) : null,
					contractUrl: explorerUrl(cfg.contractId)
				}
			: null
	};
}

// ── Outbox ───────────────────────────────────────────────────────────────────

/**
 * Replays queued changes on the contract, oldest first. Stops at the first
 * failure so a later step never runs before an earlier one (a trade before
 * its mint). A row that keeps failing is parked after MAX_ATTEMPTS so it
 * can't block the queue forever; it stays visible for a manual retry.
 */
export async function flushOutbox(
	limit = 25
): Promise<{ sent: number; failed: number; pending: number }> {
	if (!nearConfig()) return { sent: 0, failed: 0, pending: 0 };
	const queue = await db
		.select()
		.from(nearOutbox)
		.where(
			and(inArray(nearOutbox.status, ['pending', 'failed']), lt(nearOutbox.attempts, MAX_ATTEMPTS))
		)
		.orderBy(asc(nearOutbox.createdAt))
		.limit(limit);

	let sent = 0;
	let failed = 0;
	for (const row of queue) {
		try {
			const txHash = await callContract(row.method, row.args as Record<string, unknown>);
			await db
				.update(nearOutbox)
				.set({
					status: 'done',
					txHash,
					doneAt: new Date(),
					attempts: row.attempts + 1,
					lastError: null
				})
				.where(eq(nearOutbox.id, row.id));
			sent++;
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			await db
				.update(nearOutbox)
				.set({ status: 'failed', attempts: row.attempts + 1, lastError: message.slice(0, 500) })
				.where(eq(nearOutbox.id, row.id));
			console.error(`[near] ${row.method} failed (attempt ${row.attempts + 1}):`, message);
			failed++;
			break;
		}
	}
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(nearOutbox)
		.where(inArray(nearOutbox.status, ['pending', 'failed']));
	return { sent, failed, pending: count };
}
