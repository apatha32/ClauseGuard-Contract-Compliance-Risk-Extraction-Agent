import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CLAUSE_CATEGORIES, type ClauseCategory } from "@clauseguard/schemas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUAD_JSON_PATH = path.join(__dirname, "../data/cuad/raw/CUAD_v1.json");
const TARGET_CATEGORIES = new Set<string>(CLAUSE_CATEGORIES);
const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes("--dry-run");

const CuadAnswerSchema = z.object({
  text: z.string(),
  answer_start: z.number().int().nonnegative(),
});

const CuadQaSchema = z.object({
  id: z.string(),
  question: z.string(),
  is_impossible: z.boolean(),
  answers: z.array(CuadAnswerSchema),
});

const CuadParagraphSchema = z.object({
  context: z.string(),
  qas: z.array(CuadQaSchema),
});

const CuadContractSchema = z.object({
  title: z.string(),
  paragraphs: z.array(CuadParagraphSchema),
});

const CuadDatasetSchema = z.object({
  version: z.string(),
  data: z.array(CuadContractSchema),
});

type ContractRow = {
  file_name: string;
  source_text: string;
  cuad_doc_id: string;
};

type ClauseLabelRow = {
  cuad_doc_id: string;
  category: ClauseCategory;
  is_present: boolean;
  source_text: string | null;
  start_char: number | null;
  end_char: number | null;
};

function categoryFromQaId(qaId: string): string {
  // qa.id is formatted "{contract title}__{category}"; category is always the
  // last "__"-delimited segment.
  const parts = qaId.split("__");
  return parts[parts.length - 1];
}

async function main() {
  console.log(`Reading ${CUAD_JSON_PATH}...`);
  const raw = await readFile(CUAD_JSON_PATH, "utf-8");
  const dataset = CuadDatasetSchema.parse(JSON.parse(raw));
  console.log(`Parsed ${dataset.data.length} contracts (CUAD v${dataset.version}).`);

  const contractRows: ContractRow[] = [];
  const clauseLabelRows: ClauseLabelRow[] = [];

  for (const contract of dataset.data) {
    const paragraph = contract.paragraphs[0];
    if (!paragraph) continue;

    contractRows.push({
      file_name: contract.title,
      source_text: paragraph.context,
      cuad_doc_id: contract.title,
    });

    for (const qa of paragraph.qas) {
      const category = categoryFromQaId(qa.id);
      if (!TARGET_CATEGORIES.has(category)) continue;

      const answer = qa.answers[0] ?? null;
      const isPresent = qa.answers.length > 0;

      clauseLabelRows.push({
        cuad_doc_id: contract.title,
        category: category as ClauseCategory,
        is_present: isPresent,
        source_text: isPresent && answer ? answer.text : null,
        start_char: isPresent && answer ? answer.answer_start : null,
        end_char: isPresent && answer ? answer.answer_start + answer.text.length : null,
      });
    }
  }

  console.log(
    `Built ${contractRows.length} contract rows and ${clauseLabelRows.length} clause_label rows ` +
      `(${TARGET_CATEGORIES.size} target categories x ${contractRows.length} contracts).`,
  );

  const presentCounts = new Map<string, number>();
  for (const row of clauseLabelRows) {
    if (row.is_present) presentCounts.set(row.category, (presentCounts.get(row.category) ?? 0) + 1);
  }
  console.log("Present-clause counts per category:");
  for (const category of CLAUSE_CATEGORIES) {
    console.log(`  ${category}: ${presentCounts.get(category) ?? 0} / ${contractRows.length}`);
  }

  if (DRY_RUN) {
    console.log("Dry run — skipping database writes.");
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Upserting contracts...");
  const cuadDocIdToId = new Map<string, string>();
  for (let i = 0; i < contractRows.length; i += BATCH_SIZE) {
    const batch = contractRows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("contracts")
      .upsert(batch, { onConflict: "cuad_doc_id" })
      .select("id, cuad_doc_id");
    if (error) throw new Error(`Contract upsert failed: ${error.message}`);
    for (const row of data ?? []) {
      cuadDocIdToId.set(row.cuad_doc_id as string, row.id as string);
    }
    console.log(`  upserted contracts ${i + batch.length}/${contractRows.length}`);
  }

  console.log("Upserting clause_labels...");
  const resolvedClauseLabelRows = clauseLabelRows.map((row) => {
    const contractId = cuadDocIdToId.get(row.cuad_doc_id);
    if (!contractId) throw new Error(`Missing contract id for ${row.cuad_doc_id}`);
    return {
      contract_id: contractId,
      category: row.category,
      is_present: row.is_present,
      source_text: row.source_text,
      start_char: row.start_char,
      end_char: row.end_char,
    };
  });

  for (let i = 0; i < resolvedClauseLabelRows.length; i += BATCH_SIZE) {
    const batch = resolvedClauseLabelRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("clause_labels")
      .upsert(batch, { onConflict: "contract_id,category" });
    if (error) throw new Error(`clause_labels upsert failed: ${error.message}`);
    console.log(`  upserted clause_labels ${i + batch.length}/${resolvedClauseLabelRows.length}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
