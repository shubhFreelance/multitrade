import { z } from "zod";

export const agentUpdateInput = z
  .object({ approved: z.boolean(), status: z.enum(["ACTIVE", "SUSPENDED"]) })
  .partial()
  .refine((v) => v.approved !== undefined || v.status !== undefined, "Nothing to change");

export type AgentUpdate = z.infer<typeof agentUpdateInput>;
