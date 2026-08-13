const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-law-2";
const VOYAGE_EMBEDDING_DIMENSION = 1024;
const MAX_INPUTS_PER_REQUEST = 128;

type VoyageEmbeddingResponse = {
  data: { object: "embedding"; embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
};

export { VOYAGE_MODEL, VOYAGE_EMBEDDING_DIMENSION };

/**
 * Embeds texts with Voyage's legal-domain model. `inputType` follows Voyage's
 * asymmetric embedding convention: "document" for text being indexed,
 * "query" for text used to search — using the wrong one measurably hurts
 * retrieval quality even though both return same-shaped vectors.
 */
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query",
  apiKey: string,
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_INPUTS_PER_REQUEST) {
    const batch = texts.slice(i, i + MAX_INPUTS_PER_REQUEST);
    const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
        input_type: inputType,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
    }

    const parsed = (await response.json()) as VoyageEmbeddingResponse;
    const sorted = [...parsed.data].sort((a, b) => a.index - b.index);
    results.push(...sorted.map((d) => d.embedding));
  }

  return results;
}
