# Open questions for the client

Numbers stay the same as items are answered, so code comments like `CONFIRM #18` keep pointing at the right row. Values live in the `Config` table or the scheme settings, not in code.

## Still open

| # | Area | Question | What the app does until answered |
|---|------|----------|----------------------------------|
| 3 | Upahar commission | The product tier table for ₹80–₹200 per paid installment. | Flat ₹80 per paid installment (client, Nov 2026). When the table arrives, the Upahar rule becomes tiers. |
| 4 | Manpasand | If the chosen product costs **less** than what the member paid, do they get money back or a voucher? | No refund. The difference is shown only when the product costs more. |
| 6 | Agent levels | Single-level commission only, or upline/downline? | Single-level: only the enrolling agent earns. |
| 8 | TDS | TDS % on agent commission (Section 194H). Confirm with the CA. | 2% (setting `tdsBps` = 200). |
| 11 | SMS | MSG91 account, sender ID and DLT-approved templates (login code, enrolment code, reminders, wins). | Dev prints messages in the server console. Production refuses to send until configured; payments and draws still work. |
| 12 | Company details | CIN, registered address and registration numbers for the footer, invoices and PDFs. | Blank in the `company` setting until provided. |
| 14 | Invoices and GST | Must member invoices carry GSTIN, HSN and tax lines, or is an installment an advance with GST charged at delivery? Is the agent commission document a self-billed invoice that needs the company GSTIN? Confirm with the CA. | Plain invoices with company name, CIN and address from settings. No GST lines on installment invoices. |
| 17 | Joining directly | Members can join on the website without an agent. Can an agent be linked to such a member later, and who collects their cash? | No agent and no commission for direct enrolments; they pay online. An agent can't be added later. |
| 19 | Gold booking | Should the member pick a date when booking, and is the rate locked when they book or on the day they buy? | The member books; the office calls to fix the day; the price uses the gold rate of the day the office prices it. |
| 21 | Upahar gift value | Upahar products are picked by the company. Can the gift cost more than what was paid, and does the member ever pay a difference? | The member never pays a difference for Upahar. |

## Decided

| # | Area | Decision |
|---|------|----------|
| 1 | Draw winner | Gets the scheme's product early; later months are waived. Must have no overdue month to be drawn. |
| 2 | Overdue / default | Overdue 10 days after the due date; defaulted after 2 overdue months in a row, out of draws until caught up (client, Nov 2026). Settings `overdueAfterDays`, `defaultAfterMissedInARow`. |
| 5 | Bonus unlock | Counted in one enrolment. Scooters unlock at 6 paid months, the gold chain at 12 (client, Nov 2026). |
| 7 | Recruitment bonus | Counts if the enrolment was made in the campaign window and its 1st installment was paid by the last day. The agent gets the highest tier reached, not the sum, as commission on their next invoice (TDS applies). |
| 9, 20 | Gold price | One daily rate, 22K. GST 3% on the gold value and 5% on making charges (client, Nov 2026). Settings `goldGstBps` = 300, `makingGstBps` = 500. Making charges are entered per purchase. |
| 10 | Sign-up | Members can join on the website (`/join`) or be enrolled by an agent (client, Nov 2026). Agents and admins are still created by the office. |
| 13 | Due date | Due on the 1st of each month from the batch start month (client, Nov 2026). Joining is allowed while the batch is Open; a late joiner's earlier months are already due. |
| 15 | Commission on refunds | Unpaid commission is reversed; commission already paid out is deducted from the agent's next invoice (client, Nov 2026). Refunds themselves are not built yet. |
| 16 | Draw winners | A month N winner still owes any unpaid months up to N; months after N are waived (client, Nov 2026). The admin can run month N's draw any day from the 1st of month N, one month at a time. A winner is out of that batch's later draws but can join any new batch. |
| 18 | Value towards the product | Only what the member actually paid counts towards a Manpasand product or a gold purchase; months waived by a draw win don't (client, Nov 2026). |
| 22 | Bonus draw | Held once per prize, run when the admin chooses. A member wins at most one bonus prize, and is entered once however many schemes they hold (client, Nov 2026). |
