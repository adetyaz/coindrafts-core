// Track worlds: a different place for each kind of race, so you can tell what
// you're in at a glance. The colours live in layout.css (`.track-*`); the 3D
// track reads them from its own element. Purely cosmetic, like the circuit.

export type TrackTheme = 'meadow' | 'golden' | 'night' | 'neon' | 'village';

export const TRACK_THEMES: Record<TrackTheme, { label: string; blurb: string; night: boolean }> = {
	meadow: { label: 'Sunny meadow', blurb: 'Practice laps in the sunshine', night: false },
	golden: { label: 'Golden hour', blurb: 'Wheat fields, one rival', night: false },
	night: { label: 'Night forest', blurb: 'Headlights on. A car is on the line', night: true },
	neon: { label: 'Neon town', blurb: 'Every call lights a gate', night: true },
	village: { label: 'Village race day', blurb: 'The whole town turns out', night: false }
};

/** Which world a race runs in, from what kind of race it is. */
export function trackThemeFor(race: {
	mode?: string | null;
	isPaper?: boolean | null;
	carRace?: boolean | null;
	multi?: boolean | null;
}): TrackTheme {
	if (race.multi) return 'village';
	if (race.mode === 'binary' || race.mode === 'binary_solo') return 'neon';
	if (race.carRace) return 'night';
	if (race.isPaper) return 'meadow';
	return 'golden';
}
