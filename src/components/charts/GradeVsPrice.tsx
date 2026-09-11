import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useStats } from "@/hooks/useStats";
import { fmtCompact } from "@/lib/formatters";
import { DarkTooltip } from "./ChartTooltip";

export function GradeVsPrice() {
  const { data } = useStats();
  return (
    <div className="card-surface gradient-top-border p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Grade vs Price</h3>
        <p className="text-xs text-muted-foreground">Bars: avg price · Line: property count</p>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <ComposedChart
            data={data?.grade_breakdown ?? []}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid stroke="#28363E" strokeDasharray="3 3" />
            <XAxis dataKey="grade" stroke="#394B56" tick={{ fill: "#91A2AC", fontSize: 10 }} />
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
            <Bar
              yAxisId="l"
              dataKey="avg_price"
              fill="#2F99DA"
              radius={[6, 6, 0, 0]}
              name="Avg Price"
              animationDuration={800}
            />
            <Line
              yAxisId="r"
              type="monotone"
              dataKey="count"
              stroke="#3DAE91"
              strokeWidth={2}
              dot={{ fill: "#3DAE91", r: 3 }}
              name="Count"
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
