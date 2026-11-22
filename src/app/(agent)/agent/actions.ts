"use server";

import { confirmEnrolment, sendEnrolmentCode } from "@/server/enrolment";
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
