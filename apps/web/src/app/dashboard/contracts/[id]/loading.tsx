import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ContractDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="h-[calc(100vh-220px)]">
          <CardContent className="flex h-full flex-col gap-2 p-6">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" style={{ width: `${70 + ((i * 7) % 30)}%` }} />
            ))}
          </CardContent>
        </Card>
        <div className="flex h-[calc(100vh-220px)] flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
