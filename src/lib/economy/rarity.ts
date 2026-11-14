import type { Rarity } from './rules';

/**
 * Badge backgrounds per tier, from the design tokens in layout.css. Light
 * tints, because the label text is ink: under Meadow `border-strong` became
 * ink, and Common badges turned into black-on-black blanks.
 */
export const RARITY_COLOR: Record<Rarity, string> = {
	Common: 'var(--color-bg)',
	Rare: 'var(--color-sky-tint)',
	Epic: 'var(--color-lavender)',
	Legendary: 'var(--color-butter)'
};

export function rarityColor(rarity: string): string {
	return RARITY_COLOR[rarity as Rarity] ?? RARITY_COLOR.Common;
}
