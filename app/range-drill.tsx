import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { getCourses, getRangeDrills, saveRangeDrills } from '../services/storage';
import type { Course, RangeDrill, RangeDrillHole, RangeDrillShot } from '../types';

// ── Club list ─────────────────────────────────────────────────────────────────

const CLUBS = [
  'Driver', '3W', '5W', '4H', '5H',
  '4i', '5i', '6i', '7i', '8i', '9i',
  'PW', 'GW', 'SW', 'LW',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtVsPar = (v: number) => (v === 0 ? 'E' : v > 0 ? `+${v}` : `${v}`);
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

type Phase = 'selecting' | 'active' | 'complete';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RangeDrillScreen() {
  // ── Phase state ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('selecting');

  // ── Selecting ──────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // ── Active ─────────────────────────────────────────────────────────────────
  const [holeIndex, setHoleIndex] = useState(0);
  const [completedHoles, setCompletedHoles] = useState<RangeDrillHole[]>([]);
  const [currentShots, setCurrentShots] = useState<RangeDrillShot[]>([]);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [distanceInput, setDistanceInput] = useState('');

  // ── Complete ───────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState('');

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getCourses().then(setCourses);
  }, []);

  // Start timer when drill becomes active
  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const holeDefinitions = selectedCourse?.holes ?? [];
  const currentHoleDef = holeDefinitions[holeIndex];
  const totalHoles = holeDefinitions.length;

  // ── Actions ────────────────────────────────────────────────────────────────

  const startDrill = (course: Course) => {
    if (!course.holes || course.holes.length === 0) {
      const msg = 'This course has no hole data. Add holes in Manage Courses first.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No hole data', msg);
      return;
    }
    setSelectedCourse(course);
    setHoleIndex(0);
    setCompletedHoles([]);
    setCurrentShots([]);
    setSelectedClub(null);
    setDistanceInput('');
    setSeconds(0);
    setPhase('active');
  };

  const addShot = () => {
    if (!selectedClub) {
      const msg = 'Select a club before adding a shot.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No club selected', msg);
      return;
    }
    const dist = distanceInput ? parseInt(distanceInput) : null;
    setCurrentShots(prev => [...prev, { club: selectedClub, distance: dist }]);
    setDistanceInput('');
    // Keep club selected for convenience (next shot usually same club)
  };

  const removeShot = (index: number) => {
    setCurrentShots(prev => prev.filter((_, i) => i !== index));
  };

  const onGreen = () => {
    if (currentShots.length === 0) {
      const msg = 'Add at least one shot before marking this hole complete.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No shots logged', msg);
      return;
    }
    const finishedHole: RangeDrillHole = {
      hole: currentHoleDef.hole,
      par: currentHoleDef.par,
      courseDistance: currentHoleDef.distance ?? null,
      shots: [...currentShots],
    };
    const newCompleted = [...completedHoles, finishedHole];
    setCompletedHoles(newCompleted);
    setCurrentShots([]);
    setSelectedClub(null);
    setDistanceInput('');

    if (holeIndex + 1 >= totalHoles) {
      setPhase('complete');
    } else {
      setHoleIndex(holeIndex + 1);
    }
  };

  const saveDrill = async () => {
    if (!selectedCourse) return;
    try {
      const drill: RangeDrill = {
        id: Date.now().toString(),
        courseId: selectedCourse.id,
        courseName: selectedCourse.name,
        date: new Date().toISOString(),
        duration: seconds,
        notes,
        holes: completedHoles,
      };
      const existing = await getRangeDrills();
      await saveRangeDrills([...existing, drill]);
      router.back();
    } catch (e) {
      console.error('Error saving range drill', e);
    }
  };

  const confirmDiscard = () => {
    const msg = 'Discard this drill? Your progress will be lost.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) router.back();
    } else {
      Alert.alert('Discard drill?', msg, [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    }
  };

  // ── Score summary helpers ──────────────────────────────────────────────────

  const totalStrokes = completedHoles.reduce((s, h) => s + h.shots.length, 0);
  const totalPar = completedHoles.reduce((s, h) => s + h.par, 0);
  const totalVsPar = totalStrokes - totalPar;

  // ── Render ─────────────────────────────────────────────────────────────────

  // PHASE: Selecting
  if (phase === 'selecting') {
    const grouped: Record<string, Course[]> = {};
    for (const c of courses) {
      const key = c.country || 'Other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    }
    const countries = Object.keys(grouped).sort();

    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏌️ Range Drill</Text>
        <Text style={styles.subtitle}>Pick a course to simulate</Text>

        {courses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⛳</Text>
            <Text style={styles.emptyTitle}>No courses yet</Text>
            <Text style={styles.emptySubtitle}>Add courses with hole data in Manage Courses first.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/courses')}>
              <Text style={styles.emptyBtnText}>Manage Courses</Text>
            </TouchableOpacity>
          </View>
        ) : (
          countries.map(country => (
            <View key={country}>
              <Text style={styles.countryLabel}>{country}</Text>
              {grouped[country].map(course => {
                const holeCount = course.holes?.length ?? 0;
                const hasHoles = holeCount > 0;
                return (
                  <TouchableOpacity
                    key={course.id}
                    style={[styles.courseRow, !hasHoles && styles.courseRowDisabled]}
                    onPress={() => startDrill(course)}
                    disabled={!hasHoles}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.courseName, !hasHoles && styles.courseNameDisabled]}>
                        {course.name}
                      </Text>
                      <Text style={styles.courseSubtext}>
                        {hasHoles ? `${holeCount} holes` : 'No hole data — add in Manage Courses'}
                      </Text>
                    </View>
                    {hasHoles && <Text style={styles.courseArrow}>▶</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  // PHASE: Active
  if (phase === 'active' && currentHoleDef) {
    const holeStrokes = currentShots.length;
    const completedCount = completedHoles.length;

    return (
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* ── Header ── */}
        <View style={styles.activeHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.courseTitleSmall}>{selectedCourse?.name}</Text>
            <Text style={styles.progressText}>
              Hole {completedCount + 1} of {totalHoles}
            </Text>
          </View>
          <Text style={styles.timer}>{fmtTime(seconds)}</Text>
          <TouchableOpacity onPress={confirmDiscard} style={styles.discardBtn}>
            <Text style={styles.discardText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hole card ── */}
        <View style={styles.holeCard}>
          <View style={styles.holeCardLeft}>
            <Text style={styles.holeNumber}>Hole {currentHoleDef.hole}</Text>
            <Text style={styles.holePar}>Par {currentHoleDef.par}</Text>
          </View>
          {currentHoleDef.distance && (
            <View style={styles.holeCardRight}>
              <Text style={styles.holeDistance}>📏 {currentHoleDef.distance}m</Text>
            </View>
          )}
        </View>

        {/* ── Shots logged this hole ── */}
        <ScrollView style={styles.shotsScroll} contentContainerStyle={styles.shotsContent}>
          {currentShots.length === 0 ? (
            <Text style={styles.shotsEmpty}>No shots yet — log your first shot below</Text>
          ) : (
            currentShots.map((shot, i) => (
              <View key={i} style={styles.shotRow}>
                <Text style={styles.shotNumber}>#{i + 1}</Text>
                <Text style={styles.shotClub}>{shot.club}</Text>
                <Text style={styles.shotDist}>{shot.distance != null ? `${shot.distance}m` : '—'}</Text>
                <TouchableOpacity onPress={() => removeShot(i)} style={styles.shotRemove}>
                  <Text style={styles.shotRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* ── Input panel ── */}
        <View style={styles.inputPanel}>
          {/* Club chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.clubScroll}
            contentContainerStyle={styles.clubScrollContent}
          >
            {CLUBS.map(club => (
              <TouchableOpacity
                key={club}
                style={[styles.clubChip, selectedClub === club && styles.clubChipSelected]}
                onPress={() => setSelectedClub(selectedClub === club ? null : club)}
              >
                <Text style={[styles.clubChipText, selectedClub === club && styles.clubChipTextSelected]}>
                  {club}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Distance + Add */}
          <View style={styles.shotInputRow}>
            <TextInput
              placeholder="Distance (m)"
              value={distanceInput}
              onChangeText={setDistanceInput}
              keyboardType="numeric"
              style={styles.distInput}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addShotBtn, !selectedClub && styles.addShotBtnDisabled]}
              onPress={addShot}
            >
              <Text style={styles.addShotBtnText}>+ Shot</Text>
            </TouchableOpacity>
          </View>

          {/* On the Green */}
          <TouchableOpacity
            style={[styles.onGreenBtn, holeStrokes === 0 && styles.onGreenBtnDisabled]}
            onPress={onGreen}
          >
            <Text style={styles.onGreenBtnText}>
              ✅ On the Green{holeStrokes > 0 ? ` · ${holeStrokes} stroke${holeStrokes !== 1 ? 's' : ''}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // PHASE: Complete
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏁 Drill Complete!</Text>
      <Text style={styles.subtitle}>{selectedCourse?.name}</Text>

      {/* Score summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalStrokes}</Text>
            <Text style={styles.summaryLabel}>Strokes</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalPar}</Text>
            <Text style={styles.summaryLabel}>Par</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[
              styles.summaryValue,
              totalVsPar < 0 && styles.underPar,
              totalVsPar === 0 && styles.evenPar,
              totalVsPar > 0 && styles.overPar,
            ]}>
              {fmtVsPar(totalVsPar)}
            </Text>
            <Text style={styles.summaryLabel}>vs Par</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{fmtTime(seconds)}</Text>
            <Text style={styles.summaryLabel}>Duration</Text>
          </View>
        </View>
      </View>

      {/* Hole-by-hole scorecard */}
      <Text style={styles.scorecardTitle}>Scorecard</Text>
      <View style={styles.scorecardHeader}>
        <Text style={[styles.scCol, styles.scColHole, styles.scHeaderText]}>#</Text>
        <Text style={[styles.scCol, styles.scColPar, styles.scHeaderText]}>Par</Text>
        <Text style={[styles.scCol, styles.scColStrokes, styles.scHeaderText]}>Strokes</Text>
        <Text style={[styles.scCol, styles.scColVsPar, styles.scHeaderText]}>+/-</Text>
        <Text style={[styles.scColClubs, styles.scHeaderText]}>Clubs</Text>
      </View>
      {completedHoles.map((h, i) => {
        const vp = h.shots.length - h.par;
        const clubSummary = h.shots.map(s => s.club).join(', ');
        return (
          <View key={i} style={[styles.scorecardRow, i % 2 === 0 && styles.scorecardRowAlt]}>
            <Text style={[styles.scCol, styles.scColHole, styles.scHoleNum]}>{h.hole}</Text>
            <Text style={[styles.scCol, styles.scColPar, styles.scText]}>{h.par}</Text>
            <Text style={[styles.scCol, styles.scColStrokes, styles.scText]}>{h.shots.length}</Text>
            <Text style={[
              styles.scCol, styles.scColVsPar,
              vp < 0 && styles.underPar,
              vp === 0 && styles.evenPar,
              vp > 0 && styles.overPar,
              styles.scVsParText,
            ]}>
              {fmtVsPar(vp)}
            </Text>
            <Text style={[styles.scColClubs, styles.scClubText]} numberOfLines={1}>{clubSummary}</Text>
          </View>
        );
      })}

      {/* Notes */}
      <TextInput
        placeholder="Notes (optional)..."
        value={notes}
        onChangeText={setNotes}
        style={styles.notesInput}
        multiline
        returnKeyType="done"
        blurOnSubmit
      />

      <TouchableOpacity style={styles.saveBtn} onPress={saveDrill}>
        <Text style={styles.saveBtnText}>💾 Save Drill</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.discardFinalBtn} onPress={confirmDiscard}>
        <Text style={styles.discardFinalText}>Discard</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  wrapper: { flex: 1, backgroundColor: '#fff' },

  backBtn: { marginBottom: 4, marginTop: 4 },
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: 10, marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24 },

  // Selecting phase
  countryLabel: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, marginBottom: 10, backgroundColor: '#fafafa' },
  courseRowDisabled: { opacity: 0.45 },
  courseName: { fontSize: 16, fontWeight: '600', color: '#333' },
  courseNameDisabled: { color: '#bbb' },
  courseSubtext: { fontSize: 13, color: '#888', marginTop: 2 },
  courseArrow: { fontSize: 14, color: '#4CAF50', fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Active phase
  activeHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  courseTitleSmall: { fontSize: 13, color: '#888', fontWeight: '500' },
  progressText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 2 },
  timer: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50', marginHorizontal: 12 },
  discardBtn: { padding: 6 },
  discardText: { fontSize: 18, color: '#bbb', fontWeight: '600' },

  holeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: '#1565C0', borderRadius: 16, padding: 16,
  },
  holeCardLeft: {},
  holeNumber: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  holePar: { fontSize: 14, color: '#bbdefb', marginTop: 2 },
  holeCardRight: {},
  holeDistance: { fontSize: 18, fontWeight: 'bold', color: '#fff' },

  shotsScroll: { flex: 1, paddingHorizontal: 16 },
  shotsContent: { paddingVertical: 8 },
  shotsEmpty: { textAlign: 'center', color: '#bbb', marginTop: 24, fontSize: 14 },
  shotRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 8,
  },
  shotNumber: { width: 24, fontSize: 12, color: '#aaa', fontWeight: '600' },
  shotClub: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  shotDist: { fontSize: 15, color: '#4CAF50', fontWeight: '600', width: 60, textAlign: 'right' },
  shotRemove: { paddingHorizontal: 8, paddingVertical: 4 },
  shotRemoveText: { fontSize: 14, color: '#ccc' },

  inputPanel: {
    borderTopWidth: 1, borderTopColor: '#eee',
    padding: 14, backgroundColor: '#fff',
  },
  clubScroll: { marginBottom: 10 },
  clubScrollContent: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  clubChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f5f5f5',
  },
  clubChipSelected: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  clubChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  clubChipTextSelected: { color: '#fff' },

  shotInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  distInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 10, fontSize: 15, backgroundColor: '#fafafa',
  },
  addShotBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#4CAF50', borderRadius: 10, justifyContent: 'center',
  },
  addShotBtnDisabled: { backgroundColor: '#ccc' },
  addShotBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  onGreenBtn: {
    backgroundColor: '#2e7d32', padding: 14,
    borderRadius: 14, alignItems: 'center',
  },
  onGreenBtnDisabled: { backgroundColor: '#ccc' },
  onGreenBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Complete phase
  summaryCard: {
    backgroundColor: '#f0f7ff', borderRadius: 16,
    padding: 16, marginBottom: 20,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 26, fontWeight: 'bold', color: '#1565C0' },
  summaryLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  underPar: { color: '#2e7d32' },
  evenPar: { color: '#888' },
  overPar: { color: '#e53935' },

  scorecardTitle: {
    fontSize: 13, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  scorecardHeader: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 2,
  },
  scHeaderText: { fontSize: 11, fontWeight: 'bold', color: '#999' },
  scorecardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 2 },
  scorecardRowAlt: { backgroundColor: '#fafafa' },
  scCol: { textAlign: 'center' },
  scColHole: { width: 28 },
  scColPar: { width: 36 },
  scColStrokes: { width: 52 },
  scColVsPar: { width: 40 },
  scColClubs: { flex: 1, paddingLeft: 6 },
  scHoleNum: { fontSize: 13, fontWeight: 'bold', color: '#555' },
  scText: { fontSize: 13, color: '#444' },
  scVsParText: { fontSize: 13, fontWeight: '600' },
  scClubText: { fontSize: 12, color: '#888' },

  notesInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, fontSize: 14, backgroundColor: '#fafafa',
    minHeight: 60, marginVertical: 16,
  },
  saveBtn: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  discardFinalBtn: { alignItems: 'center', marginTop: 14, padding: 10 },
  discardFinalText: { color: '#bbb', fontSize: 14 },
});
