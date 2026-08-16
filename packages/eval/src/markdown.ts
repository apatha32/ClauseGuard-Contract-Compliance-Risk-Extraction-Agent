import type { EvalReport } from "@clauseguard/schemas";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function renderMarkdownReport(report: EvalReport): string {
  const lines: string[] = [];

  lines.push(`# ClauseGuard Eval Report`);
  lines.push("");
  lines.push(`- Run ID: \`${report.runId}\``);
  lines.push(`- Model: \`${report.modelId}\``);
  lines.push(`- Prompt version: \`${report.promptVersion}\``);
  lines.push(`- Created: ${report.createdAt}`);
  lines.push(`- Contracts evaluated: ${report.contractsEvaluated}`);
  lines.push("");

  lines.push(`## Overall`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Precision | ${pct(report.overall.precision)} |`);
  lines.push(`| Recall | ${pct(report.overall.recall)} |`);
  lines.push(`| F1 | ${pct(report.overall.f1)} |`);
  lines.push(`| Hallucination rate | ${pct(report.hallucinationRate)} |`);
  lines.push(`| Abstention accuracy | ${pct(report.abstentionAccuracy)} |`);
  lines.push("");

  lines.push(`## Per Category`);
  lines.push("");
  lines.push(`| Category | Precision | Recall | F1 | TP | FP | FN |`);
  lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const c of report.perCategory) {
    lines.push(
      `| ${c.category} | ${pct(c.precision)} | ${pct(c.recall)} | ${pct(c.f1)} | ${c.truePositives} | ${c.falsePositives} | ${c.falseNegatives} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
