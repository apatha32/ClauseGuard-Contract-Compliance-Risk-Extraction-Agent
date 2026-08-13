import { z } from "zod";
import { ClauseCategorySchema } from "./clauses.js";

/** CUAD ground-truth clause annotations, seeded from CUAD_v1.json. Used as eval targets, not extraction output. */
export const ClauseLabelSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  category: ClauseCategorySchema,
  isPresent: z.boolean(),
  sourceText: z.string().nullable(),
  startChar: z.number().int().nonnegative().nullable(),
  endChar: z.number().int().nonnegative().nullable(),
});

export type ClauseLabel = z.infer<typeof ClauseLabelSchema>;
