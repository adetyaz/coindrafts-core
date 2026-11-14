export type ResultCardData = {
	username: string;
	didWin: boolean;
	yourScore: number;
	opponentScore: number;
	contestType: string;
	picks: Array<{ sector: string; pick: string; pct: number }>;
};

// Mirrors the Meadow palette in src/routes/layout.css. This file can't read CSS
// custom properties (it renders a standalone SVG document), so the hex values
// are duplicated here. Keep both in sync if the palette changes.
const SECTOR_COLOR: Record<string, string> = {
	l1: '#D9F7E2',
	l2: '#CFCCF7',
	defi: '#EEF29A',
	meme: '#FFD3D3',
	wildcard: '#BFE6F2'
};

const INK = '#111111';
const PAGE = '#D4EEE6';
const CREAM = '#FFFDF2';
const BRAND = '#2AD15F';
const BUTTER = '#EEF29A';
const GRASS = '#9ED86A';
const MUTED = '#5E625C';
const UP = '#127A37';
const DOWN = '#A82A2E';

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renders a 1200x630 OG-sized result card as an SVG string (Meadow sticker style). */
export function renderResultCardSvg(data: ResultCardData): string {
	const win = data.didWin;
	const status = win ? 'WON' : 'LOST';
	const n = Math.min(5, data.picks.length) || 1;
	const chipW = Math.floor((1048 - (n - 1) * 16) / n);
	const chipY = 404;

	const pickChips = data.picks
		.slice(0, 5)
		.map((p, i) => {
			const x = 76 + i * (chipW + 16);
			const fill = SECTOR_COLOR[p.sector.toLowerCase()] ?? '#FFFFFF';
			const pctStr = p.pct >= 0 ? `+${p.pct.toFixed(1)}%` : `${p.pct.toFixed(1)}%`;
			return `
				<rect x="${x + 4}" y="${chipY + 4}" width="${chipW}" height="112" rx="16" fill="${INK}" />
				<rect x="${x}" y="${chipY}" width="${chipW}" height="112" rx="16" fill="${fill}" stroke="${INK}" stroke-width="3" />
				<text x="${x + 16}" y="${chipY + 30}" font-family="sans-serif" font-size="13" font-weight="800" letter-spacing="1.5" fill="${INK}">${esc(p.sector.toUpperCase())}</text>
				<text x="${x + 16}" y="${chipY + 66}" font-family="sans-serif" font-size="26" font-weight="900" fill="${INK}">${esc(p.pick)}</text>
				<text x="${x + 16}" y="${chipY + 94}" font-family="monospace" font-size="17" font-weight="700" fill="${p.pct >= 0 ? UP : DOWN}">${esc(pctStr)}</text>`;
		})
		.join('');

	return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
		<rect width="1200" height="630" fill="${PAGE}" />
		<rect y="560" width="1200" height="70" fill="${GRASS}" />
		<rect y="558" width="1200" height="3" fill="${INK}" />

		<rect x="50" y="46" width="1100" height="500" rx="28" fill="${INK}" />
		<rect x="44" y="40" width="1100" height="500" rx="28" fill="${CREAM}" stroke="${INK}" stroke-width="3" />

		<g transform="translate(76,72)">
			<rect width="40" height="40" rx="11" fill="${BRAND}" stroke="${INK}" stroke-width="3" />
			<path d="M20 6C21 14 23 17 32 20 23 21 21 24 20 34 19 24 17 21 8 20 17 17 19 14 20 6Z" fill="${INK}" />
			<text x="54" y="29" font-family="sans-serif" font-size="26" font-weight="900" letter-spacing="-1" fill="${INK}">coindraft</text>
		</g>
		<text x="1112" y="100" text-anchor="end" font-family="sans-serif" font-size="15" font-weight="800" letter-spacing="1.5" fill="${MUTED}">${esc(data.contestType.toUpperCase())} RACE</text>

		<g transform="translate(76,160) rotate(-4)">
			<rect x="4" y="4" width="${win ? 170 : 190}" height="64" rx="14" fill="${INK}" />
			<rect width="${win ? 170 : 190}" height="64" rx="14" fill="${win ? BRAND : BUTTER}" stroke="${INK}" stroke-width="3" />
			<text x="${(win ? 170 : 190) / 2}" y="44" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="900" letter-spacing="1" fill="${INK}">${esc(status)}</text>
		</g>

		<text x="300" y="214" font-family="monospace" font-size="72" font-weight="700" letter-spacing="-2" fill="${INK}">${data.yourScore}<tspan fill="${MUTED}" font-size="42"> / ${data.opponentScore}</tspan></text>
		<text x="300" y="262" font-family="sans-serif" font-size="22" font-weight="600" fill="${MUTED}">${esc(data.username)}'s engine</text>

		${pickChips}
	</svg>`;
}
