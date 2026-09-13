/**
 * A small isometric house — a massing sketch, not a floor plan.
 *
 * Earlier passes tried a pitched roof whose ridge ran on the depth axis. Under
 * isometric projection a ridge on that axis shifts hard up-and-left and ends
 * up sharing an edge with the wall top instead of sitting visibly above it, so
 * the roof read as a blade rather than a roof. A hip roof fixed that but its
 * apex, rising off the wall-top edge, scaled to the wall's whole diagonal span
 * and dwarfed the building. A flat slab avoided both problems and read, fairly,
 * as a table.
 *
 * The version that works puts the ridge on the *width* axis, so the gable
 * triangle faces the viewer on the near end wall and the roof's two slopes
 * separate cleanly into a lit near plane and a hidden far one. The rest is
 * the detail that makes a box read as a building at small size: an overhanging
 * eave with a fascia board, a rake board down the gable end, a ridge cap,
 * shingle courses running parallel to the ridge, a chimney, and a plinth for
 * the whole thing to stand on.
 *
 * Isometric projection, Z up:
 *   screenX = (X - Y) * cos(30°)
 *   screenY = (X + Y) * sin(30°) - Z
 *
 * Because X and Y both push screenY downward, the near corner of the volume is
 * (W, D) — which is why the visible walls are the `x = W` and `y = D` faces,
 * and why every "hidden" edge below belongs to `x = 0` or `y = 0`.
 *
 * Every path is computed from that projection at module load, the same way
 * `wordmark-geometry.ts` and `floorplan.ts` work, so the geometry is one set of
 * numbers rather than something hand-transcribed into markup.
 */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

type Point3 = readonly [x: number, y: number, z: number];

function project([x, y, z]: Point3): [number, number] {
  return [(x - y) * COS30, (x + y) * SIN30 - z];
}

/**
 * Round to three decimal places and format without scientific notation.
 *
 * Trig on these inputs occasionally lands a coordinate a hair off zero —
 * `-1.7763568394002505e-15` rather than `0`. JavaScript's default `toString`
 * switches to exponential notation below 1e-6, and SVG's path grammar does
 * not define exponents, so that value would reach the browser as a token a
 * conformant parser is free to reject. Rounding first makes it exactly `0`.
 */
function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

function point(p: Point3): string {
  const [x, y] = project(p);
  return `${fmt(x)} ${fmt(y)}`;
}

function polygon(points: Point3[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${point(p)}`).join(" ") + " Z";
}

function polyline(points: Point3[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${point(p)}`).join(" ");
}

// ---- massing, in iso units ----------------------------------------------
const W = 120; // width, the axis the ridge runs along
const D = 78; // depth
const H = 46; // wall head
const RISE = 30; // ridge above the wall head
const RH = H + RISE;
const OH = 10; // eave and rake overhang, beyond the footprint
const SLOPE = RISE / (D / 2);
const EZ = H - OH * SLOPE; // the eave dips below the wall head, out past the wall
const FASCIA = 4; // depth of the board hung off the eave
const PL = 5; // plinth, wider than the walls on every side
const PZ = -4; // plinth depth below grade level

const XL = -OH;
const XR = W + OH;
const YF = -OH; // far eave, on the hidden side
const YB = D + OH; // near eave, the one facing the viewer

const R0: Point3 = [XL, D / 2, RH];
const R1: Point3 = [XR, D / 2, RH];
const E0: Point3 = [XL, YB, EZ];
const E1: Point3 = [XR, YB, EZ];
const E0b: Point3 = [XL, YB, EZ - FASCIA];
const E1b: Point3 = [XR, YB, EZ - FASCIA];
const F0: Point3 = [XL, YF, EZ];
const F1: Point3 = [XR, YF, EZ];

/** Height of the near roof slope at a given depth. */
function roofZ(y: number): number {
  return RH - (y - D / 2) * SLOPE;
}

export type FaceTone =
  | "plinth-top"
  | "plinth-side"
  | "plinth-gable"
  | "wall-side"
  | "wall-gable"
  | "roof"
  | "fascia"
  | "rake"
  | "ridge"
  | "chimney-top"
  | "chimney-side"
  | "chimney-front";

export interface HouseFace {
  id: string;
  d: string;
  tone: FaceTone;
}

/**
 * Solid faces, back to front — later entries paint over earlier ones. The
 * ridge cap is a thin band folded just over the ridge line, which is what
 * stops the two slopes from meeting in a single hairline and reading flat.
 */
export const HOUSE_FACES: HouseFace[] = [
  {
    id: "plinth-top",
    d: polygon([
      [-PL, -PL, 0],
      [W + PL, -PL, 0],
      [W + PL, D + PL, 0],
      [-PL, D + PL, 0],
    ]),
    tone: "plinth-top",
  },
  {
    id: "plinth-side",
    d: polygon([
      [-PL, D + PL, 0],
      [W + PL, D + PL, 0],
      [W + PL, D + PL, PZ],
      [-PL, D + PL, PZ],
    ]),
    tone: "plinth-side",
  },
  {
    id: "plinth-gable",
    d: polygon([
      [W + PL, -PL, 0],
      [W + PL, D + PL, 0],
      [W + PL, D + PL, PZ],
      [W + PL, -PL, PZ],
    ]),
    tone: "plinth-gable",
  },
  {
    id: "wall-side",
    d: polygon([
      [0, D, 0],
      [W, D, 0],
      [W, D, H],
      [0, D, H],
    ]),
    tone: "wall-side",
  },
  {
    id: "wall-gable",
    d: polygon([
      [W, 0, 0],
      [W, D, 0],
      [W, D, H],
      [W, D / 2, RH],
      [W, 0, H],
    ]),
    tone: "wall-gable",
  },
  { id: "roof", d: polygon([R0, R1, E1, E0]), tone: "roof" },
  { id: "fascia", d: polygon([E0, E1, E1b, E0b]), tone: "fascia" },
  { id: "rake", d: polygon([R1, E1, E1b, [XR, D / 2, RH - FASCIA]]), tone: "rake" },
  {
    id: "ridge",
    d: polygon([
      R0,
      R1,
      [XR, D / 2 + 3.4, roofZ(D / 2 + 3.4) - 2.6],
      [XL, D / 2 + 3.4, roofZ(D / 2 + 3.4) - 2.6],
    ]),
    tone: "ridge",
  },
];

/** Shingle courses, parallel to the ridge, down the visible slope. */
export const HOUSE_COURSES: string[] = [0.28, 0.52, 0.76].map((f) => {
  const y = D / 2 + f * (YB - D / 2);
  return polyline([
    [XL, y, roofZ(y)],
    [XR, y, roofZ(y)],
  ]);
});

/** Painted after the courses, so no course line runs across the stack. */
const cx0 = W * 0.44;
const cx1 = W * 0.58;
const cy0 = D * 0.58;
const cy1 = D * 0.7;
const cTop = RH + 12;

export const HOUSE_CHIMNEY: HouseFace[] = [
  {
    id: "chimney-side",
    d: polygon([
      [cx1, cy0, roofZ(cy0)],
      [cx1, cy1, roofZ(cy1)],
      [cx1, cy1, cTop],
      [cx1, cy0, cTop],
    ]),
    tone: "chimney-side",
  },
  {
    id: "chimney-front",
    d: polygon([
      [cx0, cy1, roofZ(cy1)],
      [cx1, cy1, roofZ(cy1)],
      [cx1, cy1, cTop],
      [cx0, cy1, cTop],
    ]),
    tone: "chimney-front",
  },
  {
    id: "chimney-top",
    d: polygon([
      [cx0, cy0, cTop],
      [cx1, cy0, cTop],
      [cx1, cy1, cTop],
      [cx0, cy1, cTop],
    ]),
    tone: "chimney-top",
  },
];

/** Edges on the far side of the volume, struck as dashed lines. */
export const HOUSE_HIDDEN: string[] = [
  polyline([
    [0, 0, 0],
    [W, 0, 0],
  ]),
  polyline([
    [0, 0, 0],
    [0, D, 0],
  ]),
  polyline([
    [0, 0, 0],
    [0, 0, H],
  ]),
  polyline([R0, F0]),
  polyline([F0, F1]),
  polyline([R0, E0]),
];

/** Door and windows, drawn as open outlines on their wall faces. */
export const HOUSE_DETAILS: string[] = [
  polygon([
    [W, D * 0.3, 0],
    [W, D * 0.48, 0],
    [W, D * 0.48, H * 0.6],
    [W, D * 0.3, H * 0.6],
  ]),
  polygon([
    [W, D * 0.62, H * 0.3],
    [W, D * 0.8, H * 0.3],
    [W, D * 0.8, H * 0.62],
    [W, D * 0.62, H * 0.62],
  ]),
  polygon([
    [W * 0.18, D, H * 0.3],
    [W * 0.38, D, H * 0.3],
    [W * 0.38, D, H * 0.62],
    [W * 0.18, D, H * 0.62],
  ]),
  polygon([
    [W * 0.55, D, H * 0.3],
    [W * 0.75, D, H * 0.3],
    [W * 0.75, D, H * 0.62],
    [W * 0.55, D, H * 0.62],
  ]),
];

// ---- bounding box, for centring and scaling the composed drawing --------
const extent: Point3[] = [
  [-PL, -PL, PZ],
  [W + PL, -PL, PZ],
  [W + PL, D + PL, PZ],
  [-PL, D + PL, PZ],
  R0,
  R1,
  E0,
  E1,
  E0b,
  E1b,
  F0,
  F1,
  [cx0, cy0, cTop],
  [cx1, cy1, cTop],
];
const projected = extent.map(project);
const xs = projected.map((p) => p[0]);
const ys = projected.map((p) => p[1]);

export const HOUSE_MIN_X = Math.min(...xs);
export const HOUSE_MIN_Y = Math.min(...ys);
export const HOUSE_WIDTH = Math.max(...xs) - HOUSE_MIN_X;
export const HOUSE_HEIGHT = Math.max(...ys) - HOUSE_MIN_Y;
