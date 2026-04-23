/**
 * Golf Tracker Type Definitions
 *
 * All data types used throughout the golf tracker app for type-safe storage
 * and retrieval from AsyncStorage.
 */

/**
 * Tee course rating and slope for a specific tee color
 */
export interface TeeData {
  par: number | null;
  rating: number | null;
  slope: number | null;
}

/**
 * Definition of a single hole at a course
 */
export interface HoleDefinition {
  hole: number;
  par: number;
  distance: number | null;
  distanceByTee?: Record<string, number>;
}

/**
 * A golf course with tee options and hole information
 */
export interface Course {
  id: string;
  name: string;
  country: string;
  club?: string;
  tees: Record<string, TeeData>;
  holes: HoleDefinition[];
}

/**
 * A single drill tracked during a practice session
 */
export interface Drill {
  name: string;
  made: string;
  attempts: string;
  success: number;
}

/**
 * A practice session (putting, short game, or long game)
 */
export interface PracticeSession {
  type: 'Putting' | 'Short Game' | 'Long Game';
  duration: number;
  date: string;
  notes: string;
  drills: Drill[];
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
