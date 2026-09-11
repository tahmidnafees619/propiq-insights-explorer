import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { useFeatureImportance } from "@/hooks/useFeatureImportance";
import { DarkTooltip } from "./ChartTooltip";

export function FeatureImportanceChart() {
  const { data = [] } = useFeatureImportance();
  const top = data.slice(0, 8);
  return (
    <div className="card-surface gradient-top-border p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Key Value Drivers</h3>
        <p className="text-xs text-muted-foreground">Feature contribution to predicted price</p>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart
            data={top}
            layout="vertical"
            margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis
              dataKey="label"
              type="category"
              stroke="#394B56"
              tick={{ fill: "#91A2AC", fontSize: 11 }}
              width={120}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(47,153,218,0.08)" }} />
            <Bar dataKey="importance" radius={[0, 8, 8, 0]} animationDuration={700}>
              {top.map((_, i) => (
                <Cell key={i} fill={i < 3 ? "#3DAE91" : "#2F99DA"} />
              ))}
              <LabelList
                dataKey="importance"
                position="right"
                formatter={(v: number | string) => `${(Number(v) * 100).toFixed(1)}%`}
                style={{ fill: "#91A2AC", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
