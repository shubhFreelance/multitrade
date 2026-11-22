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

Login is phone + 6-digit code. In dev no SMS is sent: the code is printed in the `npm run dev` terminal (`[sms] to 99999…: Saksham Multitrade login code: 123456`). Only numbers that already exist in the `User` table can log in; new members join at `/join`.

## Testing payments (QA)

Online payment uses a built-in **test checkout** while `PAYMENT_PROVIDER="test"` is set in `.env` (it is in `.env.example`). No real money moves; every test screen and receipt says so. Cashfree replaces the checkout later. The rest of the payment logic (marking months paid, duplicate protection, maturity, receipts) is the real code.

A full pass, start to finish:

1. Log in as agent **9800000001** and tap **Enrol a member**. Use a new number (any 10 digits starting 6–9), pick a batch, and send the code. The code is in the `npm run dev` terminal. Fill in the details and enrol.
2. Log out and log in as that new member. **My schemes** shows the 12 months and a **Pay** button for the oldest unpaid month.
3. Tap **Pay**. On the test checkout, try **Make this payment fail (test)** first: the month stays unpaid and you can **Try again**. Then pay successfully: you get an invoice, and the month turns green with an **Invoice** link under **Month by month**.
4. Log back in as the agent. **My members** shows the member's progress.
5. **Cash:** as the agent, open **My members** and tap **Record cash** on a member. The member sees the month as "cash handed over, waiting for the office to check it". Log in as the super admin (**9999999999**), open **Cash** and **Verify** it (or **Reject**: the month goes back to unpaid).
6. **Invoices:** every confirmed payment has an invoice with a **Download invoice (PDF)** button. Agents see their earnings and invoices under **My commission**.
7. **Agent invoices:** as the super admin, open **Invoices**, pick a month that has ended and tap **Create invoices**. Commission earned this month goes on next month's invoice, so to test straight away move commission into last month:
   `docker compose exec db psql -U saksham -c "update \"Commission\" set \"createdAt\" = now() - interval '1 month';"`
   Then **Mark paid** with a UTR, and download the PDF as the super admin or as the agent.

8. **Bonus draw:** a member's dashboard ends with a bonus card. Scooters unlock at 6 confirmed payments in one scheme, the gold chain at 12; cash waiting for the office doesn't count.

9. **Draws:** as an admin, open **Draws** and tap **Run the month 1 draw** on a batch whose first month has started (the seeded batches start in December; create a batch with an earlier start month to test now). Winners see a green "You won" note on their scheme card and the result under **Draw results**.

10. **Joining directly:** log out and open **/join** (or **Join a scheme** under the login form). Enter a new number, pick a batch, use the code from the terminal and fill in your details: you are logged in as the new member, with no Panchayat Leader. **My details** shows how each scheme was joined. A signed-in member can join more schemes under **Join a scheme**.

11. **Tracking:** as an agent, **My members** shows members, schemes joined and commission for this week, this month or all time, and each member's progress and commission; **Details** opens one member. As the super admin, **Agents and members** shows every agent (and members who joined directly) with collections and commission; tap an agent to see their members.

12. **Completion:** when a member pays their last month, or wins a draw, a green card at the top of **My schemes** asks them to act: confirm the delivery address (Upahar), choose a product (Manpasand; add products under the admin's **Products** with the Manpasand scheme) or book the gold purchase (Gold). It stays until they answer. An SMS (printed in the terminal) and a message under **Messages** go out too.

13. **Reminders and overdue:** as the super admin, tap **Run the daily check now** on the admin home. It sends due-soon and due-now SMS (in the terminal), marks months overdue 10 days after the due date and marks members with 2 overdue months in a row as defaulted (out of the draws until they catch up). Members see the messages under **Messages**.

14. **Fulfilment:** as an admin, open **Fulfilment**. Enter today's gold rate, then for each member who answered: pick the Upahar product, allocate the Manpasand product they chose, or enter the gold weight and making charges. If the price is above the plan value, record the difference with a receipt number or UTR, then **Mark delivered**. The member sees the price and what is left to pay on their card.

15. **Bonus draw:** as an admin, open **Draws**. The bonus draw section shows how many members have unlocked each prize; run each prize's draw once. Winners see it on their bonus card and under **Draw results**; mark each prize **handed over** when given.

Things worth checking: paying a later month before an earlier one is refused; a paid month can't be paid again; paying all 12 marks the scheme Matured; Hindi and English both read correctly.

Set `PAYMENT_PROVIDER` to nothing to switch online payment off (the Pay button disappears). The test checkout never runs unless it is set to `test`, so keep it unset in production.

## Daily job

In production, have the host's scheduler call the daily job once a morning:

```sh
curl -X POST https://<your-domain>/api/v1/cron/daily -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` to a long random value. If it is unset the endpoint is off; the super admin can still run the job from the admin home.

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
