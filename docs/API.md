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

## Auth error codes

| Code | Status | When |
|------|--------|------|
| `NOT_REGISTERED` | 404 | Phone has no account |
| `ACCOUNT_SUSPENDED` | 403 | Account is suspended |
| `OTP_TOO_SOON` | 429 | New code asked within 30 seconds |
| `INVALID_OTP` | 401 | Wrong, expired (5 min), used, or after 5 wrong tries |
| `VALIDATION` | 400 | Bad or missing input |
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Signed in, wrong role |
