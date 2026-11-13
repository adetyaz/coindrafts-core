import type { Rarity } from './rules';

/** Badge colours per tier, from the design tokens in layout.css. */
export const RARITY_COLOR: Record<Rarity, string> = {
	Common: 'var(--color-border-strong)',
	Rare: 'var(--color-blue)',
	Epic: 'var(--color-rps-lizard)',
	Legendary: 'var(--color-amber)'
};

export function rarityColor(rarity: string): string {
	return RARITY_COLOR[rarity as Rarity] ?? RARITY_COLOR.Common;
}
