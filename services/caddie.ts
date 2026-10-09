/**
 * Round caddie (tee shot) — built entirely from the Clubs tab, so every Trackman
 * update reaches the caddie straight away. No fixed yardage table (removed 2026-10-09).
 *
 *  • Each club with a carry gives a FULL option (target = carry); irons and wedges
 *    also a ¾ option (target ≈ 85 % of carry). Woods/hybrids/Driver: full only.
 *  • A full swing wins when it is within FULL_TOLERANCE m of the hole; otherwise the
 *    option whose target is closest. Longer than every club → the longest full swing.
 *  • Alt = the next closest option with another club. Lay-up = the nearest shorter
 *    full swing with another club.
 *  • The note is the aim tip from the club's direction (rounds, else Trackman) plus
 *    the club's own note from the Clubs tab.
 */
import type { ClubDistance, Round } from '../types';
import { CLUBS, withLoft, type Lofts } from '../data/clubs';

export const THREE_QUARTER = 0.85;
export const FULL_TOLERANCE = 5;      // metres
export const AIM_MIN_ROUND_SHOTS = 5; // round shots needed before rounds beat Trackman for the aim tip
export const AIM_SIDE_PCT = 50;       // one side ≥ 50 % …
export const AIM_GAP_PCT = 25;        // … and ≥ 25 pts more than the other side → aim tip

// ── Direction (L / C / R) ────────────────────────────────────────────────────

export interface LCR { left: number; centre: number; right: number; shots?: number } // percentages

/** "L17% C17% R67%" (any order, parts optional) → numbers; null if nothing usable. */
export const parseLCR = (s?: string): LCR | null => {
  if (!s) return null;
  const get = (k: string) => { const m = s.match(new RegExp(`${k}\\s*(\\d+(?:\\.\\d+)?)\\s*%`, 'i')); return m ? Math.round(parseFloat(m[1])) : 0; };
  const v = { left: get('L'), centre: get('C'), right: get('R') };
  return v.left + v.centre + v.right > 0 ? v : null;
};

export const formatLCR = (d: LCR) =>
  [d.left ? `L${d.left}%` : '', d.centre ? `C${d.centre}%` : '', d.right ? `R${d.right}%` : ''].filter(Boolean).join(' ') || '—';

/**
 * Direction per club from round strokes: Left / Right as logged in the 3×3 grid
 * (Short Left counts as Left, etc.); target, Short and Long count as centre.
 */
export const roundDirections = (rounds: Round[]): Record<string, LCR> => {
  const tally: Record<string, { l: number; c: number; r: number }> = {};
  for (const r of rounds) {
    for (const h of r.holeData ?? []) {
      for (const s of h.strokes ?? []) {
        if (!s || typeof s !== 'object' || !s.club || !s.direction || s.club === 'Putter') continue;
        const t = (tally[s.club] ??= { l: 0, c: 0, r: 0 });
        if (s.direction.includes('Left')) t.l++;
        else if (s.direction.includes('Right')) t.r++;
        else t.c++;
      }
    }
  }
  const out: Record<string, LCR> = {};
  for (const [club, t] of Object.entries(tally)) {
    const n = t.l + t.c + t.r;
    out[club] = { left: Math.round((t.l / n) * 100), centre: Math.round((t.c / n) * 100), right: Math.round((t.r / n) * 100), shots: n };
  }
  return out;
};

/** "tends right (67% · rounds) — aim left", or null when the club is balanced / unknown. */
export const aimTip = (trackman: LCR | null, rounds: LCR | undefined): string | null => {
  const useRounds = !!rounds && (rounds.shots ?? 0) >= AIM_MIN_ROUND_SHOTS;
  const d = useRounds ? rounds! : trackman;
  if (!d) return null;
  const src = useRounds ? `${rounds!.shots} round shots` : 'Trackman';
  if (d.right >= AIM_SIDE_PCT && d.right - d.left >= AIM_GAP_PCT) return `Tends right (${d.right}% · ${src}) — aim left`;
  if (d.left >= AIM_SIDE_PCT && d.left - d.right >= AIM_GAP_PCT) return `Tends left (${d.left}% · ${src}) — aim right`;
  return null;
};

// ── Options & advice ─────────────────────────────────────────────────────────

export interface CaddieOption {
  club: string;
  full: boolean;
  target: number;   // metres the swing is expected to carry
  label: string;    // "GW 52° full", "9i ¾"
}

export const carryOf = (d?: ClubDistance) => {
  const n = parseFloat((d?.carry ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const HAS_THREE_QUARTER = (club: string) => /i$/.test(club) || ['PW', 'GW', 'SW', 'LW'].includes(club);

export const buildOptions = (clubDistances: Record<string, ClubDistance>, lofts: Lofts): CaddieOption[] => {
  const opts: CaddieOption[] = [];
  for (const club of CLUBS) {
    const carry = carryOf(clubDistances[club]);
    if (!carry) continue;
    const name = withLoft(club, lofts);
    opts.push({ club, full: true, target: carry, label: `${name} full` });
    if (HAS_THREE_QUARTER(club)) opts.push({ club, full: false, target: Math.round(carry * THREE_QUARTER), label: `${name} ¾` });
  }
  return opts;
};

export const pickAdvice = (opts: CaddieOption[], distance: number) => {
  if (opts.length === 0) return null;
  const gap = (o: CaddieOption) => Math.abs(o.target - distance);
  const byGap = [...opts].sort((a, b) => gap(a) - gap(b) || Number(b.full) - Number(a.full));
  const longest = [...opts].filter(o => o.full).sort((a, b) => b.target - a.target)[0];
  const nearFull = byGap.find(o => o.full && gap(o) <= FULL_TOLERANCE);
  const best = distance > (longest?.target ?? Infinity) ? longest : nearFull ?? byGap[0];
  const alt = byGap.find(o => o.club !== best.club) ?? null;
  const layup = [...opts]
    .filter(o => o.full && o.club !== best.club && o.target < Math.min(best.target, distance))
    .sort((a, b) => b.target - a.target)[0] ?? null;
  return { best, alt, layup };
};
