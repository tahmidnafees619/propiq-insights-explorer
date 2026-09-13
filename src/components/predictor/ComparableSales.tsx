/**
 * Real nearby sales most similar to the subject property.
 *
 * Agents price against comps, not against feature importances, so this is the
 * view that speaks their language. It also serves as the estimate's sanity
 * check: if the model's number sits inside the range comparable homes actually
 * sold for, the reader can see that at a glance.
 */

import { motion } from "framer-motion";
import { Check, Info, Waves } from "lucide-react";

import { fmtCurrency, fmtNumber } from "@/lib/formatters";
import type { PredictionResult } from "@/types";

/** Where `value` sits between `low` and `high`, as a 0-100 percentage. */
function positionWithin(value: number, low: number, high: number): number {
  if (high <= low) return 50;
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}

export function ComparableSales({ result }: { result: PredictionResult }) {
  const { comparables, comparablesSummary: summary } = result;

  // No comps means no database and no bundled fallback — say so rather than
  // rendering an empty table.
  if (!comparables.length || !summary) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface gradient-top-border p-6"
      >
        <h3 className="text-sm font-semibold text-foreground">Comparable Sales</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          No comparable sales were found near this location. Try a property within King County.
        </p>
      </motion.div>
    );
  }

  const inRange = summary.estimate_within_range;
  const estimatePosition = positionWithin(result.estimate, summary.low_price, summary.high_price);
  // Comps are matched exactly on waterfront, so any row answers for the set.
  const isWaterfront = comparables[0].waterfront === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="card-surface gradient-top-border p-6"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Comparable Sales</h3>
        <span className="text-[11px] text-muted-foreground">
          {fmtNumber(summary.count)} closest matches
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        The most similar homes that actually sold nearby, ranked by proximity, size, grade and room
        count.
      </p>

      {isWaterfront && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-[#2F99DA]/30 bg-[#2F99DA]/10 px-3 py-2 text-[11px] text-muted-foreground">
          <Waves size={13} className="mt-px shrink-0 text-[#2F99DA]" />
          <span>
            Matched against waterfront sales only. Waterfront carries a{" "}
            <span className="font-medium text-foreground">+213%</span> premium in this market, so
            comparing across it would make the range meaningless — which also means these comps sit
            further away than usual.
          </span>
        </div>
      )}

      {/* Estimate against what comparable homes actually sold for. */}
      <div className="mb-5 rounded-xl border border-[#28363E] bg-[#0C1318] p-4">
        <div
          className={`mb-3 flex items-center gap-2 text-xs font-medium ${
            inRange ? "text-[#3DAE91]" : "text-[#D0A74E]"
          }`}
        >
          {inRange ? <Check size={14} /> : <Info size={14} />}
          {inRange
            ? "The estimate sits inside the range these homes sold for"
            : "The estimate falls outside the range these homes sold for"}
        </div>

        <div className="relative h-2 rounded-full bg-[#192329]">
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-[#0D3B63] via-[#2F99DA] to-[#3DAE91] opacity-70" />
          <div
            className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_10px_rgba(237,241,242,0.8)]"
            style={{ left: `calc(${estimatePosition}% - 1.5px)` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{fmtCurrency(summary.low_price)}</span>
          <span className="font-medium text-foreground">
            Estimate {fmtCurrency(result.estimate)}
          </span>
          <span>{fmtCurrency(summary.high_price)}</span>
        </div>

        <div className="mt-3 border-t border-[#28363E] pt-3 text-[11px] text-muted-foreground">
          Median comparable sale{" "}
          <span className="font-medium text-foreground">{fmtCurrency(summary.median_price)}</span>
        </div>
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[#28363E] text-muted-foreground">
              <th className="p-2 text-left text-[10px] font-medium uppercase tracking-wider">
                Match
              </th>
              <th className="p-2 text-right text-[10px] font-medium uppercase tracking-wider">
                Sold for
              </th>
              <th className="p-2 text-right text-[10px] font-medium uppercase tracking-wider">
                Beds / Baths
              </th>
              <th className="p-2 text-right text-[10px] font-medium uppercase tracking-wider">
                Sqft
              </th>
              <th className="p-2 text-right text-[10px] font-medium uppercase tracking-wider">
                Grade
              </th>
              <th className="p-2 text-right text-[10px] font-medium uppercase tracking-wider">
                Distance
              </th>
              <th className="p-2 text-right text-[10px] font-medium uppercase tracking-wider">
                Sold
              </th>
            </tr>
          </thead>
          <tbody>
            {comparables.map((comp) => (
              <tr key={comp.id} className="border-b border-[#28363E] last:border-b-0">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-10 overflow-hidden rounded-full bg-[#192329]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#2F99DA] to-[#3DAE91]"
                        style={{ width: `${comp.similarity}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {comp.similarity.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="p-2 text-right font-medium tabular-nums text-foreground">
                  {comp.price_formatted}
                </td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">
                  {comp.bedrooms} / {comp.bathrooms}
                </td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">
                  {fmtNumber(comp.sqft_living)}
                </td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">{comp.grade}</td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">
                  {comp.distance_miles.toFixed(1)} mi
                </td>
                <td className="p-2 text-right text-xs tabular-nums text-muted-foreground">
                  {comp.sold ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Sale dates are shown because they matter: this dataset covers May 2014 to May 2015, so these
        are historic transactions rather than current listings.
      </p>
    </motion.div>
  );
}
