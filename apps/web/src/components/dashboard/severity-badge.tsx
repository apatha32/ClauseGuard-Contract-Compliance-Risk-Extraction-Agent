import { AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CONFIG = {
  critical: { variant: "destructive" as const, icon: AlertOctagon, label: "Critical" },
  warning: { variant: "warning" as const, icon: AlertTriangle, label: "Warning" },
  info: { variant: "secondary" as const, icon: Info, label: "Info" },
};

export function SeverityBadge({ severity }: { severity: "critical" | "warning" | "info" }) {
  const { variant, icon: Icon, label } = CONFIG[severity];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
