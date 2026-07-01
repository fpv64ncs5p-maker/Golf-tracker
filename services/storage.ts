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
} from '../types';

// ── Generic Supabase helpers ────────────────────────────────────────────────

async function getFromSupabase<T>(table: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('data')
      .eq('id', 'singleton')
      .limit(1);
    if (error) { console.error(`[Storage] Read error "${table}":`, error); return null; }
    if (!data || data.length === 0) return null;
    return data[0].data as T;
  } catch (error) {
    console.error(`[Storage] Error reading "${table}":`, error);
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

// ── Sessions ────────────────────────────────────────────────────────────────

export async function getSessions(): Promise<PracticeSession[]> {
  const result = await getFromSupabase<PracticeSession[]>('sessions');
  return result ?? [];
}

export async function saveSessions(sessions: PracticeSession[]): Promise<void> {
  await saveToSupabase('sessions', sessions);
}

// ── Rounds ──────────────────────────────────────────────────────────────────

export async function getRounds(): Promise<Round[]> {
  const result = await getFromSupabase<Round[]>('rounds');
  return result ?? [];
}

export async function saveRounds(rounds: Round[]): Promise<void> {
  await saveToSupabase('rounds', rounds);
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
  return result ?? [];
}

export async function saveRangeDrills(drills: RangeDrill[]): Promise<void> {
  await saveToSupabase('range_drills', drills, true);
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
