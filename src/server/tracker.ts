// Read-only views of enrolments and their installments: a member sees their own, an agent sees the ones they enrolled.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { summarize, todayInIndia, type TrackerSummary } from "@/shared/tracker";
import { requireRole } from "./auth";

const include = {
  batch: { include: { scheme: true } },
  installments: { include: { payments: { where: { status: { in: ["SUCCESS", "PENDING"] } }, select: { id: true, status: true } } } },
  member: { select: { name: true, phone: true } },
  agent: { select: { name: true, phone: true } },
  drawWins: { where: { draw: { type: "MONTHLY" } }, select: { draw: { select: { monthNo: true } } } }, // bonus prizes are not a monthly win
} satisfies Prisma.EnrolmentInclude;

type Row = Prisma.EnrolmentGetPayload<{ include: typeof include }>;

export type EnrolmentView = {
  id: string;
  tokenNumber: string;
  status: string;
  wonMonth: number | null; // monthly draw this enrolment won
  createdAt: Date;
  scheme: { code: string; nameEn: string; nameHi: string };
  member: { name: string; phone: string };
  agentId: string | null;
  agent: { name: string; phone: string } | null; // null: joined directly
  summary: TrackerSummary;
};

const toView = (e: Row, today: string): EnrolmentView => ({
  id: e.id,
  tokenNumber: e.tokenNumber,
  status: e.status,
  wonMonth: e.drawWins[0]?.draw.monthNo ?? null,
  createdAt: e.createdAt,
  scheme: { code: e.batch.scheme.code, nameEn: e.batch.scheme.nameEn, nameHi: e.batch.scheme.nameHi },
  member: e.member,
  agentId: e.agentId,
  agent: e.agent,
  summary: summarize(
    e.installments.map((i) => ({
      id: i.id,
      monthNo: i.monthNo,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amount: i.amount,
      status: i.status,
      receiptId: i.payments.find((p) => p.status === "SUCCESS")?.id ?? null,
      pending: i.payments.some((p) => p.status === "PENDING"),
    })),
    today,
  ),
});

/** Enrolments matching `where` as views, by token number. Callers check access first. */
export async function enrolmentViews(where: Prisma.EnrolmentWhereInput): Promise<EnrolmentView[]> {
  const rows = await db.enrolment.findMany({ where, include, orderBy: { tokenNumber: "asc" } });
  const today = todayInIndia();
  return rows.map((r) => toView(r, today));
}

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
  return (await enrolmentViews({ agentId: agent.id })).sort((a, b) => b.summary.dueNowTotal - a.summary.dueNowTotal);
}

/** The signed-in member's profile and, per enrolment, who enrolled them (null agent: joined directly). */
export async function getMyAccount(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  return db.user.findUniqueOrThrow({
    where: { id: member.id },
    select: {
      name: true,
      phone: true,
      createdAt: true,
      memberProfile: { select: { village: true, address: true, nominee: true } },
      enrolments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          tokenNumber: true,
          status: true,
          createdAt: true,
          batch: { select: { scheme: { select: { nameEn: true, nameHi: true } } } },
          agent: { select: { name: true, phone: true, agentProfile: { select: { panchayat: true } } } },
        },
      },
    },
  });
}
