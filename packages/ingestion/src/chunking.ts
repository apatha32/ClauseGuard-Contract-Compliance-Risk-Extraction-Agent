export type TextChunk = {
  text: string;
  startChar: number;
  endChar: number;
};

const MIN_CHUNK_CHARS = 400;
const MAX_CHUNK_CHARS = 2000;

/**
 * Splits contract text into paragraph-respecting chunks: paragraphs (split on
 * blank lines) are merged forward until they clear MIN_CHUNK_CHARS, so short
 * headings/signature lines don't become their own low-signal chunk. A single
 * paragraph longer than MAX_CHUNK_CHARS is further split on sentence
 * boundaries so no chunk is dropped for exceeding the embedding model's
 * effective context.
 */
export function chunkContractText(text: string): TextChunk[] {
  const paragraphs = splitParagraphs(text);
  const merged = mergeSmallParagraphs(paragraphs, text);
  return merged.flatMap((chunk) =>
    chunk.text.length > MAX_CHUNK_CHARS ? splitLongChunk(chunk) : [chunk],
  );
}

function splitParagraphs(text: string): TextChunk[] {
  const paragraphs: TextChunk[] = [];
  const boundary = /\n\s*\n/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushIfNonEmpty = (start: number, end: number) => {
    const raw = text.slice(start, end);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const leadingWhitespace = raw.indexOf(trimmed);
    paragraphs.push({
      text: trimmed,
      startChar: start + leadingWhitespace,
      endChar: start + leadingWhitespace + trimmed.length,
    });
  };

  while ((match = boundary.exec(text)) !== null) {
    pushIfNonEmpty(cursor, match.index);
    cursor = boundary.lastIndex;
  }
  pushIfNonEmpty(cursor, text.length);

  return paragraphs;
}

function mergeSmallParagraphs(paragraphs: TextChunk[], sourceText: string): TextChunk[] {
  const merged: TextChunk[] = [];
  let current: TextChunk | null = null;

  for (const paragraph of paragraphs) {
    if (!current) {
      current = { ...paragraph };
      continue;
    }
    if (current.text.length < MIN_CHUNK_CHARS) {
      // Slice the original text rather than joining `current.text` and
      // `paragraph.text` with a synthetic separator — a literal "\n\n" join
      // silently desyncs from whatever whitespace actually separated them
      // in the source, breaking startChar/endChar for every chunk after it.
      const previous: TextChunk = current;
      const mergedStart: number = previous.startChar;
      const mergedEnd: number = paragraph.endChar;
      const mergedText: string = sourceText.slice(mergedStart, mergedEnd);
      current = {
        text: mergedText,
        startChar: mergedStart,
        endChar: mergedEnd,
      };
    } else {
      merged.push(current);
      current = { ...paragraph };
    }
  }
  if (current) merged.push(current);

  return merged;
}

function splitLongChunk(chunk: TextChunk): TextChunk[] {
  const sentenceBoundary = /(?<=[.;])\s+/g;
  const parts = chunk.text.split(sentenceBoundary).filter(Boolean);

  const result: TextChunk[] = [];
  let searchCursor = 0;
  let bufferStart = 0;
  let bufferEnd = 0;
  let bufferOpen = false;

  const flush = () => {
    if (!bufferOpen) return;
    result.push({
      text: chunk.text.slice(bufferStart, bufferEnd),
      startChar: chunk.startChar + bufferStart,
      endChar: chunk.startChar + bufferEnd,
    });
    bufferOpen = false;
  };

  for (const part of parts) {
    // Locate the part's real position rather than assuming a fixed-width
    // separator — the split regex can consume a space, newline, or more.
    const idx = chunk.text.indexOf(part, searchCursor);
    const partStart = idx === -1 ? searchCursor : idx;
    const partEnd = partStart + part.length;
    searchCursor = partEnd;

    if (bufferOpen && partEnd - bufferStart > MAX_CHUNK_CHARS) {
      flush();
    }
    if (!bufferOpen) {
      bufferStart = partStart;
      bufferOpen = true;
    }
    bufferEnd = partEnd;
  }
  flush();

  return result;
}
