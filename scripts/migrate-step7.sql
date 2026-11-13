-- Additive only: daily trivia, and nitro / pit-stop items. Nothing dropped or rewritten.

ALTER TABLE users ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trivia_streak integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trivia_last_pass date;
ALTER TABLE lineups ADD COLUMN IF NOT EXISTS item jsonb;

CREATE TABLE IF NOT EXISTS item_uses (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES users(id),
	kind text NOT NULL,
	contest_id uuid NOT NULL REFERENCES contests(id),
	at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS item_uses_user_at_idx ON item_uses (user_id, at);

CREATE TABLE IF NOT EXISTS trivia_days (
	day date PRIMARY KEY,
	questions jsonb NOT NULL,
	created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trivia_runs (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES users(id),
	day date NOT NULL,
	answers jsonb,
	score integer,
	passed boolean,
	rewards jsonb,
	started_at timestamp NOT NULL DEFAULT now(),
	finished_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS trivia_runs_user_day_idx ON trivia_runs (user_id, day);
