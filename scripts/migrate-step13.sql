-- Sponsors and track ads (GAMEPLAY_FLOWS.md, F12). Additive only: two new tables.
CREATE TABLE IF NOT EXISTS sponsors (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL UNIQUE REFERENCES users(id),
	name text NOT NULL,
	contact_email text NOT NULL,
	created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsor_bookings (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	sponsor_id uuid NOT NULL REFERENCES sponsors(id),
	kind text NOT NULL,
	status text NOT NULL DEFAULT 'awaiting_payment',
	start_date date NOT NULL,
	end_date date NOT NULL,
	circuit text,
	slot text,
	artwork text,
	title text,
	prize text,
	livery text,
	tournament_id uuid REFERENCES tournaments(id),
	price_cents integer NOT NULL,
	views integer NOT NULL DEFAULT 0,
	note text,
	created_at timestamp NOT NULL DEFAULT now(),
	paid_at timestamp,
	decided_at timestamp
);
CREATE INDEX IF NOT EXISTS sponsor_bookings_slot_idx ON sponsor_bookings (circuit, slot, start_date, end_date);
