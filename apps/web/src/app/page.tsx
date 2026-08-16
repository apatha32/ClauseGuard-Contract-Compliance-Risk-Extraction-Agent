import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  Quote,
  SlidersHorizontal,
  FlaskConical,
  FileText,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Quote,
    title: "Grounded citations",
    description:
      "Every extracted clause maps to an exact character span in the source document. If a claim can't be verified against the text, the system abstains instead of guessing.",
  },
  {
    icon: SlidersHorizontal,
    title: "Configurable risk policy",
    description:
      "Acceptable ranges per clause type are defined in YAML, not hardcoded, so compliance rules can change without touching application code.",
  },
  {
    icon: FlaskConical,
    title: "Quantified accuracy",
    description:
      "Extraction quality is scored against CUAD's expert labels: precision, recall, F1, hallucination rate, and abstention accuracy, not qualitative review.",
  },
];

async function getPublicStats() {
  // Landing page is unauthenticated, so this uses the admin client for a
  // small, non-sensitive set of aggregate counts rather than opening up
  // public RLS read access to the underlying tables.
  const supabase = createAdminClient();
  const [{ count: contractsCount }, { count: clauseLabelsCount }] = await Promise.all([
    supabase.from("contracts").select("*", { count: "exact", head: true }),
    supabase.from("clause_labels").select("*", { count: "exact", head: true }),
  ]);
  return {
    contractsCount: contractsCount ?? 0,
    clauseLabelsCount: clauseLabelsCount ?? 0,
  };
}

export default async function LandingPage() {
  const stats = await getPublicStats();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">ClauseGuard</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-16 md:px-12 md:py-24">
        <div className="flex max-w-2xl flex-col items-center gap-6 text-center animate-fade-in-up">
          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Contract compliance and risk extraction, grounded in the source text.
          </h1>
          <p className="text-balance text-lg text-muted-foreground">
            ClauseGuard extracts key clauses from commercial contracts, flags deviations from a configurable
            risk policy, and cites the exact source text for every claim, so a reviewer can verify a finding
            in seconds instead of rereading the whole document.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <a href="https://github.com/apatha32/ClauseGuard-Contract-Compliance-Risk-Extraction-Agent" target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={FileText} label="Contracts in corpus" value={stats.contractsCount.toLocaleString()} />
          <StatCard icon={Tags} label="Expert clause labels" value={stats.clauseLabelsCount.toLocaleString()} />
          <StatCard icon={SlidersHorizontal} label="Clause categories tracked" value="10" />
        </div>

        <div className="mt-24 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <feature.icon className="h-4 w-4" />
                </div>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-muted-foreground md:px-12">
        ClauseGuard — built on the Contract Understanding Atticus Dataset (CUAD).
      </footer>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
