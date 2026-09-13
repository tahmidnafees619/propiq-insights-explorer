/**
 * A control that leans very slightly toward the cursor.
 *
 * Kept deliberately restrained — `pull` is a handful of pixels. The effect
 * earns its place on a page's primary action, where it makes the target feel
 * responsive before it is clicked; applied to every button it reads as a
 * novelty, so use it sparingly.
 *
 * The element springs back to rest on leave.
 */

import { useCallback, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

import { SPRING } from "@/lib/motion";
import { useMotionEnabled } from "./useMotionEnabled";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  type?: "button" | "submit";
  /** Maximum travel toward the cursor, in pixels. */
  pull?: number;
}

export function MagneticButton({
  children,
  onClick,
  disabled,
  className,
  style,
  type = "button",
  pull = 6,
}: Props) {
  const enabled = useMotionEnabled();
  const ref = useRef<HTMLButtonElement>(null);
  const frame = useRef(0);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING.responsive);
  const springY = useSpring(y, SPRING.responsive);

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== "mouse" || disabled) return;
      if (frame.current) return;
      const { clientX, clientY } = event;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        // Offset from the centre, normalised, then capped at `pull`.
        const dx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const dy = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        x.set(Math.max(-1, Math.min(1, dx)) * pull);
        y.set(Math.max(-1, Math.min(1, dy)) * pull);
      });
    },
    [disabled, pull, x, y],
  );

  const handleLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  if (!enabled) {
    return (
      <button type={type} onClick={onClick} disabled={disabled} className={className} style={style}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={className}
      style={{ ...style, x: springX, y: springY }}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </motion.button>
  );
}
