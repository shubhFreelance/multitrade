# API (v1)

REST endpoints under `/api/v1`, shared by the web app and the future mobile app.

- Success: `{ "data": ... }`. Failure: `{ "error": { "code", "message" } }` with a matching HTTP status.
- Auth: web sends the session as an httpOnly `session` cookie; mobile sends `Authorization: Bearer <token>`. Sessions last 30 days.
- Money is always integer **paise**.
- Phone numbers are 10 digits, no `+91` (`^[6-9]\d{9}$`).

| Method | Path | Who | Input | Output |
|--------|------|-----|-------|--------|
| POST | `/api/v1/auth/otp` | anyone | `{ phone }` | `{ sent: true }` |
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
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Signed in, wrong role |
