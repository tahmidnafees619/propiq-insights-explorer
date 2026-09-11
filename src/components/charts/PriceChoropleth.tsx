/**
 * Median sale price by ZIP code, drawn from real Census ZCTA boundaries.
 *
 * The geometry is bundled (simplified from the Census TIGER file to ~120 KB)
 * and projected here rather than through a mapping library, so the map needs
 * no tile server, no API key, and no network at all once the page has loaded.
 */

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import geo from "@/data/king-county-zips.json";
import { useMotionEnabled } from "@/components/motion";
import { useZipcodeStats } from "@/hooks/useZipcodeStats";
import { DURATION, EASE } from "@/lib/motion";
import { fmtCompact, fmtCurrency, fmtNumber } from "@/lib/formatters";
import type { ZipcodeStat } from "@/types";

type Ring = number[][];
type Polygon = Ring[];

interface ZipFeature {
  properties: { zip: string };
  geometry:
    | { type: "Polygon"; coordinates: Polygon }
    | { type: "MultiPolygon"; coordinates: Polygon[] };
}

const VIEW_W = 720;
const VIEW_H = 680;
const PAD = 14;

/**
 * Sequential ramp, dark blue through teal to amber.
 *
 * Prices here span 8x and are heavily right-skewed, so the bands below are
 * quantiles rather than equal intervals — an equal-interval scale would render
 * 68 of the 70 ZIPs in the same shade and show nothing.
 */
const BIN_COLORS = [
  "#14304F",
  "#1B4A78",
  "#22679F",
  "#2B86B8",
  "#2AA08D",
  "#57B85F",
  "#DDA62F",
  "#F0801E",
];

/** Web Mercator, normalised to the unit square. */
function project(lon: number, lat: number): [number, number] {
  const rad = (lat * Math.PI) / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2];
}

function polygonsOf(feature: ZipFeature): Polygon[] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

/**
 * Project every boundary once, at module scope.
 *
 * The geometry never changes, so this runs a single time per page load rather
 * than on every render or data refetch.
 */
const ZIP_PATHS: Array<{ zip: string; d: string }> = (() => {
  const features = (geo as unknown as { features: ZipFeature[] }).features;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const feature of features) {
    for (const polygon of polygonsOf(feature)) {
      for (const ring of polygon) {
        for (const point of ring) {
          const [x, y] = project(point[0], point[1]);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  // One uniform scale across both axes keeps the county's true shape.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min((VIEW_W - PAD * 2) / spanX, (VIEW_H - PAD * 2) / spanY);
  const offsetX = PAD + (VIEW_W - PAD * 2 - spanX * scale) / 2;
  const offsetY = PAD + (VIEW_H - PAD * 2 - spanY * scale) / 2;

  return features.map((feature) => ({
    zip: feature.properties.zip,
    d: polygonsOf(feature)
      .map((polygon) =>
        polygon
          .map((ring) => {
            let path = "";
            for (let i = 0; i < ring.length; i += 1) {
              const [x, y] = project(ring[i][0], ring[i][1]);
              const px = ((x - minX) * scale + offsetX).toFixed(1);
              const py = ((y - minY) * scale + offsetY).toFixed(1);
              path += (i === 0 ? "M" : "L") + px + "," + py;
            }
            return path + "Z";
          })
          .join(""),
      )
      .join(""),
  }));
})();

/**
 * Gap between each ZIP filling in, in seconds.
 *
 * Seventy ZIPs at this spacing build the map in a little under a second —
 * quick enough not to delay reading it, slow enough to see the price gradient
 * sweep across the county.
 */
const PRICE_FILL_STAGGER = 0.013;

/** Interior break points splitting `values` into `bins` equal-count groups. */
function quantileBreaks(values: number[], bins: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < bins; i += 1) {
    const pos = (i / bins) * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    breaks.push(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
  }
  return breaks;
}

export function PriceChoropleth() {
  const { data } = useZipcodeStats();
  const enabled = useMotionEnabled();
  const [hovered, setHovered] = useState<ZipcodeStat | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { byZip, breaks, rankOf } = useMemo(() => {
    const lookup = new Map(data.zipcodes.map((z) => [z.zipcode, z]));
    // Cheapest first, so the map fills from the south county upward and the
    // price gradient is legible as it builds rather than only once it lands.
    const ranked = [...data.zipcodes].sort((a, b) => a.median_price - b.median_price);
    return {
      byZip: lookup,
      breaks: quantileBreaks(
        data.zipcodes.map((z) => z.median_price),
        BIN_COLORS.length,
      ),
      rankOf: new Map(ranked.map((z, index) => [z.zipcode, index])),
    };
  }, [data]);

  const colorFor = (median: number) => {
    let bin = 0;
    while (bin < breaks.length && median > breaks[bin]) bin += 1;
    return BIN_COLORS[bin];
  };

  const handleMove = (event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  };

  // Legend edges: the scale floor, each interior break, then the ceiling.
  const legendEdges = [data.min_median, ...breaks, data.max_median];

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseMove={handleMove}
      onMouseLeave={() => setHovered(null)}
    >
      <svg
        viewBox={"0 0 " + VIEW_W + " " + VIEW_H}
        className="h-auto w-full"
        role="img"
        aria-label="Median home sale price by ZIP code across King County"
      >
        {ZIP_PATHS.map(({ zip, d }) => {
          const stat = byZip.get(zip);
          const active = hovered?.zipcode === zip;
          const rank = rankOf.get(zip) ?? 0;

          const shape = (
            <path
              d={d}
              fillRule="evenodd"
              fill={stat ? colorFor(stat.median_price) : "#0F1830"}
              stroke={active ? "#F1F5F9" : "#060B18"}
              strokeWidth={active ? 2 : 0.6}
              opacity={hovered && !active ? 0.55 : 1}
              className="cursor-pointer transition-[stroke,opacity] duration-150"
              onMouseEnter={() => stat && setHovered(stat)}
            >
              <title>{stat ? zip + " — " + fmtCurrency(stat.median_price) : zip}</title>
            </path>
          );

          if (!enabled) return <g key={zip}>{shape}</g>;

          /*
           * The entrance lives on a wrapping group so the path keeps its own
           * opacity for the hover dimming. Sharing one opacity between an
           * animation and a hover state would let Framer seize the value.
           */
          return (
            <motion.g
              key={zip}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: DURATION.base,
                ease: EASE.out,
                delay: rank * PRICE_FILL_STAGGER,
              }}
            >
              {shape}
            </motion.g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-[#1E2D4A] bg-[#0A1120]/95 px-3 py-2 shadow-xl backdrop-blur-sm"
          style={{
            left: Math.min(cursor.x + 14, VIEW_W - 150),
            top: Math.max(cursor.y - 12, 0),
          }}
        >
          <div className="text-sm font-semibold text-foreground">ZIP {hovered.zipcode}</div>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <div>
              Median{" "}
              <span className="font-medium text-foreground">
                {fmtCurrency(hovered.median_price)}
              </span>
            </div>
            <div>
              Per sqft{" "}
              <span className="font-medium text-foreground">
                {fmtCurrency(hovered.price_per_sqft)}
              </span>
            </div>
            <div>
              <span className="font-medium text-foreground">{fmtNumber(hovered.count)}</span> sales
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {BIN_COLORS.map((color) => (
            <div key={color} className="flex-1" style={{ background: color }} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          {legendEdges.map((edge, i) => (
            <span key={i}>{fmtCompact(edge)}</span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Median sale price by ZIP code, split into {BIN_COLORS.length} equal-count bands.
          Boundaries are US Census ZCTAs.
        </p>
      </div>
    </div>
  );
}
