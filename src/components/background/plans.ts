/**
 * Architectural geometry for the blueprint background.
 *
 * Hand-authored rather than generated: procedural floor plans read as noise,
 * and what makes a drawing legible as *architectural* is the conventions —
 * door swings as quarter arcs, doubled window lines, dashed setbacks,
 * dimension strings with slash ticks. Those don't survive randomisation.
 *
 * Coordinates are absolute within a 1440x900 canvas that covers the viewport.
 * Plans are deliberately oversized and anchored so they bleed past the edges:
 * a viewport showing part of a large drawing reads as draughting, whereas
 * small complete drawings floating in space read as clip art.
 */

export interface Dimension {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  /** Perpendicular distance from the measured edge to the dimension line. */
  offset: number;
}

export interface FloorPlan {
  id: string;
  /** Placement within the 1440x900 canvas. */
  x: number;
  y: number;
  scale: number;
  /**
   * Parallax depth, 0-1. Higher moves further, reading as nearer the viewer.
   */
  depth: number;
  /** Exterior walls — heaviest stroke. */
  walls: string[];
  /** Interior partitions — lighter stroke. */
  partitions: string[];
  /** Door swings: leaf line plus its arc. */
  doors: string[];
  /** Windows, stairs, structural columns, site features. */
  fixtures: string[];
  /** Dashed construction lines: setbacks, structural grids, centre lines. */
  guides: string[];
  dims: Dimension[];
}

export const FLOOR_PLANS: FloorPlan[] = [
  {
    // Detached residence. Bleeds off the left edge.
    id: "residence-a",
    x: -120,
    y: 30,
    scale: 3.3,
    depth: 0.62,
    walls: ["M0 0 H140 V96 H0 Z"],
    partitions: ["M84 0 V96", "M84 54 H140"],
    doors: [
      // Hinged at (84,34), swinging into the left room.
      "M84 34 L70 34",
      "M70 34 A14 14 0 0 1 84 20",
      // Hinged at (114,54), swinging up into the right room.
      "M114 54 L114 40",
      "M114 40 A14 14 0 0 0 100 54",
    ],
    fixtures: [
      // Window: the doubled line that reads as glazing in plan.
      "M30 -2 H62",
      "M30 2 H62",
      // Stair run with a direction line.
      "M8 62 H46",
      "M8 70 H46",
      "M8 78 H46",
      "M8 86 H46",
      "M27 62 V90",
    ],
    // Structural grid, as a drawing would carry.
    guides: ["M84 -22 V118", "M-22 54 H162"],
    dims: [
      { x1: 0, y1: 96, x2: 140, y2: 96, label: "46'-0\"", offset: 26 },
      { x1: 140, y1: 0, x2: 140, y2: 96, label: "32'-0\"", offset: 26 },
    ],
  },
  {
    // L-shaped plan. Bleeds off the top-right corner.
    id: "residence-b",
    x: 1085,
    y: -80,
    scale: 2.7,
    depth: 0.92,
    walls: ["M0 0 H150 V64 H86 V110 H0 Z"],
    partitions: ["M86 0 V64", "M0 44 H86"],
    doors: [
      "M86 26 L72 26",
      "M72 26 A14 14 0 0 1 86 12",
      "M42 44 L42 58",
      "M42 58 A14 14 0 0 0 28 44",
    ],
    fixtures: ["M104 -2 H136", "M104 2 H136", "M-2 74 V100", "M2 74 V100"],
    guides: ["M86 -20 V130"],
    dims: [
      { x1: 0, y1: 110, x2: 86, y2: 110, label: "28'-6\"", offset: 24 },
      { x1: 150, y1: 0, x2: 150, y2: 64, label: "21'-0\"", offset: 24 },
    ],
  },
  {
    // Compact unit, furthest back so it drifts least. Bleeds off the right.
    id: "unit-c",
    x: 1290,
    y: 580,
    scale: 2.3,
    depth: 0.44,
    walls: ["M0 0 H96 V72 H0 Z"],
    partitions: ["M56 0 V72"],
    doors: ["M56 46 L44 46", "M44 46 A12 12 0 0 1 56 34"],
    fixtures: ["M14 -2 H38", "M14 2 H38"],
    guides: [],
    dims: [{ x1: 0, y1: 72, x2: 96, y2: 72, label: "31'-6\"", offset: 20 }],
  },
  {
    // Building section rather than a plan — varies the visual rhythm.
    // Bleeds off the bottom-left.
    id: "section-d",
    x: -90,
    y: 605,
    scale: 3.1,
    depth: 0.76,
    walls: ["M0 0 H132 V96 H0 Z"],
    partitions: ["M0 32 H132", "M0 64 H132"],
    doors: [],
    fixtures: [
      // Structural columns.
      "M44 0 V96",
      "M88 0 V96",
      // Grade hatching below the section cut.
      "M0 96 L-8 106",
      "M22 96 L14 106",
      "M44 96 L36 106",
      "M66 96 L58 106",
      "M88 96 L80 106",
      "M110 96 L102 106",
      "M132 96 L124 106",
    ],
    guides: [],
    dims: [{ x1: 132, y1: 0, x2: 132, y2: 96, label: "3 STY", offset: 22 }],
  },
  {
    // Site plan: property boundary, setback, footprint and a north arrow.
    // The compass is what makes this read as a site drawing at a glance.
    id: "site-e",
    x: 640,
    y: 648,
    scale: 1.9,
    depth: 0.55,
    walls: ["M0 0 H280 V160 H0 Z"],
    partitions: [],
    doors: [],
    fixtures: [
      // Building footprint within the setback.
      "M92 54 H188 V116 H92 Z",
      // Driveway running out to the street edge.
      "M188 84 H280",
      // North arrow.
      "M248 -34 L256 -4 L248 -11 L240 -4 Z",
      "M248 -34 V-11",
    ],
    // Required setback line, dashed as a construction line.
    guides: ["M20 20 H260 V140 H20 Z"],
    dims: [{ x1: 0, y1: 160, x2: 280, y2: 160, label: "120'-0\"", offset: 26 }],
  },
];

export interface DimensionGeometry {
  /** Extension lines running from the measured edge out to the dimension line. */
  extensions: string;
  /** The dimension line itself. */
  line: string;
  /** Slash ticks at each end — the architectural convention, not arrowheads. */
  ticks: string;
  labelX: number;
  labelY: number;
  /** Vertical dimensions read bottom-to-top, as on a real drawing. */
  rotate: number;
}

/**
 * Expand a dimension into drawable geometry.
 *
 * Handles the horizontal and vertical cases only; the plans above contain no
 * angled dimensions, and supporting them would add trigonometry for nothing.
 */
export function buildDimension(dim: Dimension): DimensionGeometry {
  const TICK = 4;
  const GAP = 4;
  const isHorizontal = dim.y1 === dim.y2;

  if (isHorizontal) {
    const y = dim.y1 + dim.offset;
    return {
      extensions: `M${dim.x1} ${dim.y1 + GAP} V${y + GAP} M${dim.x2} ${dim.y1 + GAP} V${y + GAP}`,
      line: `M${dim.x1} ${y} H${dim.x2}`,
      ticks:
        `M${dim.x1 - TICK} ${y + TICK} L${dim.x1 + TICK} ${y - TICK} ` +
        `M${dim.x2 - TICK} ${y + TICK} L${dim.x2 + TICK} ${y - TICK}`,
      labelX: (dim.x1 + dim.x2) / 2,
      labelY: y - 6,
      rotate: 0,
    };
  }

  const x = dim.x1 + dim.offset;
  return {
    extensions: `M${dim.x1 + GAP} ${dim.y1} H${x + GAP} M${dim.x1 + GAP} ${dim.y2} H${x + GAP}`,
    line: `M${x} ${dim.y1} V${dim.y2}`,
    ticks:
      `M${x - TICK} ${dim.y1 + TICK} L${x + TICK} ${dim.y1 - TICK} ` +
      `M${x - TICK} ${dim.y2 + TICK} L${x + TICK} ${dim.y2 - TICK}`,
    labelX: x - 6,
    labelY: (dim.y1 + dim.y2) / 2,
    rotate: -90,
  };
}
