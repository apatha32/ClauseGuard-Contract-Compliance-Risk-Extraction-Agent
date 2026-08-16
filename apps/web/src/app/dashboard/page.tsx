import Link from "next/link";
import { FileText, ScrollText, ShieldAlert, Sparkles, ArrowRight, UploadCloud } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/dashboard/stat-tile";
import { getAggregateStats, getContracts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const [stats, { contracts }] = await Promise.all([
    getAggregateStats(),
    getContracts({ page: 1, pageSize: 6 }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Corpus and extraction status across the contracts library.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Contracts" value={stats.contractsCount} icon={FileText} />
        <StatTile
          label="Extracted"
          value={stats.extractedContractsCount}
          icon={Sparkles}
          hint={`of ${stats.contractsCount} contracts`}
        />
        <StatTile label="Risk Flags" value={stats.riskFlagsCount} icon={ShieldAlert} accent="warning" />
        <StatTile
          label="Critical Flags"
          value={stats.criticalFlagsCount}
          icon={ShieldAlert}
          accent="destructive"
        />
      </div>

      {stats.extractedContractsCount === 0 && (
        <Card className="border-primary/20">
          <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <UploadCloud className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">No extractions yet</p>
                <p className="text-sm text-muted-foreground">
                  {stats.contractsCount} contracts are seeded from CUAD, but none have been run through the
                  extraction pipeline. Upload a contract or run the extraction script to get started.
                </p>
              </div>
            </div>
            <Button asChild variant="glass" className="shrink-0">
              <Link href="/dashboard/upload">
                Upload a contract
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent contracts</CardTitle>
            <CardDescription>Latest additions to the library.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/contracts">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 pt-0">
          {contracts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No contracts yet.</p>
          ) : (
            contracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/dashboard/contracts/${contract.id}`}
                className="glass-hover -mx-2 flex items-center justify-between gap-3 rounded-lg px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{contract.file_name}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(contract.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
