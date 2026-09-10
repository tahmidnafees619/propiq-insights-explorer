import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useProperties } from '@/hooks/useProperties';
import { gradeColor } from '@/lib/constants';
import { fmtCompact } from '@/lib/formatters';

export function ScatterPlot() {
  const { data = [] } = useProperties();
  const points = data.map(p => ({ x: p.sqft_living, y: p.price, grade: p.grade, beds: p.bedrooms }));

  return (
    <div className="card-surface gradient-top-border p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Price vs Living Area</h3>
        <p className="text-xs text-muted-foreground">Each point is a property, colored by construction grade</p>
      </div>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid stroke="#1E2D4A" strokeDasharray="3 3" />
            <XAxis dataKey="x" name="Sqft" type="number" stroke="#475569" tick={{ fill: '#94A3B8', fontSize: 11 }} label={{ value: 'Living Area (sqft)', position: 'insideBottom', offset: -10, fill: '#475569', fontSize: 11 }} />
            <YAxis dataKey="y" name="Price" type="number" stroke="#475569" tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={v => fmtCompact(v)} />
            <Tooltip
              cursor={{ stroke: '#3B82F6', strokeOpacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p: any = payload[0].payload;
                return (
                  <div className="rounded-xl px-3 py-2 text-xs border" style={{ background: '#0D1526', borderColor: '#3B82F6' }}>
                    <div className="text-foreground font-semibold">${p.y.toLocaleString()}</div>
                    <div className="text-muted-foreground">{p.x.toLocaleString()} sqft · {p.beds} bd · Grade {p.grade}</div>
                  </div>
                );
              }}
            />
            <Scatter data={points} fillOpacity={0.7}>
              {points.map((p, i) => <Cell key={i} fill={gradeColor(p.grade)} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span>Grade:</span>
        {[4, 6, 8, 10, 12].map(g => (
          <span key={g} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: gradeColor(g) }} />{g}</span>
        ))}
      </div>
    </div>
  );
}
