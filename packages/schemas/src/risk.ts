import { z } from "zod";
import { ClauseCategorySchema } from "./clauses.js";

export const SeveritySchema = z.enum(["info", "warning", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * One rule from the YAML policy config. `check` names a comparator the risk
 * engine knows how to run against an extracted clause (e.g. numeric range on
 * a parsed liability cap, or a required-presence check).
 */
export const PolicyRuleSchema = z.object({
  id: z.string().min(1),
  category: ClauseCategorySchema,
  description: z.string().min(1),
  severity: SeveritySchema,
  check:
    z.enum(["must_be_present", "must_be_absent", "min_value", "max_value"]),
  value: z.number().optional(),
  unit: z.string().optional(),
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicyConfigSchema = z.object({
  version: z.number().int().positive(),
  rules: z.array(PolicyRuleSchema),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const RiskFlagSchema = z.object({
  contractId: z.string().uuid(),
  ruleId: z.string().min(1),
  category: ClauseCategorySchema,
  severity: SeveritySchema,
  message: z.string().min(1),
  clauseSourceText: z.string().nullable(),
});

export type RiskFlag = z.infer<typeof RiskFlagSchema>;
