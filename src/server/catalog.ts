// Admin management of schemes, batches and products. Every function checks the caller is an admin.
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import {
  batchCreateInput,
  batchStatuses,
  batchUpdateInput,
  productCreateInput,
  productUpdateInput,
  schemeUpdateInput,
} from "@/shared/catalog";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { AppError } from "./errors";

const ADMINS = ["ADMIN", "SUPER_ADMIN"] as const;

/** "2026-12" → 2026-12-01 (UTC, stored as a date) */
const monthStart = (month: string) => new Date(`${month}-01T00:00:00Z`);

// ---- Schemes (the three codes are fixed; admins edit their details) ----

export async function listSchemes(user: SessionUser | null) {
  requireRole(user, ADMINS);
  return db.scheme.findMany({ orderBy: { code: "asc" } });
}

export async function updateScheme(user: SessionUser | null, id: string, input: unknown) {
  const actor = requireRole(user, ADMINS);
  const data = schemeUpdateInput.parse(input);
  return db.$transaction(async (tx) => {
    const scheme = await tx.scheme.update({ where: { id }, data });
    await audit(tx, actor.id, "scheme.update", "Scheme", id, data);
    return scheme;
  });
}

// ---- Batches ----

export async function listBatches(user: SessionUser | null) {
  requireRole(user, ADMINS);
  return db.batch.findMany({ include: { scheme: true }, orderBy: [{ scheme: { code: "asc" } }, { number: "asc" }] });
}

export async function getBatch(user: SessionUser | null, id: string) {
  requireRole(user, ADMINS);
  return db.batch.findUniqueOrThrow({ where: { id }, include: { scheme: true } });
}

export async function createBatch(user: SessionUser | null, input: unknown) {
  const actor = requireRole(user, ADMINS);
  const { schemeId, startMonth, size, winnersPerDraw } = batchCreateInput.parse(input);
  return db.$transaction(async (tx) => {
    await tx.scheme.findUniqueOrThrow({ where: { id: schemeId } });
    const last = await tx.batch.findFirst({ where: { schemeId }, orderBy: { number: "desc" } });
    // Two admins creating at once both pick the same number; the unique index rejects the second (CONFLICT).
    const batch = await tx.batch.create({
      data: { schemeId, number: (last?.number ?? 0) + 1, startMonth: monthStart(startMonth), size, winnersPerDraw },
    });
    await audit(tx, actor.id, "batch.create", "Batch", batch.id, { schemeId, startMonth, size, winnersPerDraw });
    return batch;
  });
}

export async function updateBatch(user: SessionUser | null, id: string, input: unknown) {
  const actor = requireRole(user, ADMINS);
  const { startMonth, status, ...rest } = batchUpdateInput.parse(input);
  return db.$transaction(async (tx) => {
    const batch = await tx.batch.findUniqueOrThrow({ where: { id } });
    const changesSetup = startMonth !== undefined || Object.keys(rest).length > 0;
    // Start month, size and winners are fixed once a batch is running: due dates and draws depend on them.
    if (changesSetup && batch.status !== "OPEN") {
      throw new AppError("BATCH_LOCKED", "Only the status of a running or closed batch can change", 409);
    }
    if (status && batchStatuses.indexOf(status) < batchStatuses.indexOf(batch.status)) {
      throw new AppError("BATCH_STATUS_BACKWARDS", "A batch's status can only move forward", 409);
    }
    const updated = await tx.batch.update({
      where: { id },
      data: { ...rest, status, startMonth: startMonth ? monthStart(startMonth) : undefined },
    });
    await audit(tx, actor.id, "batch.update", "Batch", id, { startMonth, status, ...rest });
    return updated;
  });
}

// ---- Products ----

export async function listProducts(user: SessionUser | null) {
  requireRole(user, ADMINS);
  return db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
}

export async function getProduct(user: SessionUser | null, id: string) {
  requireRole(user, ADMINS);
  return db.product.findUniqueOrThrow({ where: { id } });
}

export async function createProduct(user: SessionUser | null, input: unknown) {
  const actor = requireRole(user, ADMINS);
  const data = productCreateInput.parse(input);
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({ data });
    await audit(tx, actor.id, "product.create", "Product", product.id, data);
    return product;
  });
}

export async function updateProduct(user: SessionUser | null, id: string, input: unknown) {
  const actor = requireRole(user, ADMINS);
  const data = productUpdateInput.parse(input);
  return db.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data });
    await audit(tx, actor.id, "product.update", "Product", id, data);
    return product;
  });
}
