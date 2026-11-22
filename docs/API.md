# API (v1)

REST endpoints under `/api/v1`, shared by the web app and the future mobile app.

- Success: `{ "data": ... }`. Failure: `{ "error": { "code", "message" } }` with a matching HTTP status.
- Auth: web sends the session as an httpOnly `session` cookie; mobile sends `Authorization: Bearer <token>`. Sessions last 30 days.
- Money is always integer **paise**.
- Phone numbers are 10 digits, no `+91` (`^[6-9]\d{9}$`).

| Method | Path | Who | Input | Output |
|--------|------|-----|-------|--------|
| POST | `/api/v1/auth/otp` | anyone | `{ phone }` | `{ sent: true, testCode? }`. `testCode` (also on `/join/code` and `/agent/enrolments/code`) is returned only while `SHOW_OTP_ON_SCREEN="true"` for testing, never in production. |
| POST | `/api/v1/auth/verify` | anyone | `{ phone, code, device? }` | `{ token, expiresAt, user }` |
| POST | `/api/v1/auth/logout` | signed in | (none) | `{ loggedOut: true }` |
| GET | `/api/v1/me` | signed in | (none) | `{ id, phone, name, role, language }` |
| GET | `/api/v1/admin/schemes` | admin | (none) | `Scheme[]` |
| PATCH | `/api/v1/admin/schemes/:id` | admin | any of `{ nameEn, nameHi, installmentAmount, tenureMonths }` | `Scheme` |
| GET | `/api/v1/admin/batches` | admin | (none) | `Batch[]` (with `scheme`) |
| POST | `/api/v1/admin/batches` | admin | `{ schemeId, startMonth: "YYYY-MM", size, winnersPerDraw }` | `Batch` (201; `number` is assigned) |
| GET | `/api/v1/admin/batches/:id` | admin | (none) | `Batch` (with `scheme`) |
| PATCH | `/api/v1/admin/batches/:id` | admin | any of `{ startMonth, size, winnersPerDraw, status }` | `Batch` |
| GET | `/api/v1/admin/products` | admin | (none) | `Product[]` |
| POST | `/api/v1/admin/products` | admin | `{ name, nameHi?, price, schemes: SchemeCode[], stock, active? }` | `Product` (201) |
| GET | `/api/v1/admin/products/:id` | admin | (none) | `Product` |
| PATCH | `/api/v1/admin/products/:id` | admin | any product field | `Product` |
| GET | `/api/v1/admin/agents` | admin | (none) | `{ id, phone, name, status, createdAt, agentProfile: { panchayat, approved } }[]`, waiting-for-approval first |
| PATCH | `/api/v1/admin/agents/:id` | admin | `{ approved?, status?: "ACTIVE" \| "SUSPENDED" }` | `{ updated: true }`. Suspending logs the agent out everywhere. Non-agent ids are `NOT_FOUND`. |

| GET | `/api/v1/agent/batches` | approved agent | (none) | open batches with a free seat: `{ id, label, schemeCode, schemeNameEn, schemeNameHi, installmentAmount, tenureMonths, startMonth, seatsLeft }[]` |
| POST | `/api/v1/agent/enrolments/code` | approved agent | `{ phone, batchId }` | `{ existingMember }`. Texts the member a code that approves joining that batch. |
| POST | `/api/v1/agent/enrolments` | approved agent | `{ phone, batchId, code, name?, village?, address?, nominee? }` (name, village, address required for a new phone) | `{ id, tokenNumber, installments }` (201) |

| GET | `/api/v1/batches/open` | anyone | (none) | batches taking enrolments with a free seat: `{ id, label, schemeCode, schemeNameEn, schemeNameHi, installmentAmount, tenureMonths, startMonth, seatsLeft }[]` |
| POST | `/api/v1/join/code` | anyone | `{ phone, batchId }` | `{ existingMember }`; texts a code to the phone |
| POST | `/api/v1/join` | anyone | `{ phone, batchId, code, name?, village?, address?, nominee?, device? }` (details needed for a new number) | `{ enrolment: { id, tokenNumber, installments }, token, expiresAt, user }` (201). The member joins directly: no agent, so no commission. Also logs them in. |
| POST | `/api/v1/me/enrolments` | member | `{ batchId }` | `{ id, tokenNumber, installments }` (201): a signed-in member joins another batch directly |
| GET | `/api/v1/me/enrolments` | member | (none) | the member's own enrolments, newest first: `EnrolmentView[]` |
| GET | `/api/v1/me/draws` | member | (none) | monthly draw results for the member's batches, newest first: `{ batch, scheme, monthNo, createdAt, seed, eligibleCount, winners: [{ token, mine }] }[]` |
| GET | `/api/v1/me/completions` | member | (none) | enrolments that matured or won a draw, waiting for the member (`PENDING`) or the office (`CONFIRMED`): `{ id, reason, status, tokenNumber, scheme, value, address, product, products }[]`. `products` (Manpasand only) lists what can be chosen, each with `difference` = price minus `value`, never below 0. |
| POST | `/api/v1/me/completions/:id` | member | Upahar `{ address }`, Manpasand `{ address, productId }`, Gold `{}` | the completion, now `CONFIRMED` |
| GET | `/api/v1/me/notifications` | member | (none) | `{ id, type: "MATURED" | "WON" | "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | "DEFAULTED", createdAt, readAt, tokenNumber, scheme, dueDate, amount }[]` (`dueDate` and `amount` for reminders), newest first; the app renders the text from `type` |
| POST | `/api/v1/me/notifications/read` | member | (none) | `null`; marks all as read |
| GET | `/api/v1/me/bonus-draws` | member | (none) | bonus draw results (all members see them): `{ prize, createdAt, seed, eligibleCount, winners: [{ token, mine }] }[]` |
| GET | `/api/v1/me/bonus` | member | (none) | `{ prize: "SCOOTER" | "GOLD_CHAIN", count, needed, paid, remaining, unlocked, won }[]`: scooters unlock at 6 paid months, the gold chain at 12 (setting `bonusUnlock`); worked out from PAID installments (pending cash, waived months and defaulted enrolments don't count) |
| GET | `/api/v1/agent/enrolments` | agent | (none) | enrolments this agent made, those owing money first: `EnrolmentView[]` |

`EnrolmentView`: `{ id, tokenNumber, status, scheme: { code, nameEn, nameHi }, member: { name, phone }, agent: { name, phone }, summary }`. `summary` is computed with `summarize()` from `src/shared/tracker.ts` using today's date in India: `{ slots: [{ monthNo, dueDate, amount, status, state }], total, paidCount, paidTotal, next, dueNowCount, dueNowTotal }`, where `state` is `PAID`, `WAIVED`, `OVERDUE`, `DUE_NOW` (due date reached, not paid) or `UPCOMING`.

| POST | `/api/v1/me/payments` | member | `{ installmentId }` (must be the oldest unpaid month) | `{ paymentId, orderId, checkoutUrl }` (201). Send the member to `checkoutUrl`. |
| POST | `/api/v1/me/payments/:id/test` | member, test provider only | `{ status: "SUCCESS" \| "FAILED" }` | the settled `Payment` |
| GET | `/api/v1/payments/:id` | the member who paid, the enrolling agent, admins | (none) | `Payment` with `member`, `installment.enrolment.batch.scheme` (receipt data) |

| POST | `/api/v1/agent/cash` | the enrolling agent | `{ installmentId }` (oldest payable month) | `Payment` with status `PENDING` (201). Counts as paid only after an admin verifies it. |
| GET | `/api/v1/admin/cash` | admin | (none) | cash waiting for verification, oldest first |
| POST | `/api/v1/admin/cash/:id/verify` | admin | (none) | the `Payment`, now `SUCCESS` (or `DUPLICATE` if the month was already paid) |
| POST | `/api/v1/admin/cash/:id/reject` | admin | (none) | the `Payment`, now `FAILED`; the month is unpaid again |

| GET | `/api/v1/agent/commission` | agent | (none) | `{ lines, earned, paid, awaitingRate }` (paise). One line per confirmed payment on a member this agent enrolled. |
| GET | `/api/v1/payments/:id/invoice` | the member who paid, the enrolling agent, admins | (none) | member invoice PDF (`application/pdf`), for counted payments only |
| GET | `/api/v1/agent/network?period=` | agent | `period`: `week` (from Monday), `month` (default) or `all`, India time | `{ period, from, totals: { people, enrolments, joined, commission }, members: (EnrolmentView & { commission: { period, total } })[] }` |
| GET | `/api/v1/agent/network/:id` (an enrolment) | that agent, super admin | (none) | `EnrolmentView` plus `commission`: the commission lines from that member |
| GET | `/api/v1/agent/campaign` | agent | (none) | `{ campaign, started, ended, awarded, count, reached, next, toNext }` or `null` if there is no campaign |
| GET | `/api/v1/agent/statement` | agent | (none) | CSV (`text/csv`, UTF-8 with BOM): every commission line (installment and recruitment bonus) and every payout (paid invoice with gross, TDS, net, UTR), by date. Labels in the viewer's language; amounts as plain rupees (`1234.50`). |
| GET | `/api/v1/admin/agents/:id/statement` | super admin | (none) | the same CSV for one agent |
| GET | `/api/v1/agent/invoices` | agent | (none) | the agent's commission invoices (not cancelled), newest first |
| GET | `/api/v1/agent-invoices/:id/pdf` | that agent, super admin | (none) | agent commission invoice PDF |
| GET | `/api/v1/admin/invoices?q=` | super admin | `q` searches member invoices | `{ agentInvoices, uninvoicedTotal, uninvoicedCount, awaitingRate, memberInvoices }` |
| GET | `/api/v1/admin/network?period=` | admin | `period` as above | `{ period, from, agents: { id, name, phone, panchayat, approved, suspended, joinedAt, members, joined, collected, commission, unpaid, paidOut }[], agentsJoined, collectedSeries: { keys, counts, totals }, direct, totals }`. `collectedSeries`: money collected through agents per day (week, month) or per month (all: last 12 months). `joined`, `collected` and `commission` are for the period; `members`, `unpaid` and `paidOut` are all-time. `direct` is members who joined without an agent. |
| GET | `/api/v1/admin/network/members?period=&source=` | admin | `source`: `direct` (default) or `agent` | `{ period, source, totals: { people, joined, direct, throughAgents, collected }, joinedSeries: { keys, counts, totals }, members: EnrolmentView[] }`: one row per scheme joined, newest first, with who enrolled them |
| GET | `/api/v1/admin/network/:agentId?period=` | admin | `period` as above | `{ agent, ...same as /agent/network }` |
| POST | `/api/v1/cron/daily` | the scheduler, with `Authorization: Bearer <CRON_SECRET>` | (none) | `{ today, overdue, defaulted, dueSoon, dueToday }`. Marks months `OVERDUE` more than `overdueAfterDays` (10) after the due date unless cash is waiting; marks enrolments `DEFAULTED` after `defaultAfterMissedInARow` (2) overdue months in a row; queues due-soon (`reminderDaysBefore`, 3), due-now, overdue and defaulted messages, and sends their SMS. Safe to run twice. 503 `CRON_DISABLED` if `CRON_SECRET` is unset. |
| POST | `/api/v1/admin/daily` | super admin | (none) | same as the cron, run by hand |
| GET | `/api/v1/admin/fulfilment` | admin | (none) | `{ items, upaharProducts, goldRate, recentRates, gstBps }`: every open completion plus the last 50 delivered, each with `value` (plan value in paise) |
| POST | `/api/v1/admin/gold-rates` | admin | `{ ratePerGram, day? }` (paise; day defaults to today, India) | the rate; entering it again for the same day corrects it |
| POST | `/api/v1/admin/fulfilment/:id/allocate` | admin | Upahar `{ productId }`, Manpasand `{}`, Gold `{ weightMg, making }` | the fulfilment, now `ALLOCATED`, with `price`, `priceDetails` and `differenceDue`. Needs the member's answer first; takes one unit of stock; Gold needs today's rate. |
| POST | `/api/v1/admin/fulfilment/:id/difference-paid` | admin | `{ ref }` (receipt number or UTR) | the fulfilment with `differencePaidAt` |
| POST | `/api/v1/admin/fulfilment/:id/delivered` | admin | (none) | the fulfilment, now `DELIVERED`; refused while a difference is unpaid |
| GET | `/api/v1/admin/bonus-draws` | admin | (none) | per prize (`SCOOTER`, `GOLD_CHAIN`): `{ prize, count, needed, eligibleNow, draw: { id, createdAt, seed, eligibleCount, winners: [{ id, token, name, phone, handedOverAt }] } | null }` |
| POST | `/api/v1/admin/bonus-draws` | admin | `{ prize }` | `{ id, prize, seed, eligibleCount, winners }` (201). Once per prize. Eligible: members who unlocked the prize (paid months in one scheme, defaulted schemes left out) and haven't won a bonus prize; each entered once with the token of their most-paid scheme. Winners get a message and SMS; no installments change. |
| POST | `/api/v1/admin/bonus-draws/winners/:id/handed-over` | admin | (none) | `{ id }`; records that the office gave the prize |
| GET | `/api/v1/admin/campaign` | super admin | (none) | `{ campaign, ended, agents: { id, name, panchayat, count, reached, next, toNext, awarded }[] }` |
| PUT | `/api/v1/admin/campaign` | super admin | `{ start, end, countsAfterPaidInstallments, tiers: [{ enrolments, bonus }] }` (dates `YYYY-MM-DD`, bonus in paise, tiers rising) | the campaign. Refused (`CAMPAIGN_AWARDED`) once its bonuses were awarded. |
| POST | `/api/v1/admin/campaign/award` | super admin | (none) | the bonus commission lines created (201): one per agent, the highest tier reached. Only after the end date (`CAMPAIGN_NOT_OVER`); safe to repeat. They go on the next agent invoice like other commission. |
| GET | `/api/v1/admin/overview` | admin | (none) | `{ members, enrolments: { ACTIVE, MATURED, WON, DEFAULTED }, pendingCash, dueNow, overdueMonths, toAllocate, toDeliver, drawsReady, agentsWaiting, money }`; `money` (`collectedMonth`, `collectedAll`, `commissionNotInvoiced`, `invoicesUnpaid`) is `null` unless super admin |
| GET | `/api/v1/admin/exports/:kind?from=&to=` | super admin | `kind`: `enrolments`, `payments`, `commission` or `agents`; `from`/`to` India dates, both included, default this month (payments and commission only) | CSV download |
| GET | `/api/v1/admin/draws` | admin | (none) | every batch with its draws, `nextMonth`, `opensOn` and `canRun` |
| POST | `/api/v1/admin/draws` | admin | `{ batchId, monthNo }` (must be the next month not drawn yet) | `{ id, monthNo, seed, eligibleCount, winners }` (201). Eligible: ACTIVE enrolments with no overdue month. Winners become `WON` and their unpaid months after `monthNo` are `WAIVED`. Winners are `pickWinners(seed, sorted eligible tokens, winnersPerDraw)` in `src/server/draws.ts`, so anyone with the seed and list can re-check them. |
| POST | `/api/v1/admin/agent-invoices` | super admin | `{ period: "YYYY-MM" }` (a month that has ended) | the invoices created (201): one per agent with unbilled commission up to the end of that month |
| POST | `/api/v1/admin/agent-invoices/:id/paid` | super admin | `{ utr }` | the invoice, now `PAID`; its commission lines become `PAID` |
| POST | `/api/v1/admin/agent-invoices/:id/cancel` | super admin | (none) | the invoice, now `CANCELLED`; its lines go back for the next invoice. Paid invoices can't be cancelled. |

Gold price: `goldPrice()` in `src/shared/fulfilment.ts`: rate per gram × weight (rounded to the paisa) + GST on the gold (`goldGstBps`, 300 = 3%) + making charges + GST on making (`makingGstBps`, 500 = 5%), each part rounded once. Difference = price − what the member has paid (PAID months only; waived months don't count), never below 0.

Invoices: every counted member payment gets a gapless number per Indian financial year (`SM/2026-27/000123`), assigned in the same transaction. Agent invoices are numbered `SMC/2026-27/0001`. TDS uses the `tdsBps` setting (default 200 = 2%), rounded to the paisa. PDFs follow the viewer's language (Hindi or English).

Commission: created in the same transaction that counts a payment, for the enrolling agent. Manpasand ₹50 flat, Gold 1% (rounded down to the paisa), Upahar ₹0 with `ruleMissing: true` until the tier table arrives. Reversal on refund comes with refunds (not built yet).

Payments: `PAYMENT_PROVIDER` in the environment picks the provider (`test` now; `cashfree` once wired; unset = off). Every provider settles orders through one function, `confirmPayment`. It is safe to call repeatedly (webhook retries count once), refuses a wrong amount, and marks money for an already-paid month as `DUPLICATE` for refund. Paying the last unpaid month sets the enrolment to `MATURED`.

Enrolment: the code is sent to the member's phone and only works for the batch it was sent for. On success the member is created if new, the next token number is assigned (`UPH-B01-0001`), and one installment per month of the tenure is created, due on the 1st of each month from the batch's start month.

"admin" means role `ADMIN` or `SUPER_ADMIN`. Money fields (`installmentAmount`, `price`) are integer paise. Every admin change is written to the audit log.

Batch rules: `status` only moves forward (`OPEN` → `RUNNING` → `CLOSED`). Once a batch is not `OPEN`, only `status` can change.

## Error codes

| Code | Status | When |
|------|--------|------|
| `NOT_REGISTERED` | 404 | Phone has no account |
| `ACCOUNT_SUSPENDED` | 403 | Account is suspended |
| `OTP_TOO_SOON` | 429 | New code asked within 30 seconds |
| `INVALID_OTP` | 401 | Wrong, expired (5 min), used, or after 5 wrong tries |
| `VALIDATION` | 400 | Bad or missing input |
| `NOT_FOUND` | 404 | No such record |
| `CONFLICT` | 409 | Duplicate (e.g. two batches created at the same moment) |
| `BATCH_LOCKED` | 409 | Changing month/size/winners of a batch that isn't `OPEN` |
| `BATCH_STATUS_BACKWARDS` | 409 | Moving a batch's status backwards |
| `AGENT_NOT_APPROVED` | 403 | Agent not approved yet |
| `PHONE_IN_USE` | 409 | Phone belongs to an agent or admin |
| `BATCH_NOT_OPEN` | 409 | Batch isn't taking enrolments |
| `BATCH_FULL` | 409 | Batch has no free seat |
| `MEMBER_DETAILS_REQUIRED` | 400 | New member without name, village or address |
| `PAYMENTS_DISABLED` | 503 | Online payment is switched off |
| `ALREADY_PAID` | 409 | Month is already paid or waived |
| `PAY_OLDEST_FIRST` | 409 | An earlier month is still unpaid |
| `AMOUNT_MISMATCH` | 400 | Gateway amount differs from the order |
| `CASH_PENDING` | 409 | Cash for this month is waiting for verification |
| `CASH_NOT_PENDING` | 409 | Cash entry already verified or rejected |
| `DRAW_ALREADY_RUN` | 409 | That month's draw for the batch was already run |
| `DRAW_OUT_OF_ORDER` | 409 | An earlier month's draw hasn't been run |
| `DRAW_NOT_OPEN` | 409 | The month hasn't started, or it is the last month (no draw) |
| `NO_ELIGIBLE` | 409 | Nobody in the batch can win right now |
| `ALREADY_CONFIRMED` | 409 | The member already answered this completion |
| `ADDRESS_REQUIRED` | 400 | Upahar or Manpasand without a delivery address |
| `WRONG_STEP` | 409 | Fulfilment isn't at that step (e.g. allocating before the member answered) |
| `OUT_OF_STOCK` | 409 | Product has no stock left |
| `NO_GOLD_RATE` | 409 | Pricing gold before today's rate is entered |
| `NOTHING_DUE` | 409 | Recording a difference when nothing is owed |
| `DIFFERENCE_UNPAID` | 409 | Delivering before the difference is received |
| `PRODUCT_UNAVAILABLE` | 409 | Manpasand product missing, inactive, out of stock or not a Manpasand product |
| `PERIOD_NOT_OVER` | 409 | Agent invoices asked for the current or a future month |
| `INVOICE_NOT_ISSUED` | 409 | Paying or cancelling an invoice that is already paid or cancelled |
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Signed in, wrong role |
