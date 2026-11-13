-- Tournaments upgrade (GAMEPLAY_FLOWS.md, F4). Additive columns and one new
-- table, plus moving the old join-into-a-group registrations over to entries.

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 15;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS group_track text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS final_track text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prizes jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee integer NOT NULL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cup text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS car_prize text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS drawn_at timestamp;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS results jsonb;

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS circuit text;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS draft_closes_at timestamp;

CREATE TABLE IF NOT EXISTS tournament_entries (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tournament_id uuid NOT NULL REFERENCES tournaments(id),
	user_id uuid NOT NULL REFERENCES users(id),
	fee_paid integer NOT NULL DEFAULT 0,
	pot integer,
	group_no integer,
	joined_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_unique_idx
	ON tournament_entries (tournament_id, user_id);

-- Open tournaments: players used to be placed into a group the moment they
-- joined. Move them to entries (the draw now places them) and remove the
-- still-waiting groups. Open tournaments get default tracks.
INSERT INTO tournament_entries (tournament_id, user_id, joined_at)
SELECT DISTINCT ON (l.tournament_id, p.user_id) l.tournament_id, p.user_id, coalesce(p.joined_at, now())
FROM lobby_participants p
JOIN lobbies l ON l.id = p.lobby_id
JOIN tournaments t ON t.id = l.tournament_id
WHERE t.status = 'open' AND l.status = 'waiting' AND p.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

DELETE FROM lobby_participants
WHERE lobby_id IN (
	SELECT l.id FROM lobbies l JOIN tournaments t ON t.id = l.tournament_id
	WHERE t.status = 'open' AND l.status = 'waiting'
);
DELETE FROM lobbies
WHERE id IN (
	SELECT l.id FROM lobbies l JOIN tournaments t ON t.id = l.tournament_id
	WHERE t.status = 'open' AND l.status = 'waiting'
);

UPDATE tournaments SET group_track = 'interlagos', final_track = 'monza'
WHERE status = 'open' AND group_track IS NULL;
-- An open tournament with no closing time would never draw; give it one.
UPDATE tournaments SET registration_closes_at = now() + interval '1 day'
WHERE status = 'open' AND registration_closes_at IS NULL;
