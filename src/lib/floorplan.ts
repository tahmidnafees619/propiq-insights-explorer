/**
 * Derives a plausible flat plan from the attributes the predictor collects.
 *
 * Two earlier versions failed in opposite directions. A treemap tiled the
 * footprint perfectly and looked nothing like a home — bathrooms between
 * bedrooms, no circulation, nothing opening off anything. Replacing it with a
 * single corridor template fixed that but produced one rigid plan that only
 * ever grew more columns.
 *
 * This generates a plan from rules instead of from a template:
 *
 *   1. The room programme grows with floor area. A 6,000 sf house has a
 *      dining room, a study and a utility — not six narrow bedrooms.
 *   2. Circulation changes with size. Small flats have no hall at all; you
 *      enter the living room. Large ones get a double-loaded corridor.
 *   3. Bathrooms are allocated, not just counted. A half bath is a guest WC in
 *      the public zone. Ensuites attach to bedrooms and are drawn smaller than
 *      a shared family bathroom — except at high grade, where the primary
 *      suite becomes the largest bathroom in the house, as it does in life.
 *   4. Everything else is chosen by a seed derived from the inputs, so the
 *      same property always draws the same plan, and a different property
 *      genuinely re-plans rather than re-scaling.
 *
 * Every generated plan is checked against `validatePlan` invariants: rooms may
 * not overlap, must sit inside the footprint, and habitable rooms must reach
 * an exterior wall for a window.
 */

import type { PredictionInput } from "@/types";

export interface PlanInput {
  sqftLiving: number;
  sqftBasement: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  grade: number;
  waterfront: boolean;
}

export type RoomKind =
  | "living"
  | "dining"
  | "kitchen"
  | "bed"
  | "bath"
  | "hall"
  | "study"
  | "utility";

export interface PlanRoom {
  id: string;
  label: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  sqft: number;
}

export interface PlanDoor {
  id: string;
  leaf: string;
  arc: string;
}

export interface PlanWindow {
  id: string;
  outer: string;
  inner: string;
}

export interface PlanFixture {
  id: string;
  d: string;
  filled: boolean;
}

/** Which of the three plan types was generated, for the caption. */
export type LayoutFamily = "open" | "corridor" | "double-loaded";

export interface FloorPlanModel {
  x: number;
  y: number;
  width: number;
  height: number;
  rooms: PlanRoom[];
  doors: PlanDoor[];
  windows: PlanWindow[];
  fixtures: PlanFixture[];
  entry: { x: number; y: number; side: "left" | "right" | "bottom" };
  layout: LayoutFamily;
  widthFeet: number;
  depthFeet: number;
  perFloorSqft: number;
  floors: number;
  basementSqft: number;
  waterfront: boolean;
  strokeWidth: number;
}

export const PLAN_VIEW_W = 460;
export const PLAN_VIEW_H = 380;

const REFERENCE_SQFT = 2000;
const REFERENCE_AREA = 312 * 215;
const MIN_SCALE = 0.52;
const MAX_SCALE = 1.34;

/** A door is a fixed width in plan, not a share of the wall it sits in. */
const DOOR = 13;

/** Narrower than this is a sliver, not a room; the programme is trimmed. */
const MIN_ROOM_W = 25;

/**
 * Bathroom areas, relative to a shared family bathroom.
 *
 * A shared bath holds a tub, shower, WC and basin. An ensuite trades the tub
 * for floor area it does not have, and a powder room is a WC and a basin.
 */
const BATH_SIZE = {
  shared: 1.0,
  primaryEnsuite: 0.85,
  /** Above this grade the primary suite outgrows the family bathroom. */
  primaryEnsuiteLuxury: 1.15,
  secondEnsuite: 0.62,
  powder: 0.38,
} as const;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- seeding

/** Small, fast, and identical on the server and the client. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(input: PlanInput, shuffle: number): number {
  const parts = [
    Math.round(input.sqftLiving),
    Math.round(input.sqftBasement / 50),
    input.bedrooms,
    Math.round(input.bathrooms * 4),
    Math.round(input.floors * 2),
    input.grade,
    input.waterfront ? 1 : 0,
    shuffle,
  ];
  // FNV-1a: cheap, and spreads small input changes across the whole word.
  let hash = 0x811c9dc5;
  for (const part of parts) {
    hash ^= part & 0xffff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// ------------------------------------------------------------- geometry

function columns(rect: Rect, weights: number[]): Rect[] {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  let cursor = rect.x;
  return weights.map((weight) => {
    const w = (rect.w * weight) / total;
    const out = { x: cursor, y: rect.y, w, h: rect.h };
    cursor += w;
    return out;
  });
}

function rows(rect: Rect, weights: number[]): Rect[] {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  let cursor = rect.y;
  return weights.map((weight) => {
    const h = (rect.h * weight) / total;
    const out = { x: rect.x, y: cursor, w: rect.w, h };
    cursor += h;
    return out;
  });
}

/**
 * A door swing: the leaf, plus the arc it sweeps.
 *
 * `towards` is the direction the leaf opens into the room; `along` is the
 * direction the closed door would lie. Both are needed to pick the arc's sweep
 * flag, and getting it wrong is what makes a swing read backwards.
 */
function door(
  id: string,
  hx: number,
  hy: number,
  wall: "horizontal" | "vertical",
  towards: 1 | -1,
  along: 1 | -1,
): PlanDoor {
  const sweep = towards * along > 0 ? 1 : 0;
  if (wall === "horizontal") {
    return {
      id,
      leaf: `M${hx} ${hy} L${hx} ${hy + DOOR * towards}`,
      arc: `M${hx} ${hy + DOOR * towards} A${DOOR} ${DOOR} 0 0 ${sweep} ${hx + DOOR * along} ${hy}`,
    };
  }
  return {
    id,
    leaf: `M${hx} ${hy} L${hx + DOOR * towards} ${hy}`,
    arc: `M${hx + DOOR * towards} ${hy} A${DOOR} ${DOOR} 0 0 ${sweep ? 0 : 1} ${hx} ${hy + DOOR * along}`,
  };
}

function windowOn(
  id: string,
  cx: number,
  cy: number,
  length: number,
  vertical = false,
): PlanWindow {
  const half = length / 2;
  if (vertical) {
    return {
      id,
      outer: `M${cx - 1.7} ${cy - half} V${cy + half}`,
      inner: `M${cx + 1.7} ${cy - half} V${cy + half}`,
    };
  }
  return {
    id,
    outer: `M${cx - half} ${cy - 1.7} H${cx + half}`,
    inner: `M${cx - half} ${cy + 1.7} H${cx + half}`,
  };
}

// -------------------------------------------------------------- fixtures

function kitchenFixtures(rect: Rect, id = "kitchen"): PlanFixture[] {
  if (rect.w < 30 || rect.h < 30) return [];
  const depth = Math.min(10, rect.h * 0.18);
  const inset = 3.5;
  const runY = rect.y + rect.h - inset - depth;
  const sinkW = Math.min(12, rect.w * 0.2);
  const sinkX = rect.x + rect.w * 0.56;
  return [
    {
      id: `${id}-run`,
      d: `M${rect.x + inset} ${runY} H${rect.x + rect.w - inset} V${runY + depth} H${rect.x + inset} Z`,
      filled: true,
    },
    {
      id: `${id}-sink`,
      d: `M${sinkX} ${runY + 2.2} H${sinkX + sinkW} V${runY + depth - 2.2} H${sinkX} Z`,
      filled: false,
    },
  ];
}

/**
 * Sanitary ware appropriate to the kind of bathroom.
 *
 * Only a shared family bathroom gets a tub; an ensuite gets a shower tray.
 * That difference is most of what distinguishes them at a glance.
 */
function bathFixtures(
  id: string,
  rect: Rect,
  variant: "shared" | "ensuite" | "powder",
): PlanFixture[] {
  if (rect.w < 17 || rect.h < 19) return [];
  const inset = 3.2;
  const out: PlanFixture[] = [];

  const wcW = Math.min(7.5, rect.w * 0.34);
  const wcH = Math.min(10, rect.h * 0.22);
  out.push({
    id: `${id}-wc`,
    d: `M${rect.x + inset} ${rect.y + inset} h${wcW} v${wcH} h${-wcW} Z`,
    filled: true,
  });

  const basinW = Math.min(variant === "powder" ? 8 : 11, rect.w * 0.45);
  const basinH = Math.min(6, rect.h * 0.15);
  out.push({
    id: `${id}-basin`,
    d: `M${rect.x + rect.w - inset - basinW} ${rect.y + inset} h${basinW} v${basinH} h${-basinW} Z`,
    filled: true,
  });

  if (variant !== "powder" && rect.h > 34) {
    const boxW = rect.w - inset * 2;
    const boxH = Math.min(variant === "shared" ? 15 : 12, rect.h * 0.3);
    const boxY = rect.y + rect.h - inset - boxH;
    out.push({
      id: `${id}-${variant === "shared" ? "tub" : "shower"}`,
      d: `M${rect.x + inset} ${boxY} h${boxW} v${boxH} h${-boxW} Z`,
      filled: false,
    });
  }
  return out;
}

function stairFixtures(rect: Rect, vertical: boolean): PlanFixture[] {
  const treads = 6;
  if (vertical) {
    const runH = Math.min(38, rect.h * 0.24);
    if (runH < 18 || rect.w < 14) return [];
    const y0 = rect.y + rect.h - runH - 5;
    const step = runH / treads;
    const parts = [`M${rect.x + 2.5} ${y0} h${rect.w - 5} v${runH} h${-(rect.w - 5)} Z`];
    for (let i = 1; i < treads; i += 1) {
      parts.push(`M${rect.x + 2.5} ${y0 + step * i} H${rect.x + rect.w - 2.5}`);
    }
    return [{ id: "stairs", d: parts.join(" "), filled: false }];
  }
  const runW = Math.min(36, rect.w * 0.2);
  if (runW < 18 || rect.h < 14) return [];
  const x0 = rect.x + rect.w - runW - 5;
  const step = runW / treads;
  const parts = [`M${x0} ${rect.y + 2.5} h${runW} v${rect.h - 5} h${-runW} Z`];
  for (let i = 1; i < treads; i += 1) {
    parts.push(`M${x0 + step * i} ${rect.y + 2.5} V${rect.y + rect.h - 2.5}`);
  }
  return [{ id: "stairs", d: parts.join(" "), filled: false }];
}

// ------------------------------------------------------- bathroom rules

interface BathPlan {
  /** A half bath is a guest WC, and belongs in the public zone. */
  powder: boolean;
  /** Attached to bedrooms, carved from them. */
  ensuites: number;
  /** Family bathrooms, reached from circulation. */
  shared: number;
}

function allocateBathrooms(
  beds: number,
  bathrooms: number,
  grade: number,
  rng: () => number,
): BathPlan {
  const powder = bathrooms % 1 !== 0;
  const full = Math.max(1, Math.min(5, Math.floor(bathrooms)));

  if (full === 1 || beds < 2) return { powder, ensuites: 0, shared: full };

  if (full === 2) {
    // The standard spec is a primary ensuite plus a family bath. Higher-grade
    // builds give the second bedroom its own instead, which is the difference
    // between a family house and a house of suites.
    const bothEnsuite = grade >= 9 || (grade === 8 && rng() > 0.5);
    return bothEnsuite ? { powder, ensuites: 2, shared: 0 } : { powder, ensuites: 1, shared: 1 };
  }

  // Three or more: suite the bedrooms that can take one, keep the rest shared.
  const ensuites = Math.min(full - 1, beds, grade >= 9 ? 3 : 2);
  return { powder, ensuites, shared: full - ensuites };
}

// -------------------------------------------------------- room programme

/** Optional rooms, in the order a growing house acquires them. */
const PROGRAMME: Array<{ kind: RoomKind; label: string; from: number; weight: number }> = [
  { kind: "dining", label: "DINING", from: 1500, weight: 1.05 },
  { kind: "utility", label: "UTILITY", from: 2400, weight: 0.5 },
  { kind: "study", label: "STUDY", from: 2800, weight: 0.85 },
];

/**
 * Optional rooms a house of this size would have — but only as many as the
 * drawing can hold.
 *
 * `budget` is how many rooms the public band can take before each one falls
 * below a usable width. A study drawn as a 20px sliver helps nobody, so the
 * programme is trimmed from the back (study first, dining last) rather than
 * letting the plan turn into a comb.
 */
function programmeFor(perFloorSqft: number, budget: number) {
  const wanted = PROGRAMME.filter((room) => perFloorSqft >= room.from);
  return wanted.slice(0, Math.max(0, budget));
}

// ------------------------------------------------------------- assembly

interface Assembly {
  rooms: PlanRoom[];
  doors: PlanDoor[];
  windows: PlanWindow[];
  fixtures: PlanFixture[];
  entry: { x: number; y: number; side: "left" | "right" | "bottom" };
}

interface BuildContext {
  shell: Rect;
  beds: number;
  baths: BathPlan;
  extras: ReturnType<typeof programmeFor>;
  floors: number;
  grade: number;
  rng: () => number;
  areaOf: (r: Rect) => number;
  /**
   * Independent variant axes, all drawn from the seed.
   *
   * One binary choice gives two plans and reads as a bug when the user presses
   * shuffle twice. Three independent ones give eight, which is enough to feel
   * like the plan is genuinely being reconsidered.
   */
  variant: {
    /** Entry and private zone swap sides. */
    mirror: boolean;
    /** Primary bedroom sits at the outer end rather than beside the hall. */
    primaryOuter: boolean;
    /** Kitchen leads the public band instead of the living room. */
    kitchenFirst: boolean;
  };
}

/** Carve an ensuite from a bedroom's circulation-side corner. */
function carveEnsuite(cell: Rect, share: number, fromRight: boolean): Rect {
  // The share has to drive the *proportion*, not only an absolute cap. Capping
  // alone meant a luxury primary ensuite and a modest one both clamped to the
  // same fraction of the bedroom and came out identical.
  const w = Math.min(cell.w * (0.3 + share * 0.14), 26 + share * 24);
  const h = Math.min(cell.h * (0.3 + share * 0.14), 22 + share * 24);
  return {
    x: fromRight ? cell.x + cell.w - w : cell.x,
    y: cell.y + cell.h - h,
    w,
    h,
  };
}

export function validatePlan(model: FloorPlanModel): string[] {
  const issues: string[] = [];
  const { x, y, width, height } = model;
  const inside = (r: PlanRoom) =>
    r.x >= x - 0.5 &&
    r.y >= y - 0.5 &&
    r.x + r.w <= x + width + 0.5 &&
    r.y + r.h <= y + height + 0.5;

  for (const room of model.rooms) {
    if (!inside(room)) issues.push(`${room.id} outside footprint`);
    if (room.w < 1 || room.h < 1) issues.push(`${room.id} degenerate`);
  }

  // Ensuites sit inside their bedroom by design, so they are exempt.
  const solid = model.rooms.filter((r) => !r.id.startsWith("ensuite"));
  for (let i = 0; i < solid.length; i += 1) {
    for (let j = i + 1; j < solid.length; j += 1) {
      const a = solid[i];
      const b = solid[j];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (overlapX > 1 && overlapY > 1) issues.push(`${a.id} overlaps ${b.id}`);
    }
  }

  const habitable = new Set<RoomKind>(["living", "dining", "bed", "study"]);
  for (const room of model.rooms) {
    if (!habitable.has(room.kind)) continue;
    const touches =
      Math.abs(room.x - x) < 1 ||
      Math.abs(room.y - y) < 1 ||
      Math.abs(room.x + room.w - (x + width)) < 1 ||
      Math.abs(room.y + room.h - (y + height)) < 1;
    if (!touches) issues.push(`${room.id} has no exterior wall for a window`);
  }
  return issues;
}

export function buildFloorPlan(input: PlanInput, shuffle = 0): FloorPlanModel {
  const floors = Math.max(1, Math.round(input.floors));
  const perFloorSqft = Math.max(200, input.sqftLiving) / floors;
  const rng = mulberry32(seedFrom(input, shuffle));

  const beds = Math.max(1, Math.min(6, Math.round(input.bedrooms)));
  const baths = allocateBathrooms(beds, input.bathrooms, input.grade, rng);

  // Larger homes are squarer; a 6,000 sf house is not a long thin box.
  const layout: LayoutFamily =
    perFloorSqft < 900 || beds === 1 ? "open" : perFloorSqft > 2400 ? "double-loaded" : "corridor";
  const aspect = layout === "double-loaded" ? 1.16 : layout === "open" ? 1.5 : 1.45;

  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.sqrt(perFloorSqft / REFERENCE_SQFT)));
  const area = REFERENCE_AREA * scale * scale;
  const width = Math.sqrt(area * aspect);
  const height = area / width;
  const shell: Rect = {
    x: (PLAN_VIEW_W - width) / 2,
    y: (PLAN_VIEW_H - height) / 2,
    w: width,
    h: height,
  };

  // How many optional rooms the public band can hold before each falls below a
  // usable width. Fewer, legible rooms beat a comb of slivers every time.
  const publicSpan = layout === "double-loaded" ? height : width;
  const fixedParts = 2 + (baths.powder ? 1 : 0); // living + kitchen (+ WC)
  const budget = Math.max(0, Math.floor(publicSpan / MIN_ROOM_W) - fixedParts);
  const extras = programmeFor(perFloorSqft, budget);

  const areaOf = (r: Rect) => Math.round(((r.w * r.h) / (width * height)) * perFloorSqft);
  const context: BuildContext = {
    shell,
    beds,
    baths,
    extras,
    floors,
    grade: input.grade,
    rng,
    areaOf,
    variant: {
      mirror: rng() > 0.5,
      primaryOuter: rng() > 0.45,
      kitchenFirst: rng() > 0.55,
    },
  };

  const assembly =
    layout === "open"
      ? buildOpen(context)
      : layout === "corridor"
        ? buildCorridor(context)
        : buildDoubleLoaded(context);

  return {
    x: shell.x,
    y: shell.y,
    width,
    height,
    ...assembly,
    layout,
    widthFeet: Math.round(Math.sqrt(perFloorSqft * aspect)),
    depthFeet: Math.round(Math.sqrt(perFloorSqft / aspect)),
    perFloorSqft: Math.round(perFloorSqft),
    floors,
    basementSqft: Math.max(0, Math.round(input.sqftBasement)),
    waterfront: input.waterfront,
    strokeWidth: 1.1 + (Math.max(1, Math.min(13, input.grade)) - 1) * 0.075,
  };
}

/**
 * Small flat: no hall at all. You enter the living room and the bedroom opens
 * off it. This is how a one-bed actually works, and drawing a corridor into
 * 700 square feet would be a lie.
 */
function buildOpen(ctx: BuildContext): Assembly {
  const { shell, beds, baths, areaOf, variant } = ctx;
  const rooms: PlanRoom[] = [];
  const doors: PlanDoor[] = [];
  const windows: PlanWindow[] = [];
  const fixtures: PlanFixture[] = [];

  const mirror = variant.mirror;
  const [publicCol, privateCol] = mirror
    ? columns(shell, [1, 1.25]).reverse()
    : columns(shell, [1.25, 1]);

  // Public side: living over kitchen, open to one another.
  const [livingRect, kitchenRect] = rows(publicCol, [1.35, 1]);
  rooms.push({
    id: "living",
    label: "LIVING",
    kind: "living",
    ...livingRect,
    sqft: areaOf(livingRect),
  });
  rooms.push({
    id: "kitchen",
    label: "KITCHEN",
    kind: "kitchen",
    ...kitchenRect,
    sqft: areaOf(kitchenRect),
  });
  fixtures.push(...kitchenFixtures(kitchenRect));
  windows.push(
    windowOn(
      "w-living",
      livingRect.x + livingRect.w / 2,
      shell.y,
      Math.min(livingRect.w * 0.5, 54),
    ),
  );

  // Private side: bedrooms stacked over the bathroom.
  const bathCount = Math.max(1, baths.shared + baths.ensuites);
  const cells = rows(privateCol, [
    ...Array.from({ length: beds }, () => 1.35),
    ...Array.from({ length: bathCount }, () => 0.85),
  ]);

  cells.forEach((cell, i) => {
    if (i < beds) {
      rooms.push({
        id: `bed-${i}`,
        label: i === 0 ? "PRIMARY" : `BED ${i + 1}`,
        kind: "bed",
        ...cell,
        sqft: areaOf(cell),
      });
      const outerX = mirror ? shell.x : shell.x + shell.w;
      windows.push(
        windowOn(`w-bed-${i}`, outerX, cell.y + cell.h / 2, Math.min(cell.h * 0.5, 42), true),
      );
      doors.push(
        door(
          `d-bed-${i}`,
          mirror ? cell.x + cell.w : cell.x,
          cell.y + cell.h * 0.7,
          "vertical",
          mirror ? -1 : 1,
          -1,
        ),
      );
      return;
    }
    const index = i - beds;
    const isPowder = baths.powder && index === bathCount - 1;
    rooms.push({
      id: `bath-${index}`,
      label: isPowder ? "WC" : "BATH",
      kind: "bath",
      ...cell,
      sqft: areaOf(cell),
    });
    fixtures.push(...bathFixtures(`bath-${index}`, cell, isPowder ? "powder" : "shared"));
    doors.push(
      door(
        `d-bath-${index}`,
        mirror ? cell.x + cell.w : cell.x,
        cell.y + cell.h * 0.6,
        "vertical",
        mirror ? -1 : 1,
        -1,
      ),
    );
  });

  const entryX = mirror ? shell.x + shell.w : shell.x;
  return {
    rooms,
    doors: [
      ...doors,
      door("d-entry", entryX, kitchenRect.y + kitchenRect.h * 0.5, "vertical", mirror ? -1 : 1, 1),
    ],
    windows,
    fixtures,
    entry: { x: entryX, y: kitchenRect.y + kitchenRect.h * 0.5, side: mirror ? "right" : "left" },
  };
}

/**
 * The common case: one corridor across the plan, public rooms at the front,
 * bedrooms along the rear wall where they can all have a window.
 */
function buildCorridor(ctx: BuildContext): Assembly {
  const { shell, beds, baths, extras, floors, grade, areaOf, variant } = ctx;
  const rooms: PlanRoom[] = [];
  const doors: PlanDoor[] = [];
  const windows: PlanWindow[] = [];
  const fixtures: PlanFixture[] = [];

  const mirror = variant.mirror;
  const [rear, hall, front] = rows(shell, [1, 0.19, 0.95]);

  // ---- rear: bedrooms, then the wet stack at one end ----------------------
  const ensuiteLux = grade >= 10;
  // The primary either anchors the far end of the rear band or sits nearest
  // the hall. Both are built; which one appears is the seed's business.
  const bedOrder = Array.from({ length: beds }, (_, i) => i);
  if (variant.primaryOuter) bedOrder.reverse();
  const bedWeights = bedOrder.map((i) => (i === 0 ? 1.5 : 1.1));
  const sharedWeights = Array.from({ length: baths.shared }, () => 0.62);
  let rearWeights = [...bedWeights, ...sharedWeights];
  if (mirror) rearWeights = [...rearWeights].reverse();

  const rearCells = columns(rear, rearWeights);
  const ordered = mirror ? [...rearCells].reverse() : rearCells;

  ordered.forEach((cell, slot) => {
    if (slot < beds) {
      const i = bedOrder[slot];
      const hasEnsuite = i < baths.ensuites;
      let ensuiteRect: Rect | null = null;
      if (hasEnsuite) {
        const share =
          i === 0
            ? ensuiteLux
              ? BATH_SIZE.primaryEnsuiteLuxury
              : BATH_SIZE.primaryEnsuite
            : BATH_SIZE.secondEnsuite;
        ensuiteRect = carveEnsuite(cell, share, !mirror);
      }

      rooms.push({
        id: `bed-${i}`,
        label: i === 0 ? "PRIMARY" : `BED ${i + 1}`,
        kind: "bed",
        ...cell,
        sqft: areaOf(cell) - (ensuiteRect ? areaOf(ensuiteRect) : 0),
      });
      windows.push(
        windowOn(`w-bed-${i}`, cell.x + cell.w / 2, shell.y, Math.min(cell.w * 0.5, 46)),
      );
      doors.push(
        door(
          `d-bed-${i}`,
          cell.x + cell.w * (ensuiteRect ? (mirror ? 0.78 : 0.2) : 0.5),
          cell.y + cell.h,
          "horizontal",
          -1,
          1,
        ),
      );

      if (ensuiteRect) {
        rooms.push({
          id: `ensuite-${i}`,
          label: "ENSUITE",
          kind: "bath",
          ...ensuiteRect,
          sqft: areaOf(ensuiteRect),
        });
        fixtures.push(...bathFixtures(`ensuite-${i}`, ensuiteRect, "ensuite"));
        doors.push(
          door(
            `d-ensuite-${i}`,
            mirror ? ensuiteRect.x + ensuiteRect.w : ensuiteRect.x,
            ensuiteRect.y + ensuiteRect.h * 0.6,
            "vertical",
            mirror ? -1 : 1,
            -1,
          ),
        );
      }
      return;
    }
    const index = slot - beds;
    rooms.push({ id: `bath-${index}`, label: "BATH", kind: "bath", ...cell, sqft: areaOf(cell) });
    fixtures.push(...bathFixtures(`bath-${index}`, cell, "shared"));
    doors.push(
      door(`d-bath-${index}`, cell.x + cell.w * 0.5, cell.y + cell.h, "horizontal", -1, -1),
    );
  });

  // ---- hall ---------------------------------------------------------------
  rooms.push({ id: "hall", label: "HALL", kind: "hall", ...hall, sqft: areaOf(hall) });
  if (floors > 1) fixtures.push(...stairFixtures(hall, false));

  // ---- front: living, optional dining, kitchen, optional powder -----------
  const frontParts: Array<{ kind: RoomKind; label: string; weight: number; id: string }> = [
    { id: "living", kind: "living", label: "LIVING", weight: 1.6 },
  ];
  for (const extra of extras) {
    if (extra.kind === "utility") continue; // utility belongs beside the kitchen
    frontParts.push({ id: extra.kind, kind: extra.kind, label: extra.label, weight: extra.weight });
  }
  frontParts.push({ id: "kitchen", kind: "kitchen", label: "KITCHEN", weight: 1.05 });
  if (baths.powder) {
    frontParts.push({ id: "powder", kind: "bath", label: "WC", weight: BATH_SIZE.powder });
  }

  // A kitchen-first public band is as common as a living-first one, and the
  // difference is immediately legible when the plan re-draws.
  if (variant.kitchenFirst) frontParts.reverse();
  const frontOrder = mirror ? [...frontParts].reverse() : frontParts;
  const frontCells = columns(
    front,
    frontOrder.map((p) => p.weight),
  );

  frontOrder.forEach((part, i) => {
    const cell = frontCells[i];
    rooms.push({ id: part.id, label: part.label, kind: part.kind, ...cell, sqft: areaOf(cell) });
    if (part.kind === "kitchen") fixtures.push(...kitchenFixtures(cell));
    if (part.id === "powder") fixtures.push(...bathFixtures("powder", cell, "powder"));
    if (part.kind !== "bath") {
      windows.push(
        windowOn(
          `w-${part.id}`,
          cell.x + cell.w / 2,
          shell.y + shell.h,
          Math.min(cell.w * 0.5, 52),
        ),
      );
    }
    doors.push(
      door(`d-${part.id}`, cell.x + cell.w * 0.5, front.y, "horizontal", 1, i % 2 ? 1 : -1),
    );
  });

  const entryX = mirror ? shell.x + shell.w : shell.x;
  const entryY = hall.y + hall.h / 2;
  doors.push(door("d-entry", entryX, entryY - DOOR / 2, "vertical", mirror ? -1 : 1, 1));

  return {
    rooms,
    doors,
    windows,
    fixtures,
    entry: { x: entryX, y: entryY, side: mirror ? "right" : "left" },
  };
}

/**
 * Large home: a corridor running front to back with rooms on both sides.
 * Squarer footprint, private wing on one side, public on the other.
 */
function buildDoubleLoaded(ctx: BuildContext): Assembly {
  const { shell, beds, baths, extras, floors, grade, areaOf, variant } = ctx;
  const rooms: PlanRoom[] = [];
  const doors: PlanDoor[] = [];
  const windows: PlanWindow[] = [];
  const fixtures: PlanFixture[] = [];

  const mirror = variant.mirror;
  const bands = columns(shell, [1.2, 0.14, 1.32]);
  const [privateCol, spine, publicCol] = mirror ? [bands[2], bands[1], bands[0]] : bands;
  const privateOnLeft = !mirror;

  // ---- private wing: bedrooms, then shared baths --------------------------
  const ensuiteLux = grade >= 10;
  const cells = rows(privateCol, [
    ...Array.from({ length: beds }, (_, i) => (i === 0 ? 1.45 : 1.08)),
    ...Array.from({ length: baths.shared }, () => 0.7),
  ]);

  cells.forEach((cell, i) => {
    const outerX = privateOnLeft ? shell.x : shell.x + shell.w;
    if (i < beds) {
      const hasEnsuite = i < baths.ensuites;
      let ensuiteRect: Rect | null = null;
      if (hasEnsuite) {
        const share =
          i === 0
            ? ensuiteLux
              ? BATH_SIZE.primaryEnsuiteLuxury
              : BATH_SIZE.primaryEnsuite
            : BATH_SIZE.secondEnsuite;
        const w = Math.min(cell.w * (0.28 + share * 0.14), 26 + share * 22);
        const h = Math.min(cell.h * (0.32 + share * 0.14), 22 + share * 22);
        ensuiteRect = {
          x: privateOnLeft ? cell.x + cell.w - w : cell.x,
          y: cell.y,
          w,
          h,
        };
      }
      rooms.push({
        id: `bed-${i}`,
        label: i === 0 ? "PRIMARY" : `BED ${i + 1}`,
        kind: "bed",
        ...cell,
        sqft: areaOf(cell) - (ensuiteRect ? areaOf(ensuiteRect) : 0),
      });
      windows.push(
        windowOn(`w-bed-${i}`, outerX, cell.y + cell.h / 2, Math.min(cell.h * 0.5, 40), true),
      );
      doors.push(
        door(
          `d-bed-${i}`,
          privateOnLeft ? cell.x + cell.w : cell.x,
          cell.y + cell.h * 0.72,
          "vertical",
          privateOnLeft ? -1 : 1,
          -1,
        ),
      );
      if (ensuiteRect) {
        rooms.push({
          id: `ensuite-${i}`,
          label: "ENSUITE",
          kind: "bath",
          ...ensuiteRect,
          sqft: areaOf(ensuiteRect),
        });
        fixtures.push(...bathFixtures(`ensuite-${i}`, ensuiteRect, "ensuite"));
        doors.push(
          door(
            `d-ensuite-${i}`,
            ensuiteRect.x + (privateOnLeft ? 0 : ensuiteRect.w),
            ensuiteRect.y + ensuiteRect.h * 0.7,
            "vertical",
            privateOnLeft ? 1 : -1,
            -1,
          ),
        );
      }
      return;
    }
    const index = i - beds;
    rooms.push({ id: `bath-${index}`, label: "BATH", kind: "bath", ...cell, sqft: areaOf(cell) });
    fixtures.push(...bathFixtures(`bath-${index}`, cell, "shared"));
    doors.push(
      door(
        `d-bath-${index}`,
        privateOnLeft ? cell.x + cell.w : cell.x,
        cell.y + cell.h * 0.6,
        "vertical",
        privateOnLeft ? -1 : 1,
        -1,
      ),
    );
  });

  // ---- spine --------------------------------------------------------------
  rooms.push({ id: "hall", label: "HALL", kind: "hall", ...spine, sqft: areaOf(spine) });
  if (floors > 1) fixtures.push(...stairFixtures(spine, true));

  // ---- public wing --------------------------------------------------------
  const publicParts: Array<{ id: string; kind: RoomKind; label: string; weight: number }> = [
    { id: "living", kind: "living", label: "LIVING", weight: 1.5 },
  ];
  for (const extra of extras) {
    publicParts.push({
      id: extra.kind,
      kind: extra.kind,
      label: extra.label,
      weight: extra.weight,
    });
  }
  publicParts.push({ id: "kitchen", kind: "kitchen", label: "KITCHEN", weight: 1.15 });
  if (baths.powder) {
    publicParts.push({ id: "powder", kind: "bath", label: "WC", weight: BATH_SIZE.powder });
  }

  if (variant.kitchenFirst) publicParts.reverse();
  const publicCells = rows(
    publicCol,
    publicParts.map((p) => p.weight),
  );
  publicParts.forEach((part, i) => {
    const cell = publicCells[i];
    rooms.push({ id: part.id, label: part.label, kind: part.kind, ...cell, sqft: areaOf(cell) });
    if (part.kind === "kitchen") fixtures.push(...kitchenFixtures(cell));
    if (part.id === "powder") fixtures.push(...bathFixtures("powder", cell, "powder"));
    if (part.kind !== "bath") {
      const outerX = privateOnLeft ? shell.x + shell.w : shell.x;
      windows.push(
        windowOn(`w-${part.id}`, outerX, cell.y + cell.h / 2, Math.min(cell.h * 0.5, 44), true),
      );
    }
    doors.push(
      door(
        `d-${part.id}`,
        privateOnLeft ? cell.x : cell.x + cell.w,
        cell.y + cell.h * 0.6,
        "vertical",
        privateOnLeft ? 1 : -1,
        -1,
      ),
    );
  });

  const entryY = shell.y + shell.h;
  doors.push(door("d-entry", spine.x + spine.w * 0.5, entryY, "horizontal", -1, 1));
  return {
    rooms,
    doors,
    windows,
    fixtures,
    entry: { x: spine.x + spine.w * 0.5, y: entryY, side: "bottom" },
  };
}

/**
 * Narrow the model payload to the handful of fields that shape a drawing.
 *
 * The schematic deliberately ignores location, condition and neighbourhood
 * size: none of them change what the plan looks like.
 */
export function toPlanInput(input: PredictionInput): PlanInput {
  return {
    sqftLiving: input.sqft_living,
    sqftBasement: input.sqft_basement,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    floors: input.floors,
    grade: input.grade,
    waterfront: input.waterfront === 1,
  };
}

/** Matches the form's initial state, so the first paint is never empty. */
export const DEFAULT_PLAN_DRAFT: PlanInput = {
  sqftLiving: 2200,
  sqftBasement: 400,
  bedrooms: 3,
  bathrooms: 2.5,
  floors: 2,
  grade: 8,
  waterfront: false,
};

/** Human-readable name for the generated plan type. */
export const LAYOUT_LABEL: Record<LayoutFamily, string> = {
  open: "Open plan",
  corridor: "Corridor plan",
  "double-loaded": "Central hall",
};
