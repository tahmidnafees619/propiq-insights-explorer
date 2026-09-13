import { motion } from "framer-motion";

import { fmtCurrency } from "@/lib/formatters";
import type { PredictionResult } from "@/types";

/**
 * Attributes the estimate to groups of inputs.
 *
 * The API computes this by ablation: it prices a typical King County home,
 * then swaps in the user's values one group at a time. The first row is that
 * baseline and the rest are signed adjustments, so the column sums to the
 * final estimate.
 */
export function ValueBreakdown({ result }: { result: PredictionResult }) {
  const [baseline, ...adjustments] = result.breakdown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="card-surface gradient-top-border p-6"
    >
      <h3 className="mb-1 text-sm font-semibold text-foreground">Value Breakdown</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        How this home differs from a typical King County property
      </p>

      <div className="space-y-1">
        {baseline && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2 text-xs">
            <span className="text-muted-foreground">{baseline.label}</span>
            <span className="font-medium text-foreground">{fmtCurrency(baseline.value)}</span>
          </div>
        )}

        {adjustments.map((driver) => {
          const positive = driver.value >= 0;
          return (
            <div
              key={driver.label}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
            >
              <span className="text-muted-foreground">{driver.label}</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  background: positive ? "rgba(61,174,145,0.15)" : "rgba(213,83,63,0.15)",
                  color: positive ? "#3DAE91" : "#D5533F",
                }}
              >
                {positive ? "+" : "−"}
                {fmtCurrency(Math.abs(driver.value))}
              </span>
            </div>
          );
        })}

        <div className="mt-1 flex items-center justify-between rounded-xl bg-[#192329] px-3 py-2.5 text-xs">
          <span className="font-semibold text-foreground">Final Estimate</span>
          <span className="font-semibold text-foreground">{fmtCurrency(result.estimate)}</span>
        </div>
      </div>
    </motion.div>
  );
}
