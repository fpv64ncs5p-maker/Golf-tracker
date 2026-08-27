import type { Course } from '../types';

export const COUNTRY_FLAG: Record<string, string> = {
  Netherlands: '🇳🇱',
  Portugal: '🇵🇹',
};

export interface CourseGrouping {
  /** Every country present, alphabetical. Show tabs only when length > 1. */
  countries: string[];
  activeCountryKey: string | null;
  /** Club sub-tabs within the active country: named clubs alphabetical, then 'Other'. */
  clubTabs: string[];
  hasClubTabs: boolean;
  activeClubKey: string | null;
  /** The courses to render for the current country + club selection. */
  visibleCourses: Course[];
}

/**
 * Two-level grouping (country → club) shared by the course editor and round setup.
 *
 * Kept in one place on purpose: these two screens previously disagreed about what a
 * course contained (the editor drew tees from a hardcoded list while round setup read
 * the course's own), and the mismatch hid Campo Real's Black, Green and Purple tees.
 *
 * Pass the user's current tab selections; nulls fall back to the first tab.
 */
export function groupCourses(
  courses: Course[],
  activeCountry: string | null,
  activeClub: string | null,
): CourseGrouping {
  const countries = [...new Set(courses.map(c => c.country || 'Other'))].sort();
  const activeCountryKey = activeCountry || countries[0] || null;
  const coursesByCountry = courses.filter(c => (c.country || 'Other') === activeCountryKey);

  const clubMap: Record<string, Course[]> = {};
  for (const c of coursesByCountry) {
    const key = c.club || 'Other';
    if (!clubMap[key]) clubMap[key] = [];
    clubMap[key].push(c);
  }
  const clubTabs = Object.keys(clubMap).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
  const hasClubTabs = clubTabs.length > 1;
  const activeClubKey = activeClub || clubTabs[0] || null;
  const visibleCourses =
    activeClubKey && clubMap[activeClubKey] ? clubMap[activeClubKey] : coursesByCountry;

  return { countries, activeCountryKey, clubTabs, hasClubTabs, activeClubKey, visibleCourses };
}
