import Link from "next/link";
import { Search, ScrollText, ChevronLeft, ChevronRight, CircleCheck, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getContracts, getContractExtractionCounts } from "@/lib/data";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const search = searchParams.q ?? "";

  const { contracts, total } = await getContracts({ page, pageSize: PAGE_SIZE, search });
  const extractionCounts = await getContractExtractionCounts(contracts.map((c) => c.id));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
        <p className="text-sm text-muted-foreground">{total} contracts in the library.</p>
      </div>

      <form className="flex items-center gap-2" action="/dashboard/contracts" method="get">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={search} placeholder="Search by file name..." className="pl-9" />
        </div>
        <Button type="submit" variant="glass">
          Search
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Extraction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    No contracts match &ldquo;{search}&rdquo;.
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((contract) => {
                  const presentCount = extractionCounts.get(contract.id);
                  return (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/contracts/${contract.id}`}
                          className="flex items-center gap-2 font-medium hover:text-primary"
                        >
                          <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="line-clamp-1">{contract.file_name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(contract.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {presentCount !== undefined ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-success">
                            <CircleCheck className="h-3.5 w-3.5" />
                            {presentCount} clauses found
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Circle className="h-3.5 w-3.5" />
                            Not extracted
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : ""}
            >
              <Link href={`/dashboard/contracts?page=${page - 1}&q=${encodeURIComponent(search)}`}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
            >
              <Link href={`/dashboard/contracts?page=${page + 1}&q=${encodeURIComponent(search)}`}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
