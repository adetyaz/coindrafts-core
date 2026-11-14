import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contests, lineups, lineupPicks, users } from '$lib/server/schema';

// Returns raw HTML directly (not a Svelte component) so link-preview crawlers
// (Twitter/Discord/etc — no JS execution, no cookies) get real og: meta tags
// in the initial response. This app runs ssr = false everywhere else because
// the root layout pulls in wallet SDKs that break under Node SSR; going
// through +page.svelte here would inherit that layout and crash the same
// way. A plain +server.ts endpoint never renders Svelte components or
// layouts, so it sidesteps that entirely.
export async function GET({ params, url }) {
	const contestId = params.id;
	const userId = url.searchParams.get('u');
	if (!contestId || !userId) return new Response('Not found', { status: 404 });

	const contest = await db
		.select()
		.from(contests)
		.where(eq(contests.id, contestId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!contest || contest.status !== 'resolved') return new Response('Not found', { status: 404 });
	if (contest.userAId !== userId && contest.userBId !== userId) {
		return new Response('Not found', { status: 404 });
	}

	const lineup = await db
		.select()
		.from(lineups)
		.where(and(eq(lineups.contestId, contestId), eq(lineups.userId, userId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!lineup) return new Response('Not found', { status: 404 });

	const picks = await db.select().from(lineupPicks).where(eq(lineupPicks.lineupId, lineup.id));
	const user = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	const didWin = contest.winnerId === userId;
	const yourScore = Number(Number(lineup.finalScore ?? 0).toFixed(0));
	const username = user?.username ?? 'Player';
	const contestType = contest.type ?? 'daily';

	const cardUrl = `${url.origin}/api/contest/${contestId}/card?u=${userId}`;
	const pageUrl = `${url.origin}/share/${contestId}?u=${userId}`;
	const title = `${didWin ? 'I won' : 'I played'} a ${contestType} contest on CoinDraft — ${yourScore} pts`;
	const description = picks
		.map(
			(p) =>
				`${p.tokenSymbol} ${Number(p.pctChange ?? 0) >= 0 ? '+' : ''}${Number(p.pctChange ?? 0).toFixed(1)}%`
		)
		.join(' · ');
	const tweetText = encodeURIComponent(
		`${didWin ? '🏆 I just won' : 'Just played'} a ${contestType} contest on CoinDraft — ${yourScore} pts`
	);
	const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(pageUrl)}`;

	const esc = (s: string) =>
		s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

	// Mirrors src/lib/server/resultCard.ts and src/routes/layout.css's design
	// tokens — this is a standalone HTML document (see the file header), so it
	// can't load app.css or the Google Fonts <link> from app.html and has to
	// duplicate both. Keep in sync if either changes.
	const SECTOR_COLOR: Record<string, string> = {
		l1: '#D9F7E2',
		l2: '#CFCCF7',
		defi: '#EEF29A',
		meme: '#FFD3D3',
		wildcard: '#BFE6F2'
	};

	const pickChips = picks
		.map((p) => {
			const pct = Number(p.pctChange ?? 0);
			const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
			const color = SECTOR_COLOR[p.sector.toLowerCase()] ?? '#FFFFFF';
			const pctColor = pct >= 0 ? '#127A37' : '#A82A2E';
			return `<span style="display:inline-flex;align-items:baseline;gap:6px;background:${color};border:2px solid #111111;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;margin:3px"><span>${esc(p.tokenSymbol)}</span><span style="font-family:'JetBrains Mono',ui-monospace,monospace;color:${pctColor}">${esc(pctStr)}</span></span>`;
		})
		.join('');

	const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${esc(title)}</title>
	<meta name="description" content="${esc(description)}" />

	<meta property="og:type" content="website" />
	<meta property="og:title" content="${esc(title)}" />
	<meta property="og:description" content="${esc(description)}" />
	<meta property="og:image" content="${esc(cardUrl)}" />
	<meta property="og:url" content="${esc(pageUrl)}" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="${esc(title)}" />
	<meta name="twitter:description" content="${esc(description)}" />
	<meta name="twitter:image" content="${esc(cardUrl)}" />

	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
	/>

	<style>
		* { box-sizing: border-box; }
		body { font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif; background: #D4EEE6; margin: 0; padding: 56px 16px; color: #111111; }
		.card { max-width: 620px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; align-items: center; }
		.brand { display: flex; align-items: center; gap: 10px; }
		.brand .mark { width: 30px; height: 30px; border-radius: 9px; background: #2AD15F; border: 2px solid #111111; }
		.brand span { font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.04em; }
		img.og { width: 100%; border-radius: 20px; border: 2px solid #111111; box-shadow: 5px 5px 0 #111111; display: block; }
		.result { width: 100%; border: 2px solid #111111; border-radius: 22px; background: #FFFDF2; padding: 24px; box-shadow: 5px 5px 0 #111111; }
		.result h1 { margin: 0 0 12px; font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
		.status {
			display: inline-block;
			font-weight: 900;
			font-size: 12px;
			letter-spacing: 0.06em;
			padding: 7px 14px;
			border-radius: 999px;
			margin-bottom: 14px;
			background: ${didWin ? '#2AD15F' : '#EEF29A'};
			color: #111111;
			border: 2px solid #111111;
		}
		.status .pts { font-family: 'JetBrains Mono', ui-monospace, monospace; }
		.chips { display: flex; flex-wrap: wrap; gap: 0; }
		.actions { display: flex; gap: 10px; width: 100%; }
		.actions a { flex: 1; box-sizing: border-box; height: 52px; display: flex; align-items: center; justify-content: center; border-radius: 14px; border: 2px solid #111111; box-shadow: 0 4px 0 #111111; font-weight: 800; font-size: 15px; text-decoration: none; color: #111111; transition: transform 0.12s ease, box-shadow 0.12s ease; }
		.actions a:active { transform: translateY(4px); box-shadow: none; }
		.share-x { background: #2AD15F; }
		.play { background: #FFFFFF; }
	</style>
</head>
<body>
	<div class="card">
		<div class="brand"><div class="mark"></div><span>coindraft</span></div>
		<img class="og" src="${esc(cardUrl)}" alt="${esc(title)}" />
		<div class="result">
			<h1>${esc(username)}'s ${esc(contestType)} contest</h1>
			<div class="status">${didWin ? 'YOU WON' : 'YOU LOST'} <span class="pts">· ${yourScore} pts</span></div>
			<div class="chips">${pickChips}</div>
		</div>
		<div class="actions">
			<a class="share-x" href="${esc(tweetUrl)}" target="_blank" rel="noopener noreferrer">Share to X</a>
			<a class="play" href="${url.origin}/dashboard">Play CoinDraft</a>
		</div>
	</div>
</body>
</html>`;

	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
