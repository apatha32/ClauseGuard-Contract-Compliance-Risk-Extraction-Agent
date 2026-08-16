/**
 * Best-effort extraction of a dollar figure from clause text, for
 * min_value/max_value policy checks. Liability caps in real contracts are
 * often stated as a formula ("fees paid in the preceding twelve (12)
 * months") rather than a bare dollar amount — this deliberately does not
 * try to resolve those. Returning null for an unparseable amount is the
 * correct outcome: the caller treats it as "needs manual review", not as
 * a policy violation.
 */
const DOLLAR_AMOUNT = /\$\s?([\d,]+(?:\.\d{1,2})?)\s*(million|thousand|k|m)?\b/gi;

export function extractDollarAmount(text: string): number | null {
  const matches = [...text.matchAll(DOLLAR_AMOUNT)];
  if (!matches.length) return null;

  const values = matches.map((match) => {
    const base = parseFloat(match[1].replace(/,/g, ""));
    const suffix = match[2]?.toLowerCase();
    if (suffix === "million" || suffix === "m") return base * 1_000_000;
    if (suffix === "thousand" || suffix === "k") return base * 1_000;
    return base;
  });

  // A clause may cite more than one dollar figure (e.g. a carve-out amount
  // alongside the headline cap); the largest is the most defensible reading
  // of "the cap" for a min-value check. Known failure mode, confirmed against
  // real CUAD clauses: if the actual cap is formula-based but the clause
  // mentions an unrelated smaller dollar figure elsewhere (a fee, a per-unit
  // price), that figure wins by default and produces a false read rather
  // than the correct "unparseable" null. Precision over recall wasn't
  // achievable here without much heavier NLP, so this is a documented
  // limitation rather than a fixed one.
  return Math.max(...values);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
