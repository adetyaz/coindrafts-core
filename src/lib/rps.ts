// Rock-paper-scissors tiebreaker rules, shared by the UI and the server so the
// outcome shown on screen and the outcome that decides match terms can't
// disagree.

export type RpsVariant = 'classic' | 'spock';
export type RpsShape = 'rock' | 'paper' | 'scissors' | 'lizard' | 'spock';

export const SHAPES: Record<RpsVariant, RpsShape[]> = {
	classic: ['paper', 'scissors', 'rock'],
	// Clockwise from the top, matching the pentagon layout in the design.
	spock: ['scissors', 'paper', 'rock', 'lizard', 'spock']
};

export const BEATS: Record<RpsShape, readonly RpsShape[]> = {
	scissors: ['paper', 'lizard'],
	paper: ['rock', 'spock'],
	rock: ['lizard', 'scissors'],
	lizard: ['spock', 'paper'],
	spock: ['scissors', 'rock']
};

export function isShape(v: unknown, variant: RpsVariant): v is RpsShape {
	return typeof v === 'string' && SHAPES[variant].includes(v as RpsShape);
}

/** 1 = a wins, -1 = b wins, 0 = tie. */
export function compare(a: RpsShape, b: RpsShape): 1 | -1 | 0 {
	if (a === b) return 0;
	return BEATS[a].includes(b) ? 1 : -1;
}

export type RpsRoundResult = {
	round: number;
	mine: RpsShape;
	theirs: RpsShape;
	outcome: 'win' | 'loss' | 'tie';
	iTimedOut: boolean;
	theyTimedOut: boolean;
};

/** One player's view of a match — never includes the opponent's current throw. */
export type RpsView = {
	id: string;
	variant: RpsVariant;
	round: number;
	deadline: string;
	serverNow: string;
	myScore: number;
	theirScore: number;
	myThrow: RpsShape | null;
	theyHaveThrown: boolean;
	opponentId: string;
	history: RpsRoundResult[];
	winnerId: string | null;
	iWon: boolean | null;
};

/** First to this many round wins takes the match (best of 3). Ties replay. */
export const WINS_NEEDED = 2;
export const THROW_SECONDS = 10;
