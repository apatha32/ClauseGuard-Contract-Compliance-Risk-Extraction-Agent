import { createClient } from "@supabase/supabase-js";
import { chunkContractText, embedTexts, VOYAGE_MODEL } from "@clauseguard/ingestion";

const BATCH_SIZE = 25;
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const voyageApiKey = process.env.VOYAGE_API_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }
  if (!DRY_RUN && !voyageApiKey) {
    throw new Error("VOYAGE_API_KEY must be set to embed for real (or pass --dry-run).");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Fetching contracts that don't have chunks yet...");
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id, file_name, source_text, contract_chunks(id)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to fetch contracts: ${error.message}`);

  const pending = (contracts ?? []).filter(
    (c) => !(c as { contract_chunks: unknown[] }).contract_chunks?.length,
  );
  console.log(`${contracts?.length ?? 0} contracts total, ${pending.length} without chunks yet.`);

  let totalChunks = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    for (const contract of batch) {
      const chunks = chunkContractText(contract.source_text as string);
      totalChunks += chunks.length;

      if (DRY_RUN) continue;

      const embeddings = await embedTexts(
        chunks.map((c) => c.text),
        "document",
        voyageApiKey!,
      );

      const rows = chunks.map((chunk, idx) => ({
        contract_id: contract.id,
        chunk_index: idx,
        content: chunk.text,
        start_char: chunk.startChar,
        end_char: chunk.endChar,
        embedding: embeddings[idx],
      }));

      const { error: insertError } = await supabase.from("contract_chunks").upsert(rows, {
        onConflict: "contract_id,chunk_index",
      });
      if (insertError) {
        throw new Error(`Failed to insert chunks for ${contract.file_name}: ${insertError.message}`);
      }
    }

    console.log(`  processed ${Math.min(i + batch.length, pending.length)}/${pending.length} contracts`);
  }

  if (DRY_RUN) {
    console.log(
      `Dry run — would embed ${totalChunks} chunks across ${pending.length} contracts with ${VOYAGE_MODEL}.`,
    );
  } else {
    console.log(`Done. Embedded ${totalChunks} chunks across ${pending.length} contracts.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
