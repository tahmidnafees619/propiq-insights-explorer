/**
 * The living blueprint background.
 *
 * Layers, back to front: a drafting grid; architectural plans that draw
 * themselves in; a drafting lamp that follows the cursor and brightens the ink
 * beneath it; and a vignette that keeps the centre of the screen readable.
 *
 * The lamp is a second copy of the same geometry at higher ink, revealed
 * through a radial mask pinned to the pointer — so moving the cursor reads as
 * carrying a light across drafting paper rather than as a glow pasted on top.
 * Both copies share the same parallax motion values; if they drifted
 * independently you would see doubled lines.
 *
 * Performance notes, because a full-viewport background is the easiest thing
 * in an app to make janky:
 *
 * - Only `transform` and `opacity` animate, so everything stays on the
 *   compositor. No layout, no paint on the drawing itself.
 * - Pointer tracking writes to motion values, never to React state, so moving
 *   the mouse never triggers a render.
 * - The lit copy renders as plain paths, not motion components — it is
 *   revealed wholesale by the mask and never animates individually, so there
 *   is no reason to pay for seventy more animators.
 * - The layer is mounted outside the route tree and so survives navigation
 *   without re-drafting.
 * - Geometry is static data. Nothing here is random, so the server and client
 *   render identical markup.
 * - `prefers-reduced-motion` skips the drafting animation, the parallax and
 *   the lamp, rendering the finished drawing immediately.
 */

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { DURATION, EASE, SPRING } from "@/lib/motion";
import { FLOOR_PLANS, buildDimension, type Dimension, type FloorPlan } from "./plans";

/** Canvas the plans are laid out in; scaled to cover the viewport. */
const CANVAS_W = 1440;
const CANVAS_H = 900;

/** How far the deepest layer travels with the pointer, in canvas units. */
const POINTER_TRAVEL = 26;
/** How far it counter-scrolls, as a fraction of scroll distance. */
const SCROLL_TRAVEL = 0.08;

/** Radius of the lamp's pool of light, in pixels. */
const LAMP_RADIUS = 360;
/** How much brighter ink reads under the lamp. */
const LAMP_GAIN = 2.6;
/**
 * When the lamp switches on. The sheets finish drafting at roughly six
 * seconds; the light arriving just before that reads as the drawing being
 * completed and then examined.
 */
const LAMP_DELAY = 5;

/** Shared by the light pool and the mask that reveals the lit ink. */
const LAMP_FALLOFF =
  `circle ${LAMP_RADIUS}px at var(--lamp-x) var(--lamp-y), ` +
  "#000 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.22) 64%, transparent 80%";

const STROKE = "#3B82F6";

/** Opacity per element class. Low enough never to compete with content. */
const INK = {
  wall: 0.16,
  partition: 0.1,
  door: 0.12,
  fixture: 0.08,
  guide: 0.07,
  dimension: 0.09,
  label: 0.14,
} as const;

export function BlueprintBackground() {
  const reduced = useReducedMotion();

  // Normalised pointer, -1..1 from the centre — drives parallax.
  const pointerNormX = useMotionValue(0);
  const pointerNormY = useMotionValue(0);
  // Raw pointer in pixels — drives the lamp.
  const pointerPxX = useMotionValue(-9999);
  const pointerPxY = useMotionValue(-9999);
  // 0 when the pointer is absent, or the device has no hover at all.
  const lampPresence = useMotionValue(0);

  // Layers trail the cursor with weight; the lamp sits closer to the hand.
  const driftX = useSpring(pointerNormX, SPRING.drift);
  const driftY = useSpring(pointerNormY, SPRING.drift);
  const lampX = useSpring(pointerPxX, SPRING.lamp);
  const lampY = useSpring(pointerPxY, SPRING.lamp);

  const { scrollY } = useScroll();

  // Custom properties the light pool and the mask both read from.
  const lampCssX = useTransform(lampX, (v) => `${v}px`);
  const lampCssY = useTransform(lampY, (v) => `${v}px`);

  useEffect(() => {
    if (reduced) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      // A finger is not a drafting lamp; leave the drawing alone on touch.
      if (event.pointerType !== "mouse") return;
      // Coalesce to one write per frame; pointermove can fire far faster.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pointerNormX.set((event.clientX / window.innerWidth) * 2 - 1);
        pointerNormY.set((event.clientY / window.innerHeight) * 2 - 1);
        pointerPxX.set(event.clientX);
        pointerPxY.set(event.clientY);
        lampPresence.set(1);
      });
    };

    const dim = () => lampPresence.set(0);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", dim);
    window.addEventListener("blur", dim);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", dim);
      window.removeEventListener("blur", dim);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced, pointerNormX, pointerNormY, pointerPxX, pointerPxY, lampPresence]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <DraftingGrid driftX={driftX} driftY={driftY} scrollY={scrollY} reduced={!!reduced} />

      {/* Base ink: the drawing as drafted. */}
      <PlanLayer
        driftX={driftX}
        driftY={driftY}
        scrollY={scrollY}
        reduced={!!reduced}
        lit={false}
      />

      {!reduced && (
        /*
         * One opacity owner per element. The outer node switches the lamp on
         * once the sheets are drafted; the inner node tracks whether the
         * pointer is present. Putting both on one element would let Framer's
         * `animate` seize the value, and the lamp would never dim again.
         */
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.slow, ease: EASE.out, delay: LAMP_DELAY }}
        >
          <motion.div className="absolute inset-0" style={{ opacity: lampPresence }}>
            {/* The pool of light, beneath the ink it reveals. */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle ${LAMP_RADIUS}px at var(--lamp-x) var(--lamp-y), rgba(59,130,246,0.055) 0%, rgba(59,130,246,0.02) 46%, transparent 74%)`,
                ["--lamp-x" as string]: lampCssX,
                ["--lamp-y" as string]: lampCssY,
              }}
            />

            {/* Brighter ink, revealed only within the lamp's reach. */}
            <motion.div
              className="absolute inset-0"
              style={{
                maskImage: `radial-gradient(${LAMP_FALLOFF})`,
                WebkitMaskImage: `radial-gradient(${LAMP_FALLOFF})`,
                ["--lamp-x" as string]: lampCssX,
                ["--lamp-y" as string]: lampCssY,
              }}
            >
              <PlanLayer driftX={driftX} driftY={driftY} scrollY={scrollY} reduced={false} lit />
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {/* Keeps the middle of the screen clean where the content sits. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 78% 62% at 50% 42%, rgba(6,11,24,0.9) 0%, rgba(6,11,24,0.5) 46%, transparent 100%)",
        }}
      />
    </div>
  );
}

/** Every plan at one ink level. Rendered twice: once base, once lit. */
function PlanLayer({
  driftX,
  driftY,
  scrollY,
  reduced,
  lit,
}: {
  driftX: MotionValue<number>;
  driftY: MotionValue<number>;
  scrollY: MotionValue<number>;
  reduced: boolean;
  lit: boolean;
}) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {FLOOR_PLANS.map((plan, index) => (
        <ParallaxPlan
          key={plan.id}
          plan={plan}
          order={index}
          driftX={driftX}
          driftY={driftY}
          scrollY={scrollY}
          reduced={reduced}
          lit={lit}
        />
      ))}
    </svg>
  );
}

/**
 * Two superimposed CSS grids — a fine one and a heavier module line every
 * fifth division, the way drafting paper is printed.
 *
 * CSS gradients rather than SVG: the browser rasterises these once and the
 * parallax is then a pure transform.
 */
function DraftingGrid({
  driftX,
  driftY,
  scrollY,
  reduced,
}: {
  driftX: MotionValue<number>;
  driftY: MotionValue<number>;
  scrollY: MotionValue<number>;
  reduced: boolean;
}) {
  const depth = 0.3;
  const x = useTransform(driftX, (v) => (reduced ? 0 : v * POINTER_TRAVEL * depth));
  const y = useTransform([driftY, scrollY] as const, (values) => {
    const [pointer, scroll] = values as [number, number];
    return reduced ? 0 : pointer * POINTER_TRAVEL * depth - scroll * SCROLL_TRAVEL * depth;
  });

  return (
    <motion.div
      className="absolute"
      // Oversized so the parallax offset never exposes an edge.
      style={{
        inset: "-8%",
        x,
        y,
        backgroundImage: `
          linear-gradient(to right, rgba(59,130,246,0.055) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(59,130,246,0.055) 1px, transparent 1px),
          linear-gradient(to right, rgba(59,130,246,0.028) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(59,130,246,0.028) 1px, transparent 1px)
        `,
        backgroundSize: "160px 160px, 160px 160px, 32px 32px, 32px 32px",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : DURATION.slow, ease: EASE.out }}
    />
  );
}

function ParallaxPlan({
  plan,
  order,
  driftX,
  driftY,
  scrollY,
  reduced,
  lit,
}: {
  plan: FloorPlan;
  order: number;
  driftX: MotionValue<number>;
  driftY: MotionValue<number>;
  scrollY: MotionValue<number>;
  reduced: boolean;
  lit: boolean;
}) {
  const x = useTransform(driftX, (v) => (reduced ? 0 : v * POINTER_TRAVEL * plan.depth));
  const y = useTransform([driftY, scrollY] as const, (values) => {
    const [pointer, scroll] = values as [number, number];
    return reduced
      ? 0
      : pointer * POINTER_TRAVEL * plan.depth - scroll * SCROLL_TRAVEL * plan.depth;
  });

  // Sheets begin drafting in sequence rather than all at once.
  const sheetDelay = order * 0.55;
  const gain = lit ? LAMP_GAIN : 1;

  return (
    <motion.g style={{ x, y }}>
      <g transform={`translate(${plan.x} ${plan.y}) scale(${plan.scale})`}>
        {plan.walls.map((d, i) => (
          <InkPath
            key={`w${i}`}
            d={d}
            width={2}
            opacity={INK.wall * gain}
            delay={sheetDelay}
            reduced={reduced}
            lit={lit}
          />
        ))}

        {plan.partitions.map((d, i) => (
          <InkPath
            key={`p${i}`}
            d={d}
            width={1.2}
            opacity={INK.partition * gain}
            delay={sheetDelay + 0.35 + i * 0.12}
            reduced={reduced}
            lit={lit}
          />
        ))}

        {plan.guides.map((d, i) => (
          <InkPath
            key={`g${i}`}
            d={d}
            width={0.8}
            opacity={INK.guide * gain}
            delay={sheetDelay + 0.5 + i * 0.1}
            dash="6 7"
            draw={false}
            reduced={reduced}
            lit={lit}
          />
        ))}

        {plan.fixtures.map((d, i) => (
          <InkPath
            key={`f${i}`}
            d={d}
            width={1}
            opacity={INK.fixture * gain}
            delay={sheetDelay + 0.6 + i * 0.05}
            reduced={reduced}
            lit={lit}
          />
        ))}

        {plan.doors.map((d, i) => (
          <InkPath
            key={`d${i}`}
            d={d}
            width={1.1}
            opacity={INK.door * gain}
            delay={sheetDelay + 0.85 + i * 0.08}
            reduced={reduced}
            lit={lit}
          />
        ))}

        {/* Annotations land last, once there is geometry to annotate. */}
        {plan.dims.map((dim, i) => (
          <DimensionAnnotation
            key={`dim${i}`}
            dim={dim}
            delay={sheetDelay + 1.5 + i * 0.2}
            reduced={reduced}
            lit={lit}
          />
        ))}
      </g>
    </motion.g>
  );
}

/**
 * A single stroke.
 *
 * In the base layer it draws itself from start to end. In the lit layer it is
 * a plain path — that copy is revealed wholesale by the lamp's mask, so paying
 * for an animator per path would buy nothing.
 */
function InkPath({
  d,
  width,
  opacity,
  delay,
  dash,
  draw = true,
  reduced,
  lit,
}: {
  d: string;
  width: number;
  opacity: number;
  delay: number;
  /** Dash pattern for construction lines. Solid when omitted. */
  dash?: string;
  /**
   * Whether the stroke draws itself.
   *
   * Framer implements `pathLength` *through* strokeDasharray, so the two
   * cannot coexist — a dashed line must fade in instead. That reads correctly
   * anyway: construction lines are set out before the drawing, not drafted
   * along with it.
   */
  draw?: boolean;
  reduced: boolean;
  lit: boolean;
}) {
  const shared = {
    d,
    fill: "none",
    stroke: STROKE,
    strokeWidth: width,
    strokeDasharray: dash,
    strokeLinecap: "square" as const,
  };

  if (lit || reduced) {
    return <path {...shared} opacity={opacity} />;
  }

  return (
    <motion.path
      {...shared}
      initial={draw ? { pathLength: 0, opacity: 0 } : { opacity: 0 }}
      animate={draw ? { pathLength: 1, opacity } : { opacity }}
      transition={{
        pathLength: { duration: DURATION.draft, ease: EASE.out, delay },
        opacity: { duration: DURATION.base, delay },
      }}
    />
  );
}

/**
 * Dimension string: extension lines, the dimension line, slash ticks and the
 * measurement. Fades in rather than drawing, so it reads as annotation added
 * on top of the drawing rather than as more of the drawing.
 */
function DimensionAnnotation({
  dim,
  delay,
  reduced,
  lit,
}: {
  dim: Dimension;
  delay: number;
  reduced: boolean;
  lit: boolean;
}) {
  const geometry = buildDimension(dim);
  const gain = lit ? LAMP_GAIN : 1;
  const still = lit || reduced;

  const marks = (
    <>
      <path
        d={geometry.extensions}
        fill="none"
        stroke={STROKE}
        strokeWidth={0.6}
        strokeDasharray="2 3"
        opacity={INK.dimension * gain}
      />
      <path
        d={geometry.line}
        fill="none"
        stroke={STROKE}
        strokeWidth={0.8}
        opacity={INK.dimension * gain}
      />
      <path
        d={geometry.ticks}
        fill="none"
        stroke={STROKE}
        strokeWidth={1}
        opacity={Math.min(INK.dimension * 1.4 * gain, 1)}
      />
      <text
        x={geometry.labelX}
        y={geometry.labelY}
        textAnchor="middle"
        fill={STROKE}
        opacity={Math.min(INK.label * gain, 1)}
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
        transform={
          geometry.rotate
            ? `rotate(${geometry.rotate} ${geometry.labelX} ${geometry.labelY})`
            : undefined
        }
      >
        {dim.label}
      </text>
    </>
  );

  if (still) {
    return <g>{marks}</g>;
  }

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.slow, ease: EASE.out, delay }}
    >
      {marks}
    </motion.g>
  );
}
