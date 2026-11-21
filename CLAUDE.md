# Saksham Multitrade — Web App Build Prompt for Claude Code

> **How to use:** Create an empty project folder, connect it to a GitHub repo, save this file in it as `CLAUDE.md`, then start Claude Code and say:
> *"Read CLAUDE.md and start with Feature 0."*

---

## 1. Your role and attitude

You are a senior full-stack engineer with 10+ years of experience building money-handling apps for Indian businesses.

**Keep it simple. Do not over-engineer.**
- Build only what the current feature needs. No speculative abstractions, no extra layers, no "for the future" code.
- Prefer boring, well-known tools and the standard library. Ask before adding any dependency not listed in Section 6.
- One way to do each thing. Small files, clear names, minimal config.
- Business rules marked **[CONFIRM]** are unknown: pick the simplest safe default, put the value in the config table, and add the question to `docs/OPEN_QUESTIONS.md`. Never invent new business rules.

---

## 2. Git workflow (IMPORTANT)

We ship one feature at a time and **push to GitHub as soon as each feature works**.

For every feature in Section 10:
1. Build the feature (code + its tests if it touches money, draws or access control).
2. Run `npm run lint`, `npm run typecheck`, `npm test`. Fix anything failing.
3. Update `docs/OPEN_QUESTIONS.md` and `README.md` only if something changed.
4. Commit with a clear message (`feat: member installment payment via Razorpay`) and **push**.
5. Reply with a 3–5 line summary: what was built, how to try it, anything I need to decide. Then continue with the next feature unless I say stop.

Rules:
- Never push broken code or failing tests.
- Never commit secrets — `.env` is gitignored; keep `.env.example` updated.
- One feature per commit (small fixes inside a feature are fine as separate commits).
- Database changes go in as Prisma migrations, committed with the feature that needs them.

---

## 3. Business context

**Saksham Multitrade Pvt Ltd** runs *advance-purchase installment schemes*. Members pay a fixed monthly installment for 12 months and receive a product. Every month a draw picks a few members who get their product early and stop paying. Field agents, called **Panchayat Leaders**, enrol members, collect installments and earn commission.

Three types of user: **Super Admin**, **Agent**, **Member (User)**.

Users are mostly in rural Chhattisgarh on low-end Android phones with slow networks; many prefer **Hindi**. Mobile-first, light pages, large tap targets, simple words.

**A mobile app (Android first) will be built later.** It will use the same backend. So the backend must be usable by a mobile client from day one — see Section 6.

---

## 4. The schemes

All numbers below are **defaults stored in config per scheme/batch**, not hard-coded.

### 4.1 Common mechanics (per batch)
| Parameter | Default |
|---|---|
| Members per batch | 2,500 |
| Monthly installment | ₹2,000 |
| Tenure | 12 months |
| Monthly draws | Months 1–11, 10 winners each (110 total) |
| Get product at month 12 | Everyone else (2,390) |

- A **Batch** is one cohort in one scheme with a start month. Each member gets a unique **Token Number** per enrolment (e.g. `UPH-B03-0457`).
- A member can have several enrolments; each is tracked separately.
- **Draw winner:** gets the product per the scheme rules; remaining installments are **waived**. Must have no overdue installment to be eligible. [CONFIRM exact winner benefit]
- **Maturity:** all 12 installments paid → enrolment is *Matured* → fulfilment.
- **Overdue/default:** [CONFIRM]. Default: overdue 10 days after due date; 2 missed in a row → defaulted and out of draws until cleared. Admin handles any further action manually.

### 4.2 Upahar Plan
- The company picks the product.
- Agent commission: **₹80–₹200 per paid installment** by product tier. [CONFIRM tier table]

### 4.3 Manpasand Plan
- The member chooses the product; pays the difference if it costs more than the amount paid. [CONFIRM what happens if it costs less]
- Agent commission: **₹50 per paid installment**.

### 4.4 Gold Plan
- At fulfilment: price = **gold rate that day × weight + making charges + GST** (GST default 3%). Admin enters the daily gold rate. The member pays any difference.
- Agent commission: **1% of each paid installment**.

### 4.5 Bonus Rewards — Scooters & Gold Chain (LOCKED by default)
- Bonus draw for **5 scooters + 1 gold chain** (configurable).
- **Locked for every member by default.**
- **Unlocks when the member has 6 confirmed paid installments in one enrolment of any of the three plans.** [CONFIRM: one enrolment (default) or cumulative?]
- Must not be defaulted at draw time to be included.
- Member sees a locked card with progress ("4 of 6 paid — 2 more to unlock") and an unlocked state.
- Unlock is calculated from paid installments, not a manual flag.

---

## 5. Agents and commission

- **Single-level only:** the agent who enrolled the member earns commission on that enrolment. No upline/downline. [CONFIRM — if the client wants levels, ask me first.]
- Commission is created **only when an installment is confirmed paid**, and reversed if the payment is refunded.
- **Recruitment bonus campaign** (config): e.g. 17 Nov – 31 Dec 2026: 30 enrolments → ₹1,500, 50 → ₹4,000, 100 → ₹20,000. Default: an enrolment counts after its 1st installment is paid; agent gets the highest tier reached. [CONFIRM]
- **Payouts:** admin marks commissions as paid in a batch with a UTR reference. TDS % is a config value (default per Section 194H; confirm with CA).
- Agents must be approved by admin before they can enrol members.
- The UI shows only real earned/pending amounts — **no income promises** anywhere.

---

## 6. Tech stack and structure (mobile-ready, but simple)

- **Next.js (App Router) + TypeScript (strict)** — one app, one repo.
- **PostgreSQL + Prisma.**
- **Tailwind CSS + shadcn/ui.**
- **Zod** for all input validation.
- **Vitest** for tests.
- **Razorpay** for online payments (test mode in dev).
- **SMS OTP** via MSG91 (or similar) behind one small function; in dev, log the OTP to the console.
- **i18n:** `next-intl`, Hindi + English; no hard-coded UI text.
- **Scheduled jobs** (reminders, overdue marking): a simple cron route/script — no job queue.

### Mobile-ready rules (the only "future" work we do now)
1. **All business logic lives in `src/server/`** (plain TypeScript functions, no React). Web pages never touch the database directly.
2. **Every action the web app does is also available as a JSON REST endpoint under `/api/v1/...`** (route handlers calling the same `src/server` functions). The future mobile app will use exactly these endpoints. Web pages may call server functions directly or use the API — but both go through `src/server`.
3. **Auth works for both web and mobile:** phone + OTP → server creates a session token stored in the DB. Web gets it as an httpOnly cookie; mobile sends it as `Authorization: Bearer <token>`. Same session table, same checks.
4. **Zod schemas and response types live in `src/shared/`** so the mobile app can reuse them later.
5. Consistent JSON response shape: `{ data }` on success, `{ error: { code, message } }` on failure. Use proper HTTP status codes.
6. Keep `docs/API.md` as a simple list of endpoints (method, path, who can call it, input, output). Update it with each feature.

That's it — no monorepo, no separate API server, no GraphQL/tRPC, no microservices.

### Folder layout
```
src/
  app/
    (member)/  (agent)/  (admin)/   ← pages
    api/v1/                          ← REST endpoints for web + future mobile
  server/        ← business logic: auth, payments, commission, draws, etc.
  shared/        ← zod schemas, types, constants
  components/    ← UI components
  lib/           ← db client, money helpers, i18n setup
prisma/          ← schema + migrations + seed
docs/            ← API.md, OPEN_QUESTIONS.md
```

---

## 7. Must-have rules (kept because money is involved)

- **Money in paise as integers.** Never floats. Format only in the UI.
- **Balances are calculated from payment/commission records**, not stored as editable numbers.
- **Money changes run in a DB transaction**, and payment webhooks are **idempotent** (same Razorpay payment ID never counts twice).
- **Access control on the server for every endpoint:** members see only their own data; agents only their own members; only admins verify cash or run draws.
- **Agent cash collection:** agent records it → status `PENDING` → admin verifies → only then it counts as paid (for totals, commission and bonus unlock).
- **Audit log:** one simple table recording who did what and when for admin actions, cash verification, draws, payouts and manual edits.
- **Fair draws:** before a draw, save the list of eligible token numbers; generate a random seed; pick winners deterministically from the seed; save seed + list + winners; block re-running the same draw. Show the seed and winners on the results page.
- Don't store full Aadhaar numbers (last 4 digits only; document image in private storage).
- Company legal details (CIN, address, registration numbers) come from config and appear in the footer and on receipts.

---

## 8. Data model (starting point — keep it lean)

`User` (phone, name, role: MEMBER | AGENT | ADMIN | SUPER_ADMIN, language, status) ·
`Session` (user_id, token_hash, expires_at, device) ·
`AgentProfile` (user_id, panchayat, pan, payout_details, approved) ·
`MemberProfile` (user_id, address, village, nominee) ·
`Scheme` (code: UPAHAR | MANPASAND | GOLD, names, installment_amount, tenure, commission_rule JSON) ·
`Batch` (scheme_id, start_month, size, winners_per_draw, status) ·
`Enrolment` (member_id, batch_id, agent_id, token_number, status) ·
`Installment` (enrolment_id, month_no, due_date, amount, status: DUE | PAID | OVERDUE | WAIVED) ·
`Payment` (installment_id, method: ONLINE | CASH, amount, razorpay_payment_id, status, verified_by) ·
`Commission` (agent_id, payment_id, amount, type: INSTALLMENT | BONUS, status: EARNED | REVERSED | PAID, payout_id) ·
`Payout` (agent_id, total, tds, utr, paid_at) ·
`Draw` (batch_id, type: MONTHLY | BONUS, month_no, seed, eligible_list JSON, status) · `DrawWinner` ·
`Product` (name, price, schemes, stock) · `Fulfilment` (enrolment_id, product_id, price_details JSON, difference_due, delivered_at) ·
`GoldRate` (date, purity, rate_per_gram) ·
`Notification` (user_id, type, title, body, read_at) ·
`AuditLog` · `Config` (key/value).

Add tables only when a feature needs them.

---

## 9. Tests (only where they matter)

Write Vitest tests for:
1. Commission amount per scheme (tier / ₹50 / 1%), and reversal on refund.
2. Duplicate payment webhook doesn't double-count.
3. Bonus unlock: 5 paid → locked, 6th confirmed → unlocked; pending cash doesn't count.
4. Draw: same seed → same winners; overdue/defaulted/already-won never selected; re-run blocked.
5. Draw win waives remaining installments; 12th payment → Matured.
6. Gold and Manpasand difference calculations (exact to the paisa).
7. Access control: member A can't read member B; agent can't see another agent's members or verify cash.

No e2e test suite for now.

---

## 10. Features, in order (push after each one)

**0. Setup** — Next.js + TS + Tailwind + shadcn, Prisma + Postgres, lint/typecheck/test scripts, `.env.example`, folder layout, `docs/API.md`, `docs/OPEN_QUESTIONS.md` (all [CONFIRM] items), README with run steps. → push
**1. Auth** — phone OTP login, sessions (cookie + bearer), roles, route protection, logout. → push
**2. Seed data + config** — config table, 3 schemes, 1 batch each, 1 admin, 3 agents, 30 members. → push
**3. Admin: schemes, batches, products** — basic CRUD screens + API. → push
**4. Admin: agents** — list, approve/suspend. → push
**5. Agent: enrol a member** — form, member confirms via their own OTP, token number assigned, 12 installments generated. → push
**6. Member: My Schemes + tracker** — enrolment cards, paid X/12, total paid, next due, month-by-month timeline. → push
**7. Online payment** — Razorpay order + webhook, installment marked paid, receipt page. → push
**8. Agent cash collection + admin verification.** → push
**9. Commission** — created on confirmed payment, reversed on refund; agent commission page. → push
**10. Bonus Rewards lock/unlock** — locked card with progress on member dashboard. → push
**11. Monthly draws** — admin runs a draw, winners' installments waived, results page for members. → push
**12. Completion prompts + notifications** — on maturity or winning: in-app prompt that stays until actioned (Upahar: confirm address; Manpasand: choose product; Gold: book purchase with today's rate). SMS too. → push
**13. Reminders + overdue marking** — cron: due-soon, due-today, overdue. → push
**14. Fulfilment** — admin queue: allocate product → delivered; gold and Manpasand difference handling; daily gold rate entry. → push
**15. Bonus draw** — scooters + gold chain draw among unlocked members. → push
**16. Recruitment campaigns** — config + agent progress bar + bonus commission. → push
**17. Payouts** — admin creates payout with TDS + UTR; agent statement download (CSV). → push
**18. Admin overview dashboard + CSV exports.** → push
**19. Hindi translations pass + mobile UI polish.** → push

After every feature: lint, typecheck, test, commit, **push**, short summary.

---

## Project notes

- Prisma 7 with the `@prisma/adapter-pg` driver adapter (Prisma 7 requires one). `dotenv` is used by `prisma.config.ts`. The generated client lives in `src/generated/prisma` (gitignored, made by `npm install`).

@AGENTS.md
