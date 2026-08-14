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

export async function extractClauses(params: ExtractClausesParams): Promise<ClauseExtraction[]> {
  const client = new Anthropic({ apiKey: params.apiKey });
  const model = params.model ?? EXTRACTION_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    tools: [buildExtractionTool()],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
    messages: [{ role: "user", content: buildExtractionPrompt(params.sourceText) }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude response did not include a tool call.");
  }

  const raw = ExtractionToolInputSchema.parse(toolUse.input);

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
