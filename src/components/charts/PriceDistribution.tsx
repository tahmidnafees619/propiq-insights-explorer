import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useStats } from "@/hooks/useStats";
import { DarkTooltip } from "./ChartTooltip";

export function PriceDistribution() {
  const { data } = useStats();
  return (
    <div className="card-surface gradient-top-border p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Price Distribution</h3>
        <p className="text-xs text-muted-foreground">Listings bucketed by sale price</p>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <AreaChart
            data={data?.price_distribution ?? []}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="distFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2F99DA" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#2F99DA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#28363E" strokeDasharray="3 3" />
            <XAxis dataKey="bucket" stroke="#394B56" tick={{ fill: "#91A2AC", fontSize: 10 }} />
            <YAxis stroke="#394B56" tick={{ fill: "#91A2AC", fontSize: 10 }} />
            <Tooltip content={<DarkTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#2F99DA"
              strokeWidth={2}
              fill="url(#distFill)"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
