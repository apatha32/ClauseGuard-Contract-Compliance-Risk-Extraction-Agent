import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Page not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or was moved.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
