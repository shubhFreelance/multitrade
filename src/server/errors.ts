import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";

/** A known, user-facing failure. `code` is stable for clients; `status` is the HTTP status. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Maps any thrown value to an AppError. Unknown errors are logged and become INTERNAL. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof ZodError) return new AppError("VALIDATION", e.issues[0]?.message ?? "Invalid input", 400);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return new AppError("NOT_FOUND", "Not found", 404);
    if (e.code === "P2002") return new AppError("CONFLICT", "That already exists", 409);
  }
  console.error(e);
  return new AppError("INTERNAL", "Something went wrong", 500);
}
