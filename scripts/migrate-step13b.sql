-- Contact email on accounts, asked for at onboarding. Additive only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
