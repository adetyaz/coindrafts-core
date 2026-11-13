-- The bots' daily life (GAMEPLAY_FLOWS.md, F10). Additive only.
CREATE TABLE IF NOT EXISTS bot_days (
	day date PRIMARY KEY,
	summary jsonb,
	created_at timestamp NOT NULL DEFAULT now()
);
