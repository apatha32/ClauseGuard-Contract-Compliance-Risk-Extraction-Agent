import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 flex items-center gap-2 text-foreground">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">ClauseGuard</span>
      </div>
      <div className="w-full max-w-sm animate-fade-in-up">{children}</div>
    </div>
  );
}
