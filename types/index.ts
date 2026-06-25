/**
 * Golf Tracker Type Definitions
 */

export interface TeeData {
  par: number | null;
  rating: number | null;
  slope: number | null;
}

export interface HoleDefinition {
  hole: number;
  par: number;
  distance: number | null;
  distanceByTee?: Record<string, number>;
  strokeIndex?: number | null; // 1–18 (or 1–9) hole difficulty ranking, used for Adjusted Gross Score
}

export interface Course {
  id: string;
  name: string;
  country: string;
  club?: string;
  tees: Record<string, TeeData>;
  holes: HoleDefinition[];
}

/**
 * Direction grid — 3×3 tap counter
 * Layout (Long on top, Short on bottom):
 *   longLeft  | long  | longRight
 *   left      | center| right
 *   shortLeft | short | shortRight
 *
 * center = Holed (Putting) or ≤Xm ✓ (Chipping/Pitching)
 */
export interface DirectionGrid {
  longLeft: number;
  long: number;
  longRight: number;
  left: number;
  center: number;
  right: number;
  shortLeft: number;
  short: number;
  shortRight: number;
}

/**
 * A single drill tracked during a practice session (Putting / Long Game / Short Game)
 */
export interface Drill {
  name: string;
  // New: direction grid (Putting)
  grid?: DirectionGrid;
  // Legacy: made/attempts (Long Game / Short Game, and old Putting data)
  made?: string;
  attempts?: string;
  success: number;
}

/**
 * Legacy proximity buckets — kept for backward compatibility
 */
export interface ProximityBuckets {
  inside1m: number;
  one2m: number;
  two3m: number;
  beyond3m: number;
  miss: number;
}

/**
 * A single drill tracked during a Chipping or Pitching session
 */
export interface ProximityDrill {
  name: string;
  attempts: number;       // total shots = sum of grid cells
  // New: direction grid
  grid?: DirectionGrid;
  threshold?: number;      // actual target in metres (stored per drill)
  thresholdLevel?: number; // adaptive level: 1=amateur, 2=good, 3=elite
  // Legacy bucket data (kept for backward compat with old sessions)
  buckets?: ProximityBuckets;
  success: number;        // % of shots in center zone
  club?: string;
}

/**
 * A practice session (putting, short game, long game, chipping, or pitching)
 */
export interface PracticeSession {
  type: 'Putting' | 'Short Game' | 'Long Game' | 'Chipping' | 'Pitching';
  duration: number;
  date: string;
  notes: string;
  drills: Drill[];
  proximityDrills?: ProximityDrill[];
}

/**
 * A single stroke record during a hole
 */
export interface Stroke {
  club: string;
  direction: string;
  penalty: string | null;
}

/**
 * Penalty record from a stroke
 */
export interface PenaltyRecord {
  location: string;
  stroke: string;
  direction: string;
}

/**
 * Data for a single hole in a round
 */
export interface HoleData {
  hole: number;
  par: number;
  strokes: Stroke[];
  totalStrokes: number;
  putts: number;
  puttDirection?: string | null;
  fairwayHit: boolean | null;
  missDirection: string | null;
  approachMiss?: string | null;
  gir: boolean;
  penalties: PenaltyRecord[];
}

/**
 * Statistics calculated for a completed round
 */
export interface RoundStats {
  totalStrokes: number;
  totalPutts: number;
  puttsPerHole: string;
  fairwaysHit: number;
  fairwayTotal: number;
  fairwayPct: number;
  girCount: number;
  girPct: number;
  par3Gir: number;
  par3Total: number;
  scoreVsPar: number | null;
}

/**
 * Weather conditions during a round
 */
export interface Weather {
  wind: string;
  sky: string;
  ground: string;
  tempC: number | null;
}

/**
 * A completed golf round
 */
export interface Round {
  courseName: string;
  courseId?: string;
  tee: string;
  holes: number;
  coursePar: number;
  courseRating?: number;
  slopeRating?: number;
  weather: Weather;
  date: string;
  notes: string;
  imported: boolean;
  holeData: HoleData[];
  stats: RoundStats;
  courseHoles?: HoleDefinition[];
}

/**
 * A round in progress (draft), with course hole definitions available
 */
export type DraftRound = Round & {
  courseHoles: HoleDefinition[];
};

/**
 * A single shot in a driving range drill
 */
export interface RangeDrillShot {
  club: string;
  distance: number | null;
}

/**
 * A single hole in a driving range drill
 */
export interface RangeDrillHole {
  hole: number;
  par: number;
  courseDistance: number | null;
  shots: RangeDrillShot[];
}

/**
 * A complete driving range drill session (course simulation)
 */
export interface RangeDrill {
  id: string;
  courseId: string;
  courseName: string;
  date: string;
  duration: number;
  notes: string;
  holes: RangeDrillHole[];
}

/**
 * Club distance and characteristics from Trackman session
 */
export interface ClubDistance {
  carry: string;
  total: string;
  ballSpeed: string;
  direction?: string;
  note?: string;
  updatedAt: string;
}
