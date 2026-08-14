import { createClient } from "@supabase/supabase-js";
import { extractClauses, EXTRACTION_MODEL, PROMPT_VERSION } from "@clauseguard/extraction";

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : undefined;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY must be set to run extraction.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Fetching contracts without extractions for this model/prompt version...");
  let query = supabase
    .from("contracts")
    .select(`id, file_name, source_text, clauses!left(id, model, prompt_version)`)
    .order("created_at", { ascending: true });
  const { data: contracts, error } = await query;
  if (error) throw new Error(`Failed to fetch contracts: ${error.message}`);

  type Row = {
    id: string;
    file_name: string;
    source_text: string;
    clauses: { id: string; model: string; prompt_version: string }[];
  };

  const pending = ((contracts ?? []) as Row[]).filter(
    (c) => !c.clauses.some((cl) => cl.model === EXTRACTION_MODEL && cl.prompt_version === PROMPT_VERSION),
  );
  const targets = LIMIT ? pending.slice(0, LIMIT) : pending;

  console.log(
    `${contracts?.length ?? 0} contracts total, ${pending.length} pending extraction, running ${targets.length}.`,
  );

  if (DRY_RUN) {
    console.log(`Dry run — model: ${EXTRACTION_MODEL}, prompt version: ${PROMPT_VERSION}. No API calls made.`);
    for (const c of targets.slice(0, 3)) {
      console.log(`  would extract: ${c.file_name} (${c.source_text.length} chars)`);
    }
    return;
  }

  let done = 0;
  for (const contract of targets) {
    const clauses = await extractClauses({
      sourceText: contract.source_text,
      apiKey: anthropicApiKey,
    });

    const rows = clauses.map((clause) => ({
      contract_id: contract.id,
      category: clause.category,
      is_present: clause.present,
      source_text: clause.present ? clause.sourceText : null,
      start_char: clause.present ? clause.startChar : null,
      end_char: clause.present ? clause.endChar : null,
      summary: clause.present ? clause.summary : clause.reason,
      model: EXTRACTION_MODEL,
      prompt_version: PROMPT_VERSION,
    }));

    const { error: insertError } = await supabase
      .from("clauses")
      .upsert(rows, { onConflict: "contract_id,category,model,prompt_version" });
    if (insertError) {
      throw new Error(`Failed to insert clauses for ${contract.file_name}: ${insertError.message}`);
    }

    done += 1;
    const presentCount = clauses.filter((c) => c.present).length;
    console.log(`  [${done}/${targets.length}] ${contract.file_name}: ${presentCount}/10 present`);
  }

  console.log(`Done. Extracted ${targets.length} contracts with ${EXTRACTION_MODEL} (${PROMPT_VERSION}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
