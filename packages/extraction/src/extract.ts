import Anthropic from "@anthropic-ai/sdk";
import {
  CATEGORY_SLUGS,
  CLAUSE_CATEGORIES,
  EXTRACTION_TOOL_NAME,
  ExtractionToolInputSchema,
  ClauseExtractionSchema,
  type ClauseExtraction,
} from "@clauseguard/schemas";
import { buildExtractionTool } from "./tool-schema.js";
import { buildExtractionPrompt, PROMPT_VERSION } from "./prompt.js";
import { findGroundedSpan } from "./grounding.js";

export const EXTRACTION_MODEL = "claude-sonnet-5";
export { PROMPT_VERSION };

export type ExtractClausesParams = {
  sourceText: string;
  apiKey: string;
  model?: string;
};

const MAX_ATTEMPTS = 5;

/**
 * Under this tool schema (10 required object-typed properties), Claude
 * intermittently — observed at roughly a 50% per-call rate on some
 * documents — returns a malformed tool call instead of the requested
 * schema: either a single `$PARAMETER_NAME` placeholder key, or the real
 * per-category data dumped as one escaped JSON string crammed with
 * `<parameter name="...">` tags (an XML tool-call convention, not ours)
 * under just the first category's key. This isn't a validation edge case
 * in our data — it's a model-level glitch reproducible on the same
 * request — so retrying is the correct response, not stricter parsing.
 * 5 attempts keeps the exhaustion probability under ~3% at a 50% failure rate.
 */
async function callExtractionTool(
  client: Anthropic,
  model: string,
  sourceText: string,
): Promise<ReturnType<typeof ExtractionToolInputSchema.parse>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [buildExtractionTool()],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      messages: [{ role: "user", content: buildExtractionPrompt(sourceText) }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      lastError = new Error("Claude response did not include a tool call.");
      continue;
    }

    const parsed = ExtractionToolInputSchema.safeParse(toolUse.input);
    if (parsed.success) {
      return parsed.data;
    }
    lastError = parsed.error;
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`Malformed tool call on attempt ${attempt}/${MAX_ATTEMPTS}, retrying...`);
    }
  }

  throw new Error(
    `Claude did not return a valid tool call after ${MAX_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function extractClauses(params: ExtractClausesParams): Promise<ClauseExtraction[]> {
  const client = new Anthropic({ apiKey: params.apiKey });
  const model = params.model ?? EXTRACTION_MODEL;

  const raw = await callExtractionTool(client, model, params.sourceText);

  const clauses = CLAUSE_CATEGORIES.map((category): ClauseExtraction => {
    const slug = CATEGORY_SLUGS[category];
    const field = raw[slug as keyof typeof raw];

    if (!field.present) {
      return {
        category,
        present: false,
        reason: field.reason.trim() || "Model reported this clause as not present.",
      };
    }

    const grounded = findGroundedSpan(params.sourceText, field.quote);
    if (!grounded) {
      // Hallucination guard: the model claimed the clause was present but we
      // could not verify the quote against the source text, so this must be
      // stored as an abstention, not as a present clause with a fabricated span.
      return {
        category,
        present: false,
        reason:
          "Model reported this clause as present but the quoted text could not be verified against the source document.",
      };
    }

    return {
      category,
      present: true,
      sourceText: grounded.sourceText,
      startChar: grounded.startChar,
      endChar: grounded.endChar,
      summary: field.summary.trim() || grounded.sourceText.slice(0, 200),
    };
  });

  return clauses.map((clause) => ClauseExtractionSchema.parse(clause));
}
