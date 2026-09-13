/**
 * Motion design tokens.
 *
 * Every animation in the app draws its timing from here. Coherence comes from
 * a small shared vocabulary rather than from animating more things — six
 * different easing curves is what makes an interface feel improvised.
 */

/** Cubic-bezier control points, typed as Framer Motion expects them. */
type Bezier = [number, number, number, number];

export const DURATION = {
  /** Press feedback, toggles — fast enough to feel instant. */
  instant: 0.12,
  /** Hover states, small reveals. */
  quick: 0.22,
  /** The default: cards, sections, most entrances. */
  base: 0.38,
  /** Larger surfaces and route-level changes. */
  slow: 0.64,
  /** Blueprint line drawing. Deliberately unhurried. */
  draft: 2.4,
} as const;

export const EASE = {
  /** Decelerating. The workhorse for anything entering the screen. */
  out: [0.22, 1, 0.36, 1] as Bezier,
  /** Symmetric. For things that move between two on-screen positions. */
  inOut: [0.65, 0, 0.35, 1] as Bezier,
  /** Slight overshoot, for emphasis. Use sparingly. */
  emphasis: [0.34, 1.56, 0.64, 1] as Bezier,
} as const;

export const STAGGER = {
  tight: 0.04,
  base: 0.08,
  loose: 0.14,
} as const;

export const SPRING = {
  /** Weighted, for cursor-following layers. Lags deliberately. */
  drift: { stiffness: 40, damping: 22, mass: 0.8 },
  /**
   * For the drafting lamp. Closer to the cursor than `drift` — a light you
   * are holding should feel attached to your hand — but still weighted enough
   * to glide rather than snap.
   */
  lamp: { stiffness: 130, damping: 26, mass: 0.5 },
  /** Snappy, for interactive elements under the pointer. */
  responsive: { stiffness: 260, damping: 30 },
} as const;
