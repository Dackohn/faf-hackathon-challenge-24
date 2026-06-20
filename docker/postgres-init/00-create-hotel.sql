-- Runs once on first Postgres init, against POSTGRES_DB (beach).
-- The beach database is created by POSTGRES_DB; the hotel service needs its own.
CREATE DATABASE hotel;
