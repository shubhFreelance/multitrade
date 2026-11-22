"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { confirmEnrolment, sendEnrolmentCode } from "@/server/enrolment";
import { recordCash } from "@/server/payments";
import { toAppError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import type { EnrolConfirm } from "@/shared/enrolment";

export async function sendEnrolmentCodeAction(phone: string, batchId: string) {
  try {
    return await sendEnrolmentCode(await getCurrentUser(), { phone, batchId });
  } catch (e) {
    return { error: toAppError(e).code };
  }
}

export async function confirmEnrolmentAction(input: EnrolConfirm) {
  try {
    return await confirmEnrolment(await getCurrentUser(), input);
  } catch (e) {
    return { error: toAppError(e).code };
  }
}

export async function recordCashAction(installmentId: string): Promise<FormState> {
  try {
    await recordCash(await getCurrentUser(), installmentId);
  } catch (e) {
    return { error: toAppError(e).code };
  }
  revalidatePath("/agent", "layout");
  return { ok: true };
}
