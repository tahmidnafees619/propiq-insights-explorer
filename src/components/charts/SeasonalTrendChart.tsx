import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  ReferenceDot,
} from "recharts";
import { useStats } from "@/hooks/useStats";
import { fmtCompact } from "@/lib/formatters";
import { DarkTooltip } from "./ChartTooltip";

export function SeasonalTrendChart({ variant = "mini" }: { variant?: "mini" | "full" }) {
  const { data } = useStats();
  const rows = data?.monthly ?? [];

  if (variant === "full") {
    const peak = rows.reduce(
      (a, b) => (b.avg_price > a.avg_price ? b : a),
      rows[0] ?? { month: "", avg_price: 0, volume: 0 },
    );
    return (
      <div className="card-surface gradient-top-border p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Seasonal Price Patterns</h3>
          <p className="text-xs text-muted-foreground">
            Average sale price by month — peak season annotated
          </p>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="seasonFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2F99DA" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#2F99DA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#28363E" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#394B56" tick={{ fill: "#91A2AC", fontSize: 11 }} />
              <YAxis
                stroke="#394B56"
                tick={{ fill: "#91A2AC", fontSize: 11 }}
                tickFormatter={(v) => fmtCompact(v)}
              />
              <Tooltip content={<DarkTooltip />} />
              <Area
                type="monotone"
                dataKey="avg_price"
                stroke="#2F99DA"
                strokeWidth={2.5}
                fill="url(#seasonFill)"
                animationDuration={900}
              />
              {peak && (
                <ReferenceDot
                  x={peak.month}
                  y={peak.avg_price}
                  r={6}
                  fill="#3DAE91"
                  stroke="#111A1F"
                  strokeWidth={2}
                  label={{
                    value: `Peak: ${peak.month}`,
                    position: "top",
                    fill: "#3DAE91",
                    fontSize: 11,
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="card-surface gradient-top-border p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Sales by Month</h3>
        <p className="text-xs text-muted-foreground">Avg price (blue) and volume (green)</p>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#28363E" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#394B56" tick={{ fill: "#91A2AC", fontSize: 10 }} />
            <YAxis
              yAxisId="l"
              stroke="#394B56"
              tick={{ fill: "#91A2AC", fontSize: 10 }}
              tickFormatter={(v) => fmtCompact(v)}
            />
            <YAxis
              yAxisId="r"
              orientation="right"
              stroke="#394B56"
              tick={{ fill: "#91A2AC", fontSize: 10 }}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, color: "#91A2AC" }} />
            <Line
              yAxisId="l"
              type="monotone"
              dataKey="avg_price"
              stroke="#2F99DA"
              strokeWidth={2}
              dot={false}
              name="Avg Price"
              animationDuration={800}
            />
            <Line
              yAxisId="r"
              type="monotone"
              dataKey="volume"
              stroke="#3DAE91"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
              name="Volume"
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
