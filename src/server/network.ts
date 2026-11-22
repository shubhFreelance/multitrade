// Who enrolled whom, and what it earned: an agent's own members, and the super admin's view of every agent.
// Money totals are summed from payment and commission rows, never stored.
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { periodInput, periodStart, type Period } from "@/shared/network";
import { todayInIndia } from "@/shared/tracker";
import { requireRole } from "./auth";
import { AppError } from "./errors";
import { enrolmentViews } from "./tracker";

const NO_AGENT = "direct"; // key for members who joined on their own

/** Commission per enrolment of one agent: earned in the period and in all, in paise. Reversed commission doesn't count. */
async function commissionByEnrolment(agentId: string, from: Date) {
  const rows = await db.$queryRaw<{ enrolmentId: string; period: bigint | null; total: bigint }[]>`
    select i."enrolmentId", sum(c.amount) filter (where c."createdAt" >= ${from}) as period, sum(c.amount) as total
    from "Commission" c join "Payment" p on p.id = c."paymentId" join "Installment" i on i.id = p."installmentId"
    where c."agentId" = ${agentId} and c.status <> 'REVERSED'
    group by i."enrolmentId"`;
  return new Map(rows.map((r) => [r.enrolmentId, { period: Number(r.period ?? 0), total: Number(r.total) }]));
}

/** One agent's members (an enrolment each) with progress and commission, plus totals for the period. */
async function agentNetwork(agentId: string, period: Period) {
  const from = periodStart(period, todayInIndia());
  const [views, commission] = await Promise.all([enrolmentViews({ agentId }), commissionByEnrolment(agentId, from)]);
  const members = views.map((e) => ({ ...e, commission: commission.get(e.id) ?? { period: 0, total: 0 } }));
  const inPeriod = members.filter((m) => m.createdAt >= from);
  return {
    period,
    from,
    totals: {
      people: new Set(members.map((m) => m.member.phone)).size,
      enrolments: members.length,
      joined: inPeriod.length,
      commission: members.reduce((t, m) => t + m.commission.period, 0),
    },
    // shortcut: every member in one list; fine for a few hundred per agent, paginate beyond that.
    members: members.sort((a, b) => b.commission.period - a.commission.period || b.createdAt.getTime() - a.createdAt.getTime()),
  };
}

/** The signed-in agent's members and earnings for `week`, `month` or `all`. */
export async function getMyNetwork(user: SessionUser | null, period: unknown) {
  const agent = requireRole(user, ["AGENT"]);
  return agentNetwork(agent.id, periodInput.parse(period));
}

/** Super admin: one agent's members and earnings. */
export async function getAgentNetwork(user: SessionUser | null, agentId: string, period: unknown) {
  requireRole(user, ["SUPER_ADMIN"]);
  const agent = await db.user.findFirst({ where: { id: agentId, role: "AGENT" }, include: { agentProfile: true } });
  if (!agent) throw new AppError("NOT_FOUND", "Not found", 404);
  return { agent: { id: agent.id, name: agent.name, phone: agent.phone, panchayat: agent.agentProfile?.panchayat ?? "" }, ...(await agentNetwork(agentId, periodInput.parse(period))) };
}

type Row = { agentId: string | null; n: bigint };

/**
 * Super admin: every agent (and members who joined directly) with members enrolled, money collected and commission.
 * `joined`, `collected` and `commission` are for the period; `members`, `unpaid` and `paidOut` are all-time.
 */
export async function networkOverview(user: SessionUser | null, period: unknown) {
  requireRole(user, ["SUPER_ADMIN"]);
  const p = periodInput.parse(period);
  const from = periodStart(p, todayInIndia());
  const [agents, members, joined, collected, commission, unpaid, paidOut] = await Promise.all([
    db.user.findMany({ where: { role: "AGENT" }, include: { agentProfile: true }, orderBy: { name: "asc" } }),
    db.$queryRaw<Row[]>`select "agentId", count(distinct "memberId") as n from "Enrolment" group by "agentId"`,
    db.$queryRaw<Row[]>`select "agentId", count(*) as n from "Enrolment" where "createdAt" >= ${from} group by "agentId"`,
    db.$queryRaw<Row[]>`
      select e."agentId", sum(p.amount) as n from "Payment" p
      join "Installment" i on i.id = p."installmentId" join "Enrolment" e on e.id = i."enrolmentId"
      where p.status = 'SUCCESS' and p."paidAt" >= ${from} group by e."agentId"`,
    db.$queryRaw<Row[]>`select "agentId", sum(amount) as n from "Commission" where status <> 'REVERSED' and "createdAt" >= ${from} group by "agentId"`,
    db.$queryRaw<Row[]>`select "agentId", sum(amount) as n from "Commission" where status = 'EARNED' group by "agentId"`,
    db.$queryRaw<Row[]>`select "agentId", sum(amount) as n from "Commission" where status = 'PAID' group by "agentId"`,
  ]);
  const byAgent = (rows: Row[]) => new Map(rows.map((r) => [r.agentId ?? NO_AGENT, Number(r.n)]));
  const [m, j, c, k, u, po] = [members, joined, collected, commission, unpaid, paidOut].map(byAgent);
  const line = (key: string) => ({
    members: m.get(key) ?? 0,
    joined: j.get(key) ?? 0,
    collected: c.get(key) ?? 0,
    commission: k.get(key) ?? 0,
    unpaid: u.get(key) ?? 0,
    paidOut: po.get(key) ?? 0,
  });
  const rows = agents
    .map((a) => ({ id: a.id, name: a.name, phone: a.phone, panchayat: a.agentProfile?.panchayat ?? "", approved: a.agentProfile?.approved ?? false, ...line(a.id) }))
    .sort((a, b) => b.collected - a.collected || b.members - a.members);
  const direct = line(NO_AGENT);
  const sum = (k: "members" | "joined" | "collected" | "commission" | "unpaid" | "paidOut") => rows.reduce((t, r) => t + r[k], direct[k]);
  return {
    period: p,
    from,
    agents: rows,
    direct,
    totals: { members: sum("members"), joined: sum("joined"), collected: sum("collected"), commission: sum("commission"), unpaid: sum("unpaid"), paidOut: sum("paidOut") },
  };
}

/** One enrolment of the signed-in agent, with its commission lines; or any enrolment for the super admin. */
export async function getNetworkEnrolment(user: SessionUser | null, enrolmentId: string) {
  const u = requireRole(user, ["AGENT", "SUPER_ADMIN"]);
  const [view] = await enrolmentViews({ id: enrolmentId, ...(u.role === "AGENT" ? { agentId: u.id } : {}) });
  if (!view) throw new AppError("NOT_FOUND", "Not found", 404);
  const lines = await db.commission.findMany({
    where: { payment: { installment: { enrolmentId } }, ...(u.role === "AGENT" ? { agentId: u.id } : {}) },
    include: { payment: { select: { paidAt: true, method: true, amount: true, installment: { select: { monthNo: true, dueDate: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return { ...view, commission: lines };
}
