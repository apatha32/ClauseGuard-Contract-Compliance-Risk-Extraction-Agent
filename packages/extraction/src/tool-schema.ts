import type Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_DESCRIPTIONS, CATEGORY_SLUGS, CLAUSE_CATEGORIES, EXTRACTION_TOOL_NAME } from "@clauseguard/schemas";

/**
 * Builds the Anthropic tool definition from CLAUSE_CATEGORIES directly, so
 * the tool schema can never drift from the categories the rest of the
 * pipeline validates against. One required, flat object field per category
 * (keyed by slug) rather than an array: this makes "exactly these 10
 * categories, no duplicates, no omissions" a structural guarantee enforced
 * by JSON schema `required` + `additionalProperties: false`, instead of
 * something we'd otherwise have to check after the fact.
 */
export function buildExtractionTool(): Anthropic.Tool {
  const properties: Record<string, unknown> = {};

  for (const category of CLAUSE_CATEGORIES) {
    const slug = CATEGORY_SLUGS[category];
    properties[slug] = {
      type: "object",
      description: CATEGORY_DESCRIPTIONS[category],
      properties: {
        present: {
          type: "boolean",
          description: "True if this category of clause appears in the contract.",
        },
        quote: {
          type: "string",
          description:
            "If present is true: the exact clause text copied character-for-character from the contract, including all sentences that make up the clause. Must be an exact substring of the contract text, not a paraphrase. Empty string if present is false.",
        },
        summary: {
          type: "string",
          description:
            "If present is true: one plain-English sentence describing what the clause says. Empty string if present is false.",
        },
        reason: {
          type: "string",
          description:
            "If present is false: a brief reason no such clause was found. Empty string if present is true.",
        },
      },
      required: ["present", "quote", "summary", "reason"],
      additionalProperties: false,
    };
  }

  return {
    name: EXTRACTION_TOOL_NAME,
    description:
      "Records whether each of the 10 target clause categories is present in the contract, with a verbatim quote and summary for each present category.",
    input_schema: {
      type: "object",
      properties,
      required: CLAUSE_CATEGORIES.map((category) => CATEGORY_SLUGS[category]),
      additionalProperties: false,
    },
  };
}
