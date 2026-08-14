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

/** Short definitions shown to the model in the extraction prompt and tool schema, so the same wording drives both. */
export const CATEGORY_DESCRIPTIONS: Record<ClauseCategory, string> = {
  "Governing Law": "The law of which jurisdiction governs interpretation of the contract.",
  "Termination For Convenience": "A right for a party to terminate the contract without cause.",
  "Cap On Liability": "A stated maximum dollar amount or formula limiting a party's liability.",
  "Uncapped Liability": "Language stating liability is not capped, or is explicitly unlimited, for certain kinds of claims.",
  "Non-Compete": "A restriction on a party competing with the other party during or after the contract term.",
  "Exclusivity": "An exclusive dealing, exclusive territory, or exclusive rights obligation between the parties.",
  "Ip Ownership Assignment": "A provision assigning ownership of intellectual property from one party to the other.",
  "Anti-Assignment": "A restriction on assigning the contract, or rights under it, to a third party without consent.",
  "Change Of Control": "A provision triggered by, or addressing, a change in control or ownership of a party.",
  Insurance: "A requirement that a party carry insurance of a specified type or amount.",
};

/** Deterministic snake_case key for a category, used as an object key in the Anthropic tool schema. */
export function categoryToSlug(category: ClauseCategory): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const CATEGORY_SLUGS: Record<ClauseCategory, string> = Object.fromEntries(
  CLAUSE_CATEGORIES.map((category) => [category, categoryToSlug(category)]),
) as Record<ClauseCategory, string>;

export const SLUG_TO_CATEGORY: Record<string, ClauseCategory> = Object.fromEntries(
  CLAUSE_CATEGORIES.map((category) => [categoryToSlug(category), category]),
);

/**
 * A single clause extraction result for one category within one contract.
 * `present: false` requires no span/offsets — this is the abstention path
 * the extraction agent must take when it cannot ground a claim in source text.
 * There is no confidence field: a self-reported LLM confidence score isn't
 * calibrated to anything, so it would add false precision rather than signal.
 */
export const ClauseExtractionSchema = z.discriminatedUnion("present", [
  z.object({
    category: ClauseCategorySchema,
    present: z.literal(true),
    sourceText: z.string().min(1),
    startChar: z.number().int().nonnegative(),
    endChar: z.number().int().nonnegative(),
    summary: z.string().min(1),
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

export type ContractExtractionResult = z.infer<typeof ContractExtractionResultSchema>;

export const EXTRACTION_TOOL_NAME = "record_clause_extractions";

/**
 * The raw shape Claude's tool call must produce, one field per category
 * keyed by slug. This is deliberately flat (no discriminated union, no
 * computed offsets) because tool-use models are far more reliable at
 * filling in a fixed set of required string/boolean fields than at
 * satisfying a conditional schema or computing character positions
 * themselves. `quote` is verified against the source text and turned into
 * `sourceText`/`startChar`/`endChar` after the call returns — see
 * @clauseguard/extraction.
 */
export const ClauseExtractionToolFieldSchema = z.object({
  present: z.boolean(),
  quote: z.string(),
  summary: z.string(),
  reason: z.string(),
});

export type ClauseExtractionToolField = z.infer<typeof ClauseExtractionToolFieldSchema>;

export const ExtractionToolInputSchema = z.object(
  Object.fromEntries(
    CLAUSE_CATEGORIES.map((category) => [categoryToSlug(category), ClauseExtractionToolFieldSchema]),
  ),
);

export type ExtractionToolInput = z.infer<typeof ExtractionToolInputSchema>;
