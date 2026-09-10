import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProperties } from '@/hooks/useProperties';
import { useStats } from '@/hooks/useStats';
import { fmtCurrency, fmtNumber } from '@/lib/formatters';
import type { Property } from '@/types';

type SortKey = keyof Pick<Property, 'price' | 'sqft_living' | 'bedrooms' | 'bathrooms' | 'grade' | 'condition' | 'yr_built'>;

const PAGE_SIZE = 10;

export function PropertyTable() {
  const { data, isLoading } = useProperties();
  const { data: stats } = useStats();
  const median = stats.median_price;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'price', dir: 'desc' });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? data.filter(p =>
          // zipcode is optional on a Property, so guard before matching.
          (p.zipcode?.toLowerCase().includes(needle) ?? false) ||
          String(p.price).includes(needle) ||
          String(p.bedrooms).includes(needle),
        )
      : data;

    return [...list].sort((a, b) => {
      const av = a[sort.key] ?? 0;
      const bv = b[sort.key] ?? 0;
      return sort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [data, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Filtering can shrink the list below the current page; snap back into range
  // so the table never renders as empty when results exist.
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const priceColor = (p: number) => {
    if (p > median * 1.25) return '#10B981';
    if (p < median * 0.75) return '#EF4444';
    return '#F59E0B';
  };

  const toggleSort = (key: SortKey) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const cols: { key: SortKey | 'location'; label: string; sortable?: boolean }[] = [
    { key: 'price', label: 'Price', sortable: true },
    { key: 'sqft_living', label: 'Sqft', sortable: true },
    { key: 'bedrooms', label: 'Beds', sortable: true },
    { key: 'bathrooms', label: 'Baths', sortable: true },
    { key: 'grade', label: 'Grade', sortable: true },
    { key: 'condition', label: 'Condition', sortable: true },
    { key: 'yr_built', label: 'Year', sortable: true },
    { key: 'location', label: 'Location' },
  ];

  return (
    <div className="card-surface gradient-top-border p-5">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent Property Listings</h3>
          <p className="text-xs text-muted-foreground">{fmtNumber(filtered.length)} properties · sorted by {sort.key}</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Filter properties..."
            className="bg-[#0A1120] border border-[#1E2D4A] rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#3B82F6] transition w-64"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-[#1E2D4A]">
              {cols.map(c => (
                <th key={c.key} className={`text-left py-2.5 px-3 font-medium uppercase tracking-wider text-[10px] ${c.sortable ? 'cursor-pointer hover:text-foreground group' : ''}`} onClick={() => c.sortable && toggleSort(c.key as SortKey)}>
                  <span className="inline-flex items-center gap-1">{c.label} {c.sortable && <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 transition" />}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p, idx) => (
              <tr
                key={p.id}
                className="border-b border-[#1E2D4A]/50 hover:bg-[#111D35]/60 transition border-l-2 border-l-transparent hover:border-l-[#3B82F6]"
                style={{ background: idx % 2 ? 'transparent' : 'rgba(17,29,53,0.3)' }}
              >
                <td className="py-2.5 px-3 font-semibold" style={{ color: priceColor(p.price) }}>{fmtCurrency(p.price)}</td>
                <td className="py-2.5 px-3 text-foreground">{fmtNumber(p.sqft_living)}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{p.bedrooms}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{p.bathrooms}</td>
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded-md bg-[#1E2D4A] text-[10px] font-medium text-foreground">{p.grade}</span></td>
                <td className="py-2.5 px-3 text-muted-foreground">{p.condition}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{p.yr_built}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{p.zipcode ?? '—'}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={cols.length} className="py-12 text-center text-muted-foreground">{isLoading ? 'Loading properties…' : 'No properties match your filter'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-[#1E2D4A] hover:bg-[#111D35] disabled:opacity-40 transition btn-press inline-flex items-center gap-1"><ChevronLeft size={12} /> Prev</button>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 rounded-lg border border-[#1E2D4A] hover:bg-[#111D35] disabled:opacity-40 transition btn-press inline-flex items-center gap-1">Next <ChevronRight size={12} /></button>
        </div>
      </div>
    </div>
  );
}
