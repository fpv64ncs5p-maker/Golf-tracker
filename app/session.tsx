import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getSessions, saveSessions, getDraftSession, saveDraftSession, clearDraftSession } from '../services/storage';
import type { PracticeSession, Drill, ProximityDrill, DirectionGrid, ProximityBuckets, CourseEditorHole, ChipLie } from '../types';
import {
  PUTTS_PER_HOLE, PUTTING_COURSE_NAME, summarizePuttingCourse, puttingCourseLine,
  CHIPPING_COURSE_NAME, CHIP_LIES, summarizeChippingCourse, chippingCourseLine,
  puttingToEditor, editorToPutting, chippingToEditor, editorToChipping,
} from '../constants/scoring';
import PuttingCourseEditor, { parseMetres, puttColour, LIE_SHORT } from '../components/PuttingCourseEditor';

// ── Drill suggestions ─────────────────────────────────────────────────────────

const GRID_SUGGESTIONS: Record<string, string[]> = {
  Putting: ['Short Putts 1m', 'Short Putts 2m', 'Short Putts 3m', 'Lag Putting 6m', 'Lag Putting 9m', 'Lag Putting 12m', 'Pressure Ladder'],
  Chipping: ['Chip 5m', 'Chip 10m', 'Chip 15m', 'Chip 20m', 'Chip 30m'],
  Pitching: ['Pitch 20m', 'Pitch 30m', 'Pitch 40m', 'Pitch 50m', 'Pitch 60m', 'Pitch 70m'],
};

const LEGACY_SUGGESTIONS: Record<string, { name: string; attempts: string }[]> = {
  'Long Game': [
    { name: 'Wedge 45m', attempts: '10' },
    { name: 'Wedge 70m', attempts: '10' },
    { name: 'Wedge 90m', attempts: '10' },
    { name: 'Trajectory Drill', attempts: '15' },
    { name: 'Mid Irons Solid', attempts: '10' },
    { name: 'Mid Irons Target', attempts: '10' },
    { name: 'Fairway Finder', attempts: '10' },
    { name: 'Shape Practice', attempts: '10' },
  ],
  'Short Game': [
    { name: 'Chip & Run', attempts: '10' },
    { name: 'Flop Shot', attempts: '10' },
    { name: 'Bunker Shot', attempts: '10' },
  ],
};

const SHORT_GAME_CLUBS = ['7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW'];

// ── Grid helpers ──────────────────────────────────────────────────────────────

type GridKey = keyof DirectionGrid;

const GRID_LAYOUT: { key: GridKey; label: string }[][] = [
  [
    { key: 'longLeft', label: 'Long\nLeft' },
    { key: 'long', label: 'Long' },
    { key: 'longRight', label: 'Long\nRight' },
  ],
  [
    { key: 'left', label: 'Left' },
    { key: 'center', label: '__CENTER__' },
    { key: 'right', label: 'Right' },
  ],
  [
    { key: 'shortLeft', label: 'Short\nLeft' },
    { key: 'short', label: 'Short' },
    { key: 'shortRight', label: 'Short\nRight' },
  ],
];

const emptyGrid = (): DirectionGrid => ({
  longLeft: 0, long: 0, longRight: 0,
  left: 0, center: 0, right: 0,
  shortLeft: 0, short: 0, shortRight: 0,
});

const sumGrid = (g: DirectionGrid) =>
  g.longLeft + g.long + g.longRight + g.left + g.center + g.right + g.shortLeft + g.short + g.shortRight;

const successFromGrid = (g: DirectionGrid) => {
  const total = sumGrid(g);
  return total === 0 ? 0 : Math.round((g.center / total) * 100);
};

const dominantMiss = (g: DirectionGrid): string | null => {
  const cells: { key: GridKey; label: string }[] = [
    { key: 'longLeft', label: 'Long Left' }, { key: 'long', label: 'Long' }, { key: 'longRight', label: 'Long Right' },
    { key: 'left', label: 'Left' }, { key: 'right', label: 'Right' },
    { key: 'shortLeft', label: 'Short Left' }, { key: 'short', label: 'Short' }, { key: 'shortRight', label: 'Short Right' },
  ];
  const top = cells.reduce((max, c) => g[c.key] > g[max.key] ? c : max, cells[0]);
  return g[top.key] > 0 ? top.label : null;
};

// ── Proximity bucket helpers (Chipping) ────────────────────────────────────────
// Buckets track where each chip finished relative to the pin (and mishits).

const BUCKET_DEFS: { key: keyof ProximityBuckets; label: string }[] = [
  { key: 'inside1m', label: '≤ 1m' },
  { key: 'one2m', label: '1–2m' },
  { key: 'two3m', label: '2–3m' },
  { key: 'beyond3m', label: 'Out (>3m)' },
  { key: 'miss', label: 'Mishit / duff' },
];

const emptyBuckets = (): ProximityBuckets => ({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 });

const sumBuckets = (b: ProximityBuckets) => b.inside1m + b.one2m + b.two3m + b.beyond3m + b.miss;

// Success = % of shots that finished within the day's target distance (from the adaptive level).
const successFromBuckets = (b: ProximityBuckets, thresholdMeters: number) => {
  const total = sumBuckets(b);
  if (total === 0) return 0;
  let within: number;
  if (thresholdMeters <= 1) within = b.inside1m;
  else if (thresholdMeters <= 2) within = b.inside1m + b.one2m;
  else within = b.inside1m + b.one2m + b.two3m;
  return Math.round((within / total) * 100);
};

// Returns adaptive level 1/2/3 based on recent session success.
// Chipping: level 1=≤3m, 2=≤2m, 3=≤1m (pin-based)
// Pitching: level 1=10%, 2=7.5%, 3=5% of drill distance
const calcAdaptiveLevel = (sessions: PracticeSession[], type: string): number => {
  const defaultLevel = type === 'Chipping' ? 2 : 1; // chipping starts at ≤2m, pitching at 10%
  const relevant = sessions
    .filter(s => s.type === type && (s.proximityDrills ?? []).some(d => d.grid || d.buckets));
  if (relevant.length < 3) return defaultLevel;
  const last5 = relevant.slice(-5);
  const allDrills = last5.flatMap(s => s.proximityDrills ?? []).filter(d => d.grid || d.buckets);
  if (allDrills.length === 0) return defaultLevel;
  // Get current level — from stored thresholdLevel, or infer from old chipping meters
  const lastDrill = [...allDrills].reverse()[0];
  let currentLevel: number;
  if (lastDrill.thresholdLevel != null) {
    currentLevel = lastDrill.thresholdLevel;
  } else if (lastDrill.threshold != null && type === 'Chipping') {
    currentLevel = lastDrill.threshold === 3 ? 1 : lastDrill.threshold === 1 ? 3 : 2;
  } else {
    currentLevel = defaultLevel;
  }
  const avgSuccess = allDrills.reduce((sum, d) => sum + d.success, 0) / allDrills.length;
  if (avgSuccess >= 60 && currentLevel < 3) return currentLevel + 1;
  if (avgSuccess < 25 && currentLevel > 1) return currentLevel - 1;
  return currentLevel;
};

// Compute actual threshold in metres from drill name + type + level
const getActualThreshold = (drillName: string, type: string, level: number): number => {
  if (type === 'Pitching') {
    const match = drillName.match(/(\d+)/);
    if (match) {
      const dist = parseInt(match[1]);
      const pct = [0.10, 0.075, 0.05][level - 1];
      return Math.round(dist * pct * 2) / 2; // round to nearest 0.5m
    }
    return [5, 3.5, 2.5][level - 1]; // fallback (≈50m equivalent)
  }
  return [3, 2, 1][level - 1]; // chipping: level 1=3m, 2=2m, 3=1m
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { type, resume } = useLocalSearchParams();
  const sessionType = typeof type === 'string' ? type : '';
  const proximity = sessionType === 'Chipping' || sessionType === 'Pitching';
  // Chipping uses proximity buckets (≤1m/≤2m/≤3m/out/mishit); Putting & Pitching use the direction grid.
  const useBuckets = sessionType === 'Chipping';
  const useGrid = (sessionType === 'Putting' || proximity) && !useBuckets;

  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [adaptiveLevel, setAdaptiveLevel] = useState(1);

  // Unified drill name
  const [drillName, setDrillName] = useState('');

  // Grid state (Putting / Pitching)
  const [grid, setGrid] = useState<DirectionGrid>(emptyGrid());
  const [proxClub, setProxClub] = useState<string | null>(null);

  // Proximity bucket state (Chipping)
  const [buckets, setBuckets] = useState<ProximityBuckets>(emptyBuckets());
  const [overrideThreshold, setOverrideThreshold] = useState<number | null>(null); // null = use adaptive target
  const bucketTotal = sumBuckets(buckets);
  const adjustBucket = (key: keyof ProximityBuckets, delta: number) =>
    setBuckets(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));

  // Legacy state (Long Game / Short Game)
  const [made, setMade] = useState('');
  const [attempts, setAttempts] = useState('');

  // Course drills, par 2 per hole:
  //  • Putting Course (Putting) — putt from the far edge of each green
  //  • Chipping Course (Chipping) — chip from off the green (fairway/rough/bunker) and hole out
  // Both are played through the same hole-by-hole flow; holes use the shared editor shape.
  const courseKind: 'putting' | 'chipping' | null =
    sessionType === 'Putting' ? 'putting' : sessionType === 'Chipping' ? 'chipping' : null;
  const [drillMode, setDrillMode] = useState<'drill' | 'course'>('drill');
  const [courseHoles, setCourseHoles] = useState<CourseEditorHole[]>([]);
  const [courseDistance, setCourseDistance] = useState('');
  const [courseLie, setCourseLie] = useState<ChipLie>('Fairway'); // Chipping: lie for the next hole
  // Going back to a logged hole: its index, the strokes/lie being chosen, and the
  // new-hole metres typed before jumping back (restored afterwards).
  const [editingHole, setEditingHole] = useState<number | null>(null);
  const [editPutts, setEditPutts] = useState(PUTTS_PER_HOLE);
  const [editLie, setEditLie] = useState<ChipLie>('Fairway');
  const [stashedDistance, setStashedDistance] = useState('');
  const [showHoleList, setShowHoleList] = useState(false);
  const courseMode = courseKind !== null && drillMode === 'course';
  const courseName = courseKind === 'chipping' ? CHIPPING_COURSE_NAME : PUTTING_COURSE_NAME;
  const courseLine = (hs: CourseEditorHole[]) =>
    courseKind === 'chipping' ? chippingCourseLine(editorToChipping(hs)) : puttingCourseLine(editorToPutting(hs));

  // Saved drills
  const [drills, setDrills] = useState<Drill[]>([]);
  const [proxDrills, setProxDrills] = useState<ProximityDrill[]>([]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Resume an autosaved session (launched from the Home resume banner)
  useEffect(() => {
    if (resume !== '1') return;
    getDraftSession().then(draft => {
      if (!draft) return;
      setSeconds(draft.seconds);
      setNotes(draft.notes);
      setDrills(draft.drills ?? []);
      setProxDrills(draft.proximityDrills ?? []);
      if (draft.pendingCourse?.length) {
        setCourseHoles(puttingToEditor(draft.pendingCourse));
        setDrillMode('course');
      } else if (draft.pendingChipCourse?.length) {
        setCourseHoles(chippingToEditor(draft.pendingChipCourse));
        setDrillMode('course');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Autosave the committed drills + notes so an interrupted session can be resumed.
  // `seconds` is captured at each save point but excluded from deps (no per-tick writes).
  useEffect(() => {
    if (drills.length === 0 && proxDrills.length === 0 && courseHoles.length === 0 && !notes.trim()) return;
    saveDraftSession({
      type: sessionType,
      seconds,
      notes,
      drills,
      proximityDrills: proxDrills,
      pendingCourse: courseKind === 'putting' && courseHoles.length ? editorToPutting(courseHoles) : undefined,
      pendingChipCourse: courseKind === 'chipping' && courseHoles.length ? editorToChipping(courseHoles) : undefined,
      startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drills, proxDrills, notes, courseHoles]);

  // Load adaptive level for chipping/pitching
  useEffect(() => {
    if (proximity) {
      getSessions().then(sessions => {
        setAdaptiveLevel(calcAdaptiveLevel(sessions, sessionType));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const formatTime = () => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const actualThreshold = proximity ? getActualThreshold(drillName, sessionType, adaptiveLevel) : 0;
  // Effective chipping target = manual override if set, else the adaptive target.
  const effectiveThreshold = overrideThreshold ?? actualThreshold;
  const thresholdToLevel = (m: number) => (m <= 1 ? 3 : m <= 2 ? 2 : 1);
  const centerLabel = sessionType === 'Putting' ? 'Holed' : `≤${actualThreshold}m ✓`;
  const gridTotal = sumGrid(grid);
  const gridSuccessPct = successFromGrid(grid);
  const bucketSuccessPct = successFromBuckets(buckets, effectiveThreshold);

  const tapCell = (key: GridKey) => setGrid(prev => ({ ...prev, [key]: prev[key] + 1 }));

  // ── Add grid drill ─────────────────────────────────────────────────────────

  const addGridDrill = () => {
    if (!drillName) {
      const msg = 'Please enter a drill name.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Missing name', msg);
      return;
    }
    if (gridTotal === 0) {
      const msg = 'Tap the grid to count at least one shot.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No shots counted', msg);
      return;
    }
    const success = gridSuccessPct;
    if (proximity) {
      setProxDrills(prev => [...prev, {
        name: drillName, attempts: gridTotal, grid: { ...grid },
        threshold: actualThreshold, thresholdLevel: adaptiveLevel, success,
        club: proxClub ?? undefined,
      }]);
    } else {
      setDrills(prev => [...prev, { name: drillName, grid: { ...grid }, success }]);
    }
    setDrillName('');
    setGrid(emptyGrid());
    setProxClub(null);
  };

  // ── Course drills (Putting Course / Chipping Course) ───────────────────────

  // Tapping a putts/strokes count logs the current hole and moves to the next one.
  // Chipping keeps the last lie selected, since lies often repeat.
  const logCourseHole = (strokes: number) => {
    setCourseHoles(prev => [...prev, {
      hole: prev.length + 1,
      distance: parseMetres(courseDistance),
      strokes,
      ...(courseKind === 'chipping' ? { lie: courseLie } : {}),
    }]);
    setCourseDistance('');
  };

  const stepCourseDistance = (delta: number) => {
    const current = parseMetres(courseDistance) ?? 0;
    const next = Math.max(0, Math.round(current + delta));
    setCourseDistance(next > 0 ? String(next) : '');
  };

  const startHoleEdit = (i: number) => {
    const h = courseHoles[i];
    if (!h) return;
    if (editingHole === null) setStashedDistance(courseDistance);
    setShowHoleList(false);
    setEditingHole(i);
    setEditPutts(h.strokes);
    setEditLie(h.lie ?? 'Fairway');
    setCourseDistance(h.distance != null ? String(h.distance) : '');
  };

  const endHoleEdit = () => {
    setEditingHole(null);
    setCourseDistance(stashedDistance);
    setStashedDistance('');
  };

  // Holes with the open (unsaved) hole edit applied — used by Save, Finish and End & Save.
  const withPendingEdit = (holes: CourseEditorHole[]) =>
    editingHole === null || !holes[editingHole]
      ? holes
      : holes.map((h, i) => (i === editingHole
        ? { ...h, distance: parseMetres(courseDistance), strokes: editPutts, ...(courseKind === 'chipping' ? { lie: editLie } : {}) }
        : h));

  const saveHoleEdit = () => {
    setCourseHoles(withPendingEdit(courseHoles));
    endHoleEdit();
  };

  const deleteEditingHole = () => {
    if (editingHole === null) return;
    setCourseHoles(prev => prev.filter((_, i) => i !== editingHole).map((h, i) => ({ ...h, hole: i + 1 })));
    endHoleEdit();
  };

  // Tap a finished course in the top list to bring it back into the editor.
  const reopenCourse = (i: number) => {
    const holes = courseKind === 'chipping'
      ? (proxDrills[i]?.chipCourse ? chippingToEditor(proxDrills[i].chipCourse!) : null)
      : (drills[i]?.course ? puttingToEditor(drills[i].course!) : null);
    if (!holes) return;
    if (courseHoles.length > 0) {
      const msg = 'Finish (or undo) the course you are playing before reopening another one.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Course in progress', msg);
      return;
    }
    if (courseKind === 'chipping') setProxDrills(prev => prev.filter((_, idx) => idx !== i));
    else setDrills(prev => prev.filter((_, idx) => idx !== i));
    setCourseHoles(holes);
    setDrillMode('course');
    setEditingHole(null);
    setShowHoleList(false);
    setCourseDistance('');
    setStashedDistance('');
  };

  const puttingCourseDrill = (holes: CourseEditorHole[]): Drill => {
    const course = editorToPutting(holes);
    return { name: PUTTING_COURSE_NAME, course, success: summarizePuttingCourse(course).success };
  };

  const chippingCourseDrill = (holes: CourseEditorHole[]): ProximityDrill => {
    const chipCourse = editorToChipping(holes);
    return {
      name: CHIPPING_COURSE_NAME,
      attempts: chipCourse.length,
      chipCourse,
      success: summarizeChippingCourse(chipCourse).upDownPct,
    };
  };

  const addCourseDrill = () => {
    const holes = withPendingEdit(courseHoles);
    if (holes.length === 0) {
      const msg = 'Log at least one hole before adding.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No holes logged', msg);
      return;
    }
    if (courseKind === 'chipping') setProxDrills(prev => [...prev, chippingCourseDrill(holes)]);
    else setDrills(prev => [...prev, puttingCourseDrill(holes)]);
    setCourseHoles([]);
    setCourseDistance('');
    setEditingHole(null);
    setStashedDistance('');
    setShowHoleList(false);
  };

  // ── Add proximity bucket drill (Chipping) ──────────────────────────────────

  const addBucketDrill = () => {
    if (!drillName) {
      const msg = 'Please enter a drill name.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Missing name', msg);
      return;
    }
    if (bucketTotal === 0) {
      const msg = 'Count at least one shot before adding.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('No shots counted', msg);
      return;
    }
    setProxDrills(prev => [...prev, {
      name: drillName, attempts: bucketTotal, buckets: { ...buckets },
      threshold: effectiveThreshold, thresholdLevel: thresholdToLevel(effectiveThreshold), success: bucketSuccessPct,
      club: proxClub ?? undefined,
    }]);
    setDrillName('');
    setBuckets(emptyBuckets());
    setProxClub(null);
  };

  // ── Add legacy drill (Long Game / Short Game) ──────────────────────────────

  const addLegacyDrill = () => {
    if (!drillName || !made || !attempts) {
      const msg = 'Fill in drill name, made, and total before adding.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Missing fields', msg);
      return;
    }
    const success = Math.round((parseInt(made) / parseInt(attempts)) * 100);
    setDrills(prev => [...prev, { name: drillName, made, attempts, success }]);
    setDrillName('');
    setMade('');
    setAttempts('');
  };

  // ── Discard ────────────────────────────────────────────────────────────────

  const confirmDiscard = () => {
    const doDiscard = () => { clearDraftSession(); router.back(); };
    if (Platform.OS === 'web') {
      if (window.confirm('Discard Session?\nThe timer and any drills you\'ve logged will be lost.')) doDiscard();
    } else {
      Alert.alert('Discard Session?', 'The timer and any drills you\'ve logged will be lost.', [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: doDiscard },
      ]);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveSession = async () => {
    try {
      let finalDrills = [...drills];
      let finalProxDrills = [...proxDrills];

      // Auto-add any pending bucket drill (Chipping)
      if (useBuckets && drillName && bucketTotal > 0) {
        finalProxDrills = [...finalProxDrills, {
          name: drillName, attempts: bucketTotal, buckets: { ...buckets },
          threshold: effectiveThreshold, thresholdLevel: thresholdToLevel(effectiveThreshold), success: bucketSuccessPct,
          club: proxClub ?? undefined,
        }];
      }

      // Auto-add any unfinished course
      const pendingHoles = withPendingEdit(courseHoles);
      if (pendingHoles.length > 0) {
        if (courseKind === 'chipping') finalProxDrills = [...finalProxDrills, chippingCourseDrill(pendingHoles)];
        else finalDrills = [...finalDrills, puttingCourseDrill(pendingHoles)];
      }

      // Auto-add any pending grid drill (Putting / Pitching)
      if (useGrid && drillName && gridTotal > 0) {
        const success = gridSuccessPct;
        if (proximity) {
          finalProxDrills = [...finalProxDrills, {
            name: drillName, attempts: gridTotal, grid: { ...grid },
            threshold: actualThreshold, thresholdLevel: adaptiveLevel, success,
            club: proxClub ?? undefined,
          }];
        } else {
          finalDrills = [...finalDrills, { name: drillName, grid: { ...grid }, success }];
        }
      }

      // Auto-add any pending legacy drill
      if (!useGrid && drillName && made && attempts) {
        const success = Math.round((parseInt(made) / parseInt(attempts)) * 100);
        finalDrills = [...finalDrills, { name: drillName, made, attempts, success }];
      }

      const newSession: PracticeSession = {
        type: sessionType as PracticeSession['type'],
        duration: seconds,
        drills: proximity ? [] : finalDrills,
        proximityDrills: proximity ? finalProxDrills : undefined,
        notes,
        date: new Date().toISOString(),
      };
      const sessions = await getSessions();
      sessions.push(newSession);
      await saveSessions(sessions);
      await clearDraftSession();
      router.back();
    } catch (e) {
      console.log('Error saving session', e);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const gridSuggestions = GRID_SUGGESTIONS[sessionType] ?? [];
  const legacySuggestions = LEGACY_SUGGESTIONS[sessionType] ?? [];

  const renderTopDrills = () => {
    if (proximity) {
      if (proxDrills.length === 0) return <Text style={styles.empty}>No drills yet — pick a distance below or type your own</Text>;
      return (
        <>
          <Text style={styles.totalBalls}>🎱 {proxDrills.reduce((s, d) => s + d.attempts, 0)} shots total</Text>
          {proxDrills.map((d, i) => {
            if (d.chipCourse) {
              return (
                <TouchableOpacity key={i} style={styles.drillItem} onPress={() => reopenCourse(i)}>
                  <View style={styles.drillNameCol}>
                    <Text style={styles.drillName}>⛳ {d.name}</Text>
                    <Text style={styles.reopenHint}>✏️ tap to reopen</Text>
                  </View>
                  <View style={styles.drillScoreCol}>
                    <Text style={styles.drillScore}>{chippingCourseLine(d.chipCourse)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }
            const miss = d.grid ? dominantMiss(d.grid) : null;
            return (
              <View key={i} style={styles.drillItem}>
                <View style={styles.drillNameCol}>
                  <Text style={styles.drillName}>{d.name}</Text>
                  {d.club && <Text style={styles.drillClub}>{d.club}</Text>}
                </View>
                <View style={styles.drillScoreCol}>
                  <Text style={styles.drillScore}>{d.attempts} shots · {d.success}% ≤{d.threshold ?? 2}m</Text>
                  {miss && <Text style={styles.drillMiss}>↳ {miss}</Text>}
                </View>
              </View>
            );
          })}
        </>
      );
    }
    if (useGrid) {
      // Putting
      if (drills.length === 0) return <Text style={styles.empty}>No drills yet — pick one below or type your own</Text>;
      return drills.map((d, i) => {
        if (d.course) {
          return (
            <TouchableOpacity key={i} style={styles.drillItem} onPress={() => reopenCourse(i)}>
              <View style={styles.drillNameCol}>
                <Text style={styles.drillName}>⛳ {d.name}</Text>
                <Text style={styles.reopenHint}>✏️ tap to reopen</Text>
              </View>
              <View style={styles.drillScoreCol}>
                <Text style={styles.drillScore}>{puttingCourseLine(d.course)}</Text>
              </View>
            </TouchableOpacity>
          );
        }
        const miss = d.grid ? dominantMiss(d.grid) : null;
        const total = d.grid ? sumGrid(d.grid) : 0;
        return (
          <View key={i} style={styles.drillItem}>
            <Text style={styles.drillName}>{d.name}</Text>
            <View style={styles.drillScoreCol}>
              <Text style={styles.drillScore}>{total} putts · {d.success}% holed</Text>
              {miss && <Text style={styles.drillMiss}>↳ miss: {miss}</Text>}
            </View>
          </View>
        );
      });
    }
    // Legacy (Long Game / Short Game)
    if (drills.length === 0) return <Text style={styles.empty}>No drills yet — pick one below or type your own</Text>;
    return drills.map((d, i) => (
      <View key={i} style={styles.drillItem}>
        <Text style={styles.drillName}>{d.name}</Text>
        <Text style={styles.drillScore}>{d.made}/{d.attempts} ({d.success}%)</Text>
      </View>
    ));
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Top section — logged drills */}
      <View style={styles.topSection}>
        <View style={styles.sessionHeader}>
          <Text style={styles.type}>{sessionType} Session</Text>
          <Text style={styles.timer}>{formatTime()}</Text>
          <TouchableOpacity onPress={confirmDiscard} style={styles.discardBtn}>
            <Text style={styles.discardText}>✕ Discard</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>{renderTopDrills()}</ScrollView>
      </View>

      {/* Bottom section — pinned input area */}
      <ScrollView
        style={styles.bottomSection}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Putting / Chipping: choose between a regular drill and the course drill */}
        {courseKind && (
          <View style={styles.modeRow}>
            {([
              ['drill', courseKind === 'putting' ? '🎯 Grid drill' : '🎯 Target drill'],
              ['course', `⛳ ${courseName}`],
            ] as const).map(([m, label]) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, drillMode === m && styles.modeBtnActive]}
                onPress={() => setDrillMode(m)}
              >
                <Text style={[styles.modeBtnText, drillMode === m && styles.modeBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {courseMode && showHoleList ? (
          <>
            <Text style={styles.courseHoleTitle}>Edit holes</Text>
            <Text style={styles.courseHint}>
              {courseKind === 'chipping' ? 'Change metres, lie or strokes, remove or add holes' : 'Change metres or putts, remove or add holes'}
            </Text>
            <PuttingCourseEditor
              holes={courseHoles}
              onChange={setCourseHoles}
              summary={courseLine}
              strokesLabel={courseKind === 'chipping' ? 'Strokes' : 'Putts'}
              distanceLabel={courseKind === 'chipping' ? 'To hole' : 'From edge'}
              lies={courseKind === 'chipping' ? CHIP_LIES : undefined}
            />
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowHoleList(false)}>
              <Text style={styles.doneBtnText}>✓ Done · back to hole {courseHoles.length + 1}</Text>
            </TouchableOpacity>
          </>
        ) : courseMode ? (
          <>
            <Text style={[styles.courseHoleTitle, editingHole !== null && styles.courseHoleTitleEditing]}>
              {editingHole !== null ? `Editing hole ${editingHole + 1}` : `Hole ${courseHoles.length + 1}`}
            </Text>
            <Text style={styles.courseHint}>
              {courseKind === 'chipping'
                ? `Chip from off the green and hole out · par ${PUTTS_PER_HOLE} (up and down)`
                : `Putt from the far edge of the green · par ${PUTTS_PER_HOLE}`}
            </Text>

            {courseKind === 'chipping' && (
              <>
                <Text style={styles.clubSelectorLabel}>Lie</Text>
                <View style={styles.lieRow}>
                  {CHIP_LIES.map(l => {
                    const active = (editingHole !== null ? editLie : courseLie) === l;
                    return (
                      <TouchableOpacity
                        key={l}
                        style={[styles.lieBtn, active && styles.lieBtnActive]}
                        onPress={() => (editingHole !== null ? setEditLie(l) : setCourseLie(l))}
                      >
                        <Text style={[styles.lieBtnText, active && styles.lieBtnTextActive]}>{l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.clubSelectorLabel}>
              {courseKind === 'chipping' ? 'Distance — metres to the hole' : 'First putt — metres from the edge'}
            </Text>
            <View style={styles.metresRow}>
              <TouchableOpacity style={styles.bucketBtn} onPress={() => stepCourseDistance(-1)}>
                <Text style={styles.bucketBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                value={courseDistance}
                onChangeText={setCourseDistance}
                placeholder="—"
                keyboardType="decimal-pad"
                style={styles.metresInput}
              />
              <Text style={styles.metresUnit}>m</Text>
              <TouchableOpacity style={styles.bucketBtn} onPress={() => stepCourseDistance(1)}>
                <Text style={styles.bucketBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.clubSelectorLabel}>
              {(courseKind === 'chipping' ? 'Strokes to hole out' : 'Putts to hole out')
                + (editingHole !== null ? '' : ' — tap to log the hole')}
            </Text>
            <View style={styles.puttRow}>
              {[1, 2, 3, 4, 5].map(n => {
                const picked = editingHole !== null && (n === 5 ? editPutts >= 5 : editPutts === n);
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.puttBtn, picked && styles.puttBtnPicked]}
                    onPress={() => editingHole !== null
                      ? setEditPutts(p => (n === 5 ? (p >= 5 ? p : 5) : n))
                      : logCourseHole(n)}
                  >
                    <Text style={[styles.puttBtnText, { color: puttColour(n) }]}>{n === 5 ? '5+' : n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {editingHole !== null && (
              <View style={styles.holeEditActions}>
                <TouchableOpacity style={[styles.holeEditBtn, styles.holeEditSave]} onPress={saveHoleEdit}>
                  <Text style={styles.holeEditSaveText}>✓ Save hole</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.holeEditBtn} onPress={endHoleEdit}>
                  <Text style={styles.holeEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.holeEditBtn} onPress={deleteEditingHole}>
                  <Text style={styles.holeEditText}>🗑</Text>
                </TouchableOpacity>
              </View>
            )}

            {courseHoles.length > 0 && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
                  {courseHoles.map((h, i) => (
                    <TouchableOpacity
                      key={h.hole}
                      style={[styles.holeChip, editingHole === i && styles.holeChipSelected]}
                      onPress={() => (editingHole === i ? endHoleEdit() : startHoleEdit(i))}
                    >
                      <Text style={styles.holeChipHole}>H{h.hole}{h.lie ? ` · ${LIE_SHORT[h.lie]}` : ''}</Text>
                      <Text style={styles.holeChipDist}>{h.distance != null ? `${h.distance}m` : '—'}</Text>
                      <Text style={[styles.holeChipPutts, { color: puttColour(h.strokes) }]}>{h.strokes}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.chipHint}>Tap a hole to change it</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.proxPreview}>{courseLine(withPendingEdit(courseHoles))}</Text>
                  {editingHole === null && (
                    <TouchableOpacity onPress={() => setCourseHoles(prev => prev.slice(0, -1))} style={[styles.resetBtn, { marginRight: 6 }]}>
                      <Text style={styles.resetBtnText}>↶ Undo</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { if (editingHole !== null) saveHoleEdit(); setShowHoleList(true); }} style={styles.resetBtn}>
                    <Text style={styles.resetBtnText}>✏️ Edit holes</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        ) : useBuckets ? (
          <>
            {/* Suggestion chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
              {gridSuggestions.map(name => (
                <TouchableOpacity
                  key={name}
                  style={[styles.chip, drillName === name && styles.chipSelected]}
                  onPress={() => { setDrillName(name); setBuckets(emptyBuckets()); }}
                >
                  <Text style={[styles.chipText, drillName === name && styles.chipTextSelected]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              placeholder="Drill name (e.g. Chip 10m)"
              value={drillName}
              onChangeText={setDrillName}
              style={[styles.input, { marginBottom: 8 }]}
            />

            {/* Club selector */}
            <Text style={styles.clubSelectorLabel}>Club (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={[styles.chipsContainer, { marginBottom: 8 }]}>
              {SHORT_GAME_CLUBS.map(club => (
                <TouchableOpacity
                  key={club}
                  style={[styles.chip, proxClub === club && styles.chipSelected]}
                  onPress={() => setProxClub(proxClub === club ? null : club)}
                >
                  <Text style={[styles.chipText, proxClub === club && styles.chipTextSelected]}>{club}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Target distance — adaptive by default, tap to override */}
            <Text style={styles.clubSelectorLabel}>
              Target {overrideThreshold == null ? `(auto · ≤${actualThreshold}m)` : '(manual)'}
            </Text>
            <View style={styles.targetRow}>
              {[1, 2, 3].map(m => {
                const active = effectiveThreshold === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.targetBtn, active && styles.targetBtnActive]}
                    onPress={() => setOverrideThreshold(overrideThreshold === m ? null : m)}
                  >
                    <Text style={[styles.targetBtnText, active && styles.targetBtnTextActive]}>≤{m}m</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Proximity bucket counters */}
            <View style={styles.bucketList}>
              {BUCKET_DEFS.map(b => (
                <View key={b.key} style={styles.bucketRow}>
                  <Text style={styles.bucketLabel}>{b.label}</Text>
                  <View style={styles.bucketControls}>
                    <TouchableOpacity style={styles.bucketBtn} onPress={() => adjustBucket(b.key, -1)}>
                      <Text style={styles.bucketBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.bucketCount}>{buckets[b.key]}</Text>
                    <TouchableOpacity style={styles.bucketBtn} onPress={() => adjustBucket(b.key, 1)}>
                      <Text style={styles.bucketBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Live summary */}
            {bucketTotal > 0 && (
              <View style={styles.previewRow}>
                <Text style={styles.proxPreview}>
                  {bucketTotal} shots · {bucketSuccessPct}% ≤{effectiveThreshold}m · {Math.round((buckets.inside1m / bucketTotal) * 100)}% ≤1m
                </Text>
                <TouchableOpacity onPress={() => setBuckets(emptyBuckets())} style={styles.resetBtn}>
                  <Text style={styles.resetBtnText}>↺ Reset</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : useGrid ? (
          <>
            {/* Suggestion chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
              {gridSuggestions.map(name => (
                <TouchableOpacity
                  key={name}
                  style={[styles.chip, drillName === name && styles.chipSelected]}
                  onPress={() => { setDrillName(name); setGrid(emptyGrid()); }}
                >
                  <Text style={[styles.chipText, drillName === name && styles.chipTextSelected]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              placeholder={sessionType === 'Putting' ? 'Drill name (e.g. Short Putts 2m)' : 'Drill name (e.g. Chip 10m)'}
              value={drillName}
              onChangeText={setDrillName}
              style={[styles.input, { marginBottom: 8 }]}
            />

            {/* Club selector (Chipping / Pitching only) */}
            {proximity && (
              <>
                <Text style={styles.clubSelectorLabel}>Club (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={[styles.chipsContainer, { marginBottom: 8 }]}>
                  {SHORT_GAME_CLUBS.map(club => (
                    <TouchableOpacity
                      key={club}
                      style={[styles.chip, proxClub === club && styles.chipSelected]}
                      onPress={() => setProxClub(proxClub === club ? null : club)}
                    >
                      <Text style={[styles.chipText, proxClub === club && styles.chipTextSelected]}>{club}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Adaptive threshold badge (Pitching) */}
            {sessionType === 'Pitching' && drillName && (
              <Text style={styles.thresholdBadge}>🎯 Target: ≤{actualThreshold}m for this drill</Text>
            )}
            {sessionType === 'Pitching' && !drillName && (
              <Text style={styles.thresholdBadge}>🎯 Select a drill to see your target</Text>
            )}

            {/* 3×3 Direction Grid */}
            <View style={styles.gridContainer}>
              {GRID_LAYOUT.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.gridRow}>
                  {row.map(({ key, label }) => {
                    const isCenter = key === 'center';
                    const count = grid[key];
                    const displayLabel = isCenter ? centerLabel : label;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.gridCell,
                          isCenter && styles.gridCenterCell,
                          count > 0 && !isCenter && styles.gridActiveCell,
                          count > 0 && isCenter && styles.gridCenterActiveCell,
                        ]}
                        onPress={() => tapCell(key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.gridCellLabel, isCenter && styles.gridCenterLabel]} numberOfLines={2}>
                          {displayLabel}
                        </Text>
                        {count > 0 && (
                          <Text style={[styles.gridCellCount, isCenter && styles.gridCenterCount]}>{count}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Live summary */}
            {gridTotal > 0 && (
              <View style={styles.previewRow}>
                <Text style={styles.proxPreview}>
                  {gridTotal} shots · {gridSuccessPct}% {sessionType === 'Putting' ? 'holed' : `≤${actualThreshold}m`}
                  {dominantMiss(grid) ? `  ·  miss: ${dominantMiss(grid)}` : ''}
                </Text>
                <TouchableOpacity onPress={() => setGrid(emptyGrid())} style={styles.resetBtn}>
                  <Text style={styles.resetBtnText}>↺ Reset</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Legacy chips */}
            {legacySuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
                {legacySuggestions.map(drill => (
                  <TouchableOpacity
                    key={drill.name}
                    style={[styles.chip, drillName === drill.name && styles.chipSelected]}
                    onPress={() => { setDrillName(drill.name); setAttempts(drill.attempts); setMade(''); }}
                  >
                    <Text style={[styles.chipText, drillName === drill.name && styles.chipTextSelected]}>{drill.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Drill name"
                value={drillName}
                onChangeText={setDrillName}
                style={[styles.input, styles.inputWide]}
                returnKeyType="next"
              />
              <TextInput
                placeholder="Made"
                value={made}
                onChangeText={setMade}
                keyboardType="numeric"
                style={[styles.input, styles.inputSmall]}
              />
              <TextInput
                placeholder="Total"
                value={attempts}
                onChangeText={setAttempts}
                keyboardType="numeric"
                style={[styles.input, styles.inputSmall]}
              />
            </View>
          </>
        )}

        <TouchableOpacity style={styles.addButton} onPress={courseMode ? addCourseDrill : useBuckets ? addBucketDrill : useGrid ? addGridDrill : addLegacyDrill}>
          <Text style={styles.addText}>{courseMode ? '✓ Finish course · add drill' : '+ Add Drill'}</Text>
        </TouchableOpacity>

        <TextInput
          placeholder="Session notes (optional)..."
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
          returnKeyType="done"
          blurOnSubmit
          multiline
        />

        <TouchableOpacity style={styles.endButton} onPress={saveSession}>
          <Text style={styles.endText}>End & Save Session</Text>
        </TouchableOpacity>
        <View style={{ height: 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff', maxWidth: '100%', overflow: 'hidden' as any },

  topSection: { flex: 1, padding: 16, minHeight: 120 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 },
  type: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  timer: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50', marginHorizontal: 8 },
  discardBtn: { padding: 4 },
  discardText: { fontSize: 13, color: '#999', fontWeight: '500' },

  empty: { textAlign: 'center', color: '#bbb', marginTop: 20, fontSize: 14, paddingHorizontal: 10 },
  drillItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  drillName: { fontSize: 15, color: '#333', flex: 1, flexWrap: 'wrap' },
  drillScore: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  drillMiss: { fontSize: 12, color: '#e65100', marginTop: 2 },
  totalBalls: { fontSize: 13, fontWeight: '700', color: '#4CAF50', textAlign: 'center', marginBottom: 8, marginTop: 4 },
  drillNameCol: { flex: 1 },
  drillClub: { fontSize: 12, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  drillScoreCol: { alignItems: 'flex-end' },

  bottomSection: { maxHeight: '62%', padding: 16, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },

  chipsScroll: { marginBottom: 10, overflow: 'scroll' as any },
  chipsContainer: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f0f4f0', borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  chipSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },

  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fafafa' },
  inputRow: { flexDirection: 'row', gap: 6, marginBottom: 10, width: '100%' },
  inputWide: { flex: 3 },
  inputSmall: { width: 58 },

  clubSelectorLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6 },

  thresholdBadge: { fontSize: 13, fontWeight: '700', color: '#1565C0', backgroundColor: '#e3f2fd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center', marginBottom: 10 },

  // 3×3 Direction Grid
  gridContainer: { marginBottom: 8, gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridCell: {
    flex: 1,
    minHeight: 60,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  gridCenterCell: {
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
  },
  gridActiveCell: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffc107',
  },
  gridCenterActiveCell: {
    backgroundColor: '#c8e6c9',
    borderColor: '#4CAF50',
  },
  gridCellLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  gridCenterLabel: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '700',
  },
  gridCellCount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e65100',
    marginTop: 2,
  },
  gridCenterCount: {
    color: '#2e7d32',
  },

  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  proxPreview: { fontSize: 13, color: '#4CAF50', fontWeight: '600', flex: 1 },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f0f0f0', borderRadius: 8 },
  resetBtnText: { fontSize: 13, color: '#666', fontWeight: '600' },
  // Chipping target toggle
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  targetBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
  targetBtnActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  targetBtnText: { fontSize: 15, fontWeight: '700', color: '#555' },
  targetBtnTextActive: { color: '#fff' },
  // Proximity bucket counters
  bucketList: { marginBottom: 10 },
  bucketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  bucketLabel: { fontSize: 15, color: '#333', fontWeight: '600' },
  bucketControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bucketBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  bucketBtnText: { fontSize: 22, color: '#333' },
  bucketCount: { fontSize: 20, fontWeight: 'bold', width: 32, textAlign: 'center' },

  // Putting Course
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
  modeBtnActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  modeBtnTextActive: { color: '#fff' },
  courseHoleTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  courseHint: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 },
  metresRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  metresInput: { width: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 8, fontSize: 20, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#fafafa' },
  metresUnit: { fontSize: 16, color: '#666', marginLeft: -4 },
  puttRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  puttBtn: { flex: 1, minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  puttBtnText: { fontSize: 22, fontWeight: 'bold' },
  holeChip: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f7f7f7', borderWidth: 1, borderColor: '#eee', minWidth: 48 },
  holeChipHole: { fontSize: 11, color: '#888', fontWeight: '700' },
  holeChipDist: { fontSize: 11, color: '#666' },
  holeChipPutts: { fontSize: 16, fontWeight: 'bold' },
  lieRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  lieBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
  lieBtnActive: { backgroundColor: '#8d6e63', borderColor: '#8d6e63' },
  lieBtnText: { fontSize: 15, fontWeight: '600', color: '#555' },
  lieBtnTextActive: { color: '#fff' },
  holeChipSelected: { borderColor: '#1565C0', borderWidth: 2, backgroundColor: '#e3f2fd' },
  chipHint: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: -4, marginBottom: 6 },
  courseHoleTitleEditing: { color: '#1565C0' },
  puttBtnPicked: { borderColor: '#1565C0', borderWidth: 2, backgroundColor: '#e3f2fd' },
  holeEditActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  holeEditBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  holeEditSave: { flex: 1, backgroundColor: '#1565C0' },
  holeEditSaveText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  holeEditText: { color: '#555', fontWeight: '600', fontSize: 15 },
  doneBtn: { backgroundColor: '#1565C0', padding: 12, borderRadius: 10, marginBottom: 10 },
  doneBtnText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  reopenHint: { fontSize: 11, color: '#1565C0', marginTop: 2 },

  notesInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 10, minHeight: 44 },
  addButton: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, marginBottom: 10 },
  addText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  endButton: { backgroundColor: '#e53935', padding: 16, borderRadius: 14 },
  endText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
});
