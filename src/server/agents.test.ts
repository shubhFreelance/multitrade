import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { getMyAgentProfile, listAgents, updateAgent } from "./agents";
import { getUserByToken } from "./auth";

let admin: SessionUser;
let agent: SessionUser;

beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN", "9000000001");
  agent = await makeUser("AGENT", "9000000002");
  await db.agentProfile.create({ data: { userId: agent.id, panchayat: "Arang" } });
});

describe("agent approval", () => {
  it("lists agents waiting for approval first", async () => {
    const other = await makeUser("AGENT", "9000000003");
    await db.agentProfile.create({ data: { userId: other.id, panchayat: "Tilda", approved: true } });
    expect((await listAgents(admin)).map((a) => a.id)).toEqual([agent.id, other.id]);
  });

  it("approves an agent and audits who did it", async () => {
    await updateAgent(admin, agent.id, { approved: true });
    expect((await getMyAgentProfile(agent))?.approved).toBe(true);
    expect(await db.auditLog.findFirstOrThrow({ where: { entityId: agent.id } })).toMatchObject({ actorId: admin.id, action: "agent.update" });
  });

  it("suspending logs the agent out everywhere; reactivating restores access", async () => {
    const token = "t1";
    await db.session.create({
      data: { userId: agent.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60_000) },
    });
    await updateAgent(admin, agent.id, { status: "SUSPENDED" });
    expect(await db.session.count({ where: { userId: agent.id } })).toBe(0);
    expect(await getUserByToken(token)).toBeNull();
    await updateAgent(admin, agent.id, { status: "ACTIVE" });
    expect((await db.user.findUniqueOrThrow({ where: { id: agent.id } })).status).toBe("ACTIVE");
  });
});

describe("access control", () => {
  it("agents and members can't approve or suspend anyone, including themselves", async () => {
    const member = await makeUser("MEMBER", "9000000004");
    for (const who of [agent, member]) {
      await failsWith(updateAgent(who, agent.id, { approved: true }), "FORBIDDEN");
      await failsWith(listAgents(who), "FORBIDDEN");
    }
    expect((await getMyAgentProfile(agent))?.approved).toBe(false);
  });

  it("only agents can be changed here", async () => {
    await failsWith(updateAgent(admin, admin.id, { status: "SUSPENDED" }), "NOT_FOUND");
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe("ACTIVE");
  });

  it("rejects an empty change", async () => {
    await failsWith(updateAgent(admin, agent.id, {}), "VALIDATION");
  });

  it("a member can't read an agent profile", async () => {
    await failsWith(getMyAgentProfile(await makeUser("MEMBER", "9000000005")), "FORBIDDEN");
  });
});
