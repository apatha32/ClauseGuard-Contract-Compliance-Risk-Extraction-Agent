import { CATEGORY_DESCRIPTIONS, CLAUSE_CATEGORIES } from "@clauseguard/schemas";

export const PROMPT_VERSION = "v1";

export function buildExtractionPrompt(contractText: string): string {
  const categoryList = CLAUSE_CATEGORIES.map(
    (category) => `- ${category}: ${CATEGORY_DESCRIPTIONS[category]}`,
  ).join("\n");

  return `You are a contract review assistant. You will be given the full text of a commercial contract.

For each of the following clause categories, determine whether that type of clause is present in the contract text below.

Categories:
${categoryList}

Rules:
1. If a category's clause is present, copy the exact clause text character-for-character from the contract into "quote". Do not paraphrase, correct typos, or alter whitespace. The quote must be an exact substring of the contract text below. Include every sentence that makes up the clause, not just the first one.
2. Quote only the clause itself, not unrelated surrounding sections.
3. If you cannot find a clause of a given type, or the closest match is ambiguous, set "present" to false. Do not force a category to be present when the contract does not clearly address it.
4. When present is true, write "summary" as one plain-English sentence describing what the clause says, and leave "reason" as an empty string.
5. When present is false, write "reason" as a brief note explaining the absence, and leave "quote" and "summary" as empty strings.

Contract text:
"""
${contractText}
"""

Call the tool with all 10 categories filled in.`;
}
