-- Additive only: new columns and one new table. Nothing is dropped or rewritten.
-- Covers the race stages (circuit, car per lineup, last-used car) and the
-- Garage step (customising and car history).

ALTER TABLE contests ADD COLUMN IF NOT EXISTS circuit text;
ALTER TABLE lineups ADD COLUMN IF NOT EXISTS car_id uuid REFERENCES cars(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_car_id uuid;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS look jsonb;

CREATE TABLE IF NOT EXISTS car_events (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	car_id uuid NOT NULL REFERENCES cars(id),
	kind text NOT NULL,
	from_user_id uuid REFERENCES users(id),
	to_user_id uuid NOT NULL REFERENCES users(id),
	price integer,
	race_id text,
	at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS car_events_car_idx ON car_events (car_id, at);

-- Backfill history for cars that already exist, once (only if car_events is empty).
-- Birth: the first seller if the car was ever sold, otherwise today's owner.
INSERT INTO car_events (car_id, kind, to_user_id, at)
SELECT c.id, 'starter',
	coalesce(
		(SELECT l.seller_id FROM car_listings l
			WHERE l.car_id = c.id AND l.status = 'sold' ORDER BY l.closed_at LIMIT 1),
		c.owner_id),
	coalesce(c.created_at, now())
FROM cars c
WHERE NOT EXISTS (SELECT 1 FROM car_events);

INSERT INTO car_events (car_id, kind, from_user_id, to_user_id, price, at)
SELECT l.car_id, 'market', l.seller_id, l.buyer_id, l.price, coalesce(l.closed_at, l.created_at)
FROM car_listings l
WHERE l.status = 'sold' AND l.buyer_id IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM car_events WHERE kind = 'market');
