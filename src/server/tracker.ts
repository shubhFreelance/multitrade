// Read-only views of enrolments and their installments: a member sees their own, an agent sees the ones they enrolled.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { summarize, todayInIndia, type TrackerSummary } from "@/shared/tracker";
import { requireRole } from "./auth";

const include = {
  batch: { include: { scheme: true } },
  installments: { include: { payments: { where: { status: "SUCCESS" }, select: { id: true }, take: 1 } } },
  member: { select: { name: true, phone: true } },
  agent: { select: { name: true, phone: true } },
} satisfies Prisma.EnrolmentInclude;

type Row = Prisma.EnrolmentGetPayload<{ include: typeof include }>;

export type EnrolmentView = {
  id: string;
  tokenNumber: string;
  status: string;
  scheme: { code: string; nameEn: string; nameHi: string };
  member: { name: string; phone: string };
  agent: { name: string; phone: string };
  summary: TrackerSummary;
};

const toView = (e: Row, today: string): EnrolmentView => ({
  id: e.id,
  tokenNumber: e.tokenNumber,
  status: e.status,
  scheme: { code: e.batch.scheme.code, nameEn: e.batch.scheme.nameEn, nameHi: e.batch.scheme.nameHi },
  member: e.member,
  agent: e.agent,
  summary: summarize(
    e.installments.map((i) => ({
      id: i.id,
      monthNo: i.monthNo,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amount: i.amount,
      status: i.status,
      receiptId: i.payments[0]?.id ?? null,
    })),
    today,
  ),
});

/** The signed-in member's enrolments, newest first. */
export async function listMyEnrolments(user: SessionUser | null): Promise<EnrolmentView[]> {
  const member = requireRole(user, ["MEMBER"]);
  const rows = await db.enrolment.findMany({ where: { memberId: member.id }, include, orderBy: { createdAt: "desc" } });
  const today = todayInIndia();
  return rows.map((r) => toView(r, today));
}

/** Enrolments the signed-in agent made: members who owe money now first, then by token number. */
export async function listAgentEnrolments(user: SessionUser | null): Promise<EnrolmentView[]> {
  const agent = requireRole(user, ["AGENT"]);
  // shortcut: loads all of an agent's enrolments with installments; fine for a few hundred members per agent, paginate beyond that.
  const rows = await db.enrolment.findMany({ where: { agentId: agent.id }, include, orderBy: { tokenNumber: "asc" } });
  const today = todayInIndia();
  return rows.map((r) => toView(r, today)).sort((a, b) => b.summary.dueNowTotal - a.summary.dueNowTotal);
}
