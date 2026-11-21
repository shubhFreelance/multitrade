import { ZodError } from "zod";
import { AppError } from "@/server/errors";

export const ok = (data: unknown, status = 200) => Response.json({ data }, { status });

const fail = (code: string, message: string, status: number) => Response.json({ error: { code, message } }, { status });

/** Runs a route handler body and turns thrown errors into the standard `{ error }` response. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    if (e instanceof ZodError) return fail("VALIDATION", e.issues[0]?.message ?? "Invalid input", 400);
    console.error(e);
    return fail("INTERNAL", "Something went wrong", 500);
  }
}

/** Request body as JSON, or null if it isn't valid JSON (zod then rejects it). */
export const readJson = (req: Request): Promise<unknown> => req.json().catch(() => null);
