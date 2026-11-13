// Nitro and pit-stop items: who owns what, the weekly cap, and locking one
// into a race. Rules and effects live in $lib/race/items (client-safe).
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { itemUses, lineups, users } from '$lib/server/schema';
import { spendGears } from '$lib/server/cars';
import {
	ITEMS,
	ITEM_KINDS,
	WEEKLY_ITEM_CAP,
	itemWeekStart,
	type Inventory,
	type ItemKind,
	type LineupItem
} from '$lib/race/items';

export class ItemError extends Error {}

function countOf(kind: ItemKind) {
	return sql`coalesce((${users.items} ->> ${kind})::int, 0)`;
}

function addTo(kind: ItemKind, n: number) {
	return sql`jsonb_set(coalesce(${users.items}, '{}'::jsonb), ${`{${kind}}`}::text[], to_jsonb(${countOf(kind)} + ${n}))`;
}

export async function usesThisWeek(userId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(itemUses)
		.where(and(eq(itemUses.userId, userId), gte(itemUses.at, itemWeekStart())));
	return row?.n ?? 0;
}

export async function getInventory(userId: string) {
	const [u] = await db.select({ items: users.items }).from(users).where(eq(users.id, userId));
	const owned: Inventory = {};
	for (const k of ITEM_KINDS) owned[k] = Number(u?.items?.[k] ?? 0);
	const used = await usesThisWeek(userId);
	return { owned, usedThisWeek: used, weeklyCap: WEEKLY_ITEM_CAP };
}

export async function grantItem(userId: string, kind: ItemKind, n = 1) {
	await db
		.update(users)
		.set({ items: addTo(kind, n) })
		.where(eq(users.id, userId));
}

/** Showroom: buy an item for Gears (burned). The weekly cap limits use, not buying. */
export async function buyItem(userId: string, kind: ItemKind) {
	try {
		await spendGears(userId, ITEMS[kind].price, `item: ${kind}`);
	} catch {
		throw new ItemError('Not enough Gears');
	}
	await grantItem(userId, kind);
}

/**
 * Locks an item into a lineup at lock time. Idempotent per race: re-locking
 * an open lineup keeps the item already used (and charged) for this contest.
 * Returns the item now on the lineup, or null.
 */
export async function lockItem(
	userId: string,
	contestId: string,
	lineupId: string,
	item: LineupItem | null
): Promise<LineupItem | null> {
	const [already] = await db
		.select({ item: lineups.item })
		.from(lineups)
		.innerJoin(itemUses, and(eq(itemUses.contestId, contestId), eq(itemUses.userId, userId)))
		.where(eq(lineups.id, lineupId))
		.limit(1);
	if (already) return already.item ?? null;
	if (!item) return null;

	if ((await usesThisWeek(userId)) >= WEEKLY_ITEM_CAP) {
		throw new ItemError(`You've used ${WEEKLY_ITEM_CAP} items this week. More on Monday.`);
	}
	const [took] = await db
		.update(users)
		.set({ items: addTo(item.kind, -1) })
		.where(and(eq(users.id, userId), sql`${countOf(item.kind)} >= 1`))
		.returning({ id: users.id });
	if (!took) throw new ItemError(`You don't have a ${ITEMS[item.kind].label}`);
	await db.insert(itemUses).values({ userId, kind: item.kind, contestId });
	await db.update(lineups).set({ item }).where(eq(lineups.id, lineupId));
	return item;
}
