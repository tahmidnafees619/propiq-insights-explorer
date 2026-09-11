import type { LucideIcon } from "lucide-react";

import { AnimatedNumber, SpotlightCard } from "@/components/motion";

interface Props {
  label: string;
  value: number;
  sub: string;
  icon: LucideIcon;
  accent?: "blue" | "green" | "amber" | "red";
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
}

const accents = {
  blue: { color: "#2F99DA", bg: "rgba(47,153,218,0.12)" },
  green: { color: "#3DAE91", bg: "rgba(61,174,145,0.12)" },
  amber: { color: "#D0A74E", bg: "rgba(208,167,78,0.12)" },
  red: { color: "#D5533F", bg: "rgba(213,83,63,0.12)" },
};

export function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "blue",
  prefix = "",
  suffix = "",
  format,
}: Props) {
  const a = accents[accent];
  // Entrance is the parent's business: the dashboard wraps these in `Stagger`,
  // so a card that animated itself in would fight the sequence.
  return (
    <SpotlightCard className="card-surface gradient-top-border hover-lift p-5 overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className="label-mute">{label}</div>
        <div className="relative">
          <div
            className="absolute inset-0 blur-xl rounded-full"
            style={{ background: a.color, opacity: 0.4 }}
          />
          <div
            className="relative w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: a.bg, color: a.color }}
          >
            <Icon size={18} />
          </div>
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
        {prefix}
        <AnimatedNumber value={value} format={format} />
        {suffix}
      </div>
      <div className="text-xs text-muted-foreground mt-2">{sub}</div>
    </SpotlightCard>
  );
}
