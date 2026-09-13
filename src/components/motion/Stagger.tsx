/**
 * Sequenced entrance for a group of siblings.
 *
 * `Stagger` orchestrates, `StaggerItem` animates. Framer propagates variants
 * down the tree by name, so the parent holds the timing and the children hold
 * no delay logic of their own — adding or reordering a card cannot desynchronise
 * the sequence.
 *
 *   <Stagger className="grid gap-4">
 *     {rows.map((row) => (
 *       <StaggerItem key={row.id}>...</StaggerItem>
 *     ))}
 *   </Stagger>
 */

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

import { DURATION, EASE, STAGGER } from "@/lib/motion";
import { useMotionEnabled } from "./useMotionEnabled";

interface StaggerProps {
  children: ReactNode;
  /** Gap between each child, in seconds. */
  gap?: number;
  /** Delay before the first child starts. */
  delay?: number;
  className?: string;
  repeat?: boolean;
}

export function Stagger({
  children,
  gap = STAGGER.base,
  delay = 0,
  className,
  repeat = false,
}: StaggerProps) {
  const enabled = useMotionEnabled();

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  };

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: !repeat, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE.out },
  },
};

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const enabled = useMotionEnabled();

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
