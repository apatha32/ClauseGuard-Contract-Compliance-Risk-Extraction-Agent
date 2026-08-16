"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status =
  | { state: "idle" }
  | { state: "selected"; file: File }
  | { state: "uploading"; file: File }
  | { state: "done"; contractId: string; extractionRan: boolean; riskFlagsCreated: number }
  | { state: "error"; message: string };

export function UploadForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = useCallback((file: File) => {
    setStatus({ state: "selected", file });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) selectFile(file);
    },
    [selectFile],
  );

  async function handleUpload() {
    if (status.state !== "selected") return;
    setStatus({ state: "uploading", file: status.file });

    const formData = new FormData();
    formData.append("file", status.file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setStatus({ state: "error", message: body.error ?? "Upload failed." });
        return;
      }
      setStatus({
        state: "done",
        contractId: body.contractId,
        extractionRan: body.extractionRan,
        riskFlagsCreated: body.riskFlagsCreated,
      });
      router.refresh();
    } catch {
      setStatus({ state: "error", message: "Network error — could not reach the server." });
    }
  }

  if (status.state === "done") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <div>
            <p className="font-medium">Contract uploaded</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status.extractionRan
                ? `Extraction complete — ${status.riskFlagsCreated} risk flag(s) raised.`
                : "Saved without extraction (no Anthropic API key configured yet)."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="glass" onClick={() => setStatus({ state: "idle" })}>
              Upload another
            </Button>
            <Button asChild>
              <a href={`/dashboard/contracts/${status.contractId}`}>View contract</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-white/15 hover:border-white/25",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) selectFile(file);
            }}
          />
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Drag and drop a contract, or click to browse</p>
            <p className="mt-1 text-sm text-muted-foreground">.txt files up to 2MB</p>
          </div>
        </div>

        {status.state === "selected" || status.state === "uploading" ? (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{status.file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(status.file.size / 1024).toFixed(0)} KB
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {status.state === "uploading" ? (
                <Button size="sm" disabled>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setStatus({ state: "idle" })}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={handleUpload}>
                    Upload
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {status.state === "error" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {status.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
