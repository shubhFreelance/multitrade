"use server";

import { revalidatePath } from "next/cache";
import { rupeesToPaise } from "@/lib/money";
import { updateAgent } from "@/server/agents";
import { rejectCash, verifyCash } from "@/server/payments";
import { runMonthlyDraw } from "@/server/draws";
import { cancelAgentInvoice, createAgentInvoices, markAgentInvoicePaid } from "@/server/invoices";
import { createBatch, createProduct, updateBatch, updateProduct, updateScheme } from "@/server/catalog";
import { AppError, toAppError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import type { SessionUser } from "@/shared/auth";
import type { FormState } from "@/components/action-form";

// FormData → typed input. Empty fields become undefined so partial updates leave them alone.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || undefined;
const num = (fd: FormData, k: string) => (str(fd, k) === undefined ? undefined : Number(str(fd, k)));
const rupees = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === undefined) return undefined;
  const p = rupeesToPaise(v);
  if (p === null) throw new AppError("VALIDATION", "Enter an amount in rupees, e.g. 2000 or 1999.50");
  return p;
};

async function run(fn: (user: SessionUser | null) => Promise<unknown>): Promise<FormState> {
  try {
    await fn(await getCurrentUser());
  } catch (e) {
    return { error: toAppError(e).code };
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export const updateSchemeAction = async (id: string, _: FormState, fd: FormData) =>
  run((u) =>
    updateScheme(u, id, {
      nameEn: str(fd, "nameEn"),
      nameHi: str(fd, "nameHi"),
      installmentAmount: rupees(fd, "installment"),
      tenureMonths: num(fd, "tenureMonths"),
    }),
  );

const batchFields = (fd: FormData) => ({
  startMonth: str(fd, "startMonth"),
  size: num(fd, "size"),
  winnersPerDraw: num(fd, "winnersPerDraw"),
});

export const createBatchAction = async (_: FormState, fd: FormData) =>
  run((u) => createBatch(u, { schemeId: str(fd, "schemeId"), ...batchFields(fd) }));

export const updateBatchAction = async (id: string, _: FormState, fd: FormData) =>
  run((u) => updateBatch(u, id, { ...(fd.has("size") ? batchFields(fd) : {}), status: str(fd, "status") }));

const productFields = (fd: FormData) => ({
  name: str(fd, "name"),
  nameHi: str(fd, "nameHi"),
  price: rupees(fd, "price"),
  schemes: fd.getAll("schemes").map(String),
  stock: num(fd, "stock"),
});

export const createProductAction = async (_: FormState, fd: FormData) =>
  run((u) => createProduct(u, productFields(fd)));

export const updateProductAction = async (id: string, _: FormState, fd: FormData) =>
  run((u) => updateProduct(u, id, { ...productFields(fd), active: fd.get("active") === "on" }));

export const approveAgentAction = async (id: string) => run((u) => updateAgent(u, id, { approved: true }));

export const setAgentStatusAction = async (id: string, status: "ACTIVE" | "SUSPENDED") =>
  run((u) => updateAgent(u, id, { status }));

export const verifyCashAction = async (id: string) => run((u) => verifyCash(u, id));
export const rejectCashAction = async (id: string) => run((u) => rejectCash(u, id));

export const createAgentInvoicesAction = async (_: FormState, fd: FormData) =>
  run((u) => createAgentInvoices(u, { period: str(fd, "period") }));
export const markAgentInvoicePaidAction = async (id: string, _: FormState, fd: FormData) =>
  run((u) => markAgentInvoicePaid(u, id, { utr: str(fd, "utr") }));
export const cancelAgentInvoiceAction = async (id: string) => run((u) => cancelAgentInvoice(u, id));

export const runDrawAction = async (batchId: string, monthNo: number) => run((u) => runMonthlyDraw(u, { batchId, monthNo }));
