import { motion } from 'framer-motion';

import { fmtCurrency } from '@/lib/formatters';
import type { PredictionResult as PR } from '@/types';

const CONFIDENCE_STYLES: Record<PR['confidenceLevel'], { label: string; color: string; background: string }> = {
  high: { label: 'High confidence', color: '#10B981', background: 'rgba(16,185,129,0.15)' },
  medium: { label: 'Moderate confidence', color: '#F59E0B', background: 'rgba(245,158,11,0.15)' },
  low: { label: 'Low confidence', color: '#EF4444', background: 'rgba(239,68,68,0.15)' },
};

/**
 * The headline estimate and its prediction interval.
 *
 * The interval is calibrated on the model's held-out residuals rather than a
 * fixed percentage, so a wider band genuinely means a less certain estimate.
 */
export function PredictionResult({ result }: { result: PR }) {
  const confidence = CONFIDENCE_STYLES[result.confidenceLevel];
  const coverage = Math.round(result.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card-surface gradient-top-border card-glow p-6"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="label-mute">Estimated Value</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{ background: confidence.background, color: confidence.color }}
        >
          {confidence.label}
        </span>
      </div>

      <div className="mb-2 text-5xl font-bold tracking-tight text-foreground">
        {fmtCurrency(result.estimate)}
      </div>
      <div className="mb-5 text-sm text-[#F59E0B]">± {fmtCurrency(result.margin)} margin of error</div>

      <div className="mb-4 rounded-xl border border-[#1E2D4A] bg-[#0A1120]/60 px-4 py-3">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {coverage}% prediction interval
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{fmtCurrency(result.similar_low)}</span>
          <span className="text-muted-foreground">to</span>
          <span className="font-medium text-foreground">{fmtCurrency(result.similar_high)}</span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {coverage} out of 100 comparable homes are expected to sell within this range. Estimated by{' '}
        <span className="text-foreground">{result.modelUsed}</span>.
      </p>
    </motion.div>
  );
}
