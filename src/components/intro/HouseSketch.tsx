/**
 * The isometric house: drawn in once, then reduced by scroll.
 *
 * The strokes ink in on the same wall-clock timeline as the rest of the sheet
 * (via `t`), sit still under a gentle CSS tilt once drawn, then shrink and
 * fade as the visitor scrolls — a real 3D rotation (perspective + rotateX/Y)
 * layered over verified-correct isometric artwork, rather than an unverified
 * true-3D scene. See `house-geometry.ts` for why: three iterations of an
 * actual pitched roof either read as a bird's wing or dwarfed the building
 * beneath it, and a flat massing-study roof was both the safer geometry and
 * the better fit for this site's tone.
 *
 * The wobble is deliberately small (a few degrees). Isometric art is a flat
 * projection; rotate it hard in 3D and the illusion breaks the moment an edge
 * approaches face-on. Kept small, it reads as "gently turning for you to
 * look at" rather than "a flat card flipping."
 */

import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type Transition,
} from "framer-motion";

import { EASE } from "@/lib/motion";
import {
  HOUSE_DETAILS,
  HOUSE_FACES,
  HOUSE_HEIGHT,
  HOUSE_HIDDEN,
  HOUSE_MIN_X,
  HOUSE_MIN_Y,
  HOUSE_WIDTH,
  type FaceTone,
} from "./house-geometry";

const TONE_FILL: Record<FaceTone, string> = {
  "wall-front": "rgba(47,153,218,0.09)",
  "wall-side": "rgba(47,153,218,0.14)",
  "roof-top": "rgba(208,167,78,0.16)",
  "roof-fascia-front": "rgba(208,167,78,0.24)",
  "roof-fascia-side": "rgba(208,167,78,0.30)",
};

const TONE_STROKE: Record<FaceTone, string> = {
  "wall-front": "var(--ink-400)",
  "wall-side": "var(--ink-400)",
  "roof-top": "var(--brass-500)",
  "roof-fascia-front": "var(--brass-500)",
  "roof-fascia-side": "var(--brass-500)",
};

type Timing = (seconds: number) => number;

/** A CSS box expressed in percentages, so it stays registered against a
 *  responsively-scaled SVG sheet the same way the wordmark overlay does. */
export interface PercentBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

interface Props {
  t: Timing;
  /** When the reduce-on-scroll begins and ends, as fractions of scroll progress. */
  reduceRange: [number, number];
  scrollYProgress: MotionValue<number>;
  /** Where the house sits on the sheet. Percentage-based: see `PercentBox`. */
  box: PercentBox;
}

export function HouseSketch({ t, reduceRange, scrollYProgress, box }: Props) {
  const reduced = useReducedMotion();

  const reduceScale = useTransform(scrollYProgress, reduceRange, [1, 0.35]);
  const reduceOpacity = useTransform(scrollYProgress, reduceRange, [1, 0]);
  const reduceY = useTransform(scrollYProgress, reduceRange, [0, -18]);

  const draw: Transition = reduced ? { duration: 0 } : { duration: t(0.6), ease: EASE.out };

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        ...box,
        scale: reduceScale,
        opacity: reduceOpacity,
        translateY: reduceY,
        perspective: 700,
      }}
    >
      {/* Perspective lives on this wrapper; the tilt is applied to the child
          below it, which is what makes the rotation read as 3D rather than a
          flat skew. */}
      <motion.div
        className="h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={reduced ? false : { opacity: 0 }}
        animate={
          reduced
            ? { opacity: 1 }
            : {
                opacity: 1,
                rotateY: [-7, 7, -7],
                rotateX: [2, -2, 2],
              }
        }
        transition={
          reduced
            ? { duration: 0 }
            : {
                opacity: { delay: t(0), duration: t(0.4) },
                rotateY: { delay: t(0.9), duration: 9, repeat: Infinity, ease: EASE.inOut },
                rotateX: { delay: t(0.9), duration: 11, repeat: Infinity, ease: EASE.inOut },
              }
        }
      >
        <svg
          viewBox={`${HOUSE_MIN_X} ${HOUSE_MIN_Y} ${HOUSE_WIDTH} ${HOUSE_HEIGHT}`}
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          {HOUSE_HIDDEN.map((d, i) => (
            <motion.path
              key={`hidden-${i}`}
              d={d}
              fill="none"
              stroke="var(--ink-400)"
              strokeWidth={0.9}
              strokeOpacity={0.35}
              strokeDasharray="3 3"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: t(0.05 * i), duration: t(0.3) }}
            />
          ))}

          {HOUSE_FACES.map((face, i) => (
            <motion.path
              key={face.id}
              d={face.d}
              fill={TONE_FILL[face.tone]}
              stroke={TONE_STROKE[face.tone]}
              strokeWidth={1.1}
              strokeOpacity={0.75}
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { ...draw, delay: t(0.1 + i * 0.09) },
                opacity: { duration: t(0.15), delay: t(0.1 + i * 0.09) },
              }}
            />
          ))}

          {HOUSE_DETAILS.map((d, i) => (
            <motion.path
              key={`detail-${i}`}
              d={d}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1}
              strokeOpacity={0.55}
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { duration: t(0.3), ease: EASE.out, delay: t(0.55 + i * 0.08) },
                opacity: { duration: t(0.15), delay: t(0.55 + i * 0.08) },
              }}
            />
          ))}
        </svg>
      </motion.div>
    </motion.div>
  );
}
