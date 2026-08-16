import {
  CLAUSE_CATEGORIES,
  EvalReportSchema,
  type ClauseCategory,
  type ClauseEvalMetrics,
  type EvalReport,
} from "@clauseguard/schemas";

export type GroundTruthClause = {
  contractId: string;
  category: ClauseCategory;
  isPresent: boolean;
};

export type PredictedClause = {
  contractId: string;
  category: ClauseCategory;
  isPresent: boolean;
  sourceText: string | null;
  startChar: number | null;
  endChar: number | null;
};

export type ComputeEvalReportParams = {
  runId: string;
  modelId: string;
  promptVersion: string;
  groundTruth: GroundTruthClause[];
  predictions: PredictedClause[];
  /** Full contract text keyed by contract id, used to verify every "present" prediction's span is real. */
  contractSourceText: Map<string, string>;
  createdAt?: Date;
};

type Counts = { tp: number; fp: number; fn: number; tn: number };

function emptyCounts(): Counts {
  return { tp: 0, fp: 0, fn: 0, tn: 0 };
}

function key(contractId: string, category: ClauseCategory): string {
  return `${contractId}::${category}`;
}

/**
 * Scores predicted clauses against CUAD ground truth: per-category and
 * overall precision/recall/F1 (micro-averaged), a hallucination rate
 * (re-verifies every "present" prediction's span against the actual
 * contract text, independent of whatever grounding check ran at
 * extraction time), and abstention accuracy (of the cases genuinely
 * absent per ground truth, how often the model correctly said so).
 */
export function computeEvalReport(params: ComputeEvalReportParams): EvalReport {
  const groundTruthByKey = new Map(
    params.groundTruth.map((g) => [key(g.contractId, g.category), g]),
  );
  const predictionByKey = new Map(
    params.predictions.map((p) => [key(p.contractId, p.category), p]),
  );

  const countsByCategory = new Map<ClauseCategory, Counts>(
    CLAUSE_CATEGORIES.map((c) => [c, emptyCounts()]),
  );

  const evaluatedContractIds = new Set<string>();
  let hallucinated = 0;
  let totalPresentPredictions = 0;

  for (const [pairKey, prediction] of predictionByKey) {
    const truth = groundTruthByKey.get(pairKey);
    if (!truth) continue; // no ground truth for this (contract, category) pair — skip

    evaluatedContractIds.add(prediction.contractId);
    const counts = countsByCategory.get(prediction.category)!;

    if (prediction.isPresent && truth.isPresent) counts.tp++;
    else if (prediction.isPresent && !truth.isPresent) counts.fp++;
    else if (!prediction.isPresent && truth.isPresent) counts.fn++;
    else counts.tn++;

    if (prediction.isPresent) {
      totalPresentPredictions++;
      if (!isGrounded(prediction, params.contractSourceText)) hallucinated++;
    }
  }

  const perCategory: ClauseEvalMetrics[] = CLAUSE_CATEGORIES.map((category) => {
    const c = countsByCategory.get(category)!;
    return { category, ...prf(c.tp, c.fp, c.fn) };
  });

  const totals = [...countsByCategory.values()].reduce(
    (acc, c) => ({ tp: acc.tp + c.tp, fp: acc.fp + c.fp, fn: acc.fn + c.fn, tn: acc.tn + c.tn }),
    emptyCounts(),
  );

  const overall = prf(totals.tp, totals.fp, totals.fn);
  const hallucinationRate = totalPresentPredictions > 0 ? hallucinated / totalPresentPredictions : 0;
  const groundTruthAbsentCount = totals.tn + totals.fp;
  const abstentionAccuracy = groundTruthAbsentCount > 0 ? totals.tn / groundTruthAbsentCount : 1;

  const report: EvalReport = {
    runId: params.runId,
    modelId: params.modelId,
    promptVersion: params.promptVersion,
    createdAt: (params.createdAt ?? new Date()).toISOString(),
    perCategory,
    overall: { precision: overall.precision, recall: overall.recall, f1: overall.f1 },
    hallucinationRate,
    abstentionAccuracy,
    contractsEvaluated: evaluatedContractIds.size,
  };

  return EvalReportSchema.parse(report);
}

function isGrounded(prediction: PredictedClause, contractSourceText: Map<string, string>): boolean {
  if (prediction.sourceText === null || prediction.startChar === null || prediction.endChar === null) {
    return false;
  }
  const sourceText = contractSourceText.get(prediction.contractId);
  if (!sourceText) return false;
  return sourceText.slice(prediction.startChar, prediction.endChar) === prediction.sourceText;
}

function prf(tp: number, fp: number, fn: number): { truePositives: number; falsePositives: number; falseNegatives: number; precision: number; recall: number; f1: number } {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { truePositives: tp, falsePositives: fp, falseNegatives: fn, precision, recall, f1 };
}
