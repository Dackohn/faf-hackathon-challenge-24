import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PrometheusRangeSeries } from "@/features/metrics/api/prometheus-client";

const COLORS = [
  "#38bdf8", "#34d399", "#fbbf24", "#a78bfa",
  "#f97316", "#22d3ee", "#fb7185", "#84cc16",
];

interface MetricLineChartProps {
  series: PrometheusRangeSeries[];
  title: string;
  unit?: string;
  labelKey?: string;
  formatValue?: (v: number) => string;
}

export function MetricLineChart({
  series,
  title,
  unit = "",
  labelKey = "service",
  formatValue,
}: MetricLineChartProps) {
  if (!series.length) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/60">No data yet</p>
      </div>
    );
  }

  // Merge all series into a single array keyed by timestamp
  const timestampMap = new Map<number, Record<string, number>>();
  series.forEach((s) => {
    const name = s.labels[labelKey] ?? Object.values(s.labels)[0] ?? "value";
    s.samples.forEach(({ timestamp, value }) => {
      if (!timestampMap.has(timestamp)) timestampMap.set(timestamp, { timestamp });
      timestampMap.get(timestamp)![name] = value;
    });
  });

  const chartData = Array.from(timestampMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  const seriesNames = series.map(
    (s) => s.labels[labelKey] ?? Object.values(s.labels)[0] ?? "value"
  );

  const fmt = formatValue ?? ((v: number) => `${v.toFixed(2)}${unit}`);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => format(new Date(v), "HH:mm")}
            tick={{ fontSize: 9, fill: "currentColor" }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "currentColor" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Number(v.toFixed(2))}${unit}`}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
            labelFormatter={(v) => format(new Date(v as number), "HH:mm:ss")}
            formatter={(v) => [fmt(Number(v))]}
          />
          {seriesNames.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
