import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CountUp } from '@/components/shared/CountUp';

interface Props {
  label: string;
  value: number;
  sub: string;
  icon: LucideIcon;
  accent?: 'blue' | 'green' | 'amber' | 'red';
  prefix?: string;
  suffix?: string;
  delay?: number;
  format?: (n: number) => string;
}

const accents = {
  blue: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  green: { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  amber: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  red: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

export function KPICard({ label, value, sub, icon: Icon, accent = 'blue', prefix = '', suffix = '', delay = 0, format }: Props) {
  const a = accents[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="card-surface gradient-top-border hover-lift p-5 relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="label-mute">{label}</div>
        <div className="relative">
          <div className="absolute inset-0 blur-xl rounded-full" style={{ background: a.color, opacity: 0.4 }} />
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: a.bg, color: a.color }}>
            <Icon size={18} />
          </div>
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground">
        {prefix}<CountUp value={value} format={format} />{suffix}
      </div>
      <div className="text-xs text-muted-foreground mt-2">{sub}</div>
    </motion.div>
  );
}
