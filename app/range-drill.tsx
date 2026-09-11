import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native';
import { router } from 'expo-router';
import {
  getCourses, getRangeDrills, saveRangeDrills, getSessions,
  getDraftRangeDrill, saveDraftRangeDrill, clearDraftRangeDrill,
} from '../services/storage';
import type {
  Course, HoleDefinition, RangeDrill, RangeDrillHole, RangeDrillShot, DraftRangeDrill,
} from '../types';
import {
  PUTTS_PER_HOLE, NEAR_GREEN_M, PUTT_AVG_MIN_HOLES,
  puttingCourseAverage, round1, type PuttingAverage,
} from '../constants/scoring';
import { TEE_COLOUR_MAP } from '../constants/theme';

// ── Club list ─────────────────────────────────────────────────────────────────

const CLUBS = [
  'Driver', '3W', '5W', '4H', '5H',
  '4i', '5i', '6i', '7i', '8i', '9i',
  'PW', 'GW', 'SW', 'LW',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtVsPar = (v: number) => (v === 0 ? 'E' : v > 0 ? `+${v}` : `${v}`);

// Resolve each hole's yardage for the chosen tee. Courses without per-tee
// distances silently fall back to the generic hole distance.
const holesForTee = (holes: HoleDefinition[], tee: string | null): HoleDefinition[] =>
  holes.map(h => ({
    ...h,
    distance: (tee ? h.distanceByTee?.[tee] : undefined) ?? h.distance ?? null,
  }));

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
  // Holes actually being played this drill (a course subset: full 18, front 9, or back 9)
  const [selectedHoles, setSelectedHoles] = useState<HoleDefinition[]>([]);
  // Course awaiting a tee + length choice
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
  // Tee colour chosen in the start modal (null when the course has no tees saved)
  const [pendingTee, setPendingTee] = useState<string | null>(null);
  // Tee the active drill is being played off
  const [selectedTee, setSelectedTee] = useState<string | null>(null);
  // An autosaved, unfinished drill that can be resumed
  const [draft, setDraft] = useState<DraftRangeDrill | null>(null);

  // ── Active ─────────────────────────────────────────────────────────────────
  const [holeIndex, setHoleIndex] = useState(0);
  const [completedHoles, setCompletedHoles] = useState<RangeDrillHole[]>([]);
  const [currentShots, setCurrentShots] = useState<RangeDrillShot[]>([]);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [distanceInput, setDistanceInput] = useState('');

  // Putts per hole for the estimated score: the current Putting Course average
  // (loaded once), frozen into `drillPutts` when a drill starts or resumes.
  const [puttAvg, setPuttAvg] = useState<PuttingAverage | null>(null);
  const [drillPutts, setDrillPutts] = useState<{ perHole: number; sample?: number }>({ perHole: PUTTS_PER_HOLE });

  // ── Complete ───────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getCourses().then(setCourses);
    getDraftRangeDrill().then(setDraft);
    getSessions().then(sessions => setPuttAvg(puttingCourseAverage(sessions))).catch(() => setPuttAvg(null));
  }, []);

  // Autosave the in-progress drill after each shot/hole so it survives interruptions.
  // `seconds` is intentionally excluded from deps to avoid writing every tick — it's
  // captured at each save point, which is close enough to resume from.
  useEffect(() => {
    if (phase !== 'active' || !selectedCourse) return;
    saveDraftRangeDrill({
      course: selectedCourse,
      tee: selectedTee ?? undefined,
      holesToPlay: selectedHoles,
      holeIndex,
      completedHoles,
      currentShots,
      seconds,
      notes,
      puttsPerHole: drillPutts.perHole,
      puttsSampleHoles: drillPutts.sample,
      startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedCourse, selectedHoles, holeIndex, completedHoles, currentShots, drillPutts]);

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

  const holeDefinitions = selectedHoles;
  const currentHoleDef = holeDefinitions[holeIndex];
  const totalHoles = holeDefinitions.length;

  // ── Actions ────────────────────────────────────────────────────────────────

  // A course tapped in the list opens the start modal: tee colour first,
  // then Full / Front 9 / Back 9 (or a single Start for ≤9-hole courses).
  const pickCourse = (course: Course) => {
    if (!course.holes || course.holes.length === 0) {
      const msg = 'This course has no hole data. Add holes in Manage Courses first.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No hole data', msg);
      return;
    }
    const teeNames = Object.keys(course.tees || {});
    setPendingTee(teeNames[0] ?? null);
    setPendingCourse(course);
  };

  const resumeDraft = () => {
    if (!draft) return;
    setSelectedCourse(draft.course);
    setSelectedTee(draft.tee ?? null);
    setSelectedHoles(draft.holesToPlay);
    setHoleIndex(draft.holeIndex);
    setCompletedHoles(draft.completedHoles);
    setCurrentShots(draft.currentShots);
    setSeconds(draft.seconds);
    setNotes(draft.notes);
    // Drafts from before this feature carry no value — freeze the current average now.
    setDrillPutts(draft.puttsPerHole != null
      ? { perHole: draft.puttsPerHole, sample: draft.puttsSampleHoles }
      : puttAvg ? { perHole: puttAvg.puttsPerHole, sample: puttAvg.holes } : { perHole: PUTTS_PER_HOLE });
    setSelectedClub(null);
    setDistanceInput('');
    setDraft(null);
    setPhase('active');
  };

  const discardDraft = () => {
    const msg = 'Discard your unfinished drill? This can\'t be undone.';
    const doDiscard = () => { clearDraftRangeDrill(); setDraft(null); };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDiscard();
    } else {
      Alert.alert('Discard unfinished drill?', msg, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: doDiscard },
      ]);
    }
  };

  const startDrill = (course: Course, holes: HoleDefinition[], tee: string | null) => {
    setPendingCourse(null);
    setSelectedCourse(course);
    setSelectedTee(tee);
    setSelectedHoles(holesForTee(holes, tee));
    setHoleIndex(0);
    setCompletedHoles([]);
    setCurrentShots([]);
    setSelectedClub(null);
    setDistanceInput('');
    setSeconds(0);
    setDrillPutts(puttAvg ? { perHole: puttAvg.puttsPerHole, sample: puttAvg.holes } : { perHole: PUTTS_PER_HOLE });
    setPhase('active');
  };

  // Length options derived from the course awaiting a choice
  const startFull = () => {
    if (!pendingCourse) return;
    startDrill(pendingCourse, [...pendingCourse.holes].sort((a, b) => a.hole - b.hole), pendingTee);
  };
  const startFront9 = () => {
    if (!pendingCourse) return;
    const sorted = [...pendingCourse.holes].sort((a, b) => a.hole - b.hole);
    startDrill(pendingCourse, sorted.slice(0, 9), pendingTee);
  };
  const startBack9 = () => {
    if (!pendingCourse) return;
    const sorted = [...pendingCourse.holes].sort((a, b) => a.hole - b.hole);
    startDrill(pendingCourse, sorted.slice(-9), pendingTee);
  };

  const addShot = () => {
    if (!selectedClub) {
      const msg = 'Select a club before adding a shot.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No club selected', msg);
      return;
    }
    const dist = parseInt(distanceInput);
    if (!distanceInput.trim() || isNaN(dist) || dist <= 0) {
      const msg = 'Enter the shot distance in metres so the remaining distance to the green stays accurate.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Distance required', msg);
      return;
    }
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

  // Finish the drill early (e.g. after 9 holes of an 18-hole course).
  // Saves the holes played so far instead of forcing all holes to be completed.
  const goToComplete = (holes: RangeDrillHole[]) => {
    setCompletedHoles(holes);
    setCurrentShots([]);
    setSelectedClub(null);
    setDistanceInput('');
    setPhase('complete');
  };

  const finishDrill = () => {
    // Mid-hole shots logged but not yet marked "On the Green" → ask whether to keep them.
    if (currentShots.length > 0 && currentHoleDef) {
      const inProgressHole: RangeDrillHole = {
        hole: currentHoleDef.hole,
        par: currentHoleDef.par,
        courseDistance: currentHoleDef.distance ?? null,
        shots: [...currentShots],
      };
      const withCurrent = [...completedHoles, inProgressHole];
      const n = currentShots.length;
      const msg = `You have ${n} shot${n !== 1 ? 's' : ''} logged on hole ${currentHoleDef.hole} that isn't marked "On the Green" yet. Include this hole in the saved drill?`;
      if (Platform.OS === 'web') {
        goToComplete(window.confirm(msg) ? withCurrent : completedHoles);
      } else {
        Alert.alert('Unfinished hole', msg, [
          { text: 'Drop it', style: 'destructive', onPress: () => goToComplete(completedHoles) },
          { text: `Include hole ${currentHoleDef.hole}`, onPress: () => goToComplete(withCurrent) },
        ]);
      }
      return;
    }
    goToComplete(completedHoles);
  };

  const saveDrill = async () => {
    if (!selectedCourse || saving) return;
    setSaving(true);
    try {
      const drill: RangeDrill = {
        id: Date.now().toString(),
        courseId: selectedCourse.id,
        courseName: selectedCourse.name,
        tee: selectedTee ?? undefined,
        date: new Date().toISOString(),
        duration: seconds,
        notes,
        holes: completedHoles,
        puttsPerHole: drillPutts.perHole,
        puttsSampleHoles: drillPutts.sample,
      };
      const existing = await getRangeDrills();
      await saveRangeDrills([...existing, drill]);
      await clearDraftRangeDrill();
      router.back();
    } catch (e) {
      console.error('Error saving range drill', e);
      const msg = 'Could not save your drill. Check your connection and try again — your scorecard is still here.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Save failed', msg);
      setSaving(false);
    }
  };

  const confirmDiscard = () => {
    const msg = 'Discard this drill? Your progress will be lost.';
    const doDiscard = () => { clearDraftRangeDrill(); router.back(); };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDiscard();
    } else {
      Alert.alert('Discard drill?', msg, [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: doDiscard },
      ]);
    }
  };

  // ── Score summary helpers ──────────────────────────────────────────────────

  const shotsToGreen = completedHoles.reduce((s, h) => s + h.shots.length, 0);
  const totalPutts = round1(completedHoles.length * drillPutts.perHole);
  const totalStrokes = round1(shotsToGreen + totalPutts); // estimated full-hole score (shots + putts)
  const totalPar = completedHoles.reduce((s, h) => s + h.par, 0);
  const totalVsPar = round1(totalStrokes - totalPar);

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

    const pendingHoleCount = pendingCourse?.holes?.length ?? 0;
    const pendingTeeNames = Object.keys(pendingCourse?.tees || {});
    // Total yardage off each tee, so the chips show what you're choosing between
    const teeTotal = (teeName: string) =>
      (pendingCourse?.holes || []).reduce(
        (sum, h) => sum + (h.distanceByTee?.[teeName] ?? h.distance ?? 0), 0,
      );

    return (
      <>
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏌️ Range Drill</Text>
        <Text style={styles.subtitle}>Pick a course to simulate</Text>

        {/* Resume banner — an unfinished drill was autosaved */}
        {draft && (
          <View style={styles.resumeBanner}>
            <TouchableOpacity style={styles.resumeMain} onPress={resumeDraft}>
              <Text style={styles.resumeTitle}>▶ Resume drill</Text>
              <Text style={styles.resumeSub}>
                {draft.course.name}{draft.tee ? ` · ${draft.tee}` : ''} · {draft.completedHoles.length}/{draft.holesToPlay.length} holes done
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resumeDiscard} onPress={discardDraft}>
              <Text style={styles.resumeDiscardText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

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
                    onPress={() => pickCourse(course)}
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

      {/* Length picker — Full 18 / Front 9 / Back 9 */}
      <Modal
        visible={!!pendingCourse}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingCourse(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPendingCourse(null)}
        >
          <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
            <Text style={styles.modalTitle}>{pendingCourse?.name}</Text>

            {/* Tee colour — only for courses with tees saved */}
            {pendingTeeNames.length > 0 && (
              <>
                <Text style={styles.modalSubtitle}>Which tee?</Text>
                <View style={styles.teeRow}>
                  {pendingTeeNames.map(teeName => {
                    const colours = TEE_COLOUR_MAP[teeName] || { color: '#888', text: '#fff' };
                    const total = teeTotal(teeName);
                    return (
                      <TouchableOpacity
                        key={teeName}
                        style={[
                          styles.teeBtn,
                          { backgroundColor: colours.color, borderColor: colours.border || colours.color },
                          pendingTee === teeName && styles.teeBtnSelected,
                        ]}
                        onPress={() => setPendingTee(teeName)}
                      >
                        <Text style={[styles.teeBtnText, { color: colours.text }]}>{teeName}</Text>
                        {total > 0 && (
                          <Text style={[styles.teeBtnDist, { color: colours.text }]}>{total}m</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.modalSubtitle}>How many holes?</Text>

            {pendingHoleCount > 9 ? (
              <>
                <TouchableOpacity style={styles.lengthBtn} onPress={startFull}>
                  <Text style={styles.lengthBtnText}>Full round · {pendingHoleCount} holes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lengthBtn} onPress={startFront9}>
                  <Text style={styles.lengthBtnText}>Front 9 · holes 1–9</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lengthBtn} onPress={startBack9}>
                  <Text style={styles.lengthBtnText}>Back 9 · last 9 holes</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.lengthBtn} onPress={startFull}>
                <Text style={styles.lengthBtnText}>Start drill · {pendingHoleCount} holes</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.lengthCancel} onPress={() => setPendingCourse(null)}>
              <Text style={styles.lengthCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      </>
    );
  }

  // PHASE: Active
  if (phase === 'active' && currentHoleDef) {
    const holeStrokes = currentShots.length;
    const completedCount = completedHoles.length;

    // Running distance to the green. Overshoots "bounce back": hitting 100m on
    // a 58m hole leaves you 42m from the green on the far side, so each shot
    // does remaining = |remaining − distance|. "On / near the green" only when
    // within NEAR_GREEN_M metres.
    const holeLength = currentHoleDef.distance ?? null;
    let remaining: number | null = null;
    let wentPast = false;
    if (holeLength != null) {
      remaining = holeLength;
      for (const s of currentShots) {
        const d = s.distance ?? 0;
        wentPast = d > remaining;
        remaining = Math.abs(remaining - d);
      }
    }
    const nearGreen = remaining != null && remaining <= NEAR_GREEN_M;
    const remainingLabel =
      remaining == null ? null
      : nearGreen ? '⛳ On / near the green'
      : wentPast ? `⚠️ ${remaining}m past the green`
      : `${remaining}m to the green`;

    return (
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* ── Header ── */}
        <View style={styles.activeHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.courseTitleSmall}>
              {selectedCourse?.name}{selectedTee ? ` · ${selectedTee} tees` : ''}
            </Text>
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
              {remainingLabel && (
                <Text style={[
                  styles.holeRemaining,
                  nearGreen && styles.holeRemainingGreen,
                  !nearGreen && wentPast && styles.holeRemainingPast,
                ]}>
                  {remainingLabel}
                </Text>
              )}
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
          {/* Live distance to the green */}
          {remainingLabel && (
            <View style={[
              styles.remainingBar,
              nearGreen && styles.remainingBarGreen,
              !nearGreen && wentPast && styles.remainingBarPast,
            ]}>
              <Text style={[
                styles.remainingBarText,
                nearGreen && styles.remainingBarTextGreen,
                !nearGreen && wentPast && styles.remainingBarTextPast,
              ]}>
                {!nearGreen && !wentPast ? '🎯 ' : ''}{remainingLabel}
              </Text>
            </View>
          )}

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

          {/* Finish drill early — save the holes played so far */}
          {completedCount > 0 && (
            <TouchableOpacity style={styles.finishBtn} onPress={finishDrill}>
              <Text style={styles.finishBtnText}>
                🏁 Finish Drill · {completedCount} of {totalHoles} holes
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // PHASE: Complete
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏁 Drill Complete!</Text>
      <Text style={styles.subtitle}>
        {selectedCourse?.name}{selectedTee ? ` · ${selectedTee} tees` : ''}
      </Text>

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
      <Text style={styles.scoreCaption}>
        Score = {shotsToGreen} shots to green + {totalPutts} putts ({drillPutts.perHole}/hole
        {drillPutts.sample ? ` · your last ${drillPutts.sample} putting-course holes` : ` · default until ${PUTT_AVG_MIN_HOLES} putting-course holes`})
      </Text>

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
        const holeScore = round1(h.shots.length + drillPutts.perHole);
        const vp = round1(holeScore - h.par);
        const clubSummary = h.shots.map(s => s.club).join(', ');
        return (
          <View key={i} style={[styles.scorecardRow, i % 2 === 0 && styles.scorecardRowAlt]}>
            <Text style={[styles.scCol, styles.scColHole, styles.scHoleNum]}>{h.hole}</Text>
            <Text style={[styles.scCol, styles.scColPar, styles.scText]}>{h.par}</Text>
            <Text style={[styles.scCol, styles.scColStrokes, styles.scText]}>{holeScore}</Text>
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

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={saveDrill}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : '💾 Save Drill'}</Text>
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
  holeCardRight: { alignItems: 'flex-end' },
  holeDistance: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  holeRemaining: { fontSize: 13, fontWeight: '600', color: '#bbdefb', marginTop: 2 },
  holeRemainingGreen: { color: '#a5d6a7' },
  holeRemainingPast: { color: '#ffe082' },

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
  remainingBar: {
    backgroundColor: '#e3f2fd', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10, alignItems: 'center',
  },
  remainingBarGreen: { backgroundColor: '#e8f5e9' },
  remainingBarPast: { backgroundColor: '#fff8e1' },
  remainingBarText: { fontSize: 15, fontWeight: 'bold', color: '#1565C0' },
  remainingBarTextGreen: { color: '#2e7d32' },
  remainingBarTextPast: { color: '#b26a00' },
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

  finishBtn: {
    marginTop: 10, paddingVertical: 12,
    borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#2e7d32', backgroundColor: 'transparent',
  },
  finishBtnText: { color: '#2e7d32', fontWeight: 'bold', fontSize: 15 },

  // Resume banner
  resumeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff3e0', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#ffb74d',
    padding: 14, marginBottom: 16,
  },
  resumeMain: { flex: 1 },
  resumeTitle: { fontSize: 16, fontWeight: 'bold', color: '#e65100' },
  resumeSub: { fontSize: 13, color: '#bf6b15', marginTop: 2 },
  resumeDiscard: { paddingHorizontal: 10, paddingVertical: 6 },
  resumeDiscardText: { fontSize: 18, color: '#bf6b15', fontWeight: 'bold' },

  // Length picker modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalSheet: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff',
    borderRadius: 18, padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#222', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 2, marginBottom: 16 },
  teeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18 },
  teeBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 2, alignItems: 'center', minWidth: 72,
  },
  teeBtnSelected: { borderColor: '#1565C0', transform: [{ scale: 1.06 }] },
  teeBtnText: { fontSize: 13, fontWeight: 'bold' },
  teeBtnDist: { fontSize: 11, opacity: 0.85, marginTop: 1 },

  lengthBtn: {
    backgroundColor: '#1565C0', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginBottom: 10,
  },
  lengthBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  lengthCancel: { paddingVertical: 12, alignItems: 'center' },
  lengthCancelText: { color: '#888', fontWeight: '600', fontSize: 15 },

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
  scoreCaption: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 20 },

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
  saveBtnDisabled: { backgroundColor: '#a5d6a7' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  discardFinalBtn: { alignItems: 'center', marginTop: 14, padding: 10 },
  discardFinalText: { color: '#bbb', fontSize: 14 },
});
