import type { TeeData, NineRating } from '../types';

export type NineHalf = 'front' | 'back';

export interface PlayRating {
  par: number | null;
  rating: number | null;
  slope: number | null;
  /** true when these came from an official 9-hole rating rather than the 18-hole one */
  isOfficialNine: boolean;
}

/**
 * Resolve the Par / Course Rating / Slope that apply to the holes actually played.
 *
 * WHS rates each nine separately: a nine's Course Rating is not half the 18-hole CR,
 * and its Slope usually differs from the 18-hole Slope (at Campo Real off Red the back
 * nine is 34.8/129 while the front is 35.6/123 - halving 70.4/126 gets both wrong).
 *
 * When the course has no official 9-hole rating we fall back to the old behaviour:
 * halve the 18-hole CR and keep the 18-hole Slope. That is an approximation, and
 * `isOfficialNine: false` lets the UI say so.
 */
export function ratingForPlay(
  teeData: TeeData | undefined | null,
  holesPlayed: number,
  nine?: NineHalf,
  isNineHoleCourse = false,
): PlayRating {
  if (!teeData) return { par: null, rating: null, slope: null, isOfficialNine: false };

  // A 9-hole course's stored values already describe nine holes.
  if (isNineHoleCourse) {
    return {
      par: teeData.par == null ? null : (holesPlayed > 9 ? teeData.par * 2 : teeData.par),
      rating: teeData.rating,
      slope: teeData.slope,
      isOfficialNine: false,
    };
  }

  // Full 18 on an 18-hole course.
  if (holesPlayed > 9) {
    return { par: teeData.par, rating: teeData.rating, slope: teeData.slope, isOfficialNine: false };
  }

  // Nine holes on an 18-hole course.
  const official: NineRating | undefined = nine === 'back' ? teeData.back9 : teeData.front9;
  if (official?.rating != null && official?.slope != null) {
    return {
      par: official.par ?? (teeData.par == null ? null : Math.round(teeData.par / 2)),
      rating: official.rating,
      slope: official.slope,
      isOfficialNine: true,
    };
  }

  // Fallback: halve the 18-hole CR, keep the 18-hole Slope.
  return {
    par: teeData.par == null ? null : Math.round(teeData.par / 2),
    rating: teeData.rating == null ? null : Math.round((teeData.rating / 2) * 10) / 10,
    slope: teeData.slope,
    isOfficialNine: false,
  };
}

/** True when this tee publishes at least one official 9-hole rating. */
export function hasNineRatings(teeData: TeeData | undefined | null): boolean {
  if (!teeData) return false;
  return (teeData.front9?.rating != null && teeData.front9?.slope != null)
    || (teeData.back9?.rating != null && teeData.back9?.slope != null);
}
