import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function InsightCard({ icon, headline, body, accent = 'blue', delay = 0 }: { icon: ReactNode; headline: string; body: string; accent?: 'blue' | 'green' | 'amber'; delay?: number }) {
  const colors = { blue: '#3B82F6', green: '#10B981', amber: '#F59E0B' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="card-surface gradient-top-border p-6 hover-lift"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${colors[accent]}22`, color: colors[accent] }}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{headline}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </motion.div>
  );
}
