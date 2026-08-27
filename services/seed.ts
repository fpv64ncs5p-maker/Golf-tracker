import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_COURSES, Course } from '../data/courses';
import { DEFAULT_CLUB_DISTANCES, OLD_KEY_MAP } from '../data/clubs';
import { getCourses, saveCourses, getClubDistances, saveClubDistances } from './storage';

// List of old course names to remove during migration
const OLD_COURSE_NAMES = [
  'Short golf Utrecht Par 3',
  'Short Golf Utrecht Par 3',
  'Short golf utrecht par 3/4',
  'Short Golf Utrecht Par 3/4',
  'Gendersteyn — Blauwe lus',
];

async function upsertCourse(
  courseData: Course,
  storedCourses: Course[],
  forceTees = false,
): Promise<Course[]> {
  const existingIndex = storedCourses.findIndex(
    c => c.id === courseData.id || c.name === courseData.name
  );

  if (existingIndex >= 0) {
    return storedCourses.map((c, i) => {
      if (i !== existingIndex) return c;
      // Corrected seed data wins outright for the TEES — see TEE_RESEED_VERSION.
      // Holes are left alone apart from filling in a Stroke Index the user lacks,
      // so any distances or pars they edited themselves survive.
      if (forceTees) {
        const storedHoles = c.holes || [];
        const holes = storedHoles.length > 0
          ? storedHoles.map(h => ({
              ...h,
              strokeIndex: h.strokeIndex
                ?? courseData.holes?.find(sh => sh.hole === h.hole)?.strokeIndex
                ?? null,
            }))
          : courseData.holes;
        return { ...courseData, id: c.id, tees: courseData.tees, holes };
      }
      // Merge tees: prefer stored values if user has entered real CR/SR,
      // otherwise fall back to seed data (so new seed values propagate when stored is null)
      const mergedTees: Record<string, any> = { ...courseData.tees };
      Object.entries(c.tees).forEach(([tee, stored]: [string, any]) => {
        const seed = (courseData.tees as any)[tee];
        mergedTees[tee] = {
          ...seed,
          ...stored,
          rating: stored.rating ?? seed?.rating ?? null,
          slope:  stored.slope  ?? seed?.slope  ?? null,
          // 9-hole ratings: keep the user's if they entered any, else take the seed's.
          front9: stored.front9 ?? seed?.front9,
          back9:  stored.back9  ?? seed?.back9,
        };
      });
      return { ...courseData, id: c.id, tees: mergedTees };
    });
  } else {
    return [...storedCourses, courseData];
  }
}

/**
 * One-off corrections that must overwrite what the user already has stored.
 *
 * The normal tee merge keeps stored values (`stored.rating ?? seed.rating`) so a
 * user's own entry is never clobbered. That is right for edits, but wrong when the
 * seed itself was wrong: Campo Real shipped with the FPG *men's* table, and no merge
 * rule would ever replace it. Bumping the version re-applies the seed's tees once.
 */
const TEE_RESEED_VERSION = '2026-08-27-camporeal-women';
const TEE_RESEED_COURSE_IDS = ['campo-real'];
const TEE_RESEED_KEY = 'teeReseedVersion';

async function shouldReseedTees(): Promise<boolean> {
  try {
    const done = await AsyncStorage.getItem(TEE_RESEED_KEY);
    return done !== TEE_RESEED_VERSION;
  } catch {
    return false;
  }
}

async function markReseedDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(TEE_RESEED_KEY, TEE_RESEED_VERSION);
  } catch {
    // best effort — worst case the correction is re-applied next launch
  }
}

async function seedCourses(): Promise<void> {
  let courses = await getCourses();

  // Remove any old duplicate entries
  courses = courses.filter(c => !OLD_COURSE_NAMES.includes(c.name));

  const reseed = await shouldReseedTees();

  // Upsert each course from ALL_COURSES
  for (const courseData of ALL_COURSES) {
    const forceTees = reseed && TEE_RESEED_COURSE_IDS.includes(courseData.id);
    courses = await upsertCourse(courseData, courses, forceTees);
  }

  await saveCourses(courses);
  if (reseed) await markReseedDone();
}

async function seedClubDistances(): Promise<void> {
  const current = await getClubDistances();

  // Migrate old full-name keys (e.g. '5 Wood' → '5W') if present
  const migrated: Record<string, any> = {};
  Object.entries(current).forEach(([k, v]) => {
    const newKey = OLD_KEY_MAP[k] ?? k;
    migrated[newKey] = v;
  });

  // Merge: add default data only for clubs not already set by the user
  const merged = { ...DEFAULT_CLUB_DISTANCES, ...migrated };
  await saveClubDistances(merged);
}

export async function initializeAppData(): Promise<void> {
  try {
    await seedCourses();
    await seedClubDistances();
  } catch (error) {
    console.error('Error initializing app data:', error);
  }
}
