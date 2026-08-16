"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, UploadCloud, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contracts", label: "Contracts", icon: FileText },
  { href: "/dashboard/upload", label: "Upload", icon: UploadCloud },
  { href: "/dashboard/eval", label: "Eval", icon: LineChart },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/5",
            )}
          >
            <Icon className="h-4 w-4" />
          </Link>
        );
      })}
    </nav>
  );
}
