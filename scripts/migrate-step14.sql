-- Notifications (GAMEPLAY_FLOWS.md, F11). Additive only: one new table.
CREATE TABLE IF NOT EXISTS push_subscriptions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES users(id),
	endpoint text NOT NULL UNIQUE,
	p256dh text NOT NULL,
	auth text NOT NULL,
	created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);
