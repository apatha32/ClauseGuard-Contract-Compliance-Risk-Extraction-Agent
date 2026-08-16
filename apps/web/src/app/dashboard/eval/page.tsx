import { BarChart3, Target, Crosshair, Ghost, ShieldQuestion, FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PerCategoryChart, HistoryChart } from "@/components/dashboard/eval-charts";
import { getEvalReports } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EvalMetricsPage() {
  const reports = await getEvalReports();
  const latest = reports[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Eval Metrics</h1>
        <p className="text-sm text-muted-foreground">
          Extraction quality scored against CUAD expert labels, run by run.
        </p>
      </div>

      {!latest ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FlaskConical className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No eval runs yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Run <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">npm run run:eval</code> after
              extracting clauses to score the pipeline against CUAD ground truth.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile label="Precision" value={pct(latest.precision)} icon={Crosshair} />
            <StatTile label="Recall" value={pct(latest.recall)} icon={Target} />
            <StatTile label="F1" value={pct(latest.f1)} icon={BarChart3} />
            <StatTile
              label="Hallucination"
              value={pct(latest.hallucination_rate)}
              icon={Ghost}
              accent={num(latest.hallucination_rate) > 0.05 ? "destructive" : "success"}
            />
            <StatTile
              label="Abstention Acc."
              value={pct(latest.abstention_accuracy)}
              icon={ShieldQuestion}
              accent="success"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Per-category performance</CardTitle>
              <CardDescription>
                {latest.model} &middot; prompt {latest.prompt_version} &middot; {latest.contracts_evaluated}{" "}
                contracts &middot; {new Date(latest.created_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PerCategoryChart report={latest} />
            </CardContent>
          </Card>

          {reports.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Trend across runs</CardTitle>
                <CardDescription>Comparing model and prompt versions over time.</CardDescription>
              </CardHeader>
              <CardContent>
                <HistoryChart reports={reports} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function num(v: number | string): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function pct(v: number | string): string {
  return `${(num(v) * 100).toFixed(1)}%`;
}
