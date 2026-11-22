# Saksham Multitrade

Web app for Saksham Multitrade's advance-purchase installment schemes (Upahar, Manpasand, Gold). Roles: Super Admin, Agent (Panchayat Leader), Member.

The build plan and rules are in [CLAUDE.md](CLAUDE.md). Client questions still open are in [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md). Endpoints are in [docs/API.md](docs/API.md).

## Stack

Next.js (App Router) + TypeScript, PostgreSQL + Prisma 7, Tailwind + shadcn/ui, Zod, Vitest.

## Run locally

Needs Node 24+ and Docker Desktop (running).

```sh
npm install
cp .env.example .env
npm run db:up        # start Postgres in Docker
npm run db:migrate   # apply migrations
npm run db:seed      # settings, 3 schemes with 1 batch each, demo users (safe to re-run)
npm run dev          # http://localhost:3000
```

### Demo logins (dev only)

| Phone | Role |
|-------|------|
| 9999999999 | Super Admin |
| 9800000001, 9800000002 | Agent (approved) |
| 9800000003 | Agent (not yet approved) |
| 9700000001 – 9700000030 | Member |

Demo users are never created when `NODE_ENV=production`. Settings and schemes are, but only if missing, so admin edits are never overwritten.

### Logging in (dev)

Login is phone + 6-digit code. In dev no SMS is sent: the code is printed in the `npm run dev` terminal (`[sms] to 99999…: Saksham Multitrade login code: 123456`). Only numbers that already exist in the `User` table can log in. Seed users arrive in Feature 2.

## Testing payments (QA)

Online payment uses a built-in **test checkout** while `PAYMENT_PROVIDER="test"` is set in `.env` (it is in `.env.example`). No real money moves; every test screen and receipt says so. Cashfree replaces the checkout later. The rest of the payment logic (marking months paid, duplicate protection, maturity, receipts) is the real code.

A full pass, start to finish:

1. Log in as agent **9800000001** and tap **Enrol a member**. Use a new number (any 10 digits starting 6–9), pick a batch, and send the code. The code is in the `npm run dev` terminal. Fill in the details and enrol.
2. Log out and log in as that new member. **My schemes** shows the 12 months and a **Pay** button for the oldest unpaid month.
3. Tap **Pay**. On the test checkout, try **Make this payment fail (test)** first: the month stays unpaid and you can **Try again**. Then pay successfully: you get a receipt, and the month turns green with a **Receipt** link under **Month by month**.
4. Log back in as the agent. **My members** shows the member's progress.

Things worth checking: paying a later month before an earlier one is refused; a paid month can't be paid again; paying all 12 marks the scheme Matured; Hindi and English both read correctly.

Set `PAYMENT_PROVIDER` to nothing to switch online payment off (the Pay button disappears). The test checkout never runs unless it is set to `test`, so keep it unset in production.

## Schema changes

After editing `prisma/schema.prisma`, run `npm run db:migrate` and then `npx prisma generate`. Prisma 7 doesn't regenerate the client on migrate.

## Checks

```sh
npm run lint
npm run typecheck
npm test        # uses TEST_DATABASE_URL (a separate DB), applies migrations, tests clear their own tables
```

## Layout

```
src/app/          pages, plus api/v1/ REST endpoints
src/server/       business logic (no React, no direct DB access from pages)
src/shared/       zod schemas, types, constants (reusable by the mobile app)
src/components/   UI components
src/lib/          db client, helpers
prisma/           schema and migrations
docs/             API.md, OPEN_QUESTIONS.md
```
