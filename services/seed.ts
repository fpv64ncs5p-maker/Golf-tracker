import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_COURSES, Course } from '../data/courses';
import { DEFAULT_CLUB_DISTANCES, OLD_KEY_MAP } from '../data/clubs';

// List of old course names to remove during migration
const OLD_COURSE_NAMES = [
  'Short golf Utrecht Par 3',
  'Short Golf Utrecht Par 3',
  'Short golf utrecht par 3/4',
  'Short Golf Utrecht Par 3/4',
  'Gendersteyn — Blauwe lus',
];

/**
 * Upsert a single course into the stored courses array.
 * Finds the course by id or name, updates if found, adds if not.
 * Preserves user-edited tee data.
 */
async function upsertCourse(courseData: Course, storedCourses: Course[]): Promise<Course[]> {
  const existingIndex = storedCourses.findIndex(
    c => c.id === courseData.id || c.name === courseData.name
  );

  if (existingIndex >= 0) {
    // Update existing course, preserve any user-edited tees
    return storedCourses.map((c, i) =>
      i === existingIndex
        ? { ...courseData, id: c.id, tees: { ...courseData.tees, ...c.tees } }
        : c
    );
  } else {
    // Add new course
    return [...storedCourses, courseData];
  }
}

/**
 * Seed all courses to AsyncStorage.
 * Removes old duplicate entries, upserts all default courses while preserving user tee edits.
 */
async function seedCourses(): Promise<void> {
  const data = await AsyncStorage.getItem('courses');
  let courses: Course[] = data ? JSON.parse(data) : [];

  // Remove any old duplicate entries
  courses = courses.filter(c => !OLD_COURSE_NAMES.includes(c.name));

  // Upsert each course from ALL_COURSES
  for (const courseData of ALL_COURSES) {
    courses = await upsertCourse(courseData, courses);
  }

  await AsyncStorage.setItem('courses', JSON.stringify(courses));
}

/**
 * Seed default club distances to AsyncStorage.
 * Migrates old key names and merges with user data.
 */
async function seedClubDistances(): Promise<void> {
  const existing = await AsyncStorage.getItem('clubDistances');
  const current = existing ? JSON.parse(existing) : {};

  // Migrate old full-name keys (e.g. '5 Wood' → '5W') if present
  const migrated: Record<string, any> = {};
  Object.entries(current).forEach(([k, v]) => {
    const newKey = OLD_KEY_MAP[k] ?? k;
    migrated[newKey] = v;
  });

  // Merge: add default data only for clubs not already set by the user
  const merged = { ...DEFAULT_CLUB_DISTANCES, ...migrated };
  await AsyncStorage.setItem('clubDistances', JSON.stringify(merged));
}

/**
 * Initialize app data by seeding courses and club distances.
 * Call this once on app startup.
 */
export async function initializeAppData(): Promise<void> {
  try {
    await seedCourses();
    await seedClubDistances();
  } catch (error) {
    console.error('Error initializing app data:', error);
  }
}
