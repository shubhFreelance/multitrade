// Admin management of agents (Panchayat Leaders).
import { db } from "@/lib/db";
import { agentUpdateInput } from "@/shared/agents";
import { adminRoles, type SessionUser } from "@/shared/auth";
import { audit } from "./audit";
import { requireRole } from "./auth";


/** Agents awaiting approval first, then by name. */
export async function listAgents(user: SessionUser | null) {
  requireRole(user, adminRoles);
  return db.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, phone: true, name: true, status: true, createdAt: true, agentProfile: { select: { panchayat: true, approved: true } } },
    orderBy: [{ agentProfile: { approved: "asc" } }, { name: "asc" }],
  });
}

export async function updateAgent(user: SessionUser | null, agentId: string, input: unknown) {
  const actor = requireRole(user, adminRoles);
  const { approved, status } = agentUpdateInput.parse(input);
  return db.$transaction(async (tx) => {
    // Only agents can be changed here; any other id is NOT_FOUND.
    const agent = await tx.user.findFirstOrThrow({ where: { id: agentId, role: "AGENT" }, include: { agentProfile: true } });
    if (approved !== undefined) await tx.agentProfile.update({ where: { userId: agentId }, data: { approved } });
    if (status) {
      await tx.user.update({ where: { id: agentId }, data: { status } });
      if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId: agentId } }); // log them out everywhere
    }
    await audit(tx, actor.id, "agent.update", "User", agentId, {
      before: { approved: agent.agentProfile?.approved ?? null, status: agent.status },
      after: { approved, status },
    });
  });
}

/** The signed-in agent's own profile. */
export async function getMyAgentProfile(user: SessionUser | null) {
  const agent = requireRole(user, ["AGENT"]);
  return db.agentProfile.findUnique({ where: { userId: agent.id } });
}
