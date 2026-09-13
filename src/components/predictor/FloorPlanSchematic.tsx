/**
 * A live blueprint of the property being priced.
 *
 * Every control in the form reshapes this drawing: the footprint scales with
 * square footage, the rear band re-columns as bedrooms are added, the wet
 * stack grows, an upper storey offsets in, the basement appears as a dashed
 * underlay, and waterfront draws a shoreline.
 *
 * Three implementation notes:
 *
 * - Rooms are positioned by animating a wrapping `<g>`, never the `<rect>`'s
 *   own `x`/`y`. On SVG children Framer treats `x`/`y` as transforms, which
 *   silently fights the attributes of the same name.
 * - Doors, windows and fixtures are path strings whose shape changes with the
 *   plan, so they cross-fade rather than morph. Interpolating between two
 *   arbitrary path strings produces garbage far more often than animation.
 * - Geometry comes from a pure function, so the server and client agree and
 *   the drawing is identical for identical inputs.
 */

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { Shuffle } from "lucide-react";

import { DURATION, EASE } from "@/lib/motion";
import {
  LAYOUT_LABEL,
  PLAN_VIEW_H,
  PLAN_VIEW_W,
  buildFloorPlan,
  type PlanInput,
  type PlanRoom,
  type RoomKind,
} from "@/lib/floorplan";

const INK = "#2F99DA";

/** Fill tint per room type — enough to group them, not to colour-code. */
const ROOM_FILL: Record<RoomKind, string> = {
  living: "rgba(47,153,218,0.10)",
  dining: "rgba(47,153,218,0.08)",
  kitchen: "rgba(61,174,145,0.09)",
  utility: "rgba(61,174,145,0.06)",
  study: "rgba(47,153,218,0.06)",
  bed: "rgba(47,153,218,0.05)",
  bath: "rgba(145,162,172,0.07)",
  // Circulation reads as unoccupied floor, not as a room. Deliberately not
  // brass: that is the primary action's colour and nothing else's.
  hall: "rgba(145,162,172,0.04)",
};

/** Below this, a room is too small to letter without it turning to soup. */
const LABEL_MIN_W = 42;
const LABEL_MIN_H = 24;
/** Area is only worth printing when there is space for a second line. */
const AREA_MIN_H = 38;
/** The hall is a corridor; it is narrow by definition. */
const HALL_LABEL_MIN_H = 12;

export function FloorPlanSchematic({ draft }: { draft: PlanInput }) {
  const reduced = useReducedMotion();
  /*
   * The plan is seeded from the property, so the same home always draws the
   * same layout. This counter adds a second axis: an architect would produce
   * options for one brief, and pressing shuffle walks through them.
   */
  const [shuffle, setShuffle] = useState(0);
  const plan = buildFloorPlan(draft, shuffle);

  const move: Transition = reduced ? { duration: 0 } : { duration: DURATION.base, ease: EASE.out };
  const fade: Transition = reduced ? { duration: 0 } : { duration: DURATION.quick, ease: EASE.out };

  const bedrooms = plan.rooms.filter((r) => r.kind === "bed").length;
  const upperOffsets = Array.from({ length: Math.max(0, plan.floors - 1) }, (_, i) => (i + 1) * 9);

  return (
    <div className="card-surface gradient-top-border p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Schematic</h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {plan.widthFeet}&prime; &times; {plan.depthFeet}&prime;
          </span>
          <button
            type="button"
            onClick={() => setShuffle((n) => n + 1)}
            title="Draw an alternative layout for the same property"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#28363E] px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-[#2F99DA] hover:text-foreground btn-press"
          >
            <motion.span
              key={shuffle}
              initial={reduced ? false : { rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE.out }}
              className="inline-flex"
            >
              <Shuffle size={12} />
            </motion.span>
            Shuffle
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        <span className="text-foreground">{LAYOUT_LABEL[plan.layout]}</span> — one indicative
        arrangement of this brief, not a survey. Shuffle for an alternative.
      </p>

      <svg
        viewBox={`0 0 ${PLAN_VIEW_W} ${PLAN_VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={
          `Schematic floor plan: ${plan.perFloorSqft} square feet per floor, ` +
          `${plan.floors} ${plan.floors === 1 ? "storey" : "storeys"}, ${bedrooms} bedrooms`
        }
      >
        <defs>
          <pattern
            id="water-hatch"
            width="8"
            height="8"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={INK} strokeWidth="1" opacity="0.22" />
          </pattern>
        </defs>

        {/* Upper storeys, furthest back. */}
        {upperOffsets.map((offset) => (
          <motion.rect
            key={`upper-${offset}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{
              opacity: 0.26,
              x: plan.x - offset,
              y: plan.y - offset,
              width: plan.width,
              height: plan.height,
            }}
            transition={move}
            fill="none"
            stroke={INK}
            strokeWidth={0.9}
            strokeDasharray="5 5"
          />
        ))}

        {/* Basement, as a dashed underlay offset below the ground floor. */}
        {plan.basementSqft > 0 && (
          <motion.g
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 0.38, x: plan.x + 10, y: plan.y + 10 }}
            transition={move}
          >
            <motion.rect
              animate={{ width: plan.width, height: plan.height }}
              transition={move}
              fill="none"
              stroke={INK}
              strokeWidth={0.8}
              strokeDasharray="3 4"
            />
          </motion.g>
        )}

        {/* Rooms. */}
        <AnimatePresence>
          {plan.rooms.map((room) => (
            <RoomCell key={room.id} room={room} move={move} reduced={!!reduced} />
          ))}
        </AnimatePresence>

        {/* Fixtures: sanitary ware, the kitchen run, the stair. */}
        <AnimatePresence>
          {plan.fixtures.map((fixture) => (
            <motion.path
              key={fixture.id}
              d={fixture.d}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              fill={fixture.filled ? "rgba(47,153,218,0.14)" : "none"}
              stroke={INK}
              strokeWidth={0.8}
              strokeOpacity={0.5}
            />
          ))}
        </AnimatePresence>

        {/* Exterior wall, over the partitions so it reads heaviest. */}
        <motion.g animate={{ x: plan.x, y: plan.y }} transition={move}>
          <motion.rect
            animate={{ width: plan.width, height: plan.height }}
            transition={move}
            fill="none"
            stroke={INK}
            strokeWidth={plan.strokeWidth * 2}
            opacity={0.75}
          />
        </motion.g>

        {/* Glazing, as the doubled line used in plan. */}
        <AnimatePresence>
          {plan.windows.map((win) => (
            <motion.g
              key={win.id}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 0.85 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <path d={win.outer} stroke="#EDF1F2" strokeWidth={1.1} fill="none" />
              <path d={win.inner} stroke="#EDF1F2" strokeWidth={1.1} fill="none" />
            </motion.g>
          ))}
        </AnimatePresence>

        {/* Door swings — the detail that makes it read as architecture. */}
        <AnimatePresence>
          {plan.doors.map((door) => (
            <motion.g
              key={door.id}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <path
                d={door.leaf}
                stroke="#EDF1F2"
                strokeWidth={1}
                strokeOpacity={0.6}
                fill="none"
              />
              <path
                d={door.arc}
                stroke="#EDF1F2"
                strokeWidth={0.8}
                strokeOpacity={0.34}
                fill="none"
              />
            </motion.g>
          ))}
        </AnimatePresence>

        {/* Shoreline along the foot of the site. */}
        <AnimatePresence>
          {plan.waterfront && (
            <motion.g
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <rect
                x={0}
                y={PLAN_VIEW_H - 26}
                width={PLAN_VIEW_W}
                height={26}
                fill="url(#water-hatch)"
              />
              <path
                d={`M0 ${PLAN_VIEW_H - 26} H${PLAN_VIEW_W}`}
                stroke={INK}
                strokeWidth={1.4}
                opacity={0.5}
                fill="none"
              />
              <text
                x={10}
                y={PLAN_VIEW_H - 9}
                fill={INK}
                opacity={0.6}
                style={{ fontSize: 9, letterSpacing: "0.14em" }}
              >
                WATERFRONT
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Entry, called out because a plan without one reads as a diagram. */}
        <motion.g animate={{ x: plan.entry.x, y: plan.entry.y }} transition={move}>
          <text
            x={-9}
            y={3}
            textAnchor="end"
            fill="#D0A74E"
            style={{ fontSize: 8, letterSpacing: "0.14em", fontWeight: 600 }}
          >
            ENTRY
          </text>
        </motion.g>

        {/* Overall dimension string across the foot of the footprint. */}
        <motion.g animate={{ x: plan.x, y: plan.y + plan.height + 20 }} transition={move}>
          <motion.path
            animate={{ d: `M0 0 H${plan.width}` }}
            transition={move}
            stroke={INK}
            strokeWidth={0.8}
            opacity={0.4}
            fill="none"
          />
          <path d="M-4 4 L4 -4" stroke={INK} strokeWidth={1} opacity={0.55} fill="none" />
          <motion.path
            animate={{ d: `M${plan.width - 4} 4 L${plan.width + 4} -4` }}
            transition={move}
            stroke={INK}
            strokeWidth={1}
            opacity={0.55}
            fill="none"
          />
          <motion.text
            animate={{ x: plan.width / 2 }}
            transition={move}
            y={-5}
            textAnchor="middle"
            fill={INK}
            opacity={0.62}
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
          >
            {plan.widthFeet}&prime;-0&Prime;
          </motion.text>
        </motion.g>
      </svg>

      {/* Title block, as a drawing sheet carries. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[#28363E] pt-3 sm:grid-cols-4">
        <TitleBlockItem label="Floor area" value={`${plan.perFloorSqft.toLocaleString()} sf`} />
        <TitleBlockItem label="Storeys" value={String(plan.floors)} />
        <TitleBlockItem
          label="Basement"
          value={plan.basementSqft > 0 ? `${plan.basementSqft.toLocaleString()} sf` : "None"}
        />
        <TitleBlockItem label="Grade" value={String(draft.grade)} />
      </dl>
    </div>
  );
}

function RoomCell({ room, move, reduced }: { room: PlanRoom; move: Transition; reduced: boolean }) {
  // A corridor is realistically narrow, so the hall would never clear the
  // threshold the rooms use — and it is the element the whole plan is
  // organised around, so it earns a lower bar rather than going unnamed.
  const minHeight = room.kind === "hall" ? HALL_LABEL_MIN_H : LABEL_MIN_H;
  const showLabel = room.w >= LABEL_MIN_W && room.h >= minHeight;
  // Circulation is labelled but never dimensioned; nobody quotes hall area.
  const showArea = showLabel && room.h >= AREA_MIN_H && room.kind !== "hall";

  return (
    <>
      <motion.g
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1, x: room.x, y: room.y }}
        exit={{ opacity: 0 }}
        transition={move}
      >
        <motion.rect
          animate={{ width: room.w, height: room.h }}
          transition={move}
          fill={ROOM_FILL[room.kind]}
          stroke={INK}
          strokeWidth={0.9}
          strokeOpacity={0.45}
        />
      </motion.g>

      {showLabel && (
        <motion.g
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1, x: room.x + room.w / 2, y: room.y + room.h / 2 }}
          exit={{ opacity: 0 }}
          transition={move}
        >
          <text
            textAnchor="middle"
            y={showArea ? -3 : 3}
            fill="#EDF1F2"
            opacity={room.kind === "hall" ? 0.4 : 0.62}
            style={{ fontSize: 9, letterSpacing: "0.1em" }}
          >
            {room.label}
          </text>
          {showArea && (
            <text
              textAnchor="middle"
              y={10}
              fill={INK}
              opacity={0.55}
              style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
            >
              {room.sqft} sf
            </text>
          )}
        </motion.g>
      )}
    </>
  );
}

function TitleBlockItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
