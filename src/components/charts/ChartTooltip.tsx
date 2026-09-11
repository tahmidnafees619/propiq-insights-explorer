import type { TooltipProps } from "recharts";

export function DarkTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs border"
      style={{
        background: "#111A1F",
        borderColor: "#2F99DA",
        boxShadow: "0 0 20px -4px rgba(47,153,218,0.4)",
      }}
    >
      {label !== undefined && <div className="text-muted-foreground mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground font-medium">
            {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
