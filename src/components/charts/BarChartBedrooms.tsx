import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { useStats } from "@/hooks/useStats";
import { fmtCompact, fmtCurrency } from "@/lib/formatters";
import { DarkTooltip } from "./ChartTooltip";

export function BarChartBedrooms() {
  const { data } = useStats();
  const rows = (data?.avg_price_by_bedrooms ?? []).map((r) => ({
    name: `${r.bedrooms} bd`,
    value: r.avg_price,
  }));

  return (
    <div className="card-surface gradient-top-border p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Avg Price by Bedrooms</h3>
        <p className="text-xs text-muted-foreground">
          Median listing price grouped by bedroom count
        </p>
      </div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="bedBar" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2F99DA" />
                <stop offset="100%" stopColor="#3DAE91" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#28363E" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              stroke="#394B56"
              tick={{ fill: "#91A2AC", fontSize: 11 }}
              tickFormatter={(v) => fmtCompact(v)}
            />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#394B56"
              tick={{ fill: "#91A2AC", fontSize: 11 }}
              width={50}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(47,153,218,0.08)" }} />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={800}>
              {rows.map((_, i) => (
                <Cell key={i} fill="url(#bedBar)" />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: number | string) => fmtCurrency(Number(v))}
                style={{ fill: "#91A2AC", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
