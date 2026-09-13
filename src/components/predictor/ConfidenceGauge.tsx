import { motion } from "framer-motion";

import { fmtCurrency } from "@/lib/formatters";
import type { PredictionResult } from "@/types";

/** Length of the semicircular gauge track, in SVG user units. */
const ARC_LENGTH = 251;

/**
 * Where this estimate sits in the King County market.
 *
 * The percentile comes from the API, which compares the estimate against the
 * modelled distribution of local sale prices.
 */
export function ConfidenceGauge({ result }: { result: PredictionResult }) {
  const percentile = Math.min(100, Math.max(0, result.percentile));
  const angle = (percentile / 100) * 180 - 90;

  // "Top X%" only reads correctly for expensive homes; below the midpoint,
  // describing the property as more affordable than its peers is clearer.
  const summary =
    percentile >= 50
      ? `More expensive than ${percentile.toFixed(0)}% of King County homes`
      : `More affordable than ${(100 - percentile).toFixed(0)}% of King County homes`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="card-surface gradient-top-border p-6"
    >
      <h3 className="mb-1 text-sm font-semibold text-foreground">Market Context</h3>
      <p className="mb-4 text-xs text-muted-foreground">{summary}</p>

      <div className="my-2 flex items-center justify-center">
        <svg width="200" height="120" viewBox="0 0 200 120" role="img" aria-label={summary}>
          <defs>
            <linearGradient id="gauge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2F99DA" />
              <stop offset="50%" stopColor="#3DAE91" />
              <stop offset="100%" stopColor="#D0A74E" />
            </linearGradient>
          </defs>
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            stroke="#28363E"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            stroke="url(#gauge)"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(percentile / 100) * ARC_LENGTH} ${ARC_LENGTH}`}
          />
          <g transform={`translate(100,100) rotate(${angle})`}>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-65"
              stroke="#EDF1F2"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle r="6" fill="#2F99DA" />
          </g>
          <text x="100" y="88" textAnchor="middle" fill="#EDF1F2" fontSize="18" fontWeight="600">
            {percentile.toFixed(0)}
            <tspan fontSize="11" fill="#91A2AC">
              th
            </tspan>
          </text>
        </svg>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Comparable homes are expected to sell between{" "}
        <span className="font-medium text-foreground">{fmtCurrency(result.similar_low)}</span> and{" "}
        <span className="font-medium text-foreground">{fmtCurrency(result.similar_high)}</span>
      </div>
    </motion.div>
  );
}
