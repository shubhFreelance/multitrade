// An approved agent enrols a member into an open batch; the member confirms with a code sent to their phone.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import type { SessionUser } from "@/shared/auth";
import { batchLabel } from "@/shared/catalog";
import { enrolCodeInput, enrolConfirmInput, tokenNumber, type EnrolmentResult } from "@/shared/enrolment";
import { requireRole } from "./auth";
import { AppError } from "./errors";
import { sendCode, consumeCode } from "./otp";

async function requireApprovedAgent(user: SessionUser | null) {
  const agent = requireRole(user, ["AGENT"]);
  const profile = await db.agentProfile.findUnique({ where: { userId: agent.id } });
  if (!profile?.approved) throw new AppError("AGENT_NOT_APPROVED", "Your account is not approved yet", 403);
  return agent;
}

/** The batch, if it is taking enrolments and has a free seat. */
async function openBatch(client: Prisma.TransactionClient, batchId: string) {
  const batch = await client.batch.findUniqueOrThrow({
    where: { id: batchId },
    include: { scheme: true, _count: { select: { enrolments: true } } },
  });
  if (batch.status !== "OPEN") throw new AppError("BATCH_NOT_OPEN", "This batch is not taking enrolments", 409);
  if (batch._count.enrolments >= batch.size) throw new AppError("BATCH_FULL", "This batch is full", 409);
  return batch;
}

/** The existing member with this phone, or null if the phone is new. */
async function memberByPhone(phone: string) {
  const user = await db.user.findUnique({ where: { phone } });
  if (user && user.role !== "MEMBER") throw new AppError("PHONE_IN_USE", "This number belongs to a staff account", 409);
  if (user?.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "This account is suspended", 403);
  return user;
}

/** First day of the month, `months` after `start` (UTC). */
const addMonths = (start: Date, months: number) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));

export async function listOpenBatches(user: SessionUser | null) {
  await requireApprovedAgent(user);
  const batches = await db.batch.findMany({
    where: { status: "OPEN" },
    include: { scheme: true, _count: { select: { enrolments: true } } },
    orderBy: [{ scheme: { code: "asc" } }, { number: "asc" }],
  });
  return batches
    .filter((b) => b._count.enrolments < b.size)
    .map((b) => ({
      id: b.id,
      label: batchLabel(b.scheme.code, b.number),
      schemeCode: b.scheme.code,
      schemeNameEn: b.scheme.nameEn,
      schemeNameHi: b.scheme.nameHi,
      installmentAmount: b.scheme.installmentAmount,
      tenureMonths: b.scheme.tenureMonths,
      startMonth: b.startMonth.toISOString().slice(0, 7),
      seatsLeft: b.size - b._count.enrolments,
    }));
}

/** Step 1: texts the member a code that approves joining this batch. */
export async function sendEnrolmentCode(user: SessionUser | null, input: unknown): Promise<{ existingMember: boolean }> {
  const agent = await requireApprovedAgent(user);
  const { phone, batchId } = enrolCodeInput.parse(input);
  const member = await memberByPhone(phone);
  const { scheme } = await openBatch(db, batchId);
  await sendCode(
    phone,
    "ENROL",
    batchId,
    (code) =>
      `Saksham Multitrade: agent ${agent.name} is enrolling you in ${scheme.nameEn}, ` +
      `${formatPaise(scheme.installmentAmount)} a month for ${scheme.tenureMonths} months. ` +
      `Code: ${code}. Give it to the agent only if you agree.`,
  );
  return { existingMember: member !== null };
}

/** Step 2: with the member's code, creates the member (if new), the enrolment and its installments. */
export async function confirmEnrolment(user: SessionUser | null, input: unknown): Promise<EnrolmentResult> {
  const agent = await requireApprovedAgent(user);
  const { phone, batchId, code, name, village, address, nominee } = enrolConfirmInput.parse(input);
  const existing = await memberByPhone(phone);
  if (!existing && (!name || !village || !address)) {
    throw new AppError("MEMBER_DETAILS_REQUIRED", "Name, village and address are needed for a new member", 400);
  }
  await consumeCode(phone, "ENROL", code, batchId);

  return db.$transaction(async (tx) => {
    // Lock the batch row: enrolments into one batch run one at a time, so seats and token numbers can't clash.
    await tx.$queryRaw`select id from "Batch" where id = ${batchId} for update`;
    const batch = await openBatch(tx, batchId);
    const member =
      existing ??
      (await tx.user.create({
        data: { phone, name: name!, memberProfile: { create: { village: village!, address: address!, nominee } } },
      }));
    const last = await tx.enrolment.findFirst({ where: { batchId }, orderBy: { seq: "desc" }, select: { seq: true } });
    const seq = (last?.seq ?? 0) + 1;

    const enrolment = await tx.enrolment.create({
      data: {
        memberId: member.id,
        agentId: agent.id,
        batchId,
        seq,
        tokenNumber: tokenNumber(batch.scheme.code, batch.number, seq),
        installments: {
          create: Array.from({ length: batch.scheme.tenureMonths }, (_, i) => ({
            monthNo: i + 1,
            dueDate: addMonths(batch.startMonth, i),
            amount: batch.scheme.installmentAmount,
          })),
        },
      },
    });
    return { id: enrolment.id, tokenNumber: enrolment.tokenNumber, installments: batch.scheme.tenureMonths };
  });
}
