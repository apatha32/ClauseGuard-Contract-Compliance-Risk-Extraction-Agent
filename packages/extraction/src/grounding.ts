export type GroundedSpan = {
  startChar: number;
  endChar: number;
  sourceText: string;
};

/**
 * Locates a model-produced quote in the actual contract text, returning the
 * verified span (using the real source substring, not the model's copy of
 * it) or null if the quote cannot be verified. This is the hallucination
 * guard: callers must treat a null result as "not grounded" and abstain
 * rather than store an unverified clause.
 */
export function findGroundedSpan(sourceText: string, quote: string): GroundedSpan | null {
  const trimmedQuote = quote.trim();
  if (!trimmedQuote) return null;

  const exactIndex = sourceText.indexOf(trimmedQuote);
  if (exactIndex !== -1) {
    return {
      startChar: exactIndex,
      endChar: exactIndex + trimmedQuote.length,
      sourceText: trimmedQuote,
    };
  }

  return findNormalizedSpan(sourceText, trimmedQuote);
}

/**
 * Falls back to whitespace-insensitive matching: models sometimes normalize
 * runs of whitespace when copying a quote (PDF-to-text extraction leaves a
 * lot of irregular spacing in these contracts). Matches against a
 * whitespace-collapsed version of the source, then maps back to exact
 * original offsets via a position index built alongside it.
 */
function findNormalizedSpan(sourceText: string, quote: string): GroundedSpan | null {
  const { normalized, indexMap } = normalizeWithIndexMap(sourceText);
  const normalizedQuote = quote.replace(/\s+/g, " ").trim();
  if (!normalizedQuote) return null;

  const idx = normalized.indexOf(normalizedQuote);
  if (idx === -1) return null;

  const startChar = indexMap[idx];
  const endChar = indexMap[idx + normalizedQuote.length - 1] + 1;
  return { startChar, endChar, sourceText: sourceText.slice(startChar, endChar) };
}

function normalizeWithIndexMap(text: string): { normalized: string; indexMap: number[] } {
  let normalized = "";
  const indexMap: number[] = [];
  let inWhitespace = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!inWhitespace) {
        normalized += " ";
        indexMap.push(i);
        inWhitespace = true;
      }
    } else {
      normalized += ch;
      indexMap.push(i);
      inWhitespace = false;
    }
  }

  return { normalized, indexMap };
}
