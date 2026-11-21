import { toAppError } from "@/server/errors";

export const ok = (data: unknown, status = 200) => Response.json({ data }, { status });

/** Runs a route handler body and turns thrown errors into the standard `{ error }` response. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    const { code, message, status } = toAppError(e);
    return Response.json({ error: { code, message } }, { status });
  }
}

/** Request body as JSON, or null if it isn't valid JSON (zod then rejects it). */
export const readJson = (req: Request): Promise<unknown> => req.json().catch(() => null);
