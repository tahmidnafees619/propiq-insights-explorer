/**
 * Derives a plausible floor plan from the attributes the predictor collects.
 *
 * This is a schematic, not a design: the point is to give the numbers in the
 * form a shape, so changing bedrooms or square footage produces something the
 * eye can read rather than another digit.
 *
 * Rooms are placed by recursive subdivision — repeatedly halving the remaining
 * area and cutting across whichever axis is longer. It is the same instinct a
 * space planner works with, it always tiles the footprint exactly, and it
 * degrades gracefully from a studio to a ten-room house without special cases.
 *
 * Everything here is pure and deterministic, so the server and the client
 * derive identical geometry.
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

export type RoomKind = "living" | "kitchen" | "bed" | "bath";

interface Room {
  id: string;
  label: string;
  kind: RoomKind;
  /** Relative floor area, not square feet. */
  weight: number;
}

export interface PlacedRoom extends Room {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Approximate real area, in square feet. */
  sqft: number;
}

export interface FloorPlanModel {
  /** Footprint in view units, centred in the canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  rooms: PlacedRoom[];
  /** Real-world footprint, in feet. */
  widthFeet: number;
  depthFeet: number;
  /** Area of a single storey, in square feet. */
  perFloorSqft: number;
  floors: number;
  basementSqft: number;
  waterfront: boolean;
  /** Construction grade drives line weight, as it would on a real drawing. */
  strokeWidth: number;
}

/** Canvas the schematic is drawn into. */
export const PLAN_VIEW_W = 460;
export const PLAN_VIEW_H = 380;

/** A plan of this many square feet fills the reference footprint below. */
const REFERENCE_SQFT = 2000;
const REFERENCE_W = 300;
const REFERENCE_H = 207;
/** Typical residential footprint proportion, width to depth. */
const ASPECT = REFERENCE_W / REFERENCE_H;

/** Keeps a studio legible and a mansion inside the frame. */
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.42;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Split `rooms` across `rect`, cutting the longer axis each time.
 *
 * The split point is chosen to divide total area as evenly as possible, which
 * is what keeps rooms near-square instead of producing long slivers.
 */
function subdivide(rect: Rect, rooms: Room[]): Array<Room & Rect> {
  if (rooms.length === 0) return [];
  if (rooms.length === 1) return [{ ...rooms[0], ...rect }];

  const total = rooms.reduce((sum, room) => sum + room.weight, 0);

  let running = 0;
  let splitAt = 1;
  let closest = Infinity;
  for (let i = 0; i < rooms.length - 1; i += 1) {
    running += rooms[i].weight;
    const distance = Math.abs(running - total / 2);
    if (distance < closest) {
      closest = distance;
      splitAt = i + 1;
    }
  }

  const head = rooms.slice(0, splitAt);
  const tail = rooms.slice(splitAt);
  const headShare = head.reduce((sum, room) => sum + room.weight, 0) / total;

  if (rect.w >= rect.h) {
    const cut = rect.w * headShare;
    return [
      ...subdivide({ x: rect.x, y: rect.y, w: cut, h: rect.h }, head),
      ...subdivide({ x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h }, tail),
    ];
  }

  const cut = rect.h * headShare;
  return [
    ...subdivide({ x: rect.x, y: rect.y, w: rect.w, h: cut }, head),
    ...subdivide({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }, tail),
  ];
}

/** The rooms a house of this shape would contain, in planning order. */
function roomProgramme(bedrooms: number, bathrooms: number): Room[] {
  const beds = Math.max(0, Math.min(10, Math.round(bedrooms)));
  // A half bath is still a room on the drawing, so round up rather than down.
  const baths = Math.max(1, Math.min(8, Math.ceil(bathrooms)));
  const hasHalfBath = bathrooms % 1 !== 0;

  const rooms: Room[] = [
    { id: "living", label: "LIVING", kind: "living", weight: 2.4 },
    { id: "kitchen", label: "KITCHEN", kind: "kitchen", weight: 1.5 },
  ];

  for (let i = 0; i < beds; i += 1) {
    rooms.push({
      id: `bed-${i}`,
      // The largest bedroom is the primary, as it would be labelled in plan.
      label: i === 0 ? "PRIMARY" : `BED ${i + 1}`,
      kind: "bed",
      weight: i === 0 ? 1.85 : 1.25,
    });
  }

  for (let i = 0; i < baths; i += 1) {
    // The half bath is the powder room, and reads smaller on the drawing.
    const isPowder = hasHalfBath && i === baths - 1;
    rooms.push({
      id: `bath-${i}`,
      label: isPowder ? "WC" : "BATH",
      kind: "bath",
      weight: isPowder ? 0.34 : 0.6,
    });
  }

  return rooms;
}

export function buildFloorPlan(input: PlanInput): FloorPlanModel {
  const floors = Math.max(1, Math.round(input.floors));
  const living = Math.max(200, input.sqftLiving);
  const perFloorSqft = living / floors;

  // Area scales with the square of linear size, so take the root to size the
  // footprint — doubling the square footage should not double the width.
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.sqrt(perFloorSqft / REFERENCE_SQFT)));

  const width = REFERENCE_W * scale;
  const height = REFERENCE_H * scale;
  const x = (PLAN_VIEW_W - width) / 2;
  const y = (PLAN_VIEW_H - height) / 2;

  const rooms = roomProgramme(input.bedrooms, input.bathrooms);
  const placed = subdivide({ x, y, w: width, h: height }, rooms);

  const footprintArea = width * height;

  return {
    x,
    y,
    width,
    height,
    widthFeet: Math.round(Math.sqrt(perFloorSqft * ASPECT)),
    depthFeet: Math.round(Math.sqrt(perFloorSqft / ASPECT)),
    perFloorSqft: Math.round(perFloorSqft),
    floors,
    basementSqft: Math.max(0, Math.round(input.sqftBasement)),
    waterfront: input.waterfront,
    // Higher grades are drawn with a crisper, heavier line.
    strokeWidth: 1.1 + (Math.max(1, Math.min(13, input.grade)) - 1) * 0.075,
    rooms: placed.map((room) => ({
      ...room,
      sqft: Math.round(((room.w * room.h) / footprintArea) * perFloorSqft),
    })),
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
