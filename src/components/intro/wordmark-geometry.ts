/**
 * The PropIQ wordmark, drawn rather than typeset.
 *
 * These are monoline letterforms — single-stroke skeletons of the kind a pen
 * plotter or a draughtsman produces, not outlines of a typeface. Three reasons
 * that matters here:
 *
 *   1. A stroke can be drawn. `pathLength` animates a skeleton convincingly;
 *      run it on a filled outline and you get a wobbling contour instead of
 *      handwriting.
 *   2. No font dependency on the most important frame of the site. There is no
 *      web font to load, so there is no flash of unstyled or invisible text on
 *      the first paint a visitor ever sees.
 *   3. Every curve is constructed from a circle and a straight, which is what
 *      lets the construction geometry be drawn first — the guides a letterer
 *      actually sets out before inking.
 *
 * Geometry is on a 100-unit cap height: baseline at y=100, x-height at y=32,
 * descenders to y=132. Each glyph is authored at its own origin and positioned
 * by the composer below.
 */

export interface Stroke {
  id: string;
  d: string;
}

/** Cap height, x-height and descender, in glyph units. */
export const CAP_HEIGHT = 100;
export const X_HEIGHT = 32;
export const DESCENDER = 132;

interface Glyph {
  char: string;
  advance: number;
  /** Inked strokes, in the order a hand would draw them. */
  strokes: string[];
  /** Construction geometry: circles and rules set out before inking. */
  guides: string[];
}

/**
 * `Prop` is lowercase after the initial cap, and `IQ` is capitalised — the
 * wordmark's own joke, and it gives the drawing two different letter heights
 * to set out, which makes the construction stage worth watching.
 */
const GLYPHS: Glyph[] = [
  {
    char: "P",
    advance: 64,
    strokes: [
      // Stem, then the bowl: the order a hand would take them.
      "M0 0 V100",
      "M0 0 H24 A27 27 0 0 1 24 54 H0",
    ],
    guides: [
      // The bowl is a circle before it is a letter.
      "M24 0 A27 27 0 0 1 24 54 A27 27 0 0 1 24 0 Z",
      "M0 0 H51",
      "M0 54 H51",
    ],
  },
  {
    char: "r",
    advance: 48,
    strokes: ["M0 32 V100", "M0 44 A20 20 0 0 1 36 35"],
    guides: ["M0 32 H36", "M0 44 H36"],
  },
  {
    char: "o",
    advance: 64,
    strokes: ["M0 66 A26 26 0 0 1 52 66 A26 26 0 0 1 0 66 Z"],
    guides: ["M26 40 V92", "M0 66 H52"],
  },
  {
    char: "p",
    advance: 64,
    // The descender is what anchors the word to its baseline.
    strokes: ["M0 32 V132", "M0 40 H26 A26 26 0 0 1 26 92 H0"],
    guides: ["M26 40 A26 26 0 0 1 26 92 A26 26 0 0 1 26 40 Z", "M0 100 H52"],
  },
  {
    char: "I",
    advance: 32,
    // Barred top and bottom: the convention in drawing-office lettering, and
    // what keeps a capital I from reading as a lowercase l.
    strokes: ["M0 0 H18", "M9 0 V100", "M0 100 H18"],
    guides: [],
  },
  {
    char: "Q",
    advance: 92,
    strokes: [
      "M0 50 A36 36 0 0 1 72 50 A36 36 0 0 1 0 50 Z",
      // The tail runs on past the circle; the intro extends it into a
      // dimension leader, so the letter annotates the word it belongs to.
      "M47 71 L86 110",
    ],
    guides: ["M36 14 V86", "M0 50 H72"],
  },
];

/** Extra space between specific pairs, judged by eye rather than by metric. */
const KERNING: Record<string, number> = {
  Pr: 5,
  pI: 6,
  IQ: 2,
};

export interface GlyphGroup {
  char: string;
  /** Where this glyph starts along the baseline, in the same units as the
   *  strokes — the pivot a flight animation measures distance from. */
  x: number;
  /** Ids of the strokes belonging to this glyph, for grouping at render time. */
  strokeIds: string[];
}

interface Composed {
  strokes: Stroke[];
  guides: Stroke[];
  width: number;
  /** Where each glyph starts, for anything that needs to annotate one. */
  offsets: number[];
  groups: GlyphGroup[];
}

function compose(): Composed {
  const strokes: Stroke[] = [];
  const guides: Stroke[] = [];
  const offsets: number[] = [];
  const groups: GlyphGroup[] = [];
  let cursor = 0;

  GLYPHS.forEach((glyph, index) => {
    const previous = GLYPHS[index - 1];
    if (previous) cursor += KERNING[previous.char + glyph.char] ?? 0;

    offsets.push(cursor);
    const strokeIds: string[] = [];

    glyph.strokes.forEach((d, i) => {
      const id = `${glyph.char}-${index}-s${i}`;
      strokes.push({ id, d: translate(d, cursor) });
      strokeIds.push(id);
    });
    glyph.guides.forEach((d, i) => {
      guides.push({ id: `${glyph.char}-${index}-g${i}`, d: translate(d, cursor) });
    });
    groups.push({ char: glyph.char, x: cursor, strokeIds });

    cursor += glyph.advance;
  });

  return { strokes, guides, width: cursor, offsets, groups };
}

/**
 * Shift a path along x.
 *
 * Only the absolute commands used above need handling — M, H, V, L, A and Z.
 * A general transform would mean parsing arcs properly for no benefit, since
 * a horizontal translation leaves every arc parameter untouched except the
 * endpoint.
 */
function translate(d: string, dx: number): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const out: string[] = [];
  let i = 0;
  let command = "";

  const take = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      command = tokens[i];
      i += 1;
      if (command === "Z" || command === "z") out.push("Z");
      continue;
    }
    switch (command) {
      case "M":
      case "L": {
        const x = take();
        const y = take();
        out.push(`${command}${x + dx} ${y}`);
        break;
      }
      case "H": {
        out.push(`H${take() + dx}`);
        break;
      }
      case "V": {
        out.push(`V${take()}`);
        break;
      }
      case "A": {
        const rx = take();
        const ry = take();
        const rot = take();
        const large = take();
        const sweep = take();
        const x = take();
        const y = take();
        out.push(`A${rx} ${ry} ${rot} ${large} ${sweep} ${x + dx} ${y}`);
        break;
      }
      default:
        i += 1;
    }
  }
  return out.join(" ");
}

const COMPOSED = compose();

export const WORDMARK_STROKES = COMPOSED.strokes;
export const WORDMARK_GUIDES = COMPOSED.guides;
export const WORDMARK_WIDTH = COMPOSED.width;
/** Includes the descender and the Q's tail, which both run below the baseline. */
export const WORDMARK_HEIGHT = 112;

/** Per-glyph groupings, for anything that animates letters individually. */
export const WORDMARK_GLYPH_GROUPS = COMPOSED.groups;
