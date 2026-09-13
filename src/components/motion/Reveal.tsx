/**
 * Entrance animation for anything that scrolls into view.
 *
 * The default vocabulary for the app: content rises and fades as it arrives,
 * once, with the shared easing. Using one primitive everywhere is what keeps
 * the interface feeling composed rather than individually animated.
 */

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { DURATION, EASE } from "@/lib/motion";
import { useMotionEnabled } from "./useMotionEnabled";

/** Where the element travels from, and how far. */
const OFFSETS = {
  below: { y: 18 },
  above: { y: -18 },
  left: { x: -18 },
  right: { x: 18 },
  none: {},
} as const;

export type RevealFrom = keyof typeof OFFSETS;

interface Props {
  children: ReactNode;
  /** Direction of travel. `none` fades without moving. */
  from?: RevealFrom;
  delay?: number;
  duration?: number;
  className?: string;
  /**
   * Replay each time the element re-enters the viewport.
   *
   * Off by default: content that re-animates every time you scroll past is
   * distracting to read.
   */
  repeat?: boolean;
}

export function Reveal({
  children,
  from = "below",
  delay = 0,
  duration = DURATION.base,
  className,
  repeat = false,
}: Props) {
  const enabled = useMotionEnabled();

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...OFFSETS[from] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      // A negative margin starts the animation just before the element is
      // fully on screen, so it is finished by the time it is being read.
      viewport={{ once: !repeat, margin: "-60px" }}
      transition={{ duration, ease: EASE.out, delay }}
    >
      {children}
    </motion.div>
  );
}
