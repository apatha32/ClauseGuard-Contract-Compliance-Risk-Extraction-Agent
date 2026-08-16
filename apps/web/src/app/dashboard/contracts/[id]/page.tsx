import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractDetailView } from "@/components/dashboard/contract-detail-view";
import { getContract, getClausesForContract, getRiskFlagsForContract } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const contract = await getContract(params.id);
  if (!contract) notFound();

  const [clauses, riskFlags] = await Promise.all([
    getClausesForContract(contract.id),
    getRiskFlagsForContract(contract.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/dashboard/contracts">
            <ArrowLeft className="h-4 w-4" />
            Back to contracts
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{contract.file_name}</h1>
        <p className="text-sm text-muted-foreground">
          Uploaded {new Date(contract.created_at).toLocaleDateString()} &middot;{" "}
          {contract.source_text.length.toLocaleString()} characters
        </p>
      </div>

      <ContractDetailView sourceText={contract.source_text} clauses={clauses} riskFlags={riskFlags} />
    </div>
  );
}
