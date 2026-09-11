import { useReducedMotion } from "framer-motion";

/**
 * Whether this visitor wants motion.
 *
 * Framer's hook returns `null` before it has read the media query, which is
 * falsy but not `false`; every primitive would otherwise have to remember to
 * coerce it. Centralising that here means honouring `prefers-reduced-motion`
 * is the default rather than something each component opts into.
 */
export function useMotionEnabled(): boolean {
  return !useReducedMotion();
}
