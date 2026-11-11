"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MonthlyRate({ data }: { data: { month: string; rate: number; attended: number; expected: number }[] }) {
  const label = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  return (
    <div className="h-[240px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="hsl(40 12% 89%)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={label} tick={{ fontSize: 11.5, fill: "hsl(160 6% 45%)" }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11.5, fill: "hsl(160 6% 45%)" }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "hsl(40 14% 93% / 0.6)" }}
            labelFormatter={(l) => label(String(l))}
            formatter={(v, _n, p) => [`${Number(v).toFixed(1)}% (${(p.payload as { attended: number }).attended}/${(p.payload as { expected: number }).expected})`, "Attendance"]}
          />
          <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={22}>
            {data.map((d) => <Cell key={d.month} fill={d.rate >= 85 ? "hsl(150 62% 30%)" : d.rate >= 70 ? "hsl(32 92% 45%)" : "hsl(2 68% 47%)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
