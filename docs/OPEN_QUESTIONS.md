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
