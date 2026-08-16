import type { ClauseCategory, PolicyConfig, PolicyRule, RiskFlag, Severity } from "@clauseguard/schemas";
import { extractDollarAmount, formatUsd } from "./value-extraction.js";

export type ClauseInput = {
  category: ClauseCategory;
  isPresent: boolean;
  sourceText: string | null;
};

type RuleOutcome = { severity: Severity; message: string } | null;

/**
 * Compares one contract's extracted clauses against a policy config and
 * returns the resulting flags. Rules for categories the contract has no
 * clause row for at all are treated the same as an explicit "not present" —
 * a missing category is not silently skipped.
 */
export function evaluateContract(
  contractId: string,
  clauses: ClauseInput[],
  policy: PolicyConfig,
): RiskFlag[] {
  const byCategory = new Map(clauses.map((clause) => [clause.category, clause]));
  const flags: RiskFlag[] = [];

  for (const rule of policy.rules) {
    const clause = byCategory.get(rule.category);
    const outcome = evaluateRule(rule, clause);
    if (!outcome) continue;

    flags.push({
      contractId,
      ruleId: rule.id,
      category: rule.category,
      severity: outcome.severity,
      message: outcome.message,
      clauseSourceText: clause?.isPresent ? clause.sourceText : null,
      policyVersion: policy.version,
    });
  }

  return flags;
}

function evaluateRule(rule: PolicyRule, clause: ClauseInput | undefined): RuleOutcome {
  const isPresent = clause?.isPresent ?? false;

  switch (rule.check) {
    case "must_be_present":
      if (isPresent) return null;
      return { severity: rule.severity, message: `${rule.category} clause not found. ${rule.description}` };

    case "must_be_absent":
      if (!isPresent) return null;
      return {
        severity: rule.severity,
        message: `${rule.category} clause is present, which deviates from policy. ${rule.description}`,
      };

    case "min_value":
    case "max_value":
      return evaluateValueRule(rule, isPresent, clause?.sourceText ?? null);
  }
}

function evaluateValueRule(rule: PolicyRule, isPresent: boolean, sourceText: string | null): RuleOutcome {
  if (!isPresent || !sourceText) {
    return {
      severity: rule.severity,
      message: `${rule.category} clause not found; cannot verify against policy. ${rule.description}`,
    };
  }

  const amount = extractDollarAmount(sourceText);
  if (amount === null) {
    return {
      severity: "info",
      message: `${rule.category} clause is present but no dollar amount could be parsed automatically; manual review recommended.`,
    };
  }

  const threshold = rule.value!;
  const violates = rule.check === "min_value" ? amount < threshold : amount > threshold;
  if (!violates) return null;

  const comparator = rule.check === "min_value" ? "below" : "above";
  return {
    severity: rule.severity,
    message: `${rule.category} value (${formatUsd(amount)}) is ${comparator} the policy threshold of ${formatUsd(threshold)}.`,
  };
}
