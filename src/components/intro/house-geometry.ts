/**
 * A small isometric house — a massing sketch, not a floor plan.
 *
 * Three iterations preceded this one. A pitched gable roof projected as a
 * blade that read as a wing rather than a roof, because its ridge — receding
 * on the depth axis — shifts hard up-and-left under isometric projection and
 * ends up sharing an edge with the wall top instead of sitting visibly above
 * it. Swapping to a hip roof (four slopes meeting at one apex) fixed the
 * "wing" problem but introduced a new one: with the apex rising directly off
 * the wall-top edge, the roof triangle scaled to match the wall's whole
 * diagonal span and dwarfed the building beneath it, at every wall-height and
 * pitch this shape was tried at.
 *
 * What actually reads as a house at this scale is a flat, overhanging roof
 * slab — a massing-study convention architects use for a reason: it has no
 * apex to fight the projection, no ridge to skew, and the overhang alone is
 * enough to separate "roof" from "wall" at a glance. It also suits this
 * site's tone better than a pitched cottage would.
 *
 * Isometric projection, Z up:
 *   screenX = (X - Y) * cos(30°)
 *   screenY = (X + Y) * sin(30°) - Z
 *
 * Every path below is computed from that projection at module load, the same
 * approach `wordmark-geometry.ts` and `floorplan.ts` use, so the geometry is
 * one set of numbers rather than something hand-transcribed into markup.
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

// ---- footprint, in iso units --------------------------------------------
const W = 120;
const D = 76;
const H = 24; // wall height
const THICK = 7; // roof slab thickness
const OH = 9; // eave overhang, beyond the wall footprint on every side

const A: Point3 = [0, 0, 0];
const B: Point3 = [W, 0, 0];
const C: Point3 = [W, D, 0];
const DP: Point3 = [0, D, 0];
const A2: Point3 = [0, 0, H];
const B2: Point3 = [W, 0, H];
const C2: Point3 = [W, D, H];
const D2: Point3 = [0, D, H];

const RA: Point3 = [-OH, -OH, H];
const RB: Point3 = [W + OH, -OH, H];
const RC: Point3 = [W + OH, D + OH, H];
const RD: Point3 = [-OH, D + OH, H];
const RA2: Point3 = [-OH, -OH, H + THICK];
const RB2: Point3 = [W + OH, -OH, H + THICK];
const RC2: Point3 = [W + OH, D + OH, H + THICK];
const RD2: Point3 = [-OH, D + OH, H + THICK];

export type FaceTone =
  | "wall-front"
  | "wall-side"
  | "roof-top"
  | "roof-fascia-front"
  | "roof-fascia-side";

export interface HouseFace {
  id: string;
  d: string;
  tone: FaceTone;
}

/** Solid faces, drawn back to front — later entries paint over earlier ones. */
export const HOUSE_FACES: HouseFace[] = [
  { id: "wall-front", d: polygon([A, B, B2, A2]), tone: "wall-front" },
  { id: "wall-side", d: polygon([B, C, C2, B2]), tone: "wall-side" },
  { id: "roof-top", d: polygon([RA2, RB2, RC2, RD2]), tone: "roof-top" },
  { id: "roof-fascia-front", d: polygon([RA, RB, RB2, RA2]), tone: "roof-fascia-front" },
  { id: "roof-fascia-side", d: polygon([RB, RC, RC2, RB2]), tone: "roof-fascia-side" },
];

/** Edges that suggest the far side of the volume, struck as dashed lines. */
export const HOUSE_HIDDEN: string[] = [
  polyline([DP, D2]),
  polyline([D2, C2]),
  polyline([RD, RD2]),
  polyline([RC, RC2]),
  polyline([RD, RC]),
];

/** Door and window, drawn as open outlines on their wall faces. */
const doorX0 = W * 0.24;
const doorW = W * 0.15;
const doorH = H * 0.6;
const winY0 = D * 0.3;
const winW = D * 0.26;
const winH = H * 0.3;
const winZ = H * 0.34;

export const HOUSE_DETAILS: string[] = [
  polygon([
    [doorX0, 0, 0],
    [doorX0 + doorW, 0, 0],
    [doorX0 + doorW, 0, doorH],
    [doorX0, 0, doorH],
  ]),
  polygon([
    [W, winY0, winZ],
    [W, winY0 + winW, winZ],
    [W, winY0 + winW, winZ + winH],
    [W, winY0, winZ + winH],
  ]),
];

// ---- bounding box, for centring and scaling the composed drawing --------
const allPoints = [A, B, C, DP, A2, B2, C2, D2, RA, RB, RC, RD, RA2, RB2, RC2, RD2];
const projected = allPoints.map(project);
const xs = projected.map((p) => p[0]);
const ys = projected.map((p) => p[1]);

export const HOUSE_MIN_X = Math.min(...xs);
export const HOUSE_MIN_Y = Math.min(...ys);
export const HOUSE_WIDTH = Math.max(...xs) - HOUSE_MIN_X;
export const HOUSE_HEIGHT = Math.max(...ys) - HOUSE_MIN_Y;
