import type { PuttingCourseHole, PracticeSession, ChippingCourseHole, ChipLie, CourseEditorHole } from '../types';

/**
 * Putts assumed per hole when estimating a full-hole score from a range drill.
 *
 * A range drill only logs the shots taken to reach the green (it doesn't track
 * putting), but par includes putting — so to compare a drill fairly against par
 * we add a flat number of putts per hole. 2 is the standard "regulation" assumption.
 */
export const PUTTS_PER_HOLE = 2;

/**
 * Within this many metres of the green counts as "on / near the green"
 * during a range drill (roughly a green's radius — a chip or long putt away).
 */
export const NEAR_GREEN_M = 10;

// ── Putting Course ────────────────────────────────────────────────────────────
// Walk a course and, on every green, putt only from the far edge. Par is
// PUTTS_PER_HOLE (2) per hole — the same regulation assumption the range drill uses.

export const PUTTING_COURSE_NAME = 'Putting Course';

export interface PuttingCourseSummary {
  holes: number;
  putts: number;
  par: number;
  vsPar: number;
  onePutts: number;
  threePutts: number;          // 3 or more putts
  avgDistance: number | null;  // mean first-putt metres over holes that have one
  success: number;             // % of holes holed in par or better (≤ 2 putts)
}

export const summarizePuttingCourse = (holes: PuttingCourseHole[]): PuttingCourseSummary => {
  const putts = holes.reduce((s, h) => s + h.putts, 0);
  const par = holes.length * PUTTS_PER_HOLE;
  const measured = holes.filter(h => h.distance != null);
  const atOrUnderPar = holes.filter(h => h.putts <= PUTTS_PER_HOLE).length;
  return {
    holes: holes.length,
    putts,
    par,
    vsPar: putts - par,
    onePutts: holes.filter(h => h.putts === 1).length,
    threePutts: holes.filter(h => h.putts >= 3).length,
    avgDistance: measured.length
      ? Math.round((measured.reduce((s, h) => s + (h.distance as number), 0) / measured.length) * 10) / 10
      : null,
    success: holes.length ? Math.round((atOrUnderPar / holes.length) * 100) : 0,
  };
};

export const fmtPuttingVsPar = (v: number) => (v === 0 ? 'E' : v > 0 ? `+${v}` : `${v}`);

/** One-line summary, e.g. "9 holes · 20 putts (+2) · 1×1-putt · 3×3-putt · avg 8.5m" */
export const puttingCourseLine = (holes: PuttingCourseHole[]): string => {
  const s = summarizePuttingCourse(holes);
  const parts = [
    `${s.holes} hole${s.holes === 1 ? '' : 's'}`,
    `${s.putts} putts (${fmtPuttingVsPar(s.vsPar)})`,
    `${s.onePutts}× 1-putt`,
    `${s.threePutts}× 3-putt`,
  ];
  if (s.avgDistance != null) parts.push(`avg ${s.avgDistance}m`);
  return parts.join(' · ');
};

// ── Range Drill putts from real Putting Course practice ──────────────────────
// Instead of the flat PUTTS_PER_HOLE, a range drill uses the average putts per
// hole over the most recent Putting Course holes. The value is frozen onto each
// drill when it starts, so saved scores never shift later. Putting Courses start
// from the far edge, so this is deliberately a tougher estimate than a round.

export const PUTT_AVG_WINDOW_HOLES = 45; // ≈ last five 9-hole courses
export const PUTT_AVG_MIN_HOLES = 9;     // below this, keep the default of 2

export const round1 = (n: number) => Math.round(n * 10) / 10;

export interface PuttingAverage {
  puttsPerHole: number;
  holes: number; // sample size the average is based on
}

export const puttingCourseAverage = (sessions: PracticeSession[]): PuttingAverage | null => {
  const holes = sessions
    .filter(s => s.type === 'Putting')
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap(s => (s.drills ?? []).flatMap(d => d.course ?? []))
    .slice(-PUTT_AVG_WINDOW_HOLES);
  if (holes.length < PUTT_AVG_MIN_HOLES) return null;
  return {
    puttsPerHole: round1(holes.reduce((sum, h) => sum + h.putts, 0) / holes.length),
    holes: holes.length,
  };
};

/** Putts per hole a range drill was scored with (older drills: the flat default). */
export const drillPuttsPerHole = (d: { puttsPerHole?: number }) => d.puttsPerHole ?? PUTTS_PER_HOLE;

// ── Chipping Course ───────────────────────────────────────────────────────────
// Walk a course and on every hole chip from off the green (fairway, rough or
// bunker) and hole out. Par is 2 — chip and one putt, i.e. an up and down.

export const CHIPPING_COURSE_NAME = 'Chipping Course';
export const CHIP_COURSE_PAR = PUTTS_PER_HOLE; // 2
export const CHIP_LIES: readonly ChipLie[] = ['Fairway', 'Rough', 'Bunker'];

export interface ChippingCourseSummary {
  holes: number;
  strokes: number;
  par: number;
  vsPar: number;
  chipIns: number;
  upDowns: number;               // holes in ≤ 2 (chip-ins included)
  upDownPct: number;
  sandHoles: number;
  sandSaves: number;             // bunker holes in ≤ 2
  sandSavePct: number | null;    // null when no bunker holes
  avgDistance: number | null;
  byLie: Record<ChipLie, { holes: number; upDowns: number }>;
}

export const summarizeChippingCourse = (holes: ChippingCourseHole[]): ChippingCourseSummary => {
  const byLie = { Fairway: { holes: 0, upDowns: 0 }, Rough: { holes: 0, upDowns: 0 }, Bunker: { holes: 0, upDowns: 0 } };
  for (const h of holes) {
    const bucket = byLie[h.lie] ?? byLie.Fairway;
    bucket.holes++;
    if (h.strokes <= CHIP_COURSE_PAR) bucket.upDowns++;
  }
  const strokes = holes.reduce((s, h) => s + h.strokes, 0);
  const upDowns = holes.filter(h => h.strokes <= CHIP_COURSE_PAR).length;
  const measured = holes.filter(h => h.distance != null);
  return {
    holes: holes.length,
    strokes,
    par: holes.length * CHIP_COURSE_PAR,
    vsPar: strokes - holes.length * CHIP_COURSE_PAR,
    chipIns: holes.filter(h => h.strokes === 1).length,
    upDowns,
    upDownPct: holes.length ? Math.round((upDowns / holes.length) * 100) : 0,
    sandHoles: byLie.Bunker.holes,
    sandSaves: byLie.Bunker.upDowns,
    sandSavePct: byLie.Bunker.holes ? Math.round((byLie.Bunker.upDowns / byLie.Bunker.holes) * 100) : null,
    avgDistance: measured.length
      ? round1(measured.reduce((s, h) => s + (h.distance as number), 0) / measured.length)
      : null,
    byLie,
  };
};

/** One-line summary, e.g. "9 holes · 21 strokes (+3) · up & down 5/9 (56%) · sand 1/2 · 1 chip-in · avg 9m" */
export const chippingCourseLine = (holes: ChippingCourseHole[]): string => {
  const s = summarizeChippingCourse(holes);
  const parts = [
    `${s.holes} hole${s.holes === 1 ? '' : 's'}`,
    `${s.strokes} strokes (${fmtPuttingVsPar(s.vsPar)})`,
    `up & down ${s.upDowns}/${s.holes} (${s.upDownPct}%)`,
  ];
  if (s.sandHoles > 0) parts.push(`sand ${s.sandSaves}/${s.sandHoles}`);
  if (s.chipIns > 0) parts.push(`${s.chipIns} chip-in${s.chipIns === 1 ? '' : 's'}`);
  if (s.avgDistance != null) parts.push(`avg ${s.avgDistance}m`);
  return parts.join(' · ');
};

// ── Converters between stored course holes and the shared editor shape ───────

export const puttingToEditor = (hs: PuttingCourseHole[]): CourseEditorHole[] =>
  hs.map(h => ({ hole: h.hole, distance: h.distance, strokes: h.putts }));
export const editorToPutting = (hs: CourseEditorHole[]): PuttingCourseHole[] =>
  hs.map(h => ({ hole: h.hole, distance: h.distance, putts: h.strokes }));
export const chippingToEditor = (hs: ChippingCourseHole[]): CourseEditorHole[] =>
  hs.map(h => ({ hole: h.hole, distance: h.distance, strokes: h.strokes, lie: h.lie }));
export const editorToChipping = (hs: CourseEditorHole[]): ChippingCourseHole[] =>
  hs.map(h => ({ hole: h.hole, distance: h.distance, strokes: h.strokes, lie: h.lie ?? 'Fairway' }));
