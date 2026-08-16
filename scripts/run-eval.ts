import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { computeEvalReport, renderMarkdownReport, type GroundTruthClause, type PredictedClause } from "@clauseguard/eval";
import { EXTRACTION_MODEL, PROMPT_VERSION } from "@clauseguard/extraction";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, "../eval/reports");

const modelArg = process.argv.find((a) => a.startsWith("--model="));
const promptArg = process.argv.find((a) => a.startsWith("--prompt-version="));
const MODEL = modelArg ? modelArg.split("=")[1] : EXTRACTION_MODEL;
const PROMPT_VERSION_ARG = promptArg ? promptArg.split("=")[1] : PROMPT_VERSION;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Evaluating model=${MODEL} promptVersion=${PROMPT_VERSION_ARG}`);

  console.log("Fetching contract source text...");
  const contracts: { id: string; source_text: string }[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("contracts")
      .select("id, source_text")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Failed to fetch contracts: ${error.message}`);
    if (!data || data.length === 0) break;
    contracts.push(...(data as typeof contracts));
    if (data.length < PAGE) break;
  }
  const contractSourceText = new Map(contracts.map((c) => [c.id, c.source_text]));

  console.log("Fetching ground truth (clause_labels)...");
  const groundTruth: GroundTruthClause[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("clause_labels")
      .select("contract_id, category, is_present")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Failed to fetch clause_labels: ${error.message}`);
    if (!data || data.length === 0) break;
    groundTruth.push(
      ...data.map((l) => ({
        contractId: l.contract_id as string,
        category: l.category as GroundTruthClause["category"],
        isPresent: l.is_present as boolean,
      })),
    );
    if (data.length < PAGE) break;
  }

  console.log("Fetching predictions (clauses) for this model/prompt version...");
  const predictions: PredictedClause[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("clauses")
      .select("contract_id, category, is_present, source_text, start_char, end_char")
      .eq("model", MODEL)
      .eq("prompt_version", PROMPT_VERSION_ARG)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Failed to fetch clauses: ${error.message}`);
    if (!data || data.length === 0) break;
    predictions.push(
      ...data.map((c) => ({
        contractId: c.contract_id as string,
        category: c.category as PredictedClause["category"],
        isPresent: c.is_present as boolean,
        sourceText: c.source_text as string | null,
        startChar: c.start_char as number | null,
        endChar: c.end_char as number | null,
      })),
    );
    if (data.length < PAGE) break;
  }

  if (predictions.length === 0) {
    console.warn(
      "No predictions found for this model/prompt version. Run `npm run extract:clauses` first, or pass --model=/--prompt-version= to match an existing run.",
    );
  }

  const runId = `eval-${MODEL}-${PROMPT_VERSION_ARG}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const report = computeEvalReport({
    runId,
    modelId: MODEL,
    promptVersion: PROMPT_VERSION_ARG,
    groundTruth,
    predictions,
    contractSourceText,
  });

  await mkdir(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `${runId}.json`);
  const mdPath = path.join(REPORTS_DIR, `${runId}.md`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  await writeFile(mdPath, renderMarkdownReport(report), "utf-8");

  const { error: insertError } = await supabase.from("eval_reports").upsert(
    {
      run_id: report.runId,
      model: report.modelId,
      prompt_version: report.promptVersion,
      contracts_evaluated: report.contractsEvaluated,
      precision: report.overall.precision,
      recall: report.overall.recall,
      f1: report.overall.f1,
      hallucination_rate: report.hallucinationRate,
      abstention_accuracy: report.abstentionAccuracy,
      per_category: report.perCategory,
      created_at: report.createdAt,
    },
    { onConflict: "run_id" },
  );
  if (insertError) throw new Error(`Failed to store eval report: ${insertError.message}`);

  console.log(`\nContracts evaluated: ${report.contractsEvaluated}`);
  console.log(`Overall: precision=${report.overall.precision.toFixed(3)} recall=${report.overall.recall.toFixed(3)} f1=${report.overall.f1.toFixed(3)}`);
  console.log(`Hallucination rate: ${report.hallucinationRate.toFixed(3)}`);
  console.log(`Abstention accuracy: ${report.abstentionAccuracy.toFixed(3)}`);
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Stored in eval_reports (run_id=${report.runId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
