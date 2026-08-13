import { z } from "zod";
import { ClauseCategorySchema } from "./clauses.js";

export const ClauseEvalMetricsSchema = z.object({
  category: ClauseCategorySchema,
  truePositives: z.number().int().nonnegative(),
  falsePositives: z.number().int().nonnegative(),
  falseNegatives: z.number().int().nonnegative(),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
});

export type ClauseEvalMetrics = z.infer<typeof ClauseEvalMetricsSchema>;

export const EvalReportSchema = z.object({
  runId: z.string().min(1),
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
  createdAt: z.string().datetime(),
  perCategory: z.array(ClauseEvalMetricsSchema),
  overall: z.object({
    precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1),
    f1: z.number().min(0).max(1),
  }),
  hallucinationRate: z.number().min(0).max(1),
  abstentionAccuracy: z.number().min(0).max(1),
  contractsEvaluated: z.number().int().nonnegative(),
});

export type EvalReport = z.infer<typeof EvalReportSchema>;
