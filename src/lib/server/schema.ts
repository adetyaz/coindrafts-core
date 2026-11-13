import {
	pgTable,
	uuid,
	text,
	integer,
	numeric,
	boolean,
	timestamp,
	jsonb,
	date,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
// Relative, type-only: drizzle-kit loads this file without SvelteKit's aliases.
import type { LineupItem } from '../race/items';

// ─── Users (Wallet-based) ────────────────────────────────────────────────────

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	walletAddress: text('wallet_address').unique().notNull(), // primary identity
	chainType: text('chain_type').notNull(), // 'evm' | 'solana'
	username: text('username').unique().notNull(), // auto-generated, user can update
	xpTotal: integer('xp_total').default(0),
	paperXpTotal: integer('paper_xp_total').default(0), // practice-mode XP, tracked separately from real XP
	streak: integer('streak').default(0),
	matchmakingStatus: text('matchmaking_status').default('idle'), // 'idle' | 'queued' | 'in_contest'
	activeBoosts: jsonb('active_boosts').default('[]'), // [{ sector, expiresAt }]
	createdAt: timestamp('created_at').defaultNow(),
	// Learning/visiting streak — separate from `streak` above (which is
	// win-only, see F-08). Increments once per day on a research-article read
	// or a Term of the Day attempt, whichever comes first that day.
	researchStreak: integer('research_streak').default(0),
	lastResearchDate: date('last_research_date'),
	// AI Draft Agent (G-06) / Free Hit (X-11) — waiver mechanic only; nothing
	// grants one yet, X-11's earn-path is still an open, separate question.
	freeHitsAvailable: integer('free_hits_available').default(0),
	// NEAR account that owns this user's cars and Gears in the garage contract.
	// Players get an implicit account (64-hex, no on-chain creation needed);
	// bots get a named sub-account of the operator. Null until onboarded.
	nearAccountId: text('near_account_id').unique(),
	// Player's implicit-account private key, AES-256-GCM encrypted. The game
	// never needs it (the operator moves tokens), but keeping it means a player
	// can later take full custody. Null for bots.
	nearKeyCipher: text('near_key_cipher'),
	// In-game currency. Postgres is the read model; the contract is the record
	// when CAR_LEDGER=near.
	gears: integer('gears').default(0).notNull(),
	starterKitAt: timestamp('starter_kit_at'),
	// The car the race flow pre-selects (the one you raced last).
	lastCarId: uuid('last_car_id'),
	// Nitro and pit-stop items owned: { nitro, turbo, spare, shield } counts.
	items: jsonb('items').$type<Partial<Record<string, number>>>(),
	// Daily trivia: consecutive days passed, and the last day passed (UTC).
	triviaStreak: integer('trivia_streak').default(0).notNull(),
	triviaLastPass: date('trivia_last_pass'),
	// Me (GAMEPLAY_FLOWS.md, F6): the car and up to 3 badges shown on your card,
	// and your settings.
	showcaseCarId: uuid('showcase_car_id'),
	// Contact email, asked for at onboarding (pre-filled from the email/Google
	// login when Reown shares it). Self-reported, never verified by us: it's for
	// contact and notifications, and must never grant access to anything.
	email: text('email'),
	showcaseBadges: jsonb('showcase_badges').$type<string[]>(),
	settings: jsonb('settings').$type<
		{
			botChat?: 'on' | 'quiet' | 'off';
			reducedMotion?: boolean;
		} & import('../notifications').NotifySettings
	>()
});

// Sponsors and track ads (GAMEPLAY_FLOWS.md, F12, $lib/sponsors).
export const sponsors = pgTable('sponsors', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.references(() => users.id)
		.notNull()
		.unique(),
	name: text('name').notNull(),
	contactEmail: text('contact_email').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const sponsorBookings = pgTable('sponsor_bookings', {
	id: uuid('id').primaryKey().defaultRandom(),
	sponsorId: uuid('sponsor_id')
		.references(() => sponsors.id)
		.notNull(),
	kind: text('kind').notNull(), // 'ad' | 'tournament'
	status: text('status').default('awaiting_payment').notNull(), // see BookingStatus
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	// Ads
	circuit: text('circuit'),
	slot: text('slot'), // 'billboard' | 'banner' | 'arch'
	artwork: text('artwork'), // data: URL, small (MAX_ARTWORK_BYTES)
	// Tournaments
	title: text('title'),
	prize: text('prize'), // what the sponsor puts up, in words
	livery: text('livery'), // a colour the cars race in
	tournamentId: uuid('tournament_id').references(() => tournaments.id),
	priceCents: integer('price_cents').notNull(),
	views: integer('views').default(0).notNull(),
	note: text('note'), // the operator's note on approval or rejection
	createdAt: timestamp('created_at').defaultNow().notNull(),
	paidAt: timestamp('paid_at'),
	decidedAt: timestamp('decided_at')
});

// A browser that agreed to notifications (Web Push). One player can have several.
export const pushSubscriptions = pgTable('push_subscriptions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.references(() => users.id)
		.notNull(),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// One row per bot day the daily job played (GAMEPLAY_FLOWS.md, F10). The row
// is also the claim, so a retried cron can't play the same day twice.
export const botDays = pgTable('bot_days', {
	day: date('day').primaryKey(),
	summary: jsonb('summary'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// A Versus invite from a player card (F6): race me, on these terms.
export const challenges = pgTable('challenges', {
	id: uuid('id').primaryKey().defaultRandom(),
	fromUserId: uuid('from_user_id')
		.references(() => users.id)
		.notNull(),
	toUserId: uuid('to_user_id')
		.references(() => users.id)
		.notNull(),
	durationMinutes: integer('duration_minutes').default(15).notNull(),
	message: text('message'),
	status: text('status').default('pending').notNull(), // 'pending' | 'accepted' | 'declined' | 'expired'
	contestId: uuid('contest_id'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	respondedAt: timestamp('responded_at')
});

// ─── Cars ─────────────────────────────────────────────────────────────────────
// Cosmetic, owned assets. Mirrors the NEP-245 garage contract when
// CAR_LEDGER=near; is the only record when CAR_LEDGER=db.

export const cars = pgTable('cars', {
	id: uuid('id').primaryKey().defaultRandom(),
	tokenId: text('token_id').unique().notNull(), // `car:<id>`, same as on-chain
	ownerId: uuid('owner_id')
		.references(() => users.id)
		.notNull(),
	model: text('model').notNull(),
	rarity: text('rarity').notNull(), // 'Common' | 'Rare' | 'Epic' | 'Legendary'
	races: integer('races').default(0).notNull(),
	wins: integer('wins').default(0).notNull(),
	// Set while the car is staked in an open car-for-car race.
	stakedInRace: text('staked_in_race'),
	// Paint, decal, number plate (Garage → Customise). Cosmetic only.
	look: jsonb('look').$type<{ paint?: string; decal?: string; plate?: string }>(),
	createdAt: timestamp('created_at').defaultNow()
});

// Every way a car changes hands, for Garage → car history (GAMEPLAY_FLOWS.md,
// F3). Written in the same transaction as the move itself.
export const carEvents = pgTable('car_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	carId: uuid('car_id')
		.references(() => cars.id)
		.notNull(),
	// 'starter' | 'showroom' | 'market' | 'sell_now' | 'race_won'
	kind: text('kind').notNull(),
	fromUserId: uuid('from_user_id').references(() => users.id),
	toUserId: uuid('to_user_id')
		.references(() => users.id)
		.notNull(),
	price: integer('price'), // Gears, for sales
	raceId: text('race_id'),
	at: timestamp('at').defaultNow().notNull()
});

// ─── Car Market ───────────────────────────────────────────────────────────────
// A car for sale, by a player or a bot. A sale moves Gears and the car in one
// ledger trade (cars/ledger.ts → tradeCar), on chain too when CAR_LEDGER=near.

export const carListings = pgTable('car_listings', {
	id: uuid('id').primaryKey().defaultRandom(),
	carId: uuid('car_id')
		.references(() => cars.id)
		.notNull(),
	sellerId: uuid('seller_id')
		.references(() => users.id)
		.notNull(),
	price: integer('price').notNull(), // Gears
	// The one-line "why" behind a bot's listing price, shown as a tooltip.
	reason: text('reason'),
	status: text('status').default('open').notNull(), // 'open' | 'sold' | 'cancelled'
	buyerId: uuid('buyer_id').references(() => users.id),
	// The buyer's reason, when the buyer is a bot.
	buyReason: text('buy_reason'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	closedAt: timestamp('closed_at')
});

// ─── NEAR outbox ──────────────────────────────────────────────────────────────
// Every on-chain write goes through here, in order. The game updates Postgres
// first and never waits on the chain to stay playable; this queue replays the
// same change on the contract and survives a failed or slow RPC. Processed
// oldest-first and stops at the first failure, because order matters (a car
// must be minted before it can be traded).

export const nearOutbox = pgTable('near_outbox', {
	id: uuid('id').primaryKey().defaultRandom(),
	method: text('method').notNull(), // contract method, e.g. 'mint_car'
	args: jsonb('args').notNull(),
	status: text('status').default('pending').notNull(), // 'pending' | 'done' | 'failed'
	attempts: integer('attempts').default(0).notNull(),
	lastError: text('last_error'),
	txHash: text('tx_hash'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	doneAt: timestamp('done_at')
});

// ─── Contests ─────────────────────────────────────────────────────────────────
// One contest = one head-to-head match between two users
// user_a = the human, user_b = bot (Wave 1) or real opponent (Wave 2)

export const contests = pgTable('contests', {
	id: uuid('id').primaryKey().defaultRandom(),
	userAId: uuid('user_a_id').references(() => users.id),
	userBId: uuid('user_b_id').references(() => users.id),
	type: text('type').default('daily'), // 'daily' | 'weekly' — kept for XP multiplier + labelling
	status: text('status').default('open'), // 'open' | 'live' | 'resolved'
	isPaper: boolean('is_paper').default(false), // practice mode — bot-only, no real XP/streak/badges/league impact
	// Real chosen game length. Duration used to be derived from `type` (1 or 7
	// days, hardcoded at lock time), which made short games impossible. It's now
	// picked before matching and matched on. Default 1440 = 24h, so every
	// existing contest keeps exactly the behaviour it had.
	durationMinutes: integer('duration_minutes').default(1440),
	startAt: timestamp('start_at'),
	endAt: timestamp('end_at'),
	winnerId: uuid('winner_id').references(() => users.id),
	// Real circuit id from $lib/race/circuits. Cosmetic only. Null on races from
	// before circuits existed (they fall back to a circuit picked from the id).
	circuit: text('circuit'),
	// Race mode: null = a normal draft race; 'binary' / 'binary_solo' = call coins
	// up or down (GAMEPLAY_FLOWS.md, F9, $lib/race/binary).
	mode: text('mode')
});

// ─── Lineups ──────────────────────────────────────────────────────────────────
// Each contest has two lineups — one per player

export const lineups = pgTable('lineups', {
	id: uuid('id').primaryKey().defaultRandom(),
	contestId: uuid('contest_id').references(() => contests.id),
	lobbyId: uuid('lobby_id').references(() => lobbies.id), // exactly one of contestId/lobbyId is set
	userId: uuid('user_id').references(() => users.id),
	locked: boolean('locked').default(false),
	finalScore: numeric('final_score').default('0'),
	breakdown: text('breakdown'), // pre-generated AI text (for seeded contests)
	// The car this player raced with. Cosmetic only.
	carId: uuid('car_id'),
	// The nitro or pit-stop item locked in for this race ($lib/race/items).
	item: jsonb('item').$type<LineupItem>()
});

// One row per race an item was used in: the weekly cap counts these.
export const itemUses = pgTable('item_uses', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.references(() => users.id)
		.notNull(),
	kind: text('kind').notNull(),
	contestId: uuid('contest_id')
		.references(() => contests.id)
		.notNull(),
	at: timestamp('at').defaultNow().notNull()
});

// Daily trivia (GAMEPLAY_FLOWS.md, F7): one set of 8 questions per UTC day,
// answers included, so every player gets the same set and scoring is stable.
export const triviaDays = pgTable('trivia_days', {
	day: date('day').primaryKey(),
	// [{ question, options: [{ label, value }], answer, kind }]
	questions: jsonb('questions').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// One run per player per day. Answers are taken one at a time, in order.
export const triviaRuns = pgTable(
	'trivia_runs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.references(() => users.id)
			.notNull(),
		day: date('day').notNull(),
		// [{ answer, correct }] in question order
		answers: jsonb('answers').$type<{ answer: string | null; correct: boolean }[]>(),
		score: integer('score'),
		passed: boolean('passed'),
		// What the run paid out, for the result screen.
		rewards: jsonb('rewards').$type<{ xp: number; items: string[]; streak: number }>(),
		startedAt: timestamp('started_at').defaultNow().notNull(),
		finishedAt: timestamp('finished_at')
	},
	(t) => [uniqueIndex('trivia_runs_user_day_idx').on(t.userId, t.day)]
);

// ─── Lineup Picks ─────────────────────────────────────────────────────────────
// 5 rows per lineup — one per draft slot

export const lineupPicks = pgTable('lineup_picks', {
	id: uuid('id').primaryKey().defaultRandom(),
	lineupId: uuid('lineup_id').references(() => lineups.id),
	tokenSymbol: text('token_symbol').notNull(), // 'SOL', 'PEPE'
	tokenName: text('token_name').notNull(), // 'Solana', 'Pepe'
	sector: text('sector').notNull(), // 'L1' | 'L2' | 'Meme' | 'DeFi' | 'Wildcard'
	currencyId: text('currency_id').notNull(), // SoSoValue currency_id (string of long int)
	entryPrice: numeric('entry_price'), // price at lineup lock time
	exitPrice: numeric('exit_price'), // price at contest resolution
	pctChange: numeric('pct_change'), // ((exit - entry) / entry) * 100
	score: numeric('score').default('0'), // weighted score for this pick
	// Binary mode: the call on this coin, 'up' or 'down'. Null in a draft race.
	call: text('call')
});

// ─── Lobbies ──────────────────────────────────────────────────────────────────
// A lobby is a multiplayer (3+) contest, parallel to the 2-player `contests`
// table above rather than a generalization of it — see plan doc for why.

export const lobbies = pgTable('lobbies', {
	id: uuid('id').primaryKey().defaultRandom(),
	createdBy: uuid('created_by').references(() => users.id),
	contestType: text('contest_type').default('daily'), // 'daily' | 'weekly'
	format: text('format').notNull(), // 'fixed' | 'open'
	size: integer('size'), // required for 'fixed', optional cap for 'open'
	status: text('status').default('waiting'), // 'waiting' | 'drafting' | 'live' | 'resolved'
	startAt: timestamp('start_at'),
	endAt: timestamp('end_at'),
	winnerId: uuid('winner_id').references(() => users.id), // 1st place
	createdAt: timestamp('created_at').defaultNow(),
	// Set when this lobby is one bracket stage of a Tournament rather than a
	// standalone lobby — null for every ordinary lobby.
	tournamentId: uuid('tournament_id').references(() => tournaments.id),
	tournamentStage: integer('tournament_stage'), // 0 = qualifier group, 1 = final
	// Race length, circuit and the draft deadline (tournament groups and finals).
	// A player who hasn't drafted by draftClosesAt races an auto-drafted lineup.
	durationMinutes: integer('duration_minutes'),
	circuit: text('circuit'),
	draftClosesAt: timestamp('draft_closes_at'),
	// Set when this lobby is one grid of a league night.
	leagueNightId: uuid('league_night_id')
});

// ─── Tournaments ──────────────────────────────────────────────────────────────
// The umbrella over a bracket of lobbies (see tournamentId/tournamentStage
// above). Public + free-to-play only for now — private/sponsor access and
// real-money funding share the same escrow mechanic Wager Mode is blocked
// on, deliberately not built here yet (see mode5-tournament-checklist.md).

export const tournaments = pgTable('tournaments', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	createdBy: uuid('created_by').references(() => users.id),
	contestType: text('contest_type').default('daily'), // 'daily' | 'weekly'
	accessType: text('access_type').default('public'), // 'public' | 'private' — invite-only via tournamentInvites
	fundingMode: text('funding_mode').default('free'), // 'free' only, for now
	payoutStructure: text('payout_structure').default('winner_take_all'), // 'winner_take_all' | 'top3_weighted'
	sectorRestriction: text('sector_restriction'), // 'l1'|'l2'|'defi'|'meme'|'wildcard', null = unrestricted
	groupSize: integer('group_size').default(4), // participants per qualifier group
	// Minimum total participants for the tournament to be viable. At
	// registrationClosesAt this single number decides which of the two very
	// different closes happens — start, or cancel.
	minPlayers: integer('min_players').default(2),
	// When joining stops. The same instant is either the start or the death of
	// the tournament, depending on minPlayers — see the "Two different closes"
	// section in mode5-tournament-checklist.md.
	registrationClosesAt: timestamp('registration_closes_at'),
	// 'cancelled' is a real terminal state, distinct from 'resolved': the
	// tournament never ran and nobody won. Without it a dead tournament would
	// either sit in 'open' forever (still listed, still joinable) or be faked as
	// 'resolved' (implying a winner). Once funding exists, this is also the
	// branch that must refund every stake.
	status: text('status').default('open'), // 'open' | 'active' | 'resolved' | 'cancelled'
	// Auto-created tournaments keep the public list populated. They cancel
	// silently when nobody joins, which is the expected path, not a failure —
	// so they're flagged to keep that noise out of user-facing notifications.
	isAutoCreated: boolean('is_auto_created').default(false),
	createdAt: timestamp('created_at').defaultNow(),
	// GAMEPLAY_FLOWS.md, F4.
	durationMinutes: integer('duration_minutes').default(15),
	groupTrack: text('group_track'),
	finalTrack: text('final_track'),
	// Gears from the game for the best-placed humans: [1st, 2nd, 3rd].
	prizes: jsonb('prizes').$type<number[]>(),
	// Optional entry fee in Gears; the pot goes to the top 3 humans (50/30/20).
	entryFee: integer('entry_fee').default(0).notNull(),
	// Scheduled cups the game runs itself ('daily-monza', 'weekend-spa'); null for player-made.
	cup: text('cup'),
	// A car for the winner (its rarity), e.g. the Weekend Spa Classic.
	carPrize: text('car_prize'),
	drawnAt: timestamp('drawn_at'),
	// Final standings and what each human won, written once at the end.
	results:
		jsonb('results').$type<
			{ userId: string; username: string; place: number; gears: number; car?: string }[]
		>()
});

// Who registered for a tournament, and where the draw put them.
export const tournamentEntries = pgTable(
	'tournament_entries',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tournamentId: uuid('tournament_id')
			.references(() => tournaments.id)
			.notNull(),
		userId: uuid('user_id')
			.references(() => users.id)
			.notNull(),
		feePaid: integer('fee_paid').default(0).notNull(),
		pot: integer('pot'), // 1 = strongest, by XP at the draw
		groupNo: integer('group_no'),
		joinedAt: timestamp('joined_at').defaultNow().notNull()
	},
	(t) => [uniqueIndex('tournament_entries_unique_idx').on(t.tournamentId, t.userId)]
);

// ─── Tournament Invites ───────────────────────────────────────────────────────
// How a private tournament is joined — it isn't listed publicly, so an invite is
// the only way in.
//
// The token is the invite. Email is a *delivery mechanism* for that token, not
// the mechanism itself: an invite works as a shareable link whether or not mail
// is configured, which means the feature doesn't depend on SMTP being set up and
// a bounced email never costs someone their place.

export const tournamentInvites = pgTable('tournament_invites', {
	id: uuid('id').primaryKey().defaultRandom(),
	tournamentId: uuid('tournament_id').references(() => tournaments.id),
	// Unguessable — this is the credential that grants access.
	token: text('token').notNull().unique(),
	// Null for a plain shareable link. Set when addressed to someone specific.
	email: text('email'),
	invitedBy: uuid('invited_by').references(() => users.id),
	// Who actually used it. An invite is single-use once claimed, so a link
	// forwarded on can't quietly admit a crowd.
	acceptedBy: uuid('accepted_by').references(() => users.id),
	acceptedAt: timestamp('accepted_at'),
	emailSentAt: timestamp('email_sent_at'),
	createdAt: timestamp('created_at').defaultNow()
});

// ─── Lobby Participants ───────────────────────────────────────────────────────

export const lobbyParticipants = pgTable('lobby_participants', {
	id: uuid('id').primaryKey().defaultRandom(),
	lobbyId: uuid('lobby_id').references(() => lobbies.id),
	userId: uuid('user_id').references(() => users.id),
	rank: integer('rank'), // set at resolution: 1 = winner, 2 = 2nd, etc.
	xpEarned: integer('xp_earned'),
	joinedAt: timestamp('joined_at').defaultNow()
});

// ─── Lobby Queue ──────────────────────────────────────────────────────────────
// Fixed-size auto-match queue, mirrors matchmakingQueue's shape

export const lobbyQueue = pgTable('lobby_queue', {
	userId: uuid('user_id')
		.primaryKey()
		.references(() => users.id),
	size: integer('size').notNull(),
	contestType: text('contest_type').notNull(),
	queuedAt: timestamp('queued_at').defaultNow().notNull()
});

// ─── Leagues ──────────────────────────────────────────────────────────────────

export const leagues = pgTable('leagues', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	type: text('type').notNull(), // 'public' | 'private'
	inviteCode: text('invite_code').unique(),
	createdBy: uuid('created_by').references(() => users.id),
	seasonStart: timestamp('season_start'),
	seasonEnd: timestamp('season_end'),
	createdAt: timestamp('created_at').defaultNow(),
	// GAMEPLAY_FLOWS.md, F5. League night: weekly, on the home track.
	homeTrack: text('home_track'),
	nightDay: integer('night_day').default(5).notNull(), // 0 = Sunday … 6 = Saturday (UTC)
	nightHour: integer('night_hour').default(19).notNull(), // lights out, UTC
	nightMinutes: integer('night_minutes').default(15).notNull(), // race length
	// The month (YYYY-MM, UTC) the current standings belong to; rolls monthly.
	seasonMonth: text('season_month'),
	seasonPrize: integer('season_prize').default(1000).notNull()
});

// One row per league per week: the night ran, or was skipped (with why).
export const leagueNights = pgTable(
	'league_nights',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		leagueId: uuid('league_id')
			.references(() => leagues.id)
			.notNull(),
		night: date('night').notNull(),
		status: text('status').notNull(), // 'racing' | 'done' | 'skipped'
		note: text('note'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [uniqueIndex('league_nights_unique_idx').on(t.leagueId, t.night)]
);

// Past seasons: who won, and what they got.
export const leagueSeasons = pgTable(
	'league_seasons',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		leagueId: uuid('league_id')
			.references(() => leagues.id)
			.notNull(),
		month: text('month').notNull(),
		winnerId: uuid('winner_id').references(() => users.id),
		points: integer('points').default(0).notNull(),
		prize: integer('prize').default(0).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [uniqueIndex('league_seasons_unique_idx').on(t.leagueId, t.month)]
);

// ─── League Members ───────────────────────────────────────────────────────────

export const leagueMembers = pgTable('league_members', {
	id: uuid('id').primaryKey().defaultRandom(),
	leagueId: uuid('league_id').references(() => leagues.id),
	userId: uuid('user_id').references(() => users.id),
	wins: integer('wins').default(0),
	losses: integer('losses').default(0),
	points: integer('points').default(0),
	joinedAt: timestamp('joined_at').defaultNow()
});

// ─── Gauntlet Questions ───────────────────────────────────────────────────────

export const gauntletQuestions = pgTable('gauntlet_questions', {
	id: uuid('id').primaryKey().defaultRandom(),
	question: text('question').notNull(),
	options: jsonb('options').notNull(), // [{ label, value }]
	correctAnswer: text('correct_answer').notNull(),
	sector: text('sector'), // which sector this relates to
	currencyId: text('currency_id'), // SoSoValue currency_id if token-specific
	xpReward: integer('xp_reward').default(50),
	boostSector: text('boost_sector'), // which draft slot gets boosted on correct answer
	activeDate: date('active_date').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	// 'market' (live price/sector data) | 'vocab' (a crypto term + definition
	// check) — merges what used to be two parallel daily-quiz systems
	// (Gauntlet + Term of the Day) into one. `term` is only set for 'vocab'.
	category: text('category').notNull().default('market'),
	term: text('term')
});

// ─── Vocab Pool ─────────────────────────────────────────────────────────────
// The actual "knowledge base": vocab terms are timeless, so they're batch-
// generated by AI in bulk (unlike market questions, which depend on live
// prices and must be generated fresh per day). One batch call fills this
// pool; each day's vocab question is a deterministic pick FROM the pool
// rather than its own AI call.

export const vocabPoolBatches = pgTable('vocab_pool_batches', {
	id: uuid('id').primaryKey().defaultRandom(),
	createdAt: timestamp('created_at').defaultNow()
});

export const vocabPool = pgTable(
	'vocab_pool',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		batchId: uuid('batch_id').references(() => vocabPoolBatches.id),
		term: text('term').notNull(),
		question: text('question').notNull(),
		options: jsonb('options').notNull(), // [{ label, value }]
		correctAnswer: text('correct_answer').notNull(),
		createdAt: timestamp('created_at').defaultNow()
	},
	(table) => [
		// Case-insensitive: prevents "Gas fee" and "Gas Fee" both landing in the
		// pool. Also the actual guard against two concurrent top-ups (no
		// in-process lock exists) — a losing insert is skipped via
		// onConflictDoNothing() at the call site, not left to error.
		uniqueIndex('vocab_pool_term_lower_idx').on(sql`lower(${table.term})`)
	]
);

// ─── Gauntlet Attempts ────────────────────────────────────────────────────────

export const gauntletAttempts = pgTable('gauntlet_attempts', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id),
	questionId: uuid('question_id').references(() => gauntletQuestions.id),
	answer: text('answer').notNull(),
	correct: boolean('correct').notNull(),
	xpEarned: integer('xp_earned').default(0),
	attemptedAt: timestamp('attempted_at').defaultNow()
});

// ─── Daily Terms (Term of the Day, G-10) ───────────────────────────────────────
// A separate daily ritual from the Gauntlet — a vocabulary term + a quick
// multiple-choice check, not a market question. Mirrors gauntletQuestions'
// shape deliberately, same self-seeding pattern.

export const dailyTerms = pgTable('daily_terms', {
	id: uuid('id').primaryKey().defaultRandom(),
	term: text('term').notNull(), // e.g. "TVL"
	definition: text('definition').notNull(), // shown alongside the term
	quizOptions: jsonb('quiz_options').notNull(), // [{ label, value }]
	correctOption: text('correct_option').notNull(),
	xpReward: integer('xp_reward').default(20),
	activeDate: date('active_date').notNull(),
	createdAt: timestamp('created_at').defaultNow()
});

// ─── Term Attempts ──────────────────────────────────────────────────────────

export const termAttempts = pgTable('term_attempts', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id),
	termId: uuid('term_id').references(() => dailyTerms.id),
	answer: text('answer').notNull(),
	correct: boolean('correct').notNull(),
	xpEarned: integer('xp_earned').default(0),
	attemptedAt: timestamp('attempted_at').defaultNow()
});

// ─── Matchmaking Queue ────────────────────────────────────────────────────────
// Backed by Postgres (not in-memory) so it survives serverless cold starts

export const matchmakingQueue = pgTable('matchmaking_queue', {
	userId: uuid('user_id')
		.primaryKey()
		.references(() => users.id),
	contestType: text('contest_type').notNull(),
	// Players are matched on duration as well as type — the queue previously
	// couldn't express "20 minutes", so every search was implicitly 24h.
	durationMinutes: integer('duration_minutes').default(1440).notNull(),
	// And on stake tier: being matched on a tier IS the agreement to that stake,
	// which is what removes any need to negotiate one afterwards. 0 = no wager.
	stakeTier: integer('stake_tier').default(0).notNull(),
	queuedAt: timestamp('queued_at').defaultNow().notNull()
});

// ─── Stakes ───────────────────────────────────────────────────────────────────
// A wager attached to a game. Deliberately a sidecar rather than columns on
// `contests`, so the same mechanic works for a 1v1, a lobby or a tournament
// without any of them knowing how settlement happens — the "plug and play
// across all modes" requirement.
//
// Mirrors the `lineups.contestId | lobbyId` convention already used here:
// exactly one of the three FKs is set.
//
// `currency` + `settlementMode` are what make this swappable. Today everything
// runs on 'xp' — real stakes players care about, no chain, no gas, fully
// testable. An on-chain provider later implements the same interface and only
// these two fields change.

export const stakes = pgTable('stakes', {
	id: uuid('id').primaryKey().defaultRandom(),
	contestId: uuid('contest_id').references(() => contests.id),
	lobbyId: uuid('lobby_id').references(() => lobbies.id),
	tournamentId: uuid('tournament_id').references(() => tournaments.id),
	// The tier both players matched on — the agreement in principle.
	tierAmount: integer('tier_amount').notNull(),
	// What each player actually risks: the LOWER of the two commits, so nobody
	// is ever pushed above their own number. Null until both have committed.
	agreedAmount: integer('agreed_amount'),
	currency: text('currency').default('xp').notNull(), // 'xp' | 'usd'
	settlementMode: text('settlement_mode').default('xp').notNull(), // 'xp' | 'onchain' | 'custodial'
	// proposed → agreed → locked → settled | refunded | cancelled
	status: text('status').default('proposed').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	settledAt: timestamp('settled_at')
});

// ─── Stake Participants ───────────────────────────────────────────────────────
// One row per player in a wager. `committed` is what they privately said they'd
// risk; the stake settles at the minimum across participants.

export const stakeParticipants = pgTable('stake_participants', {
	id: uuid('id').primaryKey().defaultRandom(),
	stakeId: uuid('stake_id').references(() => stakes.id),
	userId: uuid('user_id').references(() => users.id),
	// What this player is willing to risk. Private until both have committed —
	// that's what makes it a blind commit rather than a negotiation.
	committed: integer('committed'),
	// Signed: positive for a win, negative for a loss. Written at settlement.
	payout: integer('payout'),
	// Required before any amount can be set (G-03 AC 1). A self-report the
	// server takes on trust — making it a wallet-signed attestation is tracked
	// in docs-project/whats-next.md.
	confirmedAdult: boolean('confirmed_adult').default(false),
	committedAt: timestamp('committed_at')
});

// ─── AI Assist Receipts ───────────────────────────────────────────────────────
// A record, per use of the AI draft agent, of which inference produced the
// picks and what it cost.
//
// Why this exists: the agent charges 15 XP per slot, which is a claim the app
// otherwise cannot back up — a player just has to trust that the server
// charged them, and an opponent has no way to know AI was used at all.
//
// Written only when an inference actually produced picks; a procedural fallback
// records nothing, because no AI was involved.

export const aiAssists = pgTable('ai_assists', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id),
	contestId: uuid('contest_id').references(() => contests.id),
	sectors: text('sectors').notNull(), // comma-separated slots the agent filled
	slotCount: integer('slot_count').notNull(),
	xpCharged: integer('xp_charged').notNull(),
	freeHitUsed: boolean('free_hit_used').default(false),
	isPaper: boolean('is_paper').default(false),
	via: text('via').notNull(), // 'groq'
	model: text('model'),
	createdAt: timestamp('created_at').defaultNow()
});

// ─── Price Samples ────────────────────────────────────────────────────────────
// Intraday price history for the live race screen.
//
// Why this table exists: SoSoValue *does* expose klines, but this API key plan
// is limited to the `1d` interval — 1m/15m/1h all return 400301 "requires a
// whitelisted API key". Daily candles are useless for a 10-minute game, and
// there is no batch price endpoint either, so history has to be accumulated
// here from the snapshots the live endpoint already fetches.
//
// Samples are written by viewers polling a running game, and are throttled so
// two people watching the same contest don't double-write. Scoring never reads
// this table — results always come from locked entry prices — so a gap in
// sampling degrades the graph, never the outcome.

export const priceSamples = pgTable('price_samples', {
	id: uuid('id').primaryKey().defaultRandom(),
	contestId: uuid('contest_id').references(() => contests.id),
	currencyId: text('currency_id').notNull(),
	price: numeric('price').notNull(),
	sampledAt: timestamp('sampled_at').defaultNow().notNull()
});

// ─── User Badges ──────────────────────────────────────────────────────────────
// badgeCode references the static catalog in $lib/badges.ts

export const userBadges = pgTable('user_badges', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id),
	badgeCode: text('badge_code').notNull(),
	earnedAt: timestamp('earned_at').defaultNow()
});

// ─── Research Reads ───────────────────────────────────────────────────────────
// One boost-earning read per user per day (articleId is SoSoValue's news id)

// ─── RPS Tiebreaker ───────────────────────────────────────────────────────────
// Settles differing match terms between two queued players (see ROADMAP,
// matchmaking). The current round's throws stay server-side until both are in
// or the deadline passes, so neither player can see the other's pick early.

export const rpsMatches = pgTable('rps_matches', {
	id: uuid('id').primaryKey().defaultRandom(),
	playerA: uuid('player_a')
		.references(() => users.id)
		.notNull(),
	playerB: uuid('player_b')
		.references(() => users.id)
		.notNull(),
	variant: text('variant').notNull().default('spock'), // 'classic' | 'spock'
	round: integer('round').notNull().default(1),
	scoreA: integer('score_a').notNull().default(0),
	scoreB: integer('score_b').notNull().default(0),
	throwA: text('throw_a'),
	throwB: text('throw_b'),
	roundDeadline: timestamp('round_deadline').notNull(),
	// [{ round, a, b, winner: 'a' | 'b' | null, timedOutA, timedOutB }]
	history: jsonb('history').notNull().default('[]'),
	winnerId: uuid('winner_id').references(() => users.id),
	createdAt: timestamp('created_at').defaultNow()
});

// Research Hub was removed 2026-09-26; the table stays so past reads aren't lost.
export const researchReads = pgTable('research_reads', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id),
	articleId: text('article_id').notNull(),
	sector: text('sector').notNull(),
	xpEarned: integer('xp_earned').default(0),
	readDate: date('read_date').notNull(),
	readAt: timestamp('read_at').defaultNow()
});
