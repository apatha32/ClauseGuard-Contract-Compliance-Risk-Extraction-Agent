"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  type TooltipProps,
} from "recharts";
import type { EvalReportRow } from "@/lib/data";

const AXIS_COLOR = "hsl(215 16% 65%)";
const GRID_COLOR = "hsl(217 33% 24%)";

function num(v: number | string): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function TooltipCard({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value !== undefined ? (num(p.value) * 100).toFixed(1) : "—"}%
        </p>
      ))}
    </div>
  );
}

export function PerCategoryChart({ report }: { report: EvalReportRow }) {
  const data = report.per_category.map((c) => ({
    category: c.category.length > 18 ? c.category.slice(0, 16) + "…" : c.category,
    fullCategory: c.category,
    precision: num(c.precision),
    recall: num(c.recall),
    f1: num(c.f1),
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="category"
          angle={-35}
          textAnchor="end"
          interval={0}
          height={80}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TooltipCard />} cursor={{ fill: "hsl(0 0% 100% / 0.03)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} />
        <Bar dataKey="precision" name="Precision" fill="hsl(199 89% 60%)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="recall" name="Recall" fill="hsl(172 66% 50%)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="f1" name="F1" fill="hsl(262 83% 68%)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HistoryChart({ reports }: { reports: EvalReportRow[] }) {
  const data = [...reports]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((r) => ({
      date: new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      f1: num(r.f1),
      precision: num(r.precision),
      recall: num(r.recall),
    }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TooltipCard />} />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} />
        <Line type="monotone" dataKey="f1" name="F1" stroke="hsl(262 83% 68%)" strokeWidth={2} dot={{ r: 3 }} />
        <Line
          type="monotone"
          dataKey="precision"
          name="Precision"
          stroke="hsl(199 89% 60%)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line type="monotone" dataKey="recall" name="Recall" stroke="hsl(172 66% 50%)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
