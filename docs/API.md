# API (v1)

REST endpoints under `/api/v1`, shared by the web app and the future mobile app.

- Success: `{ "data": ... }`. Failure: `{ "error": { "code", "message" } }` with a matching HTTP status.
- Auth: web sends the session as an httpOnly cookie; mobile sends `Authorization: Bearer <token>`.
- Money is always integer **paise**.

| Method | Path | Who | Input | Output |
|--------|------|-----|-------|--------|
| _none yet_ | | | | |
