/**
 * The title sheet: PropIQ drafted, then handed to the app.
 *
 * A small isometric house draws in first — what the product is about, stated
 * before its name is. It settles under a gentle 3D tilt while, below it, a
 * parallel rule sweeps down leaving the cap, x-height and baseline behind it,
 * construction geometry is struck in dashed lines, and a T-square blade
 * travels left to right with the ink following it — so what you watch is the
 * *instrument* working rather than letters appearing by themselves. Guides
 * are erased once the letters can stand without them, the Q's tail runs out
 * into a dimension leader, and the sheet annotates itself with what the thing
 * actually does.
 *
 * On scroll, the house reduces first, then the sheet furniture retracts, and
 * the wordmark dismantles letter by letter — each one flying toward the
 * corner where the navbar sits, on its own staggered window, rather than the
 * whole word shrinking as one block. The navbar's own plain-text logo fades
 * in once the last letter is gone; there is no shared-element morph between
 * the two, because a drawn stroke mark and typeset text don't share a shape
 * to morph between.
 *
 * Constraints held here:
 *
 * - The dashboard stays mounted beneath, so the intro costs no LCP and the
 *   content is in the document whether or not the sequence ever runs.
 * - Only transform and opacity animate; the ink uses `pathLength`, which
 *   Framer compiles to stroke-dash offsets on the compositor.
 * - No web font is involved. The wordmark is geometry, so the most important
 *   frame on the site cannot flash unstyled text.
 * - `prefers-reduced-motion` never reaches this component: the provider
 *   resolves to `off` and the app renders alone.
 */

import { useMemo, useRef } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { AnimatedNumber } from "@/components/motion";
import { useStats } from "@/hooks/useStats";
import { DURATION, EASE } from "@/lib/motion";
import { HouseSketch, type PercentBox } from "./HouseSketch";
import { HOUSE_HEIGHT as HOUSE_ART_H, HOUSE_WIDTH as HOUSE_ART_W } from "./house-geometry";
import { useIntro } from "./IntroProvider";
import { Wordmark, WORDMARK_PAD, WORDMARK_VIEW_H, WORDMARK_VIEW_W } from "./Wordmark";
import {
  WORDMARK_GLYPH_GROUPS,
  WORDMARK_GUIDES,
  WORDMARK_STROKES,
  type GlyphGroup,
} from "./wordmark-geometry";

/** Sheet coordinate space. Everything on the sheet is authored in these units. */
const SHEET_W = 900;
const SHEET_H = 560;
const MARGIN = 46;

/** Baselines the parallel rule leaves behind, in wordmark units. */
const RULES = [0, 32, 100, 132];

/**
 * Where the wordmark sits on the sheet, and how large.
 *
 * The mark is an HTML-positioned `<svg>`, but the construction guides and the
 * exit layer are drawn in sheet units within the SVG itself. All three derive
 * from these numbers, and the overlay is placed in percentages, so everything
 * stays registered at every viewport width instead of drifting as the sheet
 * scales.
 */
const MARK_SCALE = 1.58;
const MARK_ORIGIN_Y = 150;
const MARK_ORIGIN_X = (SHEET_W - WORDMARK_VIEW_W * MARK_SCALE) / 2;
const MARK_TRANSFORM = `translate(${MARK_ORIGIN_X} ${MARK_ORIGIN_Y}) scale(${MARK_SCALE})`;
const MARK_BOX = {
  left: `${((MARK_ORIGIN_X - WORDMARK_PAD * MARK_SCALE) / SHEET_W) * 100}%`,
  top: `${((MARK_ORIGIN_Y - WORDMARK_PAD * MARK_SCALE) / SHEET_H) * 100}%`,
  width: `${((WORDMARK_VIEW_W * MARK_SCALE) / SHEET_W) * 100}%`,
  height: `${((WORDMARK_VIEW_H * MARK_SCALE) / SHEET_H) * 100}%`,
};

/**
 * Where the house sits: above the writing lines, in the gap between the edge
 * references and the wordmark. A supporting detail, not a second hero — real
 * drawing sheets often carry a small massing sketch beside the plan.
 */
const HOUSE_HEIGHT_UNITS = 84;
const HOUSE_WIDTH_UNITS = HOUSE_HEIGHT_UNITS * (HOUSE_ART_W / HOUSE_ART_H);
const HOUSE_CENTER_X = SHEET_W / 2;
const HOUSE_CENTER_Y = 96;
const HOUSE_BOX: PercentBox = {
  left: `${((HOUSE_CENTER_X - HOUSE_WIDTH_UNITS / 2) / SHEET_W) * 100}%`,
  top: `${((HOUSE_CENTER_Y - HOUSE_HEIGHT_UNITS / 2) / SHEET_H) * 100}%`,
  width: `${(HOUSE_WIDTH_UNITS / SHEET_W) * 100}%`,
  height: `${(HOUSE_HEIGHT_UNITS / SHEET_H) * 100}%`,
};
/** The house recedes first, ahead of the sheet furniture — a foreground
 *  element leaving before the background does reads as depth. */
const HOUSE_REDUCE_RANGE: [number, number] = [0.4, 0.7];

/**
 * The house's own opening reserves this much of the timeline before the
 * wordmark mechanism begins, so the two beats don't compete for attention.
 */
const HOUSE_OFFSET = 1.3;

/** Scroll runway. Longer on a first visit, so the sheet is not rushed past. */
const SPAN = { full: 200, brief: 120 } as const;

/** The sheet retracts over this stretch of the runway; letters dismantle within it. */
const RETRACT_FROM = 0.5;
const RETRACT_TO = 0.88;
/** Where the navbar's own logo takes over from the sheet. */
const HANDOFF_AT = 0.93;

/**
 * Each glyph gets its own window inside the retract span, staggered so they
 * leave in reading order (P first, Q last) with enough overlap to feel like
 * one continuous motion rather than a slideshow.
 */
const EXIT_START = RETRACT_FROM + 0.02;
const EXIT_SPAN = 0.34;
const EXIT_GLYPH_DURATION = 0.2;
const EXIT_GAP =
  WORDMARK_GLYPH_GROUPS.length > 1
    ? (EXIT_SPAN - EXIT_GLYPH_DURATION) / (WORDMARK_GLYPH_GROUPS.length - 1)
    : 0;

/**
 * Where the letters converge to, in raw (pre-`MARK_SCALE`) glyph units — a
 * point up and to the left, toward the corner the navbar occupies. Landing
 * exactly on the real navbar logo would need measuring its DOM position every
 * frame the scale/lift transforms above it are animating; converging toward a
 * fixed point and crossfading to the real logo at the end reads just as well
 * without that fragility.
 */
const CONVERGE_X = -40;
const CONVERGE_Y = -145;

/** Strokes belonging to the accented `IQ`, matched the same way `Wordmark`
 *  itself picks them — the last four strokes drawn. */
const ACCENT_STROKE_IDS = new Set(WORDMARK_STROKES.slice(-4).map((s) => s.id));
const STROKE_BY_ID = new Map(WORDMARK_STROKES.map((s) => [s.id, s.d]));

const TITLE_BLOCK: Array<[string, string]> = [
  ["PROJECT", "PropIQ — Market Intelligence"],
  ["DRAWING", "PIQ-2026-001"],
  ["REV", "A"],
  ["SCALE", "1:1"],
  ["DRAWN BY", "MTRN"],
];

/** What the product actually produces, annotated as a drawing would be. */
const OUTPUTS = ["PRICE", "CONFIDENCE RANGE", "COMPARABLE SALES"];

export function IntroSequence() {
  const { mode, introActive, handOff } = useIntro();
  const spacerRef = useRef<HTMLDivElement>(null);
  const { data: stats } = useStats();

  const { scrollYProgress } = useScroll({
    target: spacerRef,
    offset: ["start start", "end start"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (value >= HANDOFF_AT && introActive) handOff();
  });

  // Every hook runs before the `off` bail-out below: React requires the same
  // hooks in the same order on every render, and the mode is resolved after
  // mount, so it changes across renders of this component.
  const sheetOpacity = useTransform(scrollYProgress, [RETRACT_FROM, RETRACT_TO], [1, 0]);
  const sheetLift = useTransform(scrollYProgress, [RETRACT_FROM, RETRACT_TO], [0, -70]);
  const markOpacity = useTransform(scrollYProgress, [EXIT_START - 0.02, EXIT_START + 0.05], [1, 0]);
  const stageOpacity = useTransform(scrollYProgress, [0.9, 1], [1, 0]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.14], [1, 0]);

  if (mode === "off") return null;

  // A returning visitor gets the same sheet, assembled rather than drawn.
  const brief = mode === "brief";
  const t = (seconds: number) => (brief ? seconds * 0.13 : seconds);
  // Everything after the house's own opening beat uses this instead of `t`.
  const t2 = (seconds: number) => t(seconds + HOUSE_OFFSET);
  const ink = {
    delay: t2(1.45),
    duration: t(0.55),
    stagger: t(0.11),
  };

  return (
    <div ref={spacerRef} style={{ height: `${SPAN[brief ? "brief" : "full"]}vh` }}>
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-4">
        <motion.div className="relative w-full max-w-5xl" style={{ opacity: stageOpacity }}>
          <svg viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} className="h-auto w-full" aria-hidden="true">
            {/* --- sheet furniture: border, ticks, edge references --------- */}
            <motion.g style={{ opacity: sheetOpacity, y: sheetLift }}>
              <SheetBorder t={t} />
              <EdgeReferences t={t} />
            </motion.g>

            {/* --- the drafting instruments -------------------------------- */}
            <motion.g style={{ opacity: sheetOpacity }}>
              <ParallelRule t={t2} />
              <TSquare startDelay={t2(1.1)} travelDuration={t(2.5)} />
            </motion.g>

            {/* --- construction geometry, struck then erased --------------- */}
            <motion.g style={{ opacity: sheetOpacity }}>
              <Construction t={t2} />
            </motion.g>

            {/* --- the leader the Q's tail runs into ----------------------- */}
            <motion.g style={{ opacity: sheetOpacity }}>
              <Leader t={t2} />
            </motion.g>

            {/* --- the dismantle: each letter on its own scroll window ----- */}
            {introActive && (
              <g transform={MARK_TRANSFORM}>
                {WORDMARK_GLYPH_GROUPS.map((group, i) => (
                  <GlyphExit
                    key={`${group.char}-${i}`}
                    group={group}
                    index={i}
                    scrollYProgress={scrollYProgress}
                  />
                ))}
              </g>
            )}
          </svg>

          {/* The house sits above the sheet's own SVG so its CSS 3D tilt
              (perspective needs a plain HTML stacking context) is unaffected
              by the sheet's viewBox scaling. */}
          <HouseSketch
            t={t}
            reduceRange={HOUSE_REDUCE_RANGE}
            scrollYProgress={scrollYProgress}
            box={HOUSE_BOX}
          />

          {/* The static, fully-inked mark. It fades out the instant the first
              letter's own exit window begins, handing off to the dismantle
              layer above with no visible seam. */}
          <motion.div
            className="pointer-events-none absolute"
            style={{ ...MARK_BOX, opacity: markOpacity }}
          >
            {introActive && <Wordmark draw={brief ? undefined : ink} />}
          </motion.div>

          {/* --- annotation: what the sheet is for ----------------------- */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 pb-2 lg:pe-60"
            style={{ opacity: sheetOpacity, y: sheetLift }}
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: t2(3.35), duration: t(0.5), ease: EASE.out }}
              className="text-center font-mono text-[10px] tracking-[0.34em] text-muted-foreground sm:text-xs"
            >
              MACHINE-LEARNED PROPERTY VALUATION
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: t2(3.05), duration: t(0.5), ease: EASE.out }}
              className="flex items-baseline gap-2 font-mono text-[11px] tracking-[0.2em] text-[var(--ink-300)]"
            >
              <AnimatedNumber
                value={stats.total_properties}
                stiffness={38}
                damping={20}
                className="tabular-nums"
              />
              <span className="text-muted-foreground">SALES ANALYSED · KING COUNTY, WA</span>
            </motion.div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {OUTPUTS.map((label, i) => (
                <motion.span
                  key={label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: t2(3.6 + i * 0.12), duration: t(0.45), ease: EASE.out }}
                  className="flex items-center gap-2 font-mono text-[9px] tracking-[0.22em] text-muted-foreground"
                >
                  <span className="h-px w-5 bg-[var(--line-strong)]" />
                  {label}
                </motion.span>
              ))}
            </div>
          </motion.div>

          <TitleBlock t={t2} opacity={sheetOpacity} y={sheetLift} />
          <ScrollCue t={t2} opacity={cueOpacity} />
        </motion.div>
      </div>
    </div>
  );
}

type Timing = (seconds: number) => number;

/**
 * One letter, flying toward the navbar corner on its own scroll window.
 *
 * Strokes are looked up from the flat `WORDMARK_STROKES` list rather than
 * re-derived, so this is always drawing exactly what the static mark drew —
 * there is only one source of glyph geometry in the file.
 */
function GlyphExit({
  group,
  index,
  scrollYProgress,
}: {
  group: GlyphGroup;
  index: number;
  scrollYProgress: MotionValue<number>;
}) {
  const start = EXIT_START + index * EXIT_GAP;
  const end = start + EXIT_GLYPH_DURATION;
  const local = useTransform(scrollYProgress, [start, end], [0, 1]);

  const dx = useTransform(local, [0, 1], [0, CONVERGE_X - group.x]);
  const dy = useTransform(local, [0, 1], [0, CONVERGE_Y]);
  const scale = useTransform(local, [0, 1], [1, 0.22]);
  const rotate = useTransform(local, [0, 1], [0, index % 2 === 0 ? -16 : 16]);
  // Invisible until this glyph's own window opens (so it never doubles up
  // with the still-inking or still-static mark), snaps to full opacity
  // almost immediately once it does, then fades out as it finishes its flight.
  const opacity = useTransform(local, [0, 0.06, 0.8, 1], [0, 1, 1, 0]);

  const strokes = useMemo(
    () => group.strokeIds.map((id) => STROKE_BY_ID.get(id)).filter((d): d is string => !!d),
    [group.strokeIds],
  );

  return (
    <motion.g style={{ x: dx, y: dy, scale, rotate, opacity }}>
      {strokes.map((d, i) => (
        <path
          key={group.strokeIds[i]}
          d={d}
          fill="none"
          stroke={ACCENT_STROKE_IDS.has(group.strokeIds[i]) ? "var(--brass-500)" : "var(--ink-400)"}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </motion.g>
  );
}

/** The ruled border, plus the corner ticks a trimmed sheet carries. */
function SheetBorder({ t }: { t: Timing }) {
  const inset = 14;
  const tick = 16;
  const corners = [
    `M${inset} ${inset + tick} V${inset} H${inset + tick}`,
    `M${SHEET_W - inset - tick} ${inset} H${SHEET_W - inset} V${inset + tick}`,
    `M${SHEET_W - inset} ${SHEET_H - inset - tick} V${SHEET_H - inset} H${SHEET_W - inset - tick}`,
    `M${inset + tick} ${SHEET_H - inset} H${inset} V${SHEET_H - inset - tick}`,
  ];

  return (
    <g>
      <motion.rect
        x={inset}
        y={inset}
        width={SHEET_W - inset * 2}
        height={SHEET_H - inset * 2}
        fill="none"
        stroke="var(--line)"
        strokeWidth={1}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: t(1.1), ease: EASE.inOut }}
      />
      {corners.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={1.6}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(0.55 + i * 0.05), duration: t(0.3) }}
        />
      ))}
    </g>
  );
}

/** Grid references down the edge and across the head, as every sheet has. */
function EdgeReferences({ t }: { t: Timing }) {
  const cols = ["1", "2", "3", "4"];
  const rows = ["A", "B", "C"];
  const style = { fontSize: 9, letterSpacing: "0.18em", fontFamily: "ui-monospace, monospace" };

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ delay: t(0.75), duration: t(0.5) }}
      fill="var(--muted-foreground)"
    >
      {cols.map((label, i) => (
        <text
          key={label}
          x={MARGIN + ((SHEET_W - MARGIN * 2) / cols.length) * (i + 0.5)}
          y={38}
          textAnchor="middle"
          style={style}
        >
          {label}
        </text>
      ))}
      {rows.map((label, i) => (
        <text
          key={label}
          x={34}
          y={MARGIN + ((SHEET_H - MARGIN * 2) / rows.length) * (i + 0.5)}
          textAnchor="middle"
          style={style}
        >
          {label}
        </text>
      ))}
    </motion.g>
  );
}

/**
 * The parallel rule: sweeps down the sheet and leaves the writing lines behind
 * it, which is how the lines a letterer works between actually get there.
 */
function ParallelRule({ t }: { t: Timing }) {
  const top = MARK_ORIGIN_Y;
  const scale = MARK_SCALE;

  return (
    <g>
      {RULES.map((unit, i) => {
        const y = top + unit * scale;
        return (
          <motion.path
            key={unit}
            d={`M${MARGIN} ${y} H${SHEET_W - MARGIN}`}
            fill="none"
            stroke="var(--line)"
            strokeWidth={0.9}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.85 }}
            transition={{ delay: t(0.7 + i * 0.14), duration: t(0.5), ease: EASE.out }}
          />
        );
      })}
      {/* The rule itself, riding down past each line it draws. */}
      <motion.g
        initial={{ opacity: 0, y: top - 40 }}
        animate={{
          opacity: [0, 0.9, 0.9, 0],
          y: [top - 40, top, top + RULES[RULES.length - 1] * scale, top + 240],
        }}
        transition={{
          delay: t(0.55),
          duration: t(1.5),
          times: [0, 0.18, 0.8, 1],
          ease: EASE.inOut,
        }}
      >
        <rect
          x={MARGIN - 26}
          y={-3}
          width={SHEET_W - MARGIN * 2 + 52}
          height={6}
          fill="var(--ink-700)"
          opacity={0.5}
        />
        <path
          d={`M${MARGIN - 26} 0 H${SHEET_W - MARGIN + 26}`}
          stroke="var(--ink-300)"
          strokeWidth={1.2}
          fill="none"
        />
      </motion.g>
    </g>
  );
}

/**
 * The T-square blade, travelling ahead of the ink.
 *
 * Timed to lead the wordmark's strokes, so the letters appear to be drawn
 * against it rather than to arrive on their own. Takes fully-resolved
 * timeline values rather than deriving them internally — an earlier version
 * re-applied the brief-mode time compression to a value that was already
 * compressed, which on a returning visit put the blade a step out of sync
 * with the ink it is meant to lead.
 */
function TSquare({ startDelay, travelDuration }: { startDelay: number; travelDuration: number }) {
  const from = MARGIN + 60;
  const to = SHEET_W - MARGIN - 40;

  return (
    <motion.g
      initial={{ opacity: 0, x: from }}
      animate={{ opacity: [0, 0.85, 0.85, 0], x: [from, from, to, to + 30] }}
      transition={{
        delay: startDelay,
        duration: travelDuration,
        times: [0, 0.12, 0.88, 1],
        ease: EASE.inOut,
      }}
    >
      <path d={`M0 110 V${SHEET_H - 120}`} stroke="var(--ink-300)" strokeWidth={1.2} fill="none" />
      <rect x={-3} y={110} width={6} height={SHEET_H - 230} fill="var(--ink-700)" opacity={0.45} />
      {/* The nib riding the blade. */}
      <g>
        <circle r={3.4} cy={300} fill="var(--brass-500)" />
        <path
          d="M-9 300 H-4 M4 300 H9 M0 291 V296 M0 304 V309"
          stroke="var(--brass-400)"
          strokeWidth={1}
        />
      </g>
    </motion.g>
  );
}

/**
 * Construction geometry: the circles and centre lines a letterer strikes
 * before inking, erased once the letters can stand without them.
 */
function Construction({ t }: { t: Timing }) {
  return (
    <motion.g
      transform={MARK_TRANSFORM}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0.55, 0] }}
      transition={{
        delay: t(0.95),
        duration: t(2.6),
        times: [0, 0.16, 0.72, 1],
        ease: EASE.inOut,
      }}
    >
      {WORDMARK_GUIDES.map((guide, i) => (
        <motion.path
          key={guide.id}
          d={guide.d}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={0.7}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(0.1 + i * 0.05), duration: t(0.3) }}
        />
      ))}
    </motion.g>
  );
}

/** The Q's tail, run on into a dimension leader beneath the mark. */
function Leader({ t }: { t: Timing }) {
  const y = 402;
  const x1 = SHEET_W / 2 - 150;
  const x2 = SHEET_W / 2 + 150;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: t(2.9), duration: t(0.5) }}
    >
      <motion.path
        d={`M${x1} ${y} H${x2}`}
        fill="none"
        stroke="var(--brass-500)"
        strokeWidth={0.9}
        opacity={0.55}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: t(2.9), duration: t(0.6), ease: EASE.out }}
      />
      <path
        d={`M${x1 - 4} ${y + 4} L${x1 + 4} ${y - 4}`}
        stroke="var(--brass-500)"
        strokeWidth={1.2}
        opacity={0.7}
      />
      <path
        d={`M${x2 - 4} ${y + 4} L${x2 + 4} ${y - 4}`}
        stroke="var(--brass-500)"
        strokeWidth={1.2}
        opacity={0.7}
      />
    </motion.g>
  );
}

function TitleBlock({
  t,
  opacity,
  y,
}: {
  t: Timing;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <motion.dl
      style={{ opacity, y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: t(3.85), duration: t(0.5), ease: EASE.out }}
      className="pointer-events-none absolute bottom-2 right-2 hidden w-56 border border-[var(--line)] bg-[var(--surface)]/60 p-3 font-mono text-[9px] leading-relaxed tracking-[0.12em] backdrop-blur-sm lg:block"
    >
      {[...TITLE_BLOCK, ["DATE", today] as [string, string]].map(([key, value]) => (
        <div key={key} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="truncate text-right text-foreground/80">{value}</dd>
        </div>
      ))}
    </motion.dl>
  );
}

/** A dimension arrow, not a bouncing chevron. */
function ScrollCue({ t, opacity }: { t: Timing; opacity: MotionValue<number> }) {
  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-x-0 -bottom-14 flex justify-center"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(4.15), duration: t(0.5) }}
        className="flex flex-col items-center gap-1.5"
      >
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">SCROLL</span>
        <motion.svg
          width="12"
          height="28"
          viewBox="0 0 12 28"
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: DURATION.slow * 3, repeat: Infinity, ease: EASE.inOut }}
        >
          <path d="M6 0 V22" stroke="var(--line-strong)" strokeWidth="1" />
          <path d="M2 18 L6 24 L10 18" stroke="var(--brass-500)" strokeWidth="1.2" fill="none" />
        </motion.svg>
      </motion.div>
    </motion.div>
  );
}
