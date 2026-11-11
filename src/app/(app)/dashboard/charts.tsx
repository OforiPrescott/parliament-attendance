"use client";

import { useRouter } from "next/navigation";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtDate } from "@/lib/utils";

const C = {
  primary: "hsl(157 77% 22%)",
  gold: "hsl(41 62% 47%)",
  grid: "hsl(40 12% 89%)",
  axis: "hsl(160 6% 45%)",
  present: "hsl(150 62% 30%)",
  late: "hsl(32 92% 45%)",
  absent: "hsl(2 68% 47%)",
  excused: "hsl(210 65% 48%)",
  official: "hsl(41 62% 52%)",
};
const axis = { tick: { fill: C.axis, fontSize: 11.5 }, tickLine: false, axisLine: false } as const;

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-[12px] shadow-elevated">
      {label && <div className="mb-1 font-semibold">{fmt ? fmt(label) : label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="num ml-auto pl-3 font-semibold">{typeof p.value === "number" ? `${p.value.toFixed(1)}%` : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: { id: number; date: string; rate: number }[] }) {
  const router = useRouter();
  const avg = data.reduce((a, d) => a + d.rate, 0) / data.length;
  return (
    <div className="h-[280px]">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
          onClick={(e) => { const id = (e?.activePayload?.[0]?.payload as { id?: number })?.id; if (id) router.push(`/sittings/${id}`); }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.primary} stopOpacity={0.28} />
              <stop offset="100%" stopColor={C.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={(d) => fmtDate(d, { day: "numeric", month: "short" })} minTickGap={24} />
          <YAxis {...axis} domain={[Math.max(0, Math.floor(Math.min(...data.map((d) => d.rate)) / 10) * 10 - 10), 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<Tip fmt={(l) => fmtDate(l, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />} cursor={{ stroke: C.gold, strokeDasharray: "3 3" }} />
          <ReferenceLine y={avg} stroke={C.gold} strokeDasharray="4 4" label={{ value: `avg ${avg.toFixed(1)}%`, position: "insideTopRight", fill: C.gold, fontSize: 11 }} />
          <Area type="monotone" dataKey="rate" name="Attendance" stroke={C.primary} strokeWidth={2.25} fill="url(#trendFill)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", cursor: "pointer" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ agg }: { agg: { present: number; late: number; absent: number; excused: number; official: number; expected: number } }) {
  const parts = [
    { name: "Present", value: agg.present, color: C.present },
    { name: "Late", value: agg.late, color: C.late },
    { name: "Official duty", value: agg.official, color: C.official },
    { name: "Excused", value: agg.excused, color: C.excused },
    { name: "Absent", value: agg.absent, color: C.absent },
  ].filter((p) => p.value > 0);
  return (
    <div>
      <div className="relative h-[190px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={parts} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
              {parts.map((p) => <Cell key={p.name} fill={p.color} />)}
            </Pie>
            <Tooltip formatter={(v) => `${Number(v).toLocaleString("en-GB")} (${((Number(v) / agg.expected) * 100).toFixed(1)}%)`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="num font-serif text-[24px] font-semibold">{agg.expected.toLocaleString("en-GB")}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">records</div>
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-[12.5px]">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="num ml-auto font-medium">{p.value.toLocaleString("en-GB")}</span>
            <span className="num w-12 text-right text-muted-foreground">{((p.value / agg.expected) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PartyChart({ data }: { data: { abbreviation: string; name: string; color: string; rate: number; expected: number }[] }) {
  return (
    <div style={{ height: Math.max(140, data.length * 54) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...axis} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="abbreviation" {...axis} width={56} tick={{ fill: "hsl(160 25% 9%)", fontSize: 12.5, fontWeight: 600 }} />
          <Tooltip content={<Tip />} cursor={{ fill: "hsl(40 14% 93% / 0.6)" }} />
          <Bar dataKey="rate" name="Attendance" radius={[0, 4, 4, 0]} barSize={22}
            label={{ position: "right", formatter: (v: unknown) => `${Number(v).toFixed(1)}%`, fontSize: 12, fill: C.axis }}>
            {data.map((d) => <Cell key={d.abbreviation} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegionChart({ data }: { data: { name: string; rate: number }[] }) {
  return (
    <div style={{ height: Math.max(200, data.length * 26) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...axis} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" {...axis} width={104} interval={0} />
          <Tooltip content={<Tip />} cursor={{ fill: "hsl(40 14% 93% / 0.6)" }} />
          <Bar dataKey="rate" name="Attendance" radius={[0, 3, 3, 0]} barSize={14} fill={C.primary}
            label={{ position: "right", formatter: (v: unknown) => `${Number(v).toFixed(0)}%`, fontSize: 11, fill: C.axis }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyComparison({ data, year }: { data: { month: string; current: number | null; previous: number | null }[]; year: number }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="month" {...axis} />
          <YAxis {...axis} domain={["dataMin - 5", 100]} tickFormatter={(v) => `${Math.round(v)}%`} />
          <Tooltip content={<Tip />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="previous" name={String(year - 1)} stroke={C.gold} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          <Line dataKey="current" name={String(year)} stroke={C.primary} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
