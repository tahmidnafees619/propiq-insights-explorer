/**
 * A figure that counts to its value when it scrolls into view.
 *
 * Deliberately renders once. A spring drives the intermediate values and writes
 * them straight to the DOM node, so a counting KPI costs zero React renders —
 * the obvious implementation sets state every frame and re-renders the whole
 * card sixty times a second.
 *
 * The final value is what renders on the server, so the correct figure is in
 * the markup before any script runs, search engines see it, and the layout
 * never shifts. The client zeroes the node before first paint rather than
 * during it, so there is no visible snap from the final value back to zero.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import { useInView, useMotionValueEvent, useSpring } from "framer-motion";

import { useMotionEnabled } from "./useMotionEnabled";

interface Props {
  value: number;
  /** How the running value is rendered. Defaults to a rounded, grouped integer. */
  format?: (value: number) => string;
  /** Stiffer springs arrive faster; the default settles in about a second. */
  stiffness?: number;
  damping?: number;
  className?: string;
}

const defaultFormat = (value: number) => Math.round(value).toLocaleString();

/** `useLayoutEffect` warns when it runs during SSR, where it is also a no-op. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function AnimatedNumber({
  value,
  format = defaultFormat,
  stiffness = 70,
  damping = 22,
  className,
}: Props) {
  const enabled = useMotionEnabled();
  const ref = useRef<HTMLSpanElement>(null);
  // `once` so scrolling back and forth does not restart the count.
  const inView = useInView(ref, { once: true, margin: "-40px" });

  // Held in a ref so an inline `format` arrow does not re-run the effects.
  const formatRef = useRef(format);
  formatRef.current = format;

  const spring = useSpring(0, {
    stiffness,
    damping,
    // Scaled to the magnitude being counted. A fixed threshold would either
    // stall a large figure short of its target or never settle a small one
    // like an R-squared of 0.904.
    restDelta: Math.max(Math.abs(value) * 1e-4, 1e-3),
  });

  useIsomorphicLayoutEffect(() => {
    // Zero the node before the browser paints, so the server-rendered figure
    // never flashes before the count begins.
    if (enabled && ref.current) ref.current.textContent = formatRef.current(0);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (inView) spring.set(value);
  }, [enabled, inView, value, spring]);

  useMotionValueEvent(spring, "change", (latest) => {
    if (ref.current) ref.current.textContent = formatRef.current(latest);
  });

  useMotionValueEvent(spring, "animationComplete", () => {
    // `restDelta` lets the spring stop fractionally short; land on the exact
    // figure so the reader is never shown a number that is merely close.
    if (ref.current) ref.current.textContent = formatRef.current(value);
  });

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
