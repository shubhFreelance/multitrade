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

## Checks

```sh
npm run lint
npm run typecheck
npm test
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
