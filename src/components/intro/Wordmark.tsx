/**
 * The PropIQ wordmark, drawn from the monoline letterforms.
 *
 * Used on the title sheet only. An earlier version also stood in the navbar
 * and carried a shared layout id between the two, so the mark would morph
 * from one to the other on handoff — a drawn stroke mark and typeset text
 * don't share a shape to morph between, so that read as the logo warping
 * rather than arriving. The navbar now renders its own plain-text logo, and
 * this component just draws the mark on the sheet.
 */

import { motion } from "framer-motion";

import { DURATION, EASE } from "@/lib/motion";
import { WORDMARK_HEIGHT, WORDMARK_STROKES, WORDMARK_WIDTH } from "./wordmark-geometry";

/** The wordmark's own overshoot: the Q's tail runs past the glyph box. */
const PAD = 6;
const VIEW_W = WORDMARK_WIDTH + PAD * 2;
const VIEW_H = WORDMARK_HEIGHT + PAD * 2;

export interface WordmarkDraw {
  /** When the first stroke begins. */
  delay: number;
  /** How long each stroke takes to draw. */
  duration: number;
  /** Gap between consecutive strokes. */
  stagger: number;
}

interface Props {
  /**
   * Rendered height in pixels. Omit to fill the parent's width instead, which
   * is how the title sheet sizes it — there the mark has to stay registered
   * with SVG geometry, so it cannot be pinned to a pixel height.
   */
  height?: number;
  /** Omit for a finished mark; supply to draw it stroke by stroke. */
  draw?: WordmarkDraw;
  /**
   * `IQ` in brass. The last three strokes are the I's bars, its stem, the Q's
   * bowl and the Q's tail, and lifting them into the accent is what stops the
   * mark reading as one undifferentiated word.
   */
  accentFrom?: number;
  className?: string;
}

export function Wordmark({
  height,
  draw,
  accentFrom = WORDMARK_STROKES.length - 4,
  className,
}: Props) {
  const sized = height !== undefined;

  return (
    <motion.svg
      width={sized ? (VIEW_W / VIEW_H) * height : "100%"}
      height={sized ? height : "100%"}
      preserveAspectRatio="xMidYMid meet"
      viewBox={`${-PAD} ${-PAD} ${VIEW_W} ${VIEW_H}`}
      className={className}
      aria-label="PropIQ"
      role="img"
      // Stroke width is expressed in glyph units, so the mark keeps its weight
      // relationship at every size rather than getting spindly when small.
      style={{ overflow: "visible" }}
    >
      {WORDMARK_STROKES.map((stroke, index) => {
        const accent = index >= accentFrom;
        const common = {
          d: stroke.d,
          fill: "none" as const,
          stroke: accent ? "var(--brass-500)" : "var(--ink-400)",
          strokeWidth: 7,
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
          vectorEffect: "non-scaling-stroke" as const,
        };

        if (!draw) return <path key={stroke.id} {...common} strokeWidth={7} />;

        return (
          <motion.path
            key={stroke.id}
            {...common}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: {
                duration: draw.duration,
                ease: EASE.out,
                delay: draw.delay + index * draw.stagger,
              },
              opacity: {
                duration: DURATION.instant,
                delay: draw.delay + index * draw.stagger,
              },
            }}
          />
        );
      })}
    </motion.svg>
  );
}

export { VIEW_W as WORDMARK_VIEW_W, VIEW_H as WORDMARK_VIEW_H, PAD as WORDMARK_PAD };
