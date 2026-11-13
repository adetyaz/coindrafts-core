-- Binary race mode (GAMEPLAY_FLOWS.md, F9). Additive only.
ALTER TABLE contests ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE lineup_picks ADD COLUMN IF NOT EXISTS call text;
