/**
 * Round caddie — which club for a given distance (tee shot).
 *
 * The base table is Jo's own yardage guide (round-hole.tsx). On top of it, the
 * wedges in AUTO_WEDGES are added automatically once they have a carry on the
 * Clubs tab: a full-swing row around the carry and a ¾ row around 85 % of it.
 * Change the carry → the caddie follows; no carry → the wedge is left out.
 */
import type { ClubDistance } from '../types';
import { withLoft, type Lofts } from '../data/clubs';

export interface GuideRow {
  min: number; max: number;   // metres, inclusive
  club: string;
  swing: number;              // % of a full swing
  label: string;
  alt: string;
  note: string;
  auto?: boolean;             // built from the Clubs tab carry
}

export const AUTO_WEDGES = ['GW', 'LW'];   // 52° and 60° — the SW keeps its hand-written rows
export const THREE_QUARTER = 0.85;         // ¾ swing ≈ 85 % of the full carry
export const RANGE_BELOW = 4;              // row covers carry − 4 … carry + 3 (≈ the base rows' width)
export const RANGE_ABOVE = 3;

/** Base guide + automatic rows for the wedges that have a carry. */
export const buildGuide = (base: GuideRow[], clubDistances: Record<string, ClubDistance>, lofts: Lofts): GuideRow[] => {
  const auto: GuideRow[] = [];
  for (const club of AUTO_WEDGES) {
    const carry = parseInt(clubDistances[club]?.carry ?? '');
    if (!Number.isFinite(carry) || carry <= 0) continue;
    const name = withLoft(club, lofts);
    const tq = Math.round(carry * THREE_QUARTER);
    auto.push(
      { min: carry - RANGE_BELOW, max: carry + RANGE_ABOVE, club, swing: 100, label: `${name} full`, alt: '', note: `From your Clubs tab: ${carry} m carry`, auto: true },
      { min: Math.max(0, tq - RANGE_BELOW), max: tq + RANGE_ABOVE, club, swing: 85, label: `${name} ¾`, alt: '', note: `¾ swing ≈ ${tq} m (85 % of ${carry} m carry)`, auto: true },
    );
  }
  return [...base, ...auto].sort((a, b) => a.min - b.min || b.swing - a.swing);
};

/**
 * Pick the row for a distance. Among the rows that cover it: the fuller swing wins
 * (more repeatable), then the row whose centre is closest to the distance, then
 * the hand-written row. The alternative is the best other club covering the
 * distance — so a new wedge shows up at least as "alt" next to the usual plan.
 * Lay-up = the nearest shorter row with a different club.
 */
export const pickAdvice = (guide: GuideRow[], distance: number) => {
  const centre = (g: GuideRow) => (g.min + Math.min(g.max, g.min + 30)) / 2; // open-ended last row
  const fits = guide
    .filter(g => distance >= g.min && distance <= g.max)
    .sort((a, b) =>
      b.swing - a.swing
      || Math.abs(centre(a) - distance) - Math.abs(centre(b) - distance)
      || Number(!!a.auto) - Number(!!b.auto));
  const best = fits[0];
  if (!best) return null;
  const other = fits.find(g => g.club !== best.club);
  const alt = other && (best.auto || other.auto) ? other.label : best.alt;
  const match = { ...best, alt };
  const layup = [...guide]
    .filter(g => g.club !== best.club && g.max < distance)
    .sort((a, b) => b.max - a.max)[0] ?? null;
  return { match, layup };
};
