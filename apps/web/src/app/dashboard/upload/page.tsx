import { UploadForm } from "@/components/dashboard/upload-form";

export default function UploadPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload a contract</h1>
        <p className="text-sm text-muted-foreground">
          New contracts are extracted against the 10 tracked clause categories and evaluated against the
          active risk policy automatically.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
