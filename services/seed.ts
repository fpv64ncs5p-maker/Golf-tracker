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

async function upsertCourse(courseData: Course, storedCourses: Course[]): Promise<Course[]> {
  const existingIndex = storedCourses.findIndex(
    c => c.id === courseData.id || c.name === courseData.name
  );

  if (existingIndex >= 0) {
    return storedCourses.map((c, i) => {
      if (i !== existingIndex) return c;
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
        };
      });
      return { ...courseData, id: c.id, tees: mergedTees };
    });
  } else {
    return [...storedCourses, courseData];
  }
}

async function seedCourses(): Promise<void> {
  let courses = await getCourses();

  // Remove any old duplicate entries
  courses = courses.filter(c => !OLD_COURSE_NAMES.includes(c.name));

  // Upsert each course from ALL_COURSES
  for (const courseData of ALL_COURSES) {
    courses = await upsertCourse(courseData, courses);
  }

  await saveCourses(courses);
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
