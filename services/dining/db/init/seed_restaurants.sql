-- Reference only: in this repo's docker-compose, services share one postgres
-- container that only runs root /init-db.sql (CREATE DATABASE per service), so
-- this file is not auto-mounted. The actual seeding happens in seed.py at
-- app startup (mirrors Beach's ActivitySeeder). Kept here for a standalone
-- dedicated-Postgres-container setup, per the original plan's db/init convention.
CREATE TABLE IF NOT EXISTS restaurants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cuisine VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS tables (
    id VARCHAR(50) PRIMARY KEY,
    restaurant_id VARCHAR(50) NOT NULL REFERENCES restaurants(id),
    label VARCHAR(255) NOT NULL,
    seats INT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
    id VARCHAR(36) PRIMARY KEY,
    guest_id VARCHAR(100) NOT NULL,
    restaurant_id VARCHAR(50) NOT NULL REFERENCES restaurants(id),
    table_id VARCHAR(50) NOT NULL REFERENCES tables(id),
    party_size INT NOT NULL,
    seating_slot INT NOT NULL,
    pre_order JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_table_slot_active
    ON reservations (table_id, seating_slot)
    WHERE status = 'CONFIRMED';

INSERT INTO restaurants (id, name, cuisine, description) VALUES
('REST001', 'The Salty Whisker', 'Seafood', 'Fresh catch served with zero small talk — order at the kiosk, eat in peace.'),
('REST002', 'Bamboo and Broth', 'Asian Fusion', 'Self-serve noodle bar with private booths for solo dining.'),
('REST003', 'The Quiet Crust', 'Pizza', 'Self-serve oven pods — pick a pizza, bake it yourself, no waiter required.'),
('REST004', 'Sunset Grill Pods', 'BBQ', 'Solo BBQ pods facing the sunset, food delivered by conveyor.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tables (id, restaurant_id, label, seats) VALUES
('TBL001', 'REST001', 'Window table', 4),
('TBL002', 'REST001', 'Booth 1', 2),
('TBL003', 'REST001', 'Booth 2', 2),
('TBL004', 'REST001', 'Patio table', 6),
('TBL005', 'REST002', 'Noodle booth 1', 2),
('TBL006', 'REST002', 'Noodle booth 2', 2),
('TBL007', 'REST002', 'Group table', 8),
('TBL008', 'REST002', 'Counter seat', 1),
('TBL009', 'REST003', 'Oven pod 1', 2),
('TBL010', 'REST003', 'Oven pod 2', 2),
('TBL011', 'REST003', 'Oven pod 3', 4),
('TBL012', 'REST004', 'Sunset pod 1', 2),
('TBL013', 'REST004', 'Sunset pod 2', 2),
('TBL014', 'REST004', 'Sunset pod 3', 4),
('TBL015', 'REST004', 'Group grill', 6)
ON CONFLICT (id) DO NOTHING;
