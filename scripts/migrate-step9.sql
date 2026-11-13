-- Leagues upgrade (GAMEPLAY_FLOWS.md, F5): league night, home track, monthly
-- seasons. Additive columns and two new tables.

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS home_track text;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS night_day integer NOT NULL DEFAULT 5;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS night_hour integer NOT NULL DEFAULT 19;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS night_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS season_month text;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS season_prize integer NOT NULL DEFAULT 1000;

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS league_night_id uuid;

CREATE TABLE IF NOT EXISTS league_nights (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	league_id uuid NOT NULL REFERENCES leagues(id),
	night date NOT NULL,
	status text NOT NULL,
	note text,
	created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS league_nights_unique_idx ON league_nights (league_id, night);

CREATE TABLE IF NOT EXISTS league_seasons (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	league_id uuid NOT NULL REFERENCES leagues(id),
	month text NOT NULL,
	winner_id uuid REFERENCES users(id),
	points integer NOT NULL DEFAULT 0,
	prize integer NOT NULL DEFAULT 0,
	created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS league_seasons_unique_idx ON league_seasons (league_id, month);

-- Existing leagues: a home track, and the current month as their first season.
UPDATE leagues SET home_track = 'monza' WHERE home_track IS NULL;
UPDATE leagues SET season_month = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') WHERE season_month IS NULL;
