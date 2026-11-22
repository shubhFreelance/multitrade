# Open questions for the client

Each item has the default the app uses until the client answers. Defaults live in the `Config` table / scheme config, not in code.

| # | Area | Question | Default used for now |
|---|------|----------|----------------------|
| 1 | Draw | What exactly does a draw winner get? | Gets the scheme's product early; remaining installments are waived. Must have no overdue installment to be eligible. |
| 2 | Overdue / default | When is an installment overdue, and when is a member defaulted? | Overdue 10 days after due date. 2 missed in a row means defaulted: out of draws until cleared. Further action is manual by admin. |
| 3 | Upahar commission | What is the product tier table for ₹80–₹200 per paid installment? | Not set. Needs the tier table before Feature 9 (Commission). |
| 4 | Manpasand | What happens if the chosen product costs **less** than the amount paid? | Not decided. Needs an answer before Feature 14 (Fulfilment). |
| 5 | Bonus unlock | Is "6 paid installments" counted in **one enrolment** or **across all enrolments**? | One enrolment. |
| 6 | Agent levels | Single-level commission only, or upline/downline? | Single-level: only the enrolling agent earns. |
| 7 | Recruitment bonus | When does an enrolment count towards the campaign, and does the agent get only the highest tier? | Counts after its 1st installment is paid. Agent gets the highest tier reached, not the sum. |
| 8 | TDS | TDS % on agent commission (Section 194H)? Confirm with the CA. | Config value, set per CA advice. |
| 9 | Gold | Which gold purity is used for the Gold Plan, and how are making charges set? | GST 3%. Purity and making charges are entered by admin. |
| 10 | Login | Can people sign themselves up (members or agent applicants), or does every account start from an agent/admin? | Only numbers already in the system can log in. Members are created at enrolment (Feature 5). |
| 11 | SMS | MSG91 account, sender ID and DLT-approved OTP template? | Dev logs the code to the server console. Production refuses to send until configured. |
| 12 | Company details | CIN, registered address and registration numbers for the footer and receipts? | Blank in the `company` config value until provided. |
| 13 | Due date | Which day of the month is each installment due? Can members join a batch after its first month has started? | Due on the 1st of each month from the batch start month. Joining is allowed while the batch is Open; a late joiner's earlier months are already due. |
| 14 | Invoices and GST | Must member invoices carry GSTIN, HSN and tax lines, or is an installment an advance with GST charged at delivery? Is the agent commission document a self-billed invoice that needs the company GSTIN? Confirm with the CA. | Plain invoices with company name, CIN and address from settings. No GST lines yet. |
| 15 | Commission on refunds | When a member payment is refunded, the agent's commission must be reversed. What if it was already paid out on an invoice? | Refunds aren't built yet. Default when they are: reverse unpaid commission; deduct already-paid commission from the agent's next invoice. |
