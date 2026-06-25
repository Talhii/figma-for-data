"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartData } from "@/lib/types";
import { colorAt } from "@/lib/palette";

const AXIS = { stroke: "#52525b", fontSize: 11 };
const GRID_COLOR = "rgba(255,255,255,0.06)";

const tooltipStyle = {
  background: "#141419",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  fontSize: 12,
  color: "#e4e4e7",
  boxShadow: "0 12px 40px -12px rgba(0,0,0,0.8)",
};

export function ChartWidget({ data }: { data: ChartData }) {
  const { kind, xKey, series, rows } = data;

  if (kind === "pie") {
    const valueKey = series[0]?.key ?? "value";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} cursor={{ opacity: 0.1 }} />
          <Pie
            data={rows}
            dataKey={valueKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            innerRadius="48%"
            outerRadius="78%"
            paddingAngle={3}
            stroke="#0b0b0f"
            strokeWidth={2}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} {...AXIS} />
          <YAxis tickLine={false} axisLine={false} {...AXIS} width={36} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: GRID_COLOR }} />
          {series.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart.
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} {...AXIS} />
        <YAxis tickLine={false} axisLine={false} {...AXIS} width={36} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
        )}
        {series.map((s, si) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          >
            {/* Single-series bars get a per-category color sweep for polish. */}
            {series.length === 1
              ? rows.map((_, i) => <Cell key={i} fill={colorAt(i)} />)
              : rows.map((_, i) => <Cell key={i} fill={s.color} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
