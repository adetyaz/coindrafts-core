import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineups, lineupPicks } from '$lib/server/schema';
import { parseSessionToken } from '$lib/server/auth';
import { getNews } from '$lib/server/sosovalue';
import { createChatCompletion, AiConfigError } from '$lib/server/aiCompute';

interface Pick {
	sector: string;
	pick: string;
	pct: number;
	points: number;
}

function buildPrompt(picks: Pick[], status: string, newsHeadlines: string[]): string {
	const pickSummary = picks
		.map(
			(p) =>
				`  - ${p.sector}: ${p.pick} → ${p.pct >= 0 ? '+' : ''}${p.pct}% (${p.points.toFixed(1)} pts)`
		)
		.join('\n');

	const headlines =
		newsHeadlines.length > 0
			? newsHeadlines
					.slice(0, 6)
					.map((h) => `  • ${h}`)
					.join('\n')
			: '  • No recent headlines available.';

	return `You are CoinDraft's post-match AI analyst. Write a 2–3 sentence analysis of the player's performance.

Match outcome: ${status}

Their picks:
${pickSummary}

Recent crypto news context (from SoSoValue research feeds):
${headlines}

Rules:
- Be concise (2–3 sentences, max 80 words total)
- Reference 1–2 specific tokens by name
- Mention sector momentum or macro context from the news if relevant
- End on a forward-looking note (what to watch next draft)
- Do NOT use bullet points or headers — plain prose only`;
}

// Takes only a contest id: picks and outcome are read from the resolved
// contest, and the text is stored on the lineup. It used to accept picks and
// status from the request body and regenerate on every view, so any signed-in
// user could loop it with arbitrary input on our AI bill. Now each result is
// generated once.
export async function POST({ request, cookies }) {
	const token = cookies.get('session');
	const parsed = token ? parseSessionToken(token) : null;
	if (!parsed) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => null);
	const contestId = typeof body?.contestId === 'string' ? body.contestId : '';
	if (!contestId) return json({ error: 'contestId required' }, { status: 400 });

	const [contest] = await db.select().from(contests).where(eq(contests.id, contestId)).limit(1);
	if (!contest || contest.status !== 'resolved') {
		return json({ error: 'Contest not resolved' }, { status: 404 });
	}
	const [lineup] = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, parsed.userId)))
		.limit(1);
	if (!lineup) return json({ error: 'Not found' }, { status: 404 });
	if (lineup.breakdown) return json({ breakdown: lineup.breakdown, cached: true });

	const rows = await db.select().from(lineupPicks).where(eq(lineupPicks.lineupId, lineup.id));
	const picks: Pick[] = rows.map((p) => ({
		sector: p.sector,
		pick: p.tokenSymbol,
		pct: Number(Number(p.pctChange ?? 0).toFixed(2)),
		points: Number(p.score ?? 0)
	}));
	const status = contest.winnerId === parsed.userId ? 'YOU WON' : 'YOU LOST';

	// Fetch recent news headlines for context
	let newsHeadlines: string[] = [];
	try {
		const rawNews = (await getNews()) as unknown;
		if (Array.isArray(rawNews)) {
			newsHeadlines = rawNews
				.slice(0, 8)
				.map((n: Record<string, unknown>) => String(n?.title ?? n?.headline ?? ''))
				.filter(Boolean);
		}
	} catch {
		// News fetch failure is non-fatal — proceed without context
	}

	const prompt = buildPrompt(picks, status, newsHeadlines);

	try {
		const chat = await createChatCompletion({
			messages: [{ role: 'user', content: prompt }],
			// gpt-oss is a reasoning model — it spends part of this budget on an
			// internal reasoning trace before emitting real content. 150 was tuned
			// for the old non-reasoning llama model and risks truncating before
			// any content comes through; verified 400 leaves headroom for both.
			max_tokens: 400,
			temperature: 0.7
		});

		const text = chat.choices[0]?.message?.content?.trim() ?? '';
		if (text) await db.update(lineups).set({ breakdown: text }).where(eq(lineups.id, lineup.id));
		return json({ breakdown: text });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[/api/breakdown]', message);
		if (e instanceof AiConfigError) {
			return json({ error: e.message, reason: 'ai_misconfigured' }, { status: 500 });
		}
		return json({ error: 'AI breakdown unavailable', detail: message }, { status: 502 });
	}
}
