// Who each bot is: how it drafts, how it trades, and how it talks to you.
// Client-safe (no server imports) so the race screen can voice bots directly.
//
// A bot remembers every player it has raced. Its mood towards you comes from
// your head-to-head record (see `moodFor`), and its mood changes what it says
// on the grid, on overtakes and after the result.

export type DraftStyle =
	/** Takes the coin pumping hardest in each sector. */
	| 'momentum'
	/** Buys the dip: the coin down the most. */
	| 'contrarian'
	/** The calmest coin in each sector. */
	| 'steady'
	/** The wildest coin in each sector, up or down. */
	| 'volatile'
	/** Anything goes. */
	| 'chaos';

export type Mood = 'stranger' | 'cocky' | 'afraid' | 'grudge' | 'respect';

export type Moment = 'grid' | 'passesYou' | 'youPass' | 'wins' | 'loses';

export type Personality = {
	username: string;
	/** Two or three words, shown under the bot's name. */
	tagline: string;
	draft: DraftStyle;
	/** How hard it haggles: multiplies its asking price and what it will pay. */
	trade: { askMarkup: number; payTolerance: number };
	/** What it says, by mood and moment. `{you}` and `{coin}` are filled in. */
	lines: Partial<Record<Mood, Partial<Record<Moment, string[]>>>>;
};

/** Lines every bot falls back on when its own bank has nothing for the moment. */
const COMMON: Record<Mood, Record<Moment, string[]>> = {
	stranger: {
		grid: ['New face. Let’s see what you’ve got.', 'Never raced you before. Don’t make it easy.'],
		passesYou: ['Excuse me, coming through.'],
		youPass: ['Huh. Not bad.'],
		wins: ['Good race. Come back when you’ve practised.'],
		loses: ['You got me this time.']
	},
	cocky: {
		grid: [
			'You again? Bring a faster lineup this time.',
			'I’ve beaten you {record}. Want another?'
		],
		passesYou: ['See you at the finish. Actually, you won’t.', 'Too slow, {you}.'],
		youPass: ['Lucky tick.', 'Enjoy it while it lasts.'],
		wins: ['Same result as always.', 'Add it to the pile.'],
		loses: ['Fluke. Rematch.', 'That won’t happen twice.']
	},
	afraid: {
		grid: ['Oh no, not you…', 'Please go easy on me this time.'],
		passesYou: ['Wait, am I actually ahead?', 'Don’t look back, don’t look back…'],
		youPass: ['And there it goes.', 'Every time!'],
		wins: ['I… won? I won!', 'Finally!'],
		loses: ['I knew it.', 'You’re too good for me.']
	},
	grudge: {
		grid: ['I haven’t forgotten last time.', 'This one’s personal, {you}.'],
		passesYou: ['That’s for last time!', 'Payback starts now.'],
		youPass: ['Not again…', 'I’ll get you back.'],
		wins: ['We’re even now.', 'Told you I’d get you back.'],
		loses: ['This isn’t over.', 'Next time, {you}. Next time.']
	},
	respect: {
		grid: ['Good to race you again, {you}.', 'Let’s make it a close one.'],
		passesYou: ['Nice try. Keep up!'],
		youPass: ['Great move!', 'Okay, I see you.'],
		wins: ['Close one. Well raced.'],
		loses: ['Well raced, {you}. Deserved.']
	}
};

export const PERSONALITIES: Personality[] = [
	{
		username: 'CryptoWhale_99',
		tagline: 'Big spender',
		draft: 'momentum',
		trade: { askMarkup: 1.1, payTolerance: 1.2 },
		lines: {
			stranger: { grid: ['I buy whatever’s pumping. Try to keep up.'] },
			cocky: { passesYou: ['Whales don’t wait, {you}.'], wins: ['Money talks.'] }
		}
	},
	{
		username: 'AlphaLegend',
		tagline: 'Thinks it’s the best',
		draft: 'momentum',
		trade: { askMarkup: 1.15, payTolerance: 1.0 },
		lines: {
			stranger: { grid: ['Ah, a new challenger. How cute.'] },
			cocky: { grid: ['{record}. Need I say more?'], wins: ['Alpha. Legend. As usual.'] },
			afraid: { grid: ['You got lucky before. Not today.'] }
		}
	},
	{
		username: 'SatoshiKnight',
		tagline: 'Honourable L1 purist',
		draft: 'steady',
		trade: { askMarkup: 1.0, payTolerance: 1.05 },
		lines: {
			stranger: { grid: ['May the best chain win.'] },
			respect: { loses: ['An honourable defeat. Well played.'] },
			grudge: { grid: ['Honour demands a rematch.'] }
		}
	},
	{
		username: 'BullZone_OG',
		tagline: 'Always bullish',
		draft: 'momentum',
		trade: { askMarkup: 1.05, payTolerance: 1.15 },
		lines: {
			stranger: { grid: ['Everything’s going up. Including me.'] },
			afraid: { grid: ['Still bullish. Mostly.'] },
			cocky: { passesYou: ['Bulls only go one way: past you.'] }
		}
	},
	{
		username: 'DegenScout',
		tagline: 'Meme degen',
		draft: 'volatile',
		trade: { askMarkup: 0.95, payTolerance: 1.25 },
		lines: {
			stranger: { grid: ['Full send. No stop losses.'] },
			cocky: { passesYou: ['{coin} who? Degens win.'] },
			afraid: { youPass: ['Rugged again…'] }
		}
	},
	{
		username: 'ChartWizard',
		tagline: 'Reads the charts',
		draft: 'contrarian',
		trade: { askMarkup: 1.0, payTolerance: 0.95 },
		lines: {
			stranger: { grid: ['The charts say you’re finishing second.'] },
			cocky: { passesYou: ['Textbook breakout.'] },
			grudge: { grid: ['I’ve studied your last race. Frame by frame.'] }
		}
	},
	{
		username: 'MoonRunner',
		tagline: 'Dreams of the moon',
		draft: 'chaos',
		trade: { askMarkup: 1.2, payTolerance: 1.1 },
		lines: {
			stranger: { grid: ['Destination: the moon. You coming?'] },
			cocky: { wins: ['To the moon, and past you.'] },
			afraid: { loses: ['Grounded. Again.'] }
		}
	},
	{
		username: 'RektProof',
		tagline: 'Plays it safe',
		draft: 'steady',
		trade: { askMarkup: 1.0, payTolerance: 0.9 },
		lines: {
			stranger: { grid: ['Slow and steady. Never rekt.'] },
			afraid: { grid: ['Keeping it safe. Very safe. Please.'] },
			respect: { wins: ['Steady wins the race.'] }
		}
	}
];

const DEFAULT: Personality = {
	username: 'Bot',
	tagline: 'Racer',
	draft: 'chaos',
	trade: { askMarkup: 1, payTolerance: 1 },
	lines: {}
};

export function personalityOf(username: string | null | undefined): Personality {
	return (
		PERSONALITIES.find((p) => p.username === username) ?? {
			...DEFAULT,
			username: username ?? 'Bot'
		}
	);
}

// ── Memory → mood ───────────────────────────────────────────────────────────

/** A bot's head-to-head with one player, from the bot's side. */
export type HeadToHead = {
	races: number;
	botWins: number;
	playerWins: number;
	/** Most recent first: 'bot' | 'player'. */
	recent: ('bot' | 'player')[];
};

/**
 * How a bot feels about a player, from their shared races:
 * - stranger: never raced
 * - afraid: the player won the last 3
 * - grudge: the player won the last race and leads overall
 * - cocky: the bot leads by 2 or more
 * - respect: 6+ races and within 1 of each other
 */
export function moodFor(record: HeadToHead): Mood {
	if (record.races === 0) return 'stranger';
	if (record.recent.length >= 3 && record.recent.slice(0, 3).every((r) => r === 'player')) {
		return 'afraid';
	}
	if (record.recent[0] === 'player' && record.playerWins > record.botWins) return 'grudge';
	if (record.botWins - record.playerWins >= 2) return 'cocky';
	if (record.races >= 6 && Math.abs(record.botWins - record.playerWins) <= 1) return 'respect';
	return record.botWins >= record.playerWins ? 'cocky' : 'grudge';
}

export const MOOD_LABEL: { [K in Mood]: string } = {
	stranger: 'First meeting',
	cocky: 'Cocky',
	afraid: 'Scared of you',
	grudge: 'Holds a grudge',
	respect: 'Respects you'
};

/** One line for a moment, in the bot's own voice when it has one. */
export function lineFor(
	bot: Personality,
	mood: Mood,
	moment: Moment,
	fill: { you: string; coin?: string; record?: HeadToHead }
): string {
	const own = bot.lines[mood]?.[moment] ?? [];
	const bank = own.length > 0 && Math.random() < 0.7 ? own : COMMON[mood][moment];
	const line = bank[Math.floor(Math.random() * bank.length)];
	const record = fill.record ? `${fill.record.botWins}–${fill.record.playerWins}` : '';
	return line
		.replaceAll('{you}', fill.you)
		.replaceAll('{coin}', fill.coin ?? 'Your coin')
		.replaceAll('{record}', record);
}
