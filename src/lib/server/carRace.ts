// Car races for players (GAMEPLAY_FLOWS.md, F3): stake a car, race an opponent
// with a car of the same rarity, winner takes both. The cars are held by the
// garage contract during the race (openCarRace → settleCarRace).
//
// A car race is an ordinary 1v1 contest whose id is also the car race id:
// cars.staked_in_race = contests.id while it runs, and car_events.race_id
// records who won what afterwards. No separate table, so resolution, the race
// screen and the cron all work as they do for any contest.
//
// Opponent: a bot with a same-rarity car. Matching against a waiting player
// is the matchmaking queue's job and comes later; bots already race for cars
// in Simulate a week.
import { and, eq, isNull, like, lt, notExists, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { carEvents, carListings, cars, contests, users } from '$lib/server/schema';
import { cancelCarRace, openCarRace } from '$lib/server/cars';
import { normalizeDuration } from '$lib/constants';

export class CarRaceError extends Error {}

/** An unstarted car race is called off after this, so cars don't sit staked forever. */
const ABANDON_AFTER_MS = 60 * 60 * 1000;

/** The free car a player got on sign-up can never be staked (F3). */
async function isOwnStarter(userId: string, carId: string) {
	const [row] = await db
		.select({ id: carEvents.id })
		.from(carEvents)
		.where(
			and(eq(carEvents.carId, carId), eq(carEvents.kind, 'starter'), eq(carEvents.toUserId, userId))
		)
		.limit(1);
	return Boolean(row);
}

const noOpenListing = notExists(
	db
		.select({ id: carListings.id })
		.from(carListings)
		.where(and(eq(carListings.carId, cars.id), eq(carListings.status, 'open')))
);

/** Why a car can't be staked, or null if it can. */
export async function stakeBlocker(userId: string, carId: string): Promise<string | null> {
	const [car] = await db
		.select({ ownerId: cars.ownerId, stakedInRace: cars.stakedInRace })
		.from(cars)
		.where(and(eq(cars.id, carId), noOpenListing));
	if (!car) return 'That car is for sale. Take it off sale first.';
	if (car.ownerId !== userId) return "That isn't your car";
	if (car.stakedInRace) return 'That car is already in a car race';
	if (await isOwnStarter(userId, carId)) return "Your starter car can't be staked";
	return null;
}

/**
 * Creates the contest, finds a bot with a same-rarity car and stakes both cars.
 * The player then goes through the normal flow from the Track step.
 */
export async function startCarRace(userId: string, carId: string, durationMinutes: number) {
	const blocker = await stakeBlocker(userId, carId);
	if (blocker) throw new CarRaceError(blocker);
	const [mine] = await db.select({ rarity: cars.rarity }).from(cars).where(eq(cars.id, carId));

	const [opponent] = await db
		.select({ carId: cars.id, botId: users.id, username: users.username })
		.from(cars)
		.innerJoin(users, eq(users.id, cars.ownerId))
		.where(
			and(
				eq(cars.rarity, mine.rarity),
				isNull(cars.stakedInRace),
				like(users.walletAddress, 'seed:%'),
				noOpenListing
			)
		)
		.orderBy(sql`random()`)
		.limit(1);
	if (!opponent) {
		throw new CarRaceError(`No one has a ${mine.rarity} car free to race right now. Try later.`);
	}

	const [contest] = await db
		.insert(contests)
		.values({
			userAId: userId,
			userBId: opponent.botId,
			type: 'daily',
			isPaper: false,
			durationMinutes: normalizeDuration(durationMinutes),
			status: 'open'
		})
		.returning();
	try {
		await openCarRace(contest.id, [
			{ userId, carId },
			{ userId: opponent.botId, carId: opponent.carId }
		]);
	} catch (e) {
		await db.delete(contests).where(eq(contests.id, contest.id));
		throw new CarRaceError(e instanceof Error ? e.message : "Couldn't stake the cars");
	}
	return { contest, opponent: opponent.username };
}

/** The cars staked in a contest (empty if it isn't a car race, or is settled). */
export async function stakedCars(contestId: string) {
	return db
		.select({ id: cars.id, ownerId: cars.ownerId, model: cars.model, rarity: cars.rarity })
		.from(cars)
		.where(eq(cars.stakedInRace, contestId));
}

/** After settlement: which cars changed hands in this race. */
export async function carRaceOutcome(contestId: string) {
	return db
		.select({
			carId: carEvents.carId,
			model: cars.model,
			rarity: cars.rarity,
			fromUserId: carEvents.fromUserId,
			toUserId: carEvents.toUserId
		})
		.from(carEvents)
		.innerJoin(cars, eq(cars.id, carEvents.carId))
		.where(and(eq(carEvents.kind, 'race_won'), eq(carEvents.raceId, contestId)));
}

/**
 * Calls off car races that never started (nobody locked a lineup within the
 * hour): the cars go back to their garages. Run from the cron sweep.
 */
export async function cancelAbandonedCarRaces(now = new Date()) {
	// Staking writes a 'staked' car event, which dates the race (contests has
	// no created_at). Abandoned = still open and staked over an hour ago.
	const stale = await db
		.selectDistinct({ id: contests.id })
		.from(carEvents)
		.innerJoin(cars, eq(cars.stakedInRace, carEvents.raceId))
		.innerJoin(contests, sql`${contests.id}::text = ${carEvents.raceId}`)
		.where(
			and(
				eq(carEvents.kind, 'staked'),
				eq(contests.status, 'open'),
				lt(carEvents.at, new Date(now.getTime() - ABANDON_AFTER_MS))
			)
		);
	for (const c of stale) {
		await cancelCarRace(c.id);
		await db.update(contests).set({ status: 'cancelled' }).where(eq(contests.id, c.id));
	}
	return stale.length;
}
