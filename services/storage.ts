/**
 * Golf Tracker Storage Service
 *
 * Centralized, typed access to AsyncStorage with error handling and default values.
 * All getters return typed results safely, with graceful error handling.
 * All setters handle errors without throwing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PracticeSession,
  Round,
  Course,
  ClubDistance,
  DraftRound,
} from '../types';

/**
 * Generic safe JSON getter with error handling
 * @param key - Storage key
 * @returns Typed value or null if not found or parse fails
 */
async function getItem<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[Storage] Error reading key "${key}":`, error);
    return null;
  }
}

/**
 * Generic safe JSON setter with error handling
 * @param key - Storage key
 * @param value - Value to store
 */
async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[Storage] Error writing key "${key}":`, error);
  }
}

/**
 * Get all practice sessions
 * @returns Array of practice sessions, or empty array if none exist
 */
export async function getSessions(): Promise<PracticeSession[]> {
  const result = await getItem<PracticeSession[]>('sessions');
  return result ?? [];
}

/**
 * Save practice sessions
 * @param sessions - Array of sessions to store
 */
export async function saveSessions(sessions: PracticeSession[]): Promise<void> {
  await setItem('sessions', sessions);
}

/**
 * Get all completed rounds
 * @returns Array of rounds, or empty array if none exist
 */
export async function getRounds(): Promise<Round[]> {
  const result = await getItem<Round[]>('rounds');
  return result ?? [];
}

/**
 * Save all rounds
 * @param rounds - Array of rounds to store
 */
export async function saveRounds(rounds: Round[]): Promise<void> {
  await setItem('rounds', rounds);
}

/**
 * Get all courses
 * @returns Array of courses, or empty array if none exist
 */
export async function getCourses(): Promise<Course[]> {
  const result = await getItem<Course[]>('courses');
  return result ?? [];
}

/**
 * Save all courses
 * @param courses - Array of courses to store
 */
export async function saveCourses(courses: Course[]): Promise<void> {
  await setItem('courses', courses);
}

/**
 * Get club distance reference data
 * @returns Object with club names as keys, or empty object if none exist
 */
export async function getClubDistances(): Promise<Record<string, ClubDistance>> {
  const result = await getItem<Record<string, ClubDistance>>('clubDistances');
  return result ?? {};
}

/**
 * Save club distance reference data
 * @param data - Object with club distance data
 */
export async function saveClubDistances(
  data: Record<string, ClubDistance>
): Promise<void> {
  await setItem('clubDistances', data);
}

/**
 * Get the current draft round (round in progress)
 * @returns Draft round or null if not in progress
 */
export async function getDraftRound(): Promise<DraftRound | null> {
  return await getItem<DraftRound>('draftRound');
}

/**
 * Save a draft round
 * @param draft - Draft round to store
 */
export async function saveDraftRound(draft: DraftRound): Promise<void> {
  await setItem('draftRound', draft);
}

/**
 * Clear the draft round (typically after saving a completed round)
 */
export async function clearDraftRound(): Promise<void> {
  try {
    await AsyncStorage.removeItem('draftRound');
  } catch (error) {
    console.error('[Storage] Error clearing draft round:', error);
  }
}
