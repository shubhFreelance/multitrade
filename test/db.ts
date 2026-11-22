import { expect } from "vitest";
import { toAppError } from "@/server/errors";
import { db } from "@/lib/db";
import type { Role, SessionUser } from "@/shared/auth";

/** Empties every table in the test database (the global setup refuses to run against the dev database). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = current_schema() and tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`truncate ${tables.map((t) => `"${t.tablename}"`).join(", ")} cascade`);
}

/** Asserts `p` fails with the given app error code, after the same mapping the API applies. */
export const failsWith = (p: Promise<unknown>, code: string) =>
  expect(p.catch((e) => Promise.reject(toAppError(e)))).rejects.toMatchObject({ code });

/** Creates a user and returns it as the signed-in SessionUser. */
export async function makeUser(role: Role, phone: string): Promise<SessionUser> {
  const u = await db.user.create({ data: { phone, name: `${role} ${phone}`, role } });
  return { id: u.id, phone, name: u.name, role, language: "hi" };
}
