# Mel Management

A web app for running telebirr agent shifts. Staff record each work session's
balances; the app checks the session against the expected commission and sends
anything outside tolerance to the admin for approval. The admin also manages
SIMs, money transfers and a daily summary with capital tracking.

Built with React + Vite on top of Supabase (Postgres, logins and access rules).
Each business runs its own copy: its own Supabase project and its own Vercel site.

## Features

- **Sessions:** 4 per day, one SIM each. Start values prefill from the last approved session.
- **Checking:** profit vs. commission (3% deposits, 2% withdrawals), with complaints added
  in. Within ±150 birr is a *Match*; *Over* / *Short* waits on the admin's **Approvals** page.
- **History:** approved sessions for everyone, plus your own pending or rejected ones.
- **Transfers:** money between the owner, the admin and staff. These update the SIM balances.
- **Summary (admin):** totals by staff, SIM and day for a date range, and capital measured
  from a chosen *Working capital in* to now.
- **SIMs (admin):** add, rename, assign, deactivate, and set balances by hand.
- **Audit log:** every change to sessions and transfers is recorded in the database.

## Getting started

Requires Node.js 20.19 or newer.

```bash
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm install
npm run dev
```

The database is set up by running [`supabase/schema.sql`](supabase/schema.sql) in the
Supabase SQL Editor. See [DEPLOY.md](DEPLOY.md) for the full setup, accounts and
deployment to Vercel.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the tests once |
| `npm run lint` | Lint the code |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

GitHub Actions runs lint, tests and build on every push and pull request.

## Project layout

```
src/
  pages/        one file per screen (Home, History, Approvals, Summary, Transfers, SIMs, Login)
  components/   forms, list items and shared UI
  functions/    calculations and Supabase API calls (*Api.js), with tests in __tests__/
  auth/         login state and role (admin / staff)
supabase/
  schema.sql    tables, triggers, access rules and the authoritative calculation
```

## The session calculation lives in two places

`calc_session()` in `supabase/schema.sql` decides Match / Over / Short when a session is
saved; `src/functions/calcBalance.js` is the on-screen preview. Change both together and
re-run `schema.sql` in **each** Supabase project. The test
`src/functions/__tests__/calcParity.test.js` runs the SQL function in an in-memory
Postgres and fails if the two copies disagree.
