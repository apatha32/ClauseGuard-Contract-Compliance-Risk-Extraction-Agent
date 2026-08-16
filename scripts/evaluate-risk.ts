import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parsePolicyConfig, evaluateContract, type ClauseInput } from "@clauseguard/risk-engine";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY_PATH = path.join(__dirname, "../policy/default.yaml");

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const policyArg = process.argv.find((a) => a.startsWith("--policy="));
const POLICY_PATH = policyArg ? path.resolve(policyArg.split("=")[1]) : DEFAULT_POLICY_PATH;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }

  const policyYaml = await readFile(POLICY_PATH, "utf-8");
  const policy = parsePolicyConfig(policyYaml);
  console.log(`Loaded policy v${policy.version} from ${POLICY_PATH} (${policy.rules.length} rules).`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Fetching contracts with extracted clauses...");
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(`id, file_name, clauses(category, is_present, source_text)`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to fetch contracts: ${error.message}`);

  type Row = {
    id: string;
    file_name: string;
    clauses: { category: string; is_present: boolean; source_text: string | null }[];
  };

  const withClauses = ((contracts ?? []) as Row[]).filter((c) => c.clauses.length > 0);
  const targets = LIMIT ? withClauses.slice(0, LIMIT) : withClauses;

  console.log(
    `${contracts?.length ?? 0} contracts total, ${withClauses.length} have extracted clauses, evaluating ${targets.length}.`,
  );

  let totalFlags = 0;
  const severityCounts = { info: 0, warning: 0, critical: 0 };

  for (const contract of targets) {
    const clauseInputs: ClauseInput[] = contract.clauses.map((c) => ({
      category: c.category as ClauseInput["category"],
      isPresent: c.is_present,
      sourceText: c.source_text,
    }));

    const flags = evaluateContract(contract.id, clauseInputs, policy);
    totalFlags += flags.length;
    for (const flag of flags) severityCounts[flag.severity]++;

    console.log(`  ${contract.file_name}: ${flags.length} flag(s)`);
    for (const flag of flags) {
      console.log(`    [${flag.severity}] ${flag.ruleId}: ${flag.message}`);
    }

    if (DRY_RUN || flags.length === 0) continue;

    const rows = flags.map((flag) => ({
      contract_id: flag.contractId,
      rule_id: flag.ruleId,
      category: flag.category,
      severity: flag.severity,
      message: flag.message,
      clause_source_text: flag.clauseSourceText,
      policy_version: flag.policyVersion,
    }));

    const { error: insertError } = await supabase
      .from("risk_flags")
      .upsert(rows, { onConflict: "contract_id,rule_id,policy_version" });
    if (insertError) {
      throw new Error(`Failed to insert risk flags for ${contract.file_name}: ${insertError.message}`);
    }
  }

  console.log(
    `\nDone. ${totalFlags} flag(s) across ${targets.length} contracts` +
      ` (info: ${severityCounts.info}, warning: ${severityCounts.warning}, critical: ${severityCounts.critical}).` +
      (DRY_RUN ? " Dry run — nothing written." : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
