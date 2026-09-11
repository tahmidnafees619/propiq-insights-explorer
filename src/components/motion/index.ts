/**
 * Motion primitives.
 *
 * Everything animated in the app composes from these, so timing and easing
 * stay consistent and `prefers-reduced-motion` is honoured in one place
 * rather than remembered in twenty.
 */

export { Reveal, type RevealFrom } from "./Reveal";
export { Stagger, StaggerItem } from "./Stagger";
export { AnimatedNumber } from "./AnimatedNumber";
export { SpotlightCard } from "./SpotlightCard";
export { MagneticButton } from "./MagneticButton";
export { useMotionEnabled } from "./useMotionEnabled";
