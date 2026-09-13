/**
 * The isometric house: drawn in once, then set down by scroll.
 *
 * The strokes ink in on the same wall-clock timeline as the rest of the sheet
 * (via `t`), sit still under a gentle 3D tilt once drawn, then — as the visitor
 * scrolls — the house *descends* rather than shrinking away: it drops, tips
 * forward a few degrees as if being lowered onto the sheet, and a contact
 * shadow spreads beneath it to meet it. A real CSS 3D rotation (perspective +
 * rotateX/Y) layered over verified-correct isometric artwork, rather than an
 * unverified true-3D scene. See `house-geometry.ts` for why the artwork is
 * projected rather than modelled.
 *
 * The wobble is deliberately small (a few degrees). Isometric art is a flat
 * projection; rotate it hard in 3D and the illusion breaks the moment an edge
 * approaches face-on. Kept small, it reads as "gently turning for you to
 * look at" rather than "a flat card flipping."
 *
 * Three transform layers, because one animatable value may only have one
 * owner — Framer's `animate` seizes any value a MotionValue in `style` is also
 * driving, and both the wobble and the descent want `rotateX`:
 *
 *   outer   — placement on the sheet, and the `perspective` the 3D reads in
 *   descent — scroll-driven: translateY / scale / rotateX / opacity
 *   wobble  — wall-clock keyframes: rotateY / rotateX, looping
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
  HOUSE_CHIMNEY,
  HOUSE_COURSES,
  HOUSE_DETAILS,
  HOUSE_FACES,
  HOUSE_HEIGHT,
  HOUSE_HIDDEN,
  HOUSE_MIN_X,
  HOUSE_MIN_Y,
  HOUSE_WIDTH,
  type FaceTone,
} from "./house-geometry";

const INK = "47,153,218";
const BRASS = "208,167,78";
const PAPER = "237,241,242";

/**
 * Shaded the way an isometric solid conventionally is: each plane a step
 * darker as it turns away from the light. An earlier pass used weights so
 * faint that only the roof registered and the thing read as a floating plane
 * rather than a building, so these are deliberately assertive.
 */
const TONE_FILL: Record<FaceTone, string> = {
  "plinth-top": `rgba(${PAPER},0.06)`,
  "plinth-side": `rgba(${PAPER},0.10)`,
  "plinth-gable": `rgba(${PAPER},0.16)`,
  "wall-side": `rgba(${INK},0.22)`,
  "wall-gable": `rgba(${INK},0.36)`,
  roof: `rgba(${BRASS},0.31)`,
  fascia: `rgba(${BRASS},0.45)`,
  rake: `rgba(${BRASS},0.51)`,
  ridge: `rgba(${BRASS},0.55)`,
  "chimney-top": `rgba(${INK},0.18)`,
  "chimney-side": `rgba(${INK},0.41)`,
  "chimney-front": `rgba(${INK},0.28)`,
};

function toneStroke(tone: FaceTone): string {
  if (tone.startsWith("plinth")) return "var(--line-strong)";
  if (tone.startsWith("wall") || tone.startsWith("chimney")) return "var(--ink-400)";
  return "var(--brass-500)";
}

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
  /** When the descent begins and ends, as fractions of scroll progress. */
  reduceRange: [number, number];
  scrollYProgress: MotionValue<number>;
  /** Where the house sits on the sheet. Percentage-based: see `PercentBox`. */
  box: PercentBox;
}

export function HouseSketch({ t, reduceRange, scrollYProgress, box }: Props) {
  const reduced = useReducedMotion();
  const [from, to] = reduceRange;
  /** A midpoint, so the descent can ease rather than run dead-linear. */
  const mid = from + (to - from) * 0.55;

  // Down, not away: the house is lowered out of frame while the wordmark above
  // it climbs toward the navbar. Opposed directions read as depth; both
  // leaving the same way reads as one layer.
  const descendY = useTransform(scrollYProgress, [from, mid, to], ["0%", "34%", "128%"]);
  const descendScale = useTransform(scrollYProgress, [from, mid, to], [1, 0.88, 0.62]);
  const descendTilt = useTransform(scrollYProgress, [from, to], [0, 16]);
  const descendOpacity = useTransform(scrollYProgress, [from, mid, to], [1, 0.9, 0]);

  // The contact shadow spreads as the house comes down to meet it.
  const shadowScale = useTransform(scrollYProgress, [from, mid, to], [0.45, 0.95, 1.25]);
  const shadowOpacity = useTransform(scrollYProgress, [from, mid, to], [0, 0.5, 0]);

  const draw: Transition = reduced ? { duration: 0 } : { duration: t(0.6), ease: EASE.out };
  const faceDelay = (i: number) => t(0.1 + i * 0.06);

  return (
    <motion.div className="pointer-events-none absolute" style={{ ...box, perspective: 760 }}>
      {/* Outside the 3D chain on purpose: a shadow that tilts with the house
          stops reading as something the house is resting on. */}
      <motion.div
        className="absolute left-1/2 top-[86%] h-[16%] w-[72%] -translate-x-1/2 rounded-[50%]"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${INK},0.55) 0%, rgba(${INK},0) 70%)`,
          scale: shadowScale,
          opacity: shadowOpacity,
        }}
      />

      <motion.div
        className="h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          y: descendY,
          scale: descendScale,
          rotateX: descendTilt,
          opacity: descendOpacity,
        }}
      >
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
                strokeOpacity={0.24}
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
                stroke={toneStroke(face.tone)}
                strokeWidth={1.3}
                strokeOpacity={0.9}
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { ...draw, delay: faceDelay(i) },
                  opacity: { duration: t(0.15), delay: faceDelay(i) },
                }}
              />
            ))}

            {/* Shingle courses go on before the chimney, so no course line
                runs straight across the stack. */}
            {HOUSE_COURSES.map((d, i) => (
              <motion.path
                key={`course-${i}`}
                d={d}
                fill="none"
                stroke="var(--brass-500)"
                strokeWidth={0.8}
                strokeOpacity={0.3}
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { duration: t(0.4), ease: EASE.out, delay: t(0.72 + i * 0.06) },
                  opacity: { duration: t(0.15), delay: t(0.72 + i * 0.06) },
                }}
              />
            ))}

            {HOUSE_CHIMNEY.map((face, i) => (
              <motion.path
                key={face.id}
                d={face.d}
                fill={TONE_FILL[face.tone]}
                stroke={toneStroke(face.tone)}
                strokeWidth={1.3}
                strokeOpacity={0.9}
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { ...draw, delay: faceDelay(HOUSE_FACES.length + i) },
                  opacity: { duration: t(0.15), delay: faceDelay(HOUSE_FACES.length + i) },
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
                strokeOpacity={0.6}
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { duration: t(0.3), ease: EASE.out, delay: t(1 + i * 0.08) },
                  opacity: { duration: t(0.15), delay: t(1 + i * 0.08) },
                }}
              />
            ))}
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
