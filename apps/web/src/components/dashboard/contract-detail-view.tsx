"use client";

import { useMemo, useRef, useState } from "react";
import { CircleCheck, Circle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityBadge } from "@/components/dashboard/severity-badge";
import { buildHighlightSegments } from "@/lib/highlight-text";
import { cn } from "@/lib/utils";
import type { ClauseRow, RiskFlagRow } from "@/lib/data";
import { CLAUSE_CATEGORIES } from "@clauseguard/schemas";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function ContractDetailView({
  sourceText,
  clauses,
  riskFlags,
}: {
  sourceText: string;
  clauses: ClauseRow[];
  riskFlags: RiskFlagRow[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const presentClauses = useMemo(() => clauses.filter((c) => c.is_present && c.start_char !== null && c.end_char !== null), [clauses]);
  const clauseByCategory = useMemo(() => new Map(clauses.map((c) => [c.category, c])), [clauses]);

  const segments = useMemo(
    () =>
      buildHighlightSegments(
        sourceText,
        presentClauses.map((c) => ({
          id: c.id,
          startChar: c.start_char!,
          endChar: c.end_char!,
          category: c.category,
        })),
      ),
    [sourceText, presentClauses],
  );

  function focusClause(id: string) {
    setActiveId(id);
    const node = nodeRefs.current.get(id);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const sortedFlags = [...riskFlags].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="flex h-[calc(100vh-220px)] flex-col">
        <CardContent className="flex-1 overflow-hidden p-0">
          <div
            ref={scrollContainerRef}
            className="scrollbar-thin h-full overflow-y-auto whitespace-pre-wrap p-6 font-mono text-[13px] leading-relaxed text-foreground/90"
          >
            {segments.map((segment, i) =>
              segment.type === "text" ? (
                <span key={i}>{segment.text}</span>
              ) : (
                <mark
                  key={i}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(segment.id, el);
                  }}
                  onClick={() => focusClause(segment.id)}
                  className={cn(
                    "cursor-pointer rounded bg-primary/20 px-0.5 text-foreground ring-1 ring-inset ring-primary/40 transition-all",
                    activeId === segment.id && "bg-accent/30 ring-2 ring-accent",
                  )}
                  title={segment.category}
                >
                  {segment.text}
                </mark>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex h-[calc(100vh-220px)] flex-col">
        <Tabs defaultValue="clauses" className="flex h-full flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="clauses" className="flex-1">
              Clauses
            </TabsTrigger>
            <TabsTrigger value="risk" className="flex-1">
              Risk Flags
              {riskFlags.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                  {riskFlags.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clauses" className="scrollbar-thin flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {CLAUSE_CATEGORIES.map((category) => {
                const clause = clauseByCategory.get(category);
                const isPresent = clause?.is_present ?? false;
                return (
                  <button
                    key={category}
                    type="button"
                    disabled={!isPresent}
                    onClick={() => clause && focusClause(clause.id)}
                    className={cn(
                      "glass-hover rounded-lg p-3 text-left transition-colors",
                      isPresent ? "cursor-pointer" : "cursor-default opacity-60",
                      activeId === clause?.id && "border-accent/50 bg-white/[0.06]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{category}</span>
                      {isPresent ? (
                        <CircleCheck className="h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {clause?.summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{clause.summary}</p>
                    )}
                  </button>
                );
              })}
              {clauses.length === 0 && <NoExtractionYet />}
            </div>
          </TabsContent>

          <TabsContent value="risk" className="scrollbar-thin flex-1 overflow-y-auto pr-1">
            {clauses.length === 0 ? (
              <NoExtractionYet />
            ) : sortedFlags.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ShieldCheck className="h-8 w-8 text-success" />
                <p className="text-sm font-medium">No policy deviations</p>
                <p className="text-xs text-muted-foreground">This contract passed every rule in the active policy.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedFlags.map((flag) => (
                  <div key={flag.id} className="glass rounded-lg p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{flag.category}</span>
                      <SeverityBadge severity={flag.severity} />
                    </div>
                    <p className="text-sm">{flag.message}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function NoExtractionYet() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <ShieldAlert className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">No extraction run yet</p>
      <p className="text-xs text-muted-foreground">
        Run the extraction pipeline on this contract to see clauses and risk flags.
      </p>
    </div>
  );
}
