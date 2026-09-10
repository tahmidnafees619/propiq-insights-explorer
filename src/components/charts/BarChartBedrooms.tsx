import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { useStats } from '@/hooks/useStats';
import { fmtCompact, fmtCurrency } from '@/lib/formatters';
import { DarkTooltip } from './ChartTooltip';

export function BarChartBedrooms() {
  const { data } = useStats();
  const rows = (data?.avg_price_by_bedrooms ?? []).map(r => ({ name: `${r.bedrooms} bd`, value: r.avg_price }));

  return (
    <div className="card-surface gradient-top-border p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Avg Price by Bedrooms</h3>
        <p className="text-xs text-muted-foreground">Median listing price grouped by bedroom count</p>
      </div>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="bedBar" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1E2D4A" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="#475569" tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={v => fmtCompact(v)} />
            <YAxis dataKey="name" type="category" stroke="#475569" tick={{ fill: '#94A3B8', fontSize: 11 }} width={50} />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={800}>
              {rows.map((_, i) => <Cell key={i} fill="url(#bedBar)" />)}
              <LabelList dataKey="value" position="right" formatter={(v: any) => fmtCurrency(v)} style={{ fill: '#94A3B8', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
