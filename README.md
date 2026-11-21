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
npm run dev          # http://localhost:3000
```

### Logging in (dev)

Login is phone + 6-digit code. In dev no SMS is sent: the code is printed in the `npm run dev` terminal (`[sms] to 99999…: Saksham Multitrade login code: 123456`). Only numbers that already exist in the `User` table can log in. Seed users arrive in Feature 2.

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
