/**
 * Golf Tracker Storage Service
 *
 * Centralized, typed access to Supabase (cloud) with AsyncStorage fallback
 * for draft round (transient, device-specific data).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type {
  PracticeSession,
  Round,
  Course,
  ClubDistance,
  DraftRound,
  DraftSession,
  RangeDrill,
  DraftRangeDrill,
  DraftImport,
  DraftCourseEdit,
} from '../types';

// ── Generic Supabase helpers ────────────────────────────────────────────────

// Tracks failed Supabase reads so screens can tell "fetch failed" apart from
// "no data yet" (e.g. during a Supabase outage the app used to just look empty).
let readFailures = 0;

/**
 * Returns true if any Supabase read failed since the last call, then resets.
 * Call after a screen's load routine to decide whether to show an error banner.
 */
export function consumeReadError(): boolean {
  const failed = readFailures > 0;
  readFailures = 0;
  return failed;
}

async function getFromSupabase<T>(table: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('data')
      .eq('id', 'singleton')
      .limit(1);
    if (error) {
      console.error(`[Storage] Read error "${table}":`, error);
      readFailures++;
      return null;
    }
    if (!data || data.length === 0) return null;
    return data[0].data as T;
  } catch (error) {
    console.error(`[Storage] Error reading "${table}":`, error);
    readFailures++;
    return null;
  }
}

async function saveToSupabase<T>(
  table: string,
  value: T,
  throwOnError = false,
): Promise<void> {
  try {
    const { error } = await supabase
      .from(table)
      .upsert({ id: 'singleton', data: value });
    if (error) {
      console.error(`[Storage] Write error "${table}":`, error);
      if (throwOnError) throw error;
    }
  } catch (error) {
    console.error(`[Storage] Error writing "${table}":`, error);
    if (throwOnError) throw error;
  }
}

// ── Played-date order ───────────────────────────────────────────────────────
// Sessions, rounds and range drills are always kept oldest → newest by the date
// they were PLAYED (their `date` field), not the order they were logged in.
// Reads sort and saves sort, so every screen's index (the Dashboard shows the
// list reversed, detail screens use `length - 1 - index`) refers to the same
// order, and "most recent N" logic (handicap last 20, adaptive targets) is by date.
// The sort is stable: items with the same date keep their logged order.

const playedTime = (date: string) => {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => playedTime(a.date) - playedTime(b.date));
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function getSessions(): Promise<PracticeSession[]> {
  const result = await getFromSupabase<PracticeSession[]>('sessions');
  return sortByDate(result ?? []);
}

export async function saveSessions(sessions: PracticeSession[]): Promise<void> {
  await saveToSupabase('sessions', sortByDate(sessions));
}

// ── Rounds ──────────────────────────────────────────────────────────────────

export async function getRounds(): Promise<Round[]> {
  const result = await getFromSupabase<Round[]>('rounds');
  return sortByDate(result ?? []);
}

export async function saveRounds(rounds: Round[]): Promise<void> {
  await saveToSupabase('rounds', sortByDate(rounds));
}

// ── Courses ─────────────────────────────────────────────────────────────────

export async function getCourses(): Promise<Course[]> {
  const result = await getFromSupabase<Course[]>('courses');
  return result ?? [];
}

export async function saveCourses(courses: Course[]): Promise<void> {
  await saveToSupabase('courses', courses);
}

// ── Club Distances ───────────────────────────────────────────────────────────

export async function getClubDistances(): Promise<Record<string, ClubDistance>> {
  const result = await getFromSupabase<Record<string, ClubDistance>>('club_distances');
  return result ?? {};
}

export async function saveClubDistances(
  data: Record<string, ClubDistance>
): Promise<void> {
  await saveToSupabase('club_distances', data);
}

// ── Range Drills ─────────────────────────────────────────────────────────────

export async function getRangeDrills(): Promise<RangeDrill[]> {
  const result = await getFromSupabase<RangeDrill[]>('range_drills');
  return sortByDate(result ?? []);
}

export async function saveRangeDrills(drills: RangeDrill[]): Promise<void> {
  await saveToSupabase('range_drills', sortByDate(drills), true);
}

// ── Draft Round (stays local — transient data) ───────────────────────────────

export async function getDraftRound(): Promise<DraftRound | null> {
  try {
    const value = await AsyncStorage.getItem('draftRound');
    if (value === null) return null;
    return JSON.parse(value) as DraftRound;
  } catch {
    return null;
  }
}

export async function saveDraftRound(draft: DraftRound): Promise<void> {
  try {
    await AsyncStorage.setItem('draftRound', JSON.stringify(draft));
  } catch (error) {
    console.error('[Storage] Error saving draft round:', error);
  }
}

export async function clearDraftRound(): Promise<void> {
  try {
    await AsyncStorage.removeItem('draftRound');
  } catch (error) {
    console.error('[Storage] Error clearing draft round:', error);
  }
}

// ── Draft Import / Draft Course Edit (local, transient) ──────────────────────
// Unfinished forms, so a screen-off never costs typing.

async function getLocal<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value === null ? null : (JSON.parse(value) as T);
  } catch {
    return null;
  }
}

async function saveLocal<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[Storage] Error saving "${key}":`, error);
  }
}

async function clearLocal(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`[Storage] Error clearing "${key}":`, error);
  }
}

export const getDraftImport = () => getLocal<DraftImport>('draftImport');
export const saveDraftImport = (draft: DraftImport) => saveLocal('draftImport', draft);
export const clearDraftImport = () => clearLocal('draftImport');

// Course edits are keyed per course (and per tee) so two half-finished forms don't collide.
const courseEditKey = (courseId: string, teeName?: string) =>
  `draftCourseEdit:${courseId}:${teeName ?? 'holes'}`;
export const getDraftCourseEdit = (courseId: string, teeName?: string) =>
  getLocal<DraftCourseEdit>(courseEditKey(courseId, teeName));
export const saveDraftCourseEdit = (draft: DraftCourseEdit) =>
  saveLocal(courseEditKey(draft.courseId, draft.teeName), draft);
export const clearDraftCourseEdit = (courseId: string, teeName?: string) =>
  clearLocal(courseEditKey(courseId, teeName));

// ── Draft Session (stays local — transient data) ─────────────────────────────

export async function getDraftSession(): Promise<DraftSession | null> {
  try {
    const value = await AsyncStorage.getItem('draftSession');
    if (value === null) return null;
    return JSON.parse(value) as DraftSession;
  } catch {
    return null;
  }
}

export async function saveDraftSession(draft: DraftSession): Promise<void> {
  try {
    await AsyncStorage.setItem('draftSession', JSON.stringify(draft));
  } catch (error) {
    console.error('[Storage] Error saving draft session:', error);
  }
}

export async function clearDraftSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem('draftSession');
  } catch (error) {
    console.error('[Storage] Error clearing draft session:', error);
  }
}

// ── Draft Range Drill (stays local — transient data) ─────────────────────────

export async function getDraftRangeDrill(): Promise<DraftRangeDrill | null> {
  try {
    const value = await AsyncStorage.getItem('draftRangeDrill');
    if (value === null) return null;
    return JSON.parse(value) as DraftRangeDrill;
  } catch {
    return null;
  }
}

export async function saveDraftRangeDrill(draft: DraftRangeDrill): Promise<void> {
  try {
    await AsyncStorage.setItem('draftRangeDrill', JSON.stringify(draft));
  } catch (error) {
    console.error('[Storage] Error saving draft range drill:', error);
  }
}

export async function clearDraftRangeDrill(): Promise<void> {
  try {
    await AsyncStorage.removeItem('draftRangeDrill');
  } catch (error) {
    console.error('[Storage] Error clearing draft range drill:', error);
  }
}
