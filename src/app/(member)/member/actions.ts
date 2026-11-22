"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { revalidatePath } from "next/cache";
import { confirmFulfilment } from "@/server/completion";
import { joinBatch } from "@/server/enrolment";
import { toAppError } from "@/server/errors";
import { simulateTestPayment, startPayment } from "@/server/payments";
import { getCurrentUser } from "@/server/session";

export async function payAction(installmentId: string): Promise<FormState> {
  let url: string;
  try {
    url = (await startPayment(await getCurrentUser(), installmentId)).checkoutUrl;
  } catch (e) {
    return { error: toAppError(e).code };
  }
  redirect(url);
}

export async function simulatePaymentAction(paymentId: string, status: "SUCCESS" | "FAILED"): Promise<FormState> {
  try {
    await simulateTestPayment(await getCurrentUser(), paymentId, status);
  } catch (e) {
    return { error: toAppError(e).code };
  }
  redirect(`/member/receipts/${paymentId}`);
}

export async function joinBatchAction(batchId: string): Promise<FormState> {
  try {
    await joinBatch(await getCurrentUser(), { batchId });
  } catch (e) {
    return { error: toAppError(e).code };
  }
  redirect("/member");
}

export async function confirmFulfilmentAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    const str = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
    await confirmFulfilment(await getCurrentUser(), id, { address: str("address"), productId: str("productId") });
  } catch (e) {
    return { error: toAppError(e).code };
  }
  revalidatePath("/member", "layout");
  return { ok: true };
}
