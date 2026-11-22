import { handle, ok, readJson } from "@/lib/api";
import { confirmJoin } from "@/server/enrolment";

// For the mobile app: also logs the member in and returns the token to send as `Authorization: Bearer <token>`.
export const POST = (req: Request) =>
  handle(async () => {
    const body = (await readJson(req)) as { device?: unknown } | null;
    const { enrolment, login } = await confirmJoin(body, typeof body?.device === "string" ? body.device.slice(0, 100) : undefined);
    return ok({ enrolment, ...login }, 201);
  });
