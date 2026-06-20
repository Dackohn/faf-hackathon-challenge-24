# Dining Service

Capacity-limited restaurant table reservations with zero-human-contact pre-ordered food.

## Architecture

```
Client ──POST /reservations──▶ FastAPI
                                  │
                          repository.book_table()
                                  │
                    BEGIN ── SELECT table FOR UPDATE ──┐
                       │   check existing CONFIRMED    │  row lock serializes
                       │   reservation for table+slot   │  concurrent bookers
                       │   insert reservation            │  of the same table
                    COMMIT  (unique index is the backstop)┘
                                  │
                          fire-and-forget POST
                                  ▼
                         Broadcast Service (/dining/*)
```

## Stack

- Python 3.12 + FastAPI
- PostgreSQL + SQLAlchemy 2.0 (async, via asyncpg)
- httpx (async HTTP client for the Broadcast publisher)

## Prerequisites

- Python 3.12
- A reachable PostgreSQL instance

## Running locally

Via the repo's `docker-compose.yml` (recommended — registers `dining` against the shared
`postgres` container, wires the gateway, and seeds automatically):

```bash
docker compose up --build dining
```

Standalone, against a dedicated Postgres:

```bash
docker run --name dining-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dining -p 5432:5432 -d postgres:16

cd services/dining
pip install -r requirements.txt
uvicorn main:app --port 3004
```

The app runs `Base.metadata.create_all()` and then `seed_if_empty()` at startup (`seed.py`) —
so a fresh empty database is automatically populated with the 4 demo restaurants / 15 tables,
no separate seed step needed. `db/init/seed_restaurants.sql` is kept for reference / a
standalone Postgres container using the `docker-entrypoint-initdb.d` auto-init convention, but
is **not** auto-applied in this repo's shared-postgres compose setup.

Health check:

```bash
curl http://localhost:3004/health
```

## Environment variables

| Var | Default | Description |
|---|---|---|
| `PORT` | `3004` | HTTP port |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/dining` | Async Postgres connection string |
| `BROADCAST_SERVICE_URL` | `http://localhost:3002` | Lighthouse/Broadcast service base URL |
| `INTERNAL_SECRET` | _(empty)_ | If set, sent as `X-Internal-Key` on outbound calls to Broadcast |

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/restaurants` | List all restaurants with aggregate table/seat info |
| GET | `/restaurants/{restaurant_id}` | Single restaurant detail incl. its tables |
| GET | `/restaurants/{restaurant_id}/availability?slot={n}` | Tables free for a given seating slot |
| POST | `/reservations` | Book a table for a guest, with optional pre-order |
| GET | `/reservations/{reservation_id}` | Reservation detail |
| GET | `/reservations/by-guest/{guest_id}` | Guest's active (CONFIRMED) reservations |
| POST | `/reservations/{reservation_id}/cancel` | Cancel a reservation |

All errors share `{ "error": "<message>", "error_code": "<UPPER_SNAKE_CODE>" }`.

| Error code | Status | Meaning |
|---|---|---|
| `RESTAURANT_NOT_FOUND` | 404 | Unknown restaurant id |
| `TABLE_NOT_FOUND` | 404 | Unknown table id |
| `RESERVATION_NOT_FOUND` | 404 | Unknown reservation id |
| `SLOT_REQUIRED` | 400 | Missing/invalid `slot` query param |
| `TABLE_RESTAURANT_MISMATCH` | 400 | `table_id` doesn't belong to `restaurant_id` |
| `PARTY_TOO_LARGE` | 409 | `party_size` exceeds the table's `seats` |
| `TABLE_ALREADY_BOOKED` | 409 | Table already has a CONFIRMED reservation for that slot |
| `GUEST_ALREADY_HAS_RESERVATION` | 409 | Guest already has an active reservation |
| `RESERVATION_ALREADY_CANCELLED` | 409 | Reservation already cancelled |

## Business rules

- A table can be booked by **at most one CONFIRMED reservation per seating slot** —
  enforced both by a `SELECT ... FOR UPDATE` transactional check (friendly 409) and a
  Postgres partial unique index `uq_table_slot_active` (hard backstop).
- A guest may only hold one active (CONFIRMED) reservation at a time.
- Cancelling is a one-way `CONFIRMED → CANCELLED` transition; no capacity check needed.

## Broadcast Service integration

Best-effort, fire-and-forget POSTs to `${BROADCAST_SERVICE_URL}/dining/<event>` using
Airport's `{ channel, message, sender, data }` shape (2s timeout, all exceptions swallowed —
a slow/down Broadcast never adds latency to the booking response):

- `dining.reservation_confirmed` — on successful booking
- `dining.reservation_cancelled` — on cancellation
- `dining.table_full` — on a `TABLE_ALREADY_BOOKED` booking attempt

**Note:** receiving these events end-to-end requires a matching route added to
`services/broadcast/src/routes/dining.ts` (out of scope for this service) — without it,
Dining's POSTs 404 against Broadcast but the booking flow itself is unaffected since
publishing is fire-and-forget.

## Testing

```bash
pip install -r requirements.txt
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/dining pytest tests/ -v
```

`tests/test_concurrency.py` is the core proof of correctness: it fires 20 concurrent booking
attempts at the same table+slot and asserts exactly one succeeds and the database ends up
with exactly one CONFIRMED reservation — the property that Beach (no persisted capacity
check at all) and Hotel (count-then-create race) both lack.

## Project structure

```
services/dining/
  main.py              # App factory, lifespan, middleware, entrypoint
  config.py            # Settings (pydantic-settings)
  database.py          # Async engine, session factory, Base
  models.py            # SQLAlchemy ORM models: Restaurant, Table, Reservation
  schemas.py           # Pydantic request/response models
  routes.py            # APIRouter with all endpoints
  repository.py        # DB access + the atomic booking transaction
  broadcast.py          # Best-effort Broadcast event publisher
  tracing.py            # Request-id contextvar
  db/init/seed_restaurants.sql   # Schema + seed data
  tests/test_concurrency.py      # Overbooking race test
```
