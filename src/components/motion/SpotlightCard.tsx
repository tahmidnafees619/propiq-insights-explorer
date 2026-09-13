/**
 * A surface that lights where the pointer crosses it.
 *
 * The same idea as the drafting lamp in the background, brought to the
 * foreground: a soft pool follows the cursor across the card and the border
 * brightens nearest to it. Reusing one gesture across both layers is what
 * makes it read as the interface's behaviour rather than as an effect applied
 * to a component.
 *
 * Pointer position is written to CSS custom properties, so tracking the cursor
 * never re-renders the card or its contents.
 */

import { useCallback, useRef, type ReactNode } from "react";

import { useMotionEnabled } from "./useMotionEnabled";

interface Props {
  children: ReactNode;
  className?: string;
  /** Reach of the pool of light, in pixels. */
  radius?: number;
  /** Peak brightness of the pool, 0-1. */
  intensity?: number;
}

export function SpotlightCard({ children, className = "", radius = 320, intensity = 0.06 }: Props) {
  const enabled = useMotionEnabled();
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const handleMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    // Coalesce to one write per frame; pointermove fires far faster.
    if (frame.current) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--spot-x", `${clientX - rect.left}px`);
      node.style.setProperty("--spot-y", `${clientY - rect.top}px`);
      node.style.setProperty("--spot-on", "1");
    });
  }, []);

  const handleLeave = useCallback(() => {
    ref.current?.style.setProperty("--spot-on", "0");
  }, []);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`group relative isolate ${className}`}
      style={
        {
          "--spot-x": "50%",
          "--spot-y": "50%",
          "--spot-on": "0",
        } as React.CSSProperties
      }
    >
      {/* The pool of light across the surface. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: "var(--spot-on)",
          background: `radial-gradient(circle ${radius}px at var(--spot-x) var(--spot-y), rgba(47,153,218,${intensity}) 0%, transparent 70%)`,
        }}
      />
      {/* Border catching the light, masked to a hairline at the edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: "var(--spot-on)",
          padding: 1,
          background: `radial-gradient(circle ${radius * 0.7}px at var(--spot-x) var(--spot-y), rgba(47,153,218,0.55) 0%, transparent 65%)`,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
        }}
      />
      {children}
    </div>
  );
}
