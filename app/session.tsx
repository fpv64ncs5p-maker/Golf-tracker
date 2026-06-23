import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getSessions, saveSessions } from '../services/storage';
import type { PracticeSession, Drill, ProximityDrill, DirectionGrid } from '../types';

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
  const { type } = useLocalSearchParams();
  const sessionType = typeof type === 'string' ? type : '';
  const proximity = sessionType === 'Chipping' || sessionType === 'Pitching';
  const useGrid = sessionType === 'Putting' || proximity;

  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [adaptiveLevel, setAdaptiveLevel] = useState(1);

  // Unified drill name
  const [drillName, setDrillName] = useState('');

  // Grid state (Putting / Chipping / Pitching)
  const [grid, setGrid] = useState<DirectionGrid>(emptyGrid());
  const [proxClub, setProxClub] = useState<string | null>(null);

  // Legacy state (Long Game / Short Game)
  const [made, setMade] = useState('');
  const [attempts, setAttempts] = useState('');

  // Saved drills
  const [drills, setDrills] = useState<Drill[]>([]);
  const [proxDrills, setProxDrills] = useState<ProximityDrill[]>([]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

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
  const centerLabel = sessionType === 'Putting' ? 'Holed' : `≤${actualThreshold}m ✓`;
  const gridTotal = sumGrid(grid);
  const gridSuccessPct = successFromGrid(grid);

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
    if (Platform.OS === 'web') {
      if (window.confirm('Discard Session?\nThe timer and any drills you\'ve logged will be lost.')) router.back();
    } else {
      Alert.alert('Discard Session?', 'The timer and any drills you\'ve logged will be lost.', [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveSession = async () => {
    try {
      let finalDrills = [...drills];
      let finalProxDrills = [...proxDrills];

      // Auto-add any pending grid drill
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
        {useGrid ? (
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

            {/* Adaptive threshold badge */}
            {sessionType === 'Chipping' && (
              <Text style={styles.thresholdBadge}>🎯 Target today: ≤{getActualThreshold('', 'Chipping', adaptiveLevel)}m</Text>
            )}
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

        <TouchableOpacity style={styles.addButton} onPress={useGrid ? addGridDrill : addLegacyDrill}>
          <Text style={styles.addText}>+ Add Drill</Text>
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

  notesInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 10, minHeight: 44 },
  addButton: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, marginBottom: 10 },
  addText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  endButton: { backgroundColor: '#e53935', padding: 16, borderRadius: 14 },
  endText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
});
