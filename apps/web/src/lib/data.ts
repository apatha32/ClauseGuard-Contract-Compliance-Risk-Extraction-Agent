import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CLAUSE_CATEGORIES, type ClauseCategory } from "@clauseguard/schemas";

export type Contract = {
  id: string;
  file_name: string;
  cuad_doc_id: string | null;
  created_at: string;
  source_text: string;
};

export type ClauseRow = {
  id: string;
  category: ClauseCategory;
  is_present: boolean;
  source_text: string | null;
  start_char: number | null;
  end_char: number | null;
  summary: string | null;
  model: string;
  prompt_version: string;
};

export type RiskFlagRow = {
  id: string;
  rule_id: string;
  category: ClauseCategory;
  severity: "info" | "warning" | "critical";
  message: string;
  clause_source_text: string | null;
};

export async function getAggregateStats() {
  const supabase = createClient();

  const [{ count: contractsCount }, { count: clauseLabelsCount }, { count: clausesCount }, { count: riskFlagsCount }, { count: criticalFlagsCount }] =
    await Promise.all([
      supabase.from("contracts").select("*", { count: "exact", head: true }),
      supabase.from("clause_labels").select("*", { count: "exact", head: true }),
      supabase.from("clauses").select("*", { count: "exact", head: true }),
      supabase.from("risk_flags").select("*", { count: "exact", head: true }),
      supabase.from("risk_flags").select("*", { count: "exact", head: true }).eq("severity", "critical"),
    ]);

  const { count: extractedContractsCount } = await supabase
    .from("clauses")
    .select("contract_id", { count: "exact", head: true });

  return {
    contractsCount: contractsCount ?? 0,
    clauseLabelsCount: clauseLabelsCount ?? 0,
    clausesCount: clausesCount ?? 0,
    riskFlagsCount: riskFlagsCount ?? 0,
    criticalFlagsCount: criticalFlagsCount ?? 0,
    extractedContractsCount: extractedContractsCount ?? 0,
  };
}

export async function getContracts(params: { page: number; pageSize: number; search?: string }) {
  const supabase = createClient();
  const { page, pageSize, search } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contracts")
    .select("id, file_name, cuad_doc_id, created_at", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("file_name", `%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return { contracts: data ?? [], total: count ?? 0 };
}

export async function getContractExtractionCounts(contractIds: string[]) {
  if (contractIds.length === 0) return new Map<string, number>();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clauses")
    .select("contract_id")
    .in("contract_id", contractIds)
    .eq("is_present", true);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.contract_id, (counts.get(row.contract_id) ?? 0) + 1);
  }
  return counts;
}

export async function getContract(id: string): Promise<Contract | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("id, file_name, cuad_doc_id, created_at, source_text")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getClausesForContract(contractId: string): Promise<ClauseRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clauses")
    .select("id, category, is_present, source_text, start_char, end_char, summary, model, prompt_version")
    .eq("contract_id", contractId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRiskFlagsForContract(contractId: string): Promise<RiskFlagRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("risk_flags")
    .select("id, rule_id, category, severity, message, clause_source_text")
    .eq("contract_id", contractId)
    .order("severity", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Every clause row present in `clauses`, keyed by category, for the fixed 10-category checklist UI. */
export function clausesByCategory(clauses: ClauseRow[]): Map<ClauseCategory, ClauseRow> {
  return new Map(clauses.map((c) => [c.category, c]));
}

export function allCategories(): readonly ClauseCategory[] {
  return CLAUSE_CATEGORIES;
}

export type EvalReportRow = {
  id: string;
  run_id: string;
  model: string;
  prompt_version: string;
  contracts_evaluated: number;
  precision: number;
  recall: number;
  f1: number;
  hallucination_rate: number;
  abstention_accuracy: number;
  per_category: {
    category: ClauseCategory;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1: number;
  }[];
  created_at: string;
};

export async function getEvalReports(limit = 20): Promise<EvalReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("eval_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
