-- Me, player cards and challenges (GAMEPLAY_FLOWS.md, F6). Additive only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS showcase_car_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS showcase_badges jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings jsonb;

CREATE TABLE IF NOT EXISTS challenges (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	from_user_id uuid NOT NULL REFERENCES users(id),
	to_user_id uuid NOT NULL REFERENCES users(id),
	duration_minutes integer NOT NULL DEFAULT 15,
	message text,
	status text NOT NULL DEFAULT 'pending',
	contest_id uuid,
	created_at timestamp NOT NULL DEFAULT now(),
	responded_at timestamp
);
CREATE INDEX IF NOT EXISTS challenges_to_idx ON challenges (to_user_id, status);
