// Daily trivia (GAMEPLAY_FLOWS.md, F7). Replaces the one-question Gauntlet.
//
// 8 questions a day, the same set for everyone, about a minute in total. Pass
// at 4/8: XP, and the streak grows. 8/8 earns a Nitro; every 7th day of a
// streak earns a pit-stop item.
//
// Questions come from live market data (no LLM, so a day can always be seeded)
// plus crypto vocabulary from the existing banks. The set is stored with its
// answers when the day is first opened, so scoring never depends on prices
// that have moved since.
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { triviaDays, triviaRuns, users, vocabPool } from '$lib/server/schema';
import { getTokensWithPrices } from '$lib/server/sosovalue';
import { TERM_BANK } from '$lib/server/gauntlet';
import { grantItem } from '$lib/server/items';
import { classifySector } from '$lib/sectors';
import { SECTOR_THEME } from '$lib/sectorTheme';
import type { ItemKind } from '$lib/race/items';

export const QUESTIONS_PER_DAY = 8;
export const PASS_MARK = 4;
/** About a minute in total, plus a little grace for the network. */
export const TIME_LIMIT_MS = 60_000;
const GRACE_MS = 5_000;
const XP_PER_CORRECT = 10;
const XP_PASS_BONUS = 20;
const STREAK_REWARD_EVERY = 7;
const PIT_STOP_ITEMS: ItemKind[] = ['turbo', 'spare', 'shield'];

type Option = { label: string; value: string };
export type TriviaQuestion = { question: string; options: Option[]; answer: string; kind: string };

export function utcDay(d = new Date()): string {
	return d.toISOString().slice(0, 10);
}

function previousDay(day: string): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 1);
	return utcDay(d);
}

// Seeded so a day's set doesn't depend on which request built it first.
function rng(seed: string) {
	let h = 2166136261;
	for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return ((h ^= h >>> 16) >>> 0) / 4294967296;
	};
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

type Tok = { symbol: string; price: number; change: number };

/** Market questions from today's prices. Each template returns null if the data can't support it. */
function marketQuestions(tokens: Tok[], rand: () => number): TriviaQuestion[] {
	const pick = (n: number) => shuffle(tokens, rand).slice(0, n);
	const opts = (ts: Tok[]) => ts.map((t) => ({ label: t.symbol, value: t.symbol }));
	const templates: (() => TriviaQuestion | null)[] = [
		() => {
			const ts = pick(4);
			const best = ts.reduce((a, b) => (b.change > a.change ? b : a));
			return {
				kind: 'top-mover',
				question: 'Which of these is up the most in the last 24 hours?',
				options: opts(ts),
				answer: best.symbol
			};
		},
		() => {
			const ts = pick(4);
			const worst = ts.reduce((a, b) => (b.change < a.change ? b : a));
			return {
				kind: 'bottom-mover',
				question: 'Which of these is down the most (or up the least) in the last 24 hours?',
				options: opts(ts),
				answer: worst.symbol
			};
		},
		() => {
			const [t] = pick(1);
			return {
				kind: 'direction',
				question: `Is ${t.symbol} up or down over the last 24 hours?`,
				options: [
					{ label: 'Up', value: 'up' },
					{ label: 'Down', value: 'down' }
				],
				answer: t.change >= 0 ? 'up' : 'down'
			};
		},
		() => {
			const ts = pick(3);
			const dearest = ts.reduce((a, b) => (b.price > a.price ? b : a));
			return {
				kind: 'price',
				question: 'Which of these costs the most per coin right now?',
				options: opts(ts),
				answer: dearest.symbol
			};
		},
		() => {
			const known = tokens.filter((t) => classifySector([t.symbol]) !== 'wildcard');
			if (!known.length) return null;
			const t = known[Math.floor(rand() * known.length)];
			return {
				kind: 'sector',
				question: `Which sector does ${t.symbol} race in on CoinDraft?`,
				options: Object.values(SECTOR_THEME).map((s) => ({ label: s.label, value: s.id })),
				answer: classifySector([t.symbol])
			};
		},
		() => {
			const [t] = pick(1);
			return {
				kind: 'big-move',
				question: `Did ${t.symbol} move more than 3% either way in the last day?`,
				options: [
					{ label: 'Yes', value: 'yes' },
					{ label: 'No', value: 'no' }
				],
				answer: Math.abs(t.change) > 3 ? 'yes' : 'no'
			};
		}
	];
	return shuffle(templates, rand)
		.map((t) => t())
		.filter((q): q is TriviaQuestion => Boolean(q));
}

async function vocabQuestions(n: number, rand: () => number): Promise<TriviaQuestion[]> {
	const pool = await db
		.select()
		.from(vocabPool)
		.catch(() => []);
	if (pool.length >= n) {
		return shuffle(pool, rand)
			.slice(0, n)
			.map((v) => ({
				kind: 'vocab',
				question: v.question,
				options: shuffle(v.options as Option[], rand),
				answer: v.correctAnswer
			}));
	}
	return shuffle(TERM_BANK, rand)
		.slice(0, n)
		.map((t) => ({
			kind: 'vocab',
			question: `What does “${t.term}” mean?`,
			options: shuffle(
				[t.definition, ...t.distractors.slice(0, 3)].map((d) => ({ label: d, value: d })),
				rand
			),
			answer: t.definition
		}));
}

async function buildDay(day: string): Promise<TriviaQuestion[]> {
	const rand = rng(`trivia:${day}`);
	const tokens: Tok[] = (await getTokensWithPrices().catch(() => []))
		.filter((t) => t.symbol && t.price != null && t.price > 0 && t.change24h != null)
		.map((t) => ({ symbol: t.symbol!.toUpperCase(), price: t.price!, change: t.change24h! }));
	const market = tokens.length >= 6 ? marketQuestions(tokens, rand).slice(0, 5) : [];
	const vocab = await vocabQuestions(QUESTIONS_PER_DAY - market.length, rand);
	return shuffle([...market, ...vocab], rand).slice(0, QUESTIONS_PER_DAY);
}

export async function ensureTriviaDay(day = utcDay()): Promise<TriviaQuestion[]> {
	const [hit] = await db.select().from(triviaDays).where(eq(triviaDays.day, day));
	if (hit) return hit.questions as TriviaQuestion[];
	const questions = await buildDay(day);
	await db.insert(triviaDays).values({ day, questions }).onConflictDoNothing();
	const [row] = await db.select().from(triviaDays).where(eq(triviaDays.day, day));
	return row.questions as TriviaQuestion[];
}

/** What the browser may see: no answers. */
function publicQuestions(qs: TriviaQuestion[]) {
	return qs.map((q) => ({ question: q.question, options: q.options }));
}

type Run = typeof triviaRuns.$inferSelect;

async function runFor(userId: string, day: string): Promise<Run | null> {
	const [run] = await db
		.select()
		.from(triviaRuns)
		.where(and(eq(triviaRuns.userId, userId), eq(triviaRuns.day, day)));
	return run ?? null;
}

const deadlineOf = (run: Run) => new Date(run.startedAt).getTime() + TIME_LIMIT_MS;

/**
 * Scores a run and pays it out, once: the finishedAt claim makes a second call
 * (timeout racing the last answer) a no-op.
 */
async function finish(run: Run, questions: TriviaQuestion[]): Promise<Run> {
	const answers = [...(run.answers ?? [])];
	while (answers.length < questions.length) answers.push({ answer: null, correct: false });
	const score = answers.filter((a) => a.correct).length;
	const passed = score >= PASS_MARK;

	const [claimed] = await db
		.update(triviaRuns)
		.set({ answers, score, passed, finishedAt: new Date() })
		.where(and(eq(triviaRuns.id, run.id), isNull(triviaRuns.finishedAt)))
		.returning();
	if (!claimed) return (await runFor(run.userId, run.day))!;

	const [user] = await db
		.select({ streak: users.triviaStreak, lastPass: users.triviaLastPass })
		.from(users)
		.where(eq(users.id, run.userId));
	let streak = user?.streak ?? 0;
	let xp = 0;
	const items: ItemKind[] = [];
	if (passed) {
		streak = user?.lastPass === previousDay(run.day) ? streak + 1 : 1;
		xp = XP_PASS_BONUS + XP_PER_CORRECT * score;
		if (score === QUESTIONS_PER_DAY) items.push('nitro');
		if (streak % STREAK_REWARD_EVERY === 0) {
			items.push(PIT_STOP_ITEMS[Math.floor(Math.random() * PIT_STOP_ITEMS.length)]);
		}
		await db
			.update(users)
			.set({
				xpTotal: sql`coalesce(${users.xpTotal}, 0) + ${xp}`,
				triviaStreak: streak,
				triviaLastPass: run.day
			})
			.where(eq(users.id, run.userId));
		for (const k of items) await grantItem(run.userId, k);
	} else if (user?.lastPass !== previousDay(run.day) && user?.lastPass !== run.day) {
		// A failed day after a missed one: the streak is already broken.
		streak = 0;
		await db.update(users).set({ triviaStreak: 0 }).where(eq(users.id, run.userId));
	}
	const rewards = { xp, items, streak };
	await db.update(triviaRuns).set({ rewards }).where(eq(triviaRuns.id, run.id));
	return { ...claimed, rewards };
}

function nextSetAt(day: string) {
	return new Date(`${day}T00:00:00Z`).getTime() + 86_400_000;
}

/** Today's state for one player: not started, in progress, or done. */
export async function triviaToday(userId: string) {
	const day = utcDay();
	const questions = await ensureTriviaDay(day);
	let run = await runFor(userId, day);
	if (run && !run.finishedAt && Date.now() > deadlineOf(run) + GRACE_MS) {
		run = await finish(run, questions);
	}
	const [user] = await db
		.select({ streak: users.triviaStreak, lastPass: users.triviaLastPass })
		.from(users)
		.where(eq(users.id, userId));
	// A streak shown on the dashboard is only alive if yesterday or today was passed.
	const alive = user?.lastPass === day || user?.lastPass === previousDay(day);
	return {
		day,
		total: questions.length,
		passMark: PASS_MARK,
		timeLimitMs: TIME_LIMIT_MS,
		streak: alive ? (user?.streak ?? 0) : 0,
		nextSetAt: nextSetAt(day),
		run: run
			? {
					finished: Boolean(run.finishedAt),
					answered: run.answers?.length ?? 0,
					deadline: deadlineOf(run),
					score: run.score,
					passed: run.passed,
					rewards: run.rewards,
					answers: run.finishedAt ? run.answers : null,
					questions: publicQuestions(questions),
					// The right answers, once it's over (for the review).
					key: run.finishedAt ? questions.map((q) => q.answer) : null
				}
			: null
	};
}

export class TriviaError extends Error {}

export async function startTrivia(userId: string) {
	const day = utcDay();
	await ensureTriviaDay(day);
	await db.insert(triviaRuns).values({ userId, day, answers: [] }).onConflictDoNothing();
	return triviaToday(userId);
}

/** Answers question `index` (they go in order). Late answers count as wrong. */
export async function answerTrivia(userId: string, index: number, answer: string) {
	const day = utcDay();
	const questions = await ensureTriviaDay(day);
	const run = await runFor(userId, day);
	if (!run) throw new TriviaError('Start today’s trivia first');
	if (run.finishedAt) throw new TriviaError('You’ve already played today');
	if (Date.now() > deadlineOf(run) + GRACE_MS) {
		const done = await finish(run, questions);
		return { timeUp: true, correct: false, answer: null, finished: true, score: done.score };
	}
	const q = questions[index];
	if (!q) throw new TriviaError('No such question');
	const correct = answer === q.answer;
	// In order, once each: only lands if exactly `index` answers exist already.
	const [updated] = await db
		.update(triviaRuns)
		.set({
			answers: sql`coalesce(${triviaRuns.answers}, '[]'::jsonb) || ${JSON.stringify([{ answer, correct }])}::jsonb`
		})
		.where(
			and(
				eq(triviaRuns.id, run.id),
				isNull(triviaRuns.finishedAt),
				sql`jsonb_array_length(coalesce(${triviaRuns.answers}, '[]'::jsonb)) = ${index}`
			)
		)
		.returning();
	if (!updated) throw new TriviaError('That question was already answered');
	let finished = false;
	let score: number | null = null;
	if ((updated.answers?.length ?? 0) >= questions.length) {
		const done = await finish(updated, questions);
		finished = true;
		score = done.score;
	}
	return { timeUp: false, correct, answer: q.answer, finished, score };
}
