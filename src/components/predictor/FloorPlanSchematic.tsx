/**
 * A live blueprint of the property being priced.
 *
 * Every control in the form reshapes this drawing: the footprint scales with
 * square footage, partitions redistribute as rooms are added, an upper storey
 * offsets in, the basement appears as a dashed underlay, and waterfront draws
 * a shoreline. It gives the numbers a shape, so the form reads as configuring
 * a house rather than filling in a spreadsheet.
 *
 * Two implementation notes:
 *
 * - Rooms are positioned by animating a wrapping `<g>`, never the `<rect>`'s
 *   own `x`/`y`. On SVG children Framer treats `x`/`y` as transforms, which
 *   silently fights the attributes of the same name.
 * - Geometry comes from a pure function, so the server and client agree and
 *   the drawing is identical for identical inputs.
 */

import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";

import { DURATION, EASE } from "@/lib/motion";
import {
  PLAN_VIEW_H,
  PLAN_VIEW_W,
  buildFloorPlan,
  type PlanInput,
  type PlacedRoom,
  type RoomKind,
} from "@/lib/floorplan";

const STROKE = "#3B82F6";

/** Fill tint per room type — enough to group them, not to colour-code. */
const ROOM_FILL: Record<RoomKind, string> = {
  living: "rgba(59,130,246,0.10)",
  kitchen: "rgba(16,185,129,0.09)",
  bed: "rgba(59,130,246,0.05)",
  bath: "rgba(148,163,184,0.07)",
};

/** Below this, a room is too small to letter without it turning to soup. */
const LABEL_MIN_W = 44;
const LABEL_MIN_H = 26;
/** Room area is only worth printing when there is room for a second line. */
const AREA_MIN_H = 40;

export function FloorPlanSchematic({ draft }: { draft: PlanInput }) {
  const reduced = useReducedMotion();
  const plan = buildFloorPlan(draft);

  const move: Transition = reduced ? { duration: 0 } : { duration: DURATION.base, ease: EASE.out };

  // Upper storeys are hinted as an offset outline behind the plan.
  const upperOffsets = Array.from({ length: Math.max(0, plan.floors - 1) }, (_, i) => (i + 1) * 9);

  return (
    <div className="card-surface gradient-top-border p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Schematic</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {plan.widthFeet}&prime; &times; {plan.depthFeet}&prime; per floor
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        An indicative plan generated from the values on the left. Not a survey.
      </p>

      <svg
        viewBox={`0 0 ${PLAN_VIEW_W} ${PLAN_VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={
          `Schematic floor plan: ${plan.perFloorSqft} square feet per floor, ` +
          `${plan.floors} ${plan.floors === 1 ? "storey" : "storeys"}, ` +
          `${plan.rooms.filter((r) => r.kind === "bed").length} bedrooms`
        }
      >
        <defs>
          {/* Hatching for the water body, at 45 degrees as on a site plan. */}
          <pattern
            id="water-hatch"
            width="8"
            height="8"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={STROKE} strokeWidth="1" opacity="0.22" />
          </pattern>
        </defs>

        {/* Upper storeys, furthest back. */}
        {upperOffsets.map((offset) => (
          <motion.rect
            key={`upper-${offset}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{
              opacity: 0.28,
              x: plan.x - offset,
              y: plan.y - offset,
              width: plan.width,
              height: plan.height,
            }}
            exit={{ opacity: 0 }}
            transition={move}
            fill="none"
            stroke={STROKE}
            strokeWidth={0.9}
            strokeDasharray="5 5"
          />
        ))}

        {/* Basement, as a dashed underlay offset below the ground floor. */}
        {plan.basementSqft > 0 && (
          <motion.g
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 0.4, x: plan.x + 10, y: plan.y + 10 }}
            transition={move}
          >
            <motion.rect
              animate={{ width: plan.width, height: plan.height }}
              transition={move}
              fill="none"
              stroke={STROKE}
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

        {/* Exterior wall, drawn over the partitions so it reads heaviest. */}
        <motion.g animate={{ x: plan.x, y: plan.y }} transition={move}>
          <motion.rect
            animate={{ width: plan.width, height: plan.height }}
            transition={move}
            fill="none"
            stroke={STROKE}
            strokeWidth={plan.strokeWidth * 2}
            opacity={0.75}
          />
        </motion.g>

        {/* Shoreline along the foot of the site. */}
        <AnimatePresence>
          {plan.waterfront && (
            <motion.g
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={move}
            >
              <rect
                x={0}
                y={PLAN_VIEW_H - 30}
                width={PLAN_VIEW_W}
                height={30}
                fill="url(#water-hatch)"
              />
              <path
                d={`M0 ${PLAN_VIEW_H - 30} H${PLAN_VIEW_W}`}
                stroke={STROKE}
                strokeWidth={1.4}
                opacity={0.5}
                fill="none"
              />
              <text
                x={10}
                y={PLAN_VIEW_H - 12}
                fill={STROKE}
                opacity={0.6}
                style={{ fontSize: 9, letterSpacing: "0.14em" }}
              >
                WATERFRONT
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Overall dimension string across the foot of the footprint. */}
        <motion.g animate={{ x: plan.x, y: plan.y + plan.height + 18 }} transition={move}>
          <motion.path
            animate={{ d: `M0 0 H${plan.width}` }}
            transition={move}
            stroke={STROKE}
            strokeWidth={0.8}
            opacity={0.4}
            fill="none"
          />
          <path d="M-4 4 L4 -4" stroke={STROKE} strokeWidth={1} opacity={0.55} fill="none" />
          <motion.path
            animate={{ d: `M${plan.width - 4} 4 L${plan.width + 4} -4` }}
            transition={move}
            stroke={STROKE}
            strokeWidth={1}
            opacity={0.55}
            fill="none"
          />
          <motion.text
            animate={{ x: plan.width / 2 }}
            transition={move}
            y={-5}
            textAnchor="middle"
            fill={STROKE}
            opacity={0.62}
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
          >
            {plan.widthFeet}&prime;-0&Prime;
          </motion.text>
        </motion.g>
      </svg>

      {/* Title block, as a drawing sheet carries. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[#1E2D4A] pt-3 sm:grid-cols-4">
        <TitleBlockItem label="Floor area" value={`${plan.perFloorSqft.toLocaleString()} sf`} />
        <TitleBlockItem label="Storeys" value={plan.floors === 1 ? "1" : String(plan.floors)} />
        <TitleBlockItem
          label="Basement"
          value={plan.basementSqft > 0 ? `${plan.basementSqft.toLocaleString()} sf` : "None"}
        />
        <TitleBlockItem label="Grade" value={String(draft.grade)} />
      </dl>
    </div>
  );
}

function RoomCell({
  room,
  move,
  reduced,
}: {
  room: PlacedRoom;
  move: Transition;
  reduced: boolean;
}) {
  const showLabel = room.w >= LABEL_MIN_W && room.h >= LABEL_MIN_H;
  const showArea = showLabel && room.h >= AREA_MIN_H;

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
          stroke={STROKE}
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
            fill="#F1F5F9"
            opacity={0.62}
            style={{ fontSize: 9, letterSpacing: "0.1em" }}
          >
            {room.label}
          </text>
          {showArea && (
            <text
              textAnchor="middle"
              y={10}
              fill={STROKE}
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
