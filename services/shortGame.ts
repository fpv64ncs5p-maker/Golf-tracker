/**
 * Short game on course — analysis of the two course drills, the closest thing
 * to real on-course short-game data (every hole starts from a real situation):
 *
 *  • Putting Course: putts to hole out, by first-putt distance (from the green edge)
 *  • Chipping Course: up & down (hole out in ≤ 2), by lie and by distance to the hole
 *
 * Numbers use the most recent SHORT_GAME_WINDOW holes of each drill, with a trend
 * against the window before. A "focus spot" is the weakest group with at least
 * SPOT_MIN_HOLES holes — one for putting and one for chipping.
 */
import type { PracticeSession, PuttingCourseHole, ChippingCourseHole, ChipLie } from '../types';
import { PUTTS_PER_HOLE, CHIP_COURSE_PAR, CHIP_LIES, PUTT_AVG_WINDOW_HOLES, round1 } from '../constants/scoring';

export const SHORT_GAME_WINDOW = PUTT_AVG_WINDOW_HOLES; // 45 — same window as the Range Drill putt average
export const SPOT_MIN_HOLES = 5;                        // a group needs this many holes to be named a focus spot
export const TREND_MIN_HOLES = 9;                       // the previous window needs this many holes for a trend

export interface Band { label: string; min: number; max: number } // metres, [min, max)

export const PUTT_BANDS: Band[] = [
  { label: '< 5 m', min: 0, max: 5 },
  { label: '5–10 m', min: 5, max: 10 },
  { label: '10–15 m', min: 10, max: 15 },
  { label: '15 m+', min: 15, max: Infinity },
];

export const CHIP_BANDS: Band[] = [
  { label: '< 5 m', min: 0, max: 5 },
  { label: '5–10 m', min: 5, max: 10 },
  { label: '10–20 m', min: 10, max: 20 },
  { label: '20 m+', min: 20, max: Infinity },
];

const inBand = (b: Band, d: number | null) => d != null && d >= b.min && d < b.max;
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

export type TrendDirection = 'better' | 'worse' | 'same';

// ── Putting ───────────────────────────────────────────────────────────────────

export interface PuttStats { holes: number; avgPutts: number | null; onePuttPct: number; threePuttPct: number; threePutts: number }

const puttStats = (hs: PuttingCourseHole[]): PuttStats => ({
  holes: hs.length,
  avgPutts: hs.length ? round1(hs.reduce((s, h) => s + h.putts, 0) / hs.length) : null,
  onePuttPct: pct(hs.filter(h => h.putts === 1).length, hs.length),
  threePutts: hs.filter(h => h.putts > PUTTS_PER_HOLE).length,
  threePuttPct: pct(hs.filter(h => h.putts > PUTTS_PER_HOLE).length, hs.length),
});

export interface PuttingAnalysis {
  totalHoles: number;              // every Putting Course hole ever logged
  overall: PuttStats;              // recent window
  bands: { band: Band; stats: PuttStats }[];
  noDistance: number;              // recent holes without a measured distance
  trend: { recent: number; previous: number; direction: TrendDirection } | null; // avg putts (lower is better)
}

// ── Chipping ──────────────────────────────────────────────────────────────────

export interface ChipStats { holes: number; upDowns: number; upDownPct: number; avgStrokes: number | null }

const chipStats = (hs: ChippingCourseHole[]): ChipStats => {
  const upDowns = hs.filter(h => h.strokes <= CHIP_COURSE_PAR).length;
  return {
    holes: hs.length,
    upDowns,
    upDownPct: pct(upDowns, hs.length),
    avgStrokes: hs.length ? round1(hs.reduce((s, h) => s + h.strokes, 0) / hs.length) : null,
  };
};

export interface ChippingAnalysis {
  totalHoles: number;
  overall: ChipStats;
  byLie: { lie: ChipLie; stats: ChipStats }[];
  bands: { band: Band; stats: ChipStats }[];
  noDistance: number;
  trend: { recent: number; previous: number; direction: TrendDirection } | null; // up & down % (higher is better)
}

// ── Focus ─────────────────────────────────────────────────────────────────────

export interface FocusSpot {
  area: 'Putting' | 'Chipping';
  label: string;    // e.g. "Rough chips 10–20 m"
  detail: string;   // e.g. "2/7 up & down (29%)"
  practice: string; // what to do about it
  failPct: number;
  holes: number;
}

export interface ShortGameAnalysis {
  putting: PuttingAnalysis | null;
  chipping: ChippingAnalysis | null;
  puttingFocus: FocusSpot | null;
  chippingFocus: FocusSpot | null;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

const playedTime = (d: string) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? 0 : t; };

export const analyzeShortGame = (sessions: PracticeSession[]): ShortGameAnalysis => {
  // Oldest → newest by played date, whatever order the caller holds (the Dashboard keeps them reversed).
  const ordered = [...sessions].sort((a, b) => playedTime(a.date) - playedTime(b.date));

  const allPutts = ordered
    .filter(s => s.type === 'Putting')
    .flatMap(s => (s.drills ?? []).flatMap(d => d.course ?? []));
  const allChips = ordered
    .filter(s => s.type === 'Chipping')
    .flatMap(s => (s.proximityDrills ?? []).flatMap(d => d.chipCourse ?? []));

  // ── Putting
  let putting: PuttingAnalysis | null = null;
  let puttingFocus: FocusSpot | null = null;
  if (allPutts.length > 0) {
    const recent = allPutts.slice(-SHORT_GAME_WINDOW);
    const previous = allPutts.slice(-2 * SHORT_GAME_WINDOW, -SHORT_GAME_WINDOW);
    const overall = puttStats(recent);
    const prev = puttStats(previous);
    const bands = PUTT_BANDS.map(band => ({ band, stats: puttStats(recent.filter(h => inBand(band, h.distance))) }));
    let trend: PuttingAnalysis['trend'] = null;
    if (previous.length >= TREND_MIN_HOLES && overall.avgPutts != null && prev.avgPutts != null) {
      const diff = round1(overall.avgPutts - prev.avgPutts);
      trend = { recent: overall.avgPutts, previous: prev.avgPutts, direction: diff <= -0.1 ? 'better' : diff >= 0.1 ? 'worse' : 'same' };
    }
    putting = { totalHoles: allPutts.length, overall, bands, noDistance: recent.filter(h => h.distance == null).length, trend };

    const worst = bands
      .filter(b => b.stats.holes >= SPOT_MIN_HOLES && b.stats.threePutts > 0)
      .sort((a, b) => b.stats.threePuttPct - a.stats.threePuttPct || b.stats.holes - a.stats.holes)[0];
    if (worst) {
      const lag = worst.band.min >= 5;
      puttingFocus = {
        area: 'Putting',
        label: `${lag ? 'Lag putts' : 'Putts'} ${worst.band.label}`,
        detail: `${worst.stats.threePutts}/${worst.stats.holes} three-putts (${worst.stats.threePuttPct}%) · avg ${worst.stats.avgPutts} putts`,
        practice: lag
          ? `lag putting from ${worst.band.min}${Number.isFinite(worst.band.max) ? `–${worst.band.max}` : '+'} m — aim to finish inside 1 m`
          : 'short putts under 5 m — tempo and start line',
        failPct: worst.stats.threePuttPct,
        holes: worst.stats.holes,
      };
    }
  }

  // ── Chipping
  let chipping: ChippingAnalysis | null = null;
  let chippingFocus: FocusSpot | null = null;
  if (allChips.length > 0) {
    const recent = allChips.slice(-SHORT_GAME_WINDOW);
    const previous = allChips.slice(-2 * SHORT_GAME_WINDOW, -SHORT_GAME_WINDOW);
    const overall = chipStats(recent);
    const prev = chipStats(previous);
    const byLie = CHIP_LIES.map(lie => ({ lie, stats: chipStats(recent.filter(h => h.lie === lie)) }));
    const bands = CHIP_BANDS.map(band => ({ band, stats: chipStats(recent.filter(h => inBand(band, h.distance))) }));
    let trend: ChippingAnalysis['trend'] = null;
    if (previous.length >= TREND_MIN_HOLES) {
      const diff = overall.upDownPct - prev.upDownPct;
      trend = { recent: overall.upDownPct, previous: prev.upDownPct, direction: diff >= 5 ? 'better' : diff <= -5 ? 'worse' : 'same' };
    }
    chipping = { totalHoles: allChips.length, overall, byLie, bands, noDistance: recent.filter(h => h.distance == null).length, trend };

    // Candidates, most specific first: lie × distance, then lie, then distance.
    type Cand = { label: string; stats: ChipStats; specificity: number; practice: string };
    const cands: Cand[] = [];
    for (const lie of CHIP_LIES) {
      for (const band of CHIP_BANDS) {
        cands.push({
          label: `${lie} chips ${band.label}`,
          stats: chipStats(recent.filter(h => h.lie === lie && inBand(band, h.distance))),
          specificity: 2,
          practice: `${lie.toLowerCase()} ${lie === 'Bunker' ? 'shots' : 'chips'} from ${band.label.replace(' m', '')} m`,
        });
      }
    }
    for (const { lie, stats } of byLie) {
      cands.push({ label: `${lie} chips`, stats, specificity: 1, practice: `${lie.toLowerCase()} ${lie === 'Bunker' ? 'shots' : 'chips'} at mixed distances` });
    }
    for (const { band, stats } of bands) {
      cands.push({ label: `Chips ${band.label}`, stats, specificity: 1, practice: `chips from ${band.label.replace(' m', '')} m off mixed lies` });
    }
    const worst = cands
      .filter(c => c.stats.holes >= SPOT_MIN_HOLES && c.stats.upDowns < c.stats.holes)
      .sort((a, b) => a.stats.upDownPct - b.stats.upDownPct || b.specificity - a.specificity || b.stats.holes - a.stats.holes)[0];
    if (worst) {
      chippingFocus = {
        area: 'Chipping',
        label: worst.label,
        detail: `${worst.stats.upDowns}/${worst.stats.holes} up & down (${worst.stats.upDownPct}%)`,
        practice: `${worst.practice} — land it on the green, then hole the putt`,
        failPct: 100 - worst.stats.upDownPct,
        holes: worst.stats.holes,
      };
    }
  }

  return { putting, chipping, puttingFocus, chippingFocus };
};

export const trendArrow = (d: TrendDirection) => (d === 'better' ? '▲' : d === 'worse' ? '▼' : '＝');
export const trendColour = (d: TrendDirection) => (d === 'better' ? '#2e7d32' : d === 'worse' ? '#c62828' : '#777');
