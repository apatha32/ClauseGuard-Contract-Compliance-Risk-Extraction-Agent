import { z } from "zod";

/**
 * The 10 CUAD clause categories ClauseGuard extracts, out of CUAD's full 41.
 * Category strings match CUAD's label_group names exactly so extraction
 * output can be scored directly against CUAD ground truth in the eval harness.
 */
export const CLAUSE_CATEGORIES = [
  "Governing Law",
  "Termination For Convenience",
  "Cap On Liability",
  "Uncapped Liability",
  "Non-Compete",
  "Exclusivity",
  "Ip Ownership Assignment",
  "Anti-Assignment",
  "Change Of Control",
  "Insurance",
] as const;

export type ClauseCategory = (typeof CLAUSE_CATEGORIES)[number];

export const ClauseCategorySchema = z.enum(CLAUSE_CATEGORIES);

/**
 * A single clause extraction result for one category within one contract.
 * `present: false` requires no span/offsets — this is the abstention path
 * the extraction agent must take when it cannot ground a claim in source text.
 */
export const ClauseExtractionSchema = z.discriminatedUnion("present", [
  z.object({
    category: ClauseCategorySchema,
    present: z.literal(true),
    sourceText: z.string().min(1),
    startChar: z.number().int().nonnegative(),
    endChar: z.number().int().nonnegative(),
    summary: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    category: ClauseCategorySchema,
    present: z.literal(false),
    reason: z.string().min(1),
  }),
]);

export type ClauseExtraction = z.infer<typeof ClauseExtractionSchema>;

export const ContractExtractionResultSchema = z.object({
  contractId: z.string().uuid(),
  clauses: z.array(ClauseExtractionSchema).length(CLAUSE_CATEGORIES.length),
});

export type ContractExtractionResult = z.infer<
  typeof ContractExtractionResultSchema
>;

/** Matches the Anthropic tool-use input_schema so the extraction agent's tool call validates against this same shape. */
export const EXTRACTION_TOOL_NAME = "record_clause_extractions";
