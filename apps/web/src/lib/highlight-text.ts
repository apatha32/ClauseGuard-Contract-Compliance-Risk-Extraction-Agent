export type HighlightSpan = {
  id: string;
  startChar: number;
  endChar: number;
  category: string;
};

export type TextSegment =
  | { type: "text"; text: string }
  | { type: "highlight"; text: string; id: string; category: string };

/**
 * Splits `text` into plain and highlighted segments for the given spans.
 * Spans are sorted by position and clipped to stay in bounds; overlapping
 * spans (shouldn't happen given one span per category, but defensively
 * handled) are resolved by first-start-wins, later spans truncated.
 */
export function buildHighlightSegments(text: string, spans: HighlightSpan[]): TextSegment[] {
  const sorted = [...spans]
    .filter((s) => s.startChar >= 0 && s.endChar <= text.length && s.startChar < s.endChar)
    .sort((a, b) => a.startChar - b.startChar);

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const span of sorted) {
    if (span.startChar < cursor) continue; // overlaps previous span, skip
    if (span.startChar > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, span.startChar) });
    }
    segments.push({
      type: "highlight",
      text: text.slice(span.startChar, span.endChar),
      id: span.id,
      category: span.category,
    });
    cursor = span.endChar;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }

  return segments;
}
