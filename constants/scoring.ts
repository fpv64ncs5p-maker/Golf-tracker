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
