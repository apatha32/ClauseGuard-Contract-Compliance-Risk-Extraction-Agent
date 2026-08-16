import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractClauses, EXTRACTION_MODEL, PROMPT_VERSION } from "@clauseguard/extraction";
import { parsePolicyConfig, evaluateContract, type ClauseInput } from "@clauseguard/risk-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — plenty for a text contract
const PLACEHOLDER_KEY = "dummy-anthropic-key";

export async function POST(request: Request) {
  // Route Handlers still run behind the middleware's session check, but
  // confirm here too since this one performs privileged writes.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".txt")) {
    return NextResponse.json({ error: "Only .txt files are supported right now." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 2MB)." }, { status: 400 });
  }

  const sourceText = (await file.text()).trim();
  if (!sourceText) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: contract, error: insertError } = await admin
    .from("contracts")
    .insert({ file_name: file.name, source_text: sourceText, uploaded_by: user.id })
    .select("id")
    .single();

  if (insertError || !contract) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to save contract." }, { status: 500 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let extractionRan = false;
  let riskFlagsCreated = 0;

  if (apiKey && apiKey !== PLACEHOLDER_KEY) {
    try {
      const clauses = await extractClauses({ sourceText, apiKey });
      await admin.from("clauses").upsert(
        clauses.map((clause) => ({
          contract_id: contract.id,
          category: clause.category,
          is_present: clause.present,
          source_text: clause.present ? clause.sourceText : null,
          start_char: clause.present ? clause.startChar : null,
          end_char: clause.present ? clause.endChar : null,
          summary: clause.present ? clause.summary : clause.reason,
          model: EXTRACTION_MODEL,
          prompt_version: PROMPT_VERSION,
        })),
        { onConflict: "contract_id,category,model,prompt_version" },
      );
      extractionRan = true;

      const policyYaml = await readFile(path.join(process.cwd(), "../../policy/default.yaml"), "utf-8");
      const policy = parsePolicyConfig(policyYaml);
      const clauseInputs: ClauseInput[] = clauses.map((c) => ({
        category: c.category,
        isPresent: c.present,
        sourceText: c.present ? c.sourceText : null,
      }));
      const flags = evaluateContract(contract.id, clauseInputs, policy);
      if (flags.length > 0) {
        await admin.from("risk_flags").upsert(
          flags.map((f) => ({
            contract_id: f.contractId,
            rule_id: f.ruleId,
            category: f.category,
            severity: f.severity,
            message: f.message,
            clause_source_text: f.clauseSourceText,
            policy_version: f.policyVersion,
          })),
          { onConflict: "contract_id,rule_id,policy_version" },
        );
        riskFlagsCreated = flags.length;
      }
    } catch (err) {
      // Contract is already saved — surface the extraction failure without
      // failing the whole upload. The contract detail page's empty state
      // covers "no extraction yet" whether it's pending or failed.
      console.error("Extraction failed for upload", contract.id, err);
    }
  }

  return NextResponse.json({ contractId: contract.id, extractionRan, riskFlagsCreated });
}
