# Exercise Tracker (React + Go + Postgres 17)

Multi-user exercise logger with per-day workouts, exercises, sets, undo/redo on client, and auto-save for edits.

## Stack
- Backend: Go 1.23, chi, sqlx, pgx, JWT cookie auth, Argon2id
- DB: Postgres 17 with extensions (pgcrypto, citext, pg_trgm)
- Frontend: React + Vite + TypeScript, Zustand store, debounced auto-save

## Quick start (Docker Compose - backend + DB only)
1. Create a `.env` from `env.example` (optional)
2. Start stack:
   ```bash
   docker compose up --build
   ```
3. Backend runs at `http://localhost:8080`
4. Postgres at `localhost:5432` (user/password/db from env)

## Frontend (develop separately)
1. Open `frontend/`
2. Install deps and run:
   ```bash
   npm install
   npm run dev
   ```
3. Ensure backend CORS env `FRONTEND_ORIGIN` matches the dev URL (default `http://localhost:5173`)

## Catalog import from CSV
- Use the CSV importer to populate `exercise_catalog` from `megaGymDataset.csv`.
- Example:
  ```bash
  cd backend
  DATABASE_URL=postgres://app:app@localhost:5432/exercisetracker?sslmode=disable \
    go run ./cmd/import_catalog_csv --csv ../megaGymDataset.csv --batch 500
  ```

## Environment (backend)
- `PORT` (default: `8080`)
- `DATABASE_URL` (e.g., `postgres://app:app@db:5432/exercisetracker?sslmode=disable`)
- `JWT_SECRET` (required)
- `FRONTEND_ORIGIN` (e.g., `http://localhost:5173`)
- `COOKIE_DOMAIN` (optional; set for production custom domains)

## API (high level)
- Auth: `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`
- Days: `GET /api/days?date=YYYY-MM-DD&ensure=true`, `POST /api/days`
- Exercises: `POST /api/days/:dayId/exercises`, `PATCH /api/exercises/:id`, `DELETE /api/exercises/:id`
- Sets: `POST /api/exercises/:id/sets`, `PATCH /api/sets/:id`, `DELETE /api/sets/:id`

## Database schema
Key tables:
- `users`, `workout_days`, `exercises` (with `comment`), `sets` (denormalized `user_id`/`workout_date`)
Extensions: `pgcrypto`, `citext`, `pg_trgm`. Includes materialized view `set_facts` for analytics.

## Notes
- Undo/redo is client-side; edits are auto-saved (debounced) via PATCH endpoints
- Migrations are embedded and applied on server startup
- Dockerfile builds a static binary and runs as non-root


