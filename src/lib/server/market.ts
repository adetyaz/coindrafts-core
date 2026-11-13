// Car Market: players and bots list cars for Gears; a sale moves the Gears and
// the car in one ledger trade (on the NEAR garage contract too). Prices and
// bot decisions come from $lib/economy/rules.ts.
import { and, desc, eq, gte, inArray, isNull, like, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { carListings, cars, users } from '$lib/server/schema';
import { tradeCar } from '$lib/server/cars';
import { personalityOf } from '$lib/bots/personalities';
import {
	RARITIES,
	botListing,
	botWouldBuy,
	fairPrice,
	isStale,
	trendPct,
	type BotWallet,
	type Rarity,
	type TierMarket
} from '$lib/economy/rules';

const DAY_MS = 24 * 60 * 60 * 1000;

export class MarketError extends Error {}

/** For-sale and sold-today counts per tier: the inputs every price is made from. */
export async function tierMarkets(): Promise<Record<Rarity, TierMarket>> {
	const since = new Date(Date.now() - DAY_MS);
	const rows = await db
		.select({
			rarity: cars.rarity,
			forSale: sql<number>`count(*) filter (where ${carListings.status} = 'open')::int`,
			sold: sql<number>`count(*) filter (where ${carListings.status} = 'sold' and ${carListings.closedAt} >= ${since})::int`
		})
		.from(carListings)
		.innerJoin(cars, eq(cars.id, carListings.carId))
		.groupBy(cars.rarity);
	const out = Object.fromEntries(
		RARITIES.map((r) => [r, { forSale: 0, soldLast24h: 0 }])
	) as Record<Rarity, TierMarket>;
	for (const r of rows) {
		if (r.rarity in out) out[r.rarity as Rarity] = { forSale: r.forSale, soldLast24h: r.sold };
	}
	return out;
}

export async function listCar(sellerId: string, carId: string, price: number, reason?: string) {
	if (!Number.isInteger(price) || price < 10)
		throw new MarketError('Price must be at least 10 Gears');
	const [car] = await db.select().from(cars).where(eq(cars.id, carId));
	if (!car || car.ownerId !== sellerId) throw new MarketError("That isn't your car");
	if (car.stakedInRace) throw new MarketError('That car is staked in a race');
	const [open] = await db
		.select({ id: carListings.id })
		.from(carListings)
		.where(and(eq(carListings.carId, carId), eq(carListings.status, 'open')));
	if (open) throw new MarketError('That car is already for sale');
	const [listing] = await db
		.insert(carListings)
		.values({ carId, sellerId, price, reason: reason ?? null })
		.returning();
	return listing;
}

export async function cancelListing(sellerId: string, listingId: string) {
	const [row] = await db
		.update(carListings)
		.set({ status: 'cancelled', closedAt: new Date() })
		.where(
			and(
				eq(carListings.id, listingId),
				eq(carListings.sellerId, sellerId),
				eq(carListings.status, 'open')
			)
		)
		.returning({ id: carListings.id });
	if (!row) throw new MarketError('Listing not found');
}

/**
 * Buys a listing. The listing is claimed first (open → sold, conditionally), so
 * two buyers clicking at once can't both get it; if the trade then fails
 * (not enough Gears), the claim is released.
 */
export async function buyListing(buyerId: string, listingId: string, buyReason?: string) {
	const [claimed] = await db
		.update(carListings)
		.set({ status: 'sold', buyerId, buyReason: buyReason ?? null, closedAt: new Date() })
		.where(and(eq(carListings.id, listingId), eq(carListings.status, 'open')))
		.returning();
	if (!claimed) throw new MarketError('That car has already been sold');

	try {
		if (claimed.sellerId === buyerId) throw new MarketError("You can't buy your own car");
		const [car] = await db.select().from(cars).where(eq(cars.id, claimed.carId));
		if (!car || car.ownerId !== claimed.sellerId) {
			throw new MarketError('The seller no longer owns that car');
		}
		await tradeCar(claimed.carId, buyerId, claimed.price);
		return claimed;
	} catch (e) {
		await db
			.update(carListings)
			.set({ status: 'open', buyerId: null, buyReason: null, closedAt: null })
			.where(eq(carListings.id, listingId));
		if (e instanceof MarketError) throw e;
		throw new MarketError(e instanceof Error ? e.message : 'Purchase failed');
	}
}

/** Everything the Car Market screen shows. */
export async function getMarket() {
	const markets = await tierMarkets();
	const tiers = RARITIES.map((rarity) => {
		const fair = fairPrice(rarity, markets[rarity]);
		return {
			rarity,
			price: fair.value,
			reason: fair.reason,
			trendPct: trendPct(rarity, fair.value),
			...markets[rarity]
		};
	});

	const listingRows = await db
		.select({
			id: carListings.id,
			price: carListings.price,
			reason: carListings.reason,
			createdAt: carListings.createdAt,
			carId: cars.id,
			tokenId: cars.tokenId,
			model: cars.model,
			rarity: cars.rarity,
			races: cars.races,
			wins: cars.wins,
			sellerId: users.id,
			seller: users.username,
			sellerWallet: users.walletAddress
		})
		.from(carListings)
		.innerJoin(cars, eq(cars.id, carListings.carId))
		.innerJoin(users, eq(users.id, carListings.sellerId))
		.where(eq(carListings.status, 'open'))
		.orderBy(desc(carListings.createdAt))
		.limit(60);

	const seller = alias(users, 'seller');
	const buyer = alias(users, 'buyer');
	const sales = await db
		.select({
			id: carListings.id,
			price: carListings.price,
			reason: carListings.reason,
			buyReason: carListings.buyReason,
			closedAt: carListings.closedAt,
			model: cars.model,
			rarity: cars.rarity,
			seller: seller.username,
			buyer: buyer.username
		})
		.from(carListings)
		.innerJoin(cars, eq(cars.id, carListings.carId))
		.innerJoin(seller, eq(seller.id, carListings.sellerId))
		.innerJoin(buyer, eq(buyer.id, carListings.buyerId))
		.where(eq(carListings.status, 'sold'))
		.orderBy(desc(carListings.closedAt))
		.limit(10);

	return {
		tiers,
		listings: listingRows.map(({ sellerWallet, ...l }) => ({
			...l,
			sellerIsBot: sellerWallet.startsWith('seed:')
		})),
		sales
	};
}

// ── Bots ─────────────────────────────────────────────────────────────────────

async function botWallets() {
	const bots = await db
		.select({ id: users.id, username: users.username, gears: users.gears })
		.from(users)
		.where(like(users.walletAddress, 'seed:%'));
	if (bots.length === 0) return [];
	const owned = await db
		.select({ id: cars.id, ownerId: cars.ownerId, rarity: cars.rarity, model: cars.model })
		.from(cars)
		.leftJoin(carListings, and(eq(carListings.carId, cars.id), eq(carListings.status, 'open')))
		.where(
			and(
				inArray(
					cars.ownerId,
					bots.map((b) => b.id)
				),
				isNull(cars.stakedInRace),
				isNull(carListings.id)
			)
		);
	return bots.map((b) => ({
		...b,
		wallet: {
			gears: b.gears,
			cars: owned
				.filter((c) => c.ownerId === b.id)
				.map((c) => ({ id: c.id, rarity: c.rarity as Rarity, model: c.model }))
		} satisfies BotWallet
	}));
}

/**
 * One round of bot trading: each bot may list a car, then each bot may buy one
 * listing (from a player or another bot). Every action records its reason.
 * Runs after races resolve and from the near-sync job.
 */
export async function runBotMarket(): Promise<string[]> {
	const log: string[] = [];
	const markets = await tierMarkets();

	// Stale bot listings come down first, so they re-list at today's price.
	const botOpen = await db
		.select({
			id: carListings.id,
			price: carListings.price,
			rarity: cars.rarity,
			seller: users.username
		})
		.from(carListings)
		.innerJoin(cars, eq(cars.id, carListings.carId))
		.innerJoin(users, eq(users.id, carListings.sellerId))
		.where(and(eq(carListings.status, 'open'), like(users.walletAddress, 'seed:%')));
	for (const l of botOpen) {
		const rarity = l.rarity as Rarity;
		const fair = fairPrice(rarity, markets[rarity]).value;
		// Judged against what this bot would normally ask, or a bot that always
		// asks over the odds would take its car down and re-list it every round.
		if (!isStale(l.price, fair * personalityOf(l.seller).trade.askMarkup)) continue;
		await db
			.update(carListings)
			.set({ status: 'cancelled', closedAt: new Date() })
			.where(and(eq(carListings.id, l.id), eq(carListings.status, 'open')));
		markets[rarity].forSale = Math.max(0, markets[rarity].forSale - 1);
		log.push(`${l.seller} took down its ${rarity} at ${l.price}: the going rate fell to ${fair}`);
	}

	// One query for who already has a car up, instead of one per bot.
	const sellingNow = new Set(
		(
			await db
				.select({ sellerId: carListings.sellerId })
				.from(carListings)
				.where(eq(carListings.status, 'open'))
		).map((r) => r.sellerId)
	);
	for (const bot of await botWallets()) {
		if (sellingNow.has(bot.id)) continue;
		const decision = botListing(bot.wallet, markets, personalityOf(bot.username).trade);
		if (!decision.value) continue;
		try {
			await listCar(bot.id, decision.value.carId, decision.value.price, decision.reason);
			// The next bot prices against a market that includes this listing.
			const listed = bot.wallet.cars.find((c) => c.id === decision.value!.carId);
			if (listed) markets[listed.rarity].forSale++;
			log.push(`${bot.username} listed a car for ${decision.value.price}: ${decision.reason}`);
		} catch (e) {
			log.push(`${bot.username} couldn't list: ${(e as Error).message}`);
		}
	}

	const open = await db
		.select({
			id: carListings.id,
			price: carListings.price,
			sellerId: carListings.sellerId,
			rarity: cars.rarity,
			createdAt: carListings.createdAt
		})
		.from(carListings)
		.innerJoin(cars, eq(cars.id, carListings.carId))
		.where(
			and(
				eq(carListings.status, 'open'),
				gte(carListings.createdAt, new Date(Date.now() - 7 * DAY_MS))
			)
		)
		.orderBy(carListings.price);

	const wallets = (await botWallets()).sort(() => Math.random() - 0.5);
	const taken = new Set<string>();
	for (const bot of wallets) {
		for (const listing of open) {
			if (taken.has(listing.id) || listing.sellerId === bot.id) continue;
			const rarity = listing.rarity as Rarity;
			const decision = botWouldBuy(
				bot.wallet,
				{ price: listing.price, rarity },
				markets[rarity],
				personalityOf(bot.username).trade
			);
			if (!decision.value) continue;
			try {
				await buyListing(bot.id, listing.id, decision.reason);
				taken.add(listing.id);
				log.push(`${bot.username} bought a ${rarity} for ${listing.price}: ${decision.reason}`);
			} catch (e) {
				log.push(`${bot.username} couldn't buy: ${(e as Error).message}`);
			}
			break; // one purchase per bot per round
		}
	}
	return log;
}
