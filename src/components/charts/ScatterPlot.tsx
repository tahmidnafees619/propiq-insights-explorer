import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useProperties } from "@/hooks/useProperties";
import { gradeColor } from "@/lib/constants";
import { fmtCompact } from "@/lib/formatters";

/** One plotted sale. Recharts hands tooltip payloads back untyped. */
interface ScatterDatum {
  x: number;
  y: number;
  beds: number;
  grade: number;
}

export function ScatterPlot() {
  const { data = [] } = useProperties();
  const points = data.map((p) => ({
    x: p.sqft_living,
    y: p.price,
    grade: p.grade,
    beds: p.bedrooms,
  }));

  return (
    <div className="card-surface gradient-top-border p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Price vs Living Area</h3>
        <p className="text-xs text-muted-foreground">
          Each point is a property, colored by construction grade
        </p>
      </div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid stroke="#28363E" strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              name="Sqft"
              type="number"
              stroke="#394B56"
              tick={{ fill: "#91A2AC", fontSize: 11 }}
              label={{
                value: "Living Area (sqft)",
                position: "insideBottom",
                offset: -10,
                fill: "#394B56",
                fontSize: 11,
              }}
            />
            <YAxis
              dataKey="y"
              name="Price"
              type="number"
              stroke="#394B56"
              tick={{ fill: "#91A2AC", fontSize: 11 }}
              tickFormatter={(v) => fmtCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: "#2F99DA", strokeOpacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ScatterDatum;
                return (
                  <div
                    className="rounded-xl px-3 py-2 text-xs border"
                    style={{ background: "#111A1F", borderColor: "#2F99DA" }}
                  >
                    <div className="text-foreground font-semibold">${p.y.toLocaleString()}</div>
                    <div className="text-muted-foreground">
                      {p.x.toLocaleString()} sqft · {p.beds} bd · Grade {p.grade}
                    </div>
                  </div>
                );
              }}
            />
            <Scatter data={points} fillOpacity={0.7}>
              {points.map((p, i) => (
                <Cell key={i} fill={gradeColor(p.grade)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span>Grade:</span>
        {[4, 6, 8, 10, 12].map((g) => (
          <span key={g} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: gradeColor(g) }} />
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}
