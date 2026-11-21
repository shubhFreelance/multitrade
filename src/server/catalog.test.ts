import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { Role, SessionUser } from "@/shared/auth";
import { failsWith, resetDb } from "../../test/db";
import { createBatch, createProduct, listSchemes, updateBatch, updateProduct, updateScheme } from "./catalog";

let admin: SessionUser;
let schemeId: string;

const makeUser = async (role: Role, phone: string): Promise<SessionUser> => {
  const u = await db.user.create({ data: { phone, name: role, role } });
  return { id: u.id, phone, name: u.name, role, language: "hi" };
};

beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN", "9000000001");
  schemeId = (
    await db.scheme.create({
      data: { code: "MANPASAND", nameEn: "Manpasand", nameHi: "मनपसंद", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: {} },
    })
  ).id;
});

const newBatch = () => createBatch(admin, { schemeId, startMonth: "2027-01", size: 2500, winnersPerDraw: 10 });

describe("access control", () => {
  it("only admins can read or change the catalog", async () => {
    for (const role of ["MEMBER", "AGENT"] as const) {
      const user = await makeUser(role, role === "MEMBER" ? "9000000002" : "9000000003");
      await failsWith(listSchemes(user), "FORBIDDEN");
      await failsWith(updateScheme(user, schemeId, { nameEn: "Hacked" }), "FORBIDDEN");
      await failsWith(createProduct(user, { name: "TV", price: 100, schemes: ["UPAHAR"], stock: 1 }), "FORBIDDEN");
    }
    await failsWith(listSchemes(null), "UNAUTHENTICATED");
    expect((await db.scheme.findUniqueOrThrow({ where: { id: schemeId } })).nameEn).toBe("Manpasand");
  });
});

describe("schemes", () => {
  it("updates details and writes an audit entry in the same change", async () => {
    await updateScheme(admin, schemeId, { installmentAmount: 2_500_00 });
    expect((await db.scheme.findUniqueOrThrow({ where: { id: schemeId } })).installmentAmount).toBe(2_500_00);
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: schemeId } });
    expect(log).toMatchObject({ actorId: admin.id, action: "scheme.update" });
  });

  it("rejects non-integer or zero money", async () => {
    await failsWith(updateScheme(admin, schemeId, { installmentAmount: 2000.5 }), "VALIDATION");
    await failsWith(updateScheme(admin, schemeId, { installmentAmount: 0 }), "VALIDATION");
  });
});

describe("batches", () => {
  it("numbers batches per scheme and stores the first day of the month", async () => {
    const b1 = await newBatch();
    const b2 = await newBatch();
    expect([b1.number, b2.number]).toEqual([1, 2]);
    expect(b1.startMonth.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("locks month, size and winners once running, but allows moving status forward", async () => {
    const b = await newBatch();
    await updateBatch(admin, b.id, { status: "RUNNING" });
    await failsWith(updateBatch(admin, b.id, { size: 3000 }), "BATCH_LOCKED");
    await failsWith(updateBatch(admin, b.id, { startMonth: "2027-02" }), "BATCH_LOCKED");
    await failsWith(updateBatch(admin, b.id, { status: "OPEN" }), "BATCH_STATUS_BACKWARDS");
    await updateBatch(admin, b.id, { status: "CLOSED" });
    expect((await db.batch.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CLOSED");
  });

  it("returns NOT_FOUND for a missing batch or scheme", async () => {
    await failsWith(updateBatch(admin, "nope", { size: 1 }), "NOT_FOUND");
    await failsWith(createBatch(admin, { schemeId: "nope", startMonth: "2027-01", size: 1, winnersPerDraw: 0 }), "NOT_FOUND");
  });
});

describe("products", () => {
  it("creates active by default; a partial edit doesn't re-activate it", async () => {
    const p = await createProduct(admin, { name: "Steel almirah", price: 24_000_00, schemes: ["UPAHAR"], stock: 5 });
    expect(p.active).toBe(true);
    await updateProduct(admin, p.id, { active: false });
    await updateProduct(admin, p.id, { stock: 4 });
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ active: false, stock: 4 });
  });

  it("needs at least one scheme", async () => {
    await failsWith(createProduct(admin, { name: "Fan", price: 100, schemes: [], stock: 1 }), "VALIDATION");
  });
});
