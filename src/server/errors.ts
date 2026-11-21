/** A known, user-facing failure. `code` is stable for clients; `status` is the HTTP status. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
