import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet,
  Alert, Platform, Modal, KeyboardAvoidingView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getSessions, saveSessions } from '../services/storage';
import type { PracticeSession, Drill, ProximityDrill, DirectionGrid } from '../types';

const SHORT_GAME_CLUBS = ['7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW'];

const GRID_SUGGESTIONS: Record<string, string[]> = {
  Putting: ['Short Putts 1m', 'Short Putts 2m', 'Short Putts 3m', 'Lag Putting 6m', 'Lag Putting 9m', 'Lag Putting 12m', 'Pressure Ladder'],
  Chipping: ['Chip 5m', 'Chip 10m', 'Chip 15m', 'Chip 20m', 'Chip 30m'],
  Pitching: ['Pitch 20m', 'Pitch 30m', 'Pitch 40m', 'Pitch 50m', 'Pitch 60m', 'Pitch 70m'],
};

const LEGACY_SUGGESTIONS: Record<string, { name: string; attempts: string }[]> = {
  'Long Game': [
    { name: 'Wedge 45m', attempts: '10' }, { name: 'Wedge 70m', attempts: '10' },
    { name: 'Wedge 90m', attempts: '10' }, { name: 'Trajectory Drill', attempts: '15' },
    { name: 'Mid Irons Solid', attempts: '10' }, { name: 'Mid Irons Target', attempts: '10' },
    { name: 'Fairway Finder', attempts: '10' }, { name: 'Shape Practice', attempts: '10' },
  ],
};

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

const isProximityType = (type: string) => type === 'Chipping' || type === 'Pitching';
const useGridInput = (type: string) => type === 'Putting' || isProximityType(type);

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Grid display component (view + edit mode) ─────────────────────────────────

function GridDisplay({
  grid,
  centerLabel,
  editable = false,
  onTap,
  onLongPress,
}: {
  grid: DirectionGrid;
  centerLabel: string;
  editable?: boolean;
  onTap?: (key: GridKey) => void;
  onLongPress?: (key: GridKey) => void;
}) {
  return (
    <View style={gridStyles.container}>
      {GRID_LAYOUT.map((row, rowIdx) => (
        <View key={rowIdx} style={gridStyles.row}>
          {row.map(({ key, label }) => {
            const isCenter = key === 'center';
            const count = grid[key];
            const displayLabel = isCenter ? centerLabel : label;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  gridStyles.cell,
                  isCenter && gridStyles.centerCell,
                  count > 0 && !isCenter && gridStyles.activeCell,
                  count > 0 && isCenter && gridStyles.centerActiveCell,
                  !editable && gridStyles.readOnly,
                ]}
                onPress={() => editable && onTap?.(key)}
                onLongPress={() => editable && onLongPress?.(key)}
                activeOpacity={editable ? 0.7 : 1}
                delayLongPress={300}
              >
                <Text style={[gridStyles.label, isCenter && gridStyles.centerLabelText]} numberOfLines={2}>
                  {displayLabel}
                </Text>
                <Text style={[gridStyles.count, isCenter && gridStyles.centerCount, count === 0 && gridStyles.zeroCount]}>
                  {count}
                </Text>
                {editable && count > 0 && !isCenter && (
                  <Text style={gridStyles.hint}>hold −</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {editable && <Text style={gridStyles.editHint}>Tap to add · Hold to remove</Text>}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const { index } = useLocalSearchParams();
  const sessionIndex = typeof index === 'string' ? parseInt(index) : 0;

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [originalIndex, setOriginalIndex] = useState<number>(0);
  const [dirty, setDirty] = useState(false);

  const [notes, setNotes] = useState('');
  const [drills, setDrills] = useState<Drill[]>([]);
  const [proxDrills, setProxDrills] = useState<ProximityDrill[]>([]);
  const [sessionDate, setSessionDate] = useState('');

  // Date picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  // ── Add drill forms ────────────────────────────────────────────────────────
  const [addingDrill, setAddingDrill] = useState(false);
  const [newDrillName, setNewDrillName] = useState('');
  const [newGrid, setNewGrid] = useState<DirectionGrid>(emptyGrid());
  const [newProxClub, setNewProxClub] = useState<string | null>(null);
  // Legacy add form (Long Game)
  const [newMade, setNewMade] = useState('');
  const [newAttempts, setNewAttempts] = useState('');

  // ── Inline edit ────────────────────────────────────────────────────────────
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrid, setEditGrid] = useState<DirectionGrid>(emptyGrid());
  const [editClub, setEditClub] = useState<string | null>(null);
  // Legacy edit
  const [editMade, setEditMade] = useState('');
  const [editAttempts, setEditAttempts] = useState('');

  useEffect(() => { loadSession(); }, []);

  const loadSession = async () => {
    const all = await getSessions();
    const orig = all.length - 1 - sessionIndex;
    const s = all[orig];
    if (!s) return;
    setOriginalIndex(orig);
    setSession(s);
    setNotes(s.notes ?? '');
    setDrills([...(s.drills ?? [])]);
    setProxDrills([...(s.proximityDrills ?? [])]);
    setSessionDate(s.date);
  };

  const proximity = session ? isProximityType(session.type) : false;
  const useGrid = session ? useGridInput(session.type) : false;
  const defaultThreshold = 2;

  const getCenterLabel = (threshold?: number, type?: string) => {
    if (type === 'Putting') return 'Holed';
    return `≤${threshold ?? defaultThreshold}m ✓`;
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveSession = async () => {
    const all = await getSessions();
    all[originalIndex] = {
      ...all[originalIndex],
      notes,
      date: sessionDate,
      drills: proximity ? [] : drills,
      proximityDrills: proximity ? proxDrills : undefined,
    };
    await saveSessions(all);
    setDirty(false);
    if (Platform.OS === 'web') alert('Session saved!');
    else Alert.alert('Saved', 'Session updated successfully.');
  };

  const confirmBack = () => {
    if (!dirty) { router.back(); return; }
    if (Platform.OS === 'web') {
      if (window.confirm('Unsaved changes\nGo back without saving?')) router.back();
    } else {
      Alert.alert('Unsaved changes', 'Go back without saving?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteDrill = (i: number) => { setDrills(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); };
  const deleteProxDrill = (i: number) => { setProxDrills(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); };

  // ── Add drill ──────────────────────────────────────────────────────────────

  const confirmAddDrill = () => {
    if (!newDrillName) return;
    if (useGrid) {
      const total = sumGrid(newGrid);
      if (total === 0) return;
      const success = successFromGrid(newGrid);
      if (proximity) {
        setProxDrills(prev => [...prev, {
          name: newDrillName, attempts: total, grid: { ...newGrid },
          threshold: defaultThreshold, success, club: newProxClub ?? undefined,
        }]);
      } else {
        setDrills(prev => [...prev, { name: newDrillName, grid: { ...newGrid }, success }]);
      }
    } else {
      if (!newMade || !newAttempts) return;
      const success = Math.round((parseInt(newMade) / parseInt(newAttempts)) * 100);
      setDrills(prev => [...prev, { name: newDrillName, made: newMade, attempts: newAttempts, success }]);
    }
    setNewDrillName(''); setNewGrid(emptyGrid()); setNewProxClub(null); setNewMade(''); setNewAttempts('');
    setAddingDrill(false);
    setDirty(true);
  };

  // ── Start edit ─────────────────────────────────────────────────────────────

  const startEdit = (i: number) => {
    if (proximity) {
      const d = proxDrills[i];
      setEditingIndex(i);
      setEditName(d.name);
      setEditGrid(d.grid ? { ...d.grid } : emptyGrid());
      setEditClub(d.club ?? null);
    } else {
      const d = drills[i];
      setEditingIndex(i);
      setEditName(d.name);
      if (d.grid) {
        setEditGrid({ ...d.grid });
      } else {
        setEditGrid(emptyGrid());
        setEditMade(d.made ?? '');
        setEditAttempts(d.attempts ?? '');
      }
    }
  };

  const confirmEdit = () => {
    if (editingIndex === null || !editName) return;
    if (proximity) {
      const total = sumGrid(editGrid);
      if (total === 0) return;
      setProxDrills(prev => prev.map((d, i) =>
        i === editingIndex ? {
          ...d, name: editName, attempts: total,
          grid: { ...editGrid }, success: successFromGrid(editGrid), club: editClub ?? undefined,
        } : d
      ));
    } else {
      const d = drills[editingIndex];
      if (d.grid || sumGrid(editGrid) > 0) {
        // Grid drill (Putting)
        const total = sumGrid(editGrid);
        if (total === 0) return;
        setDrills(prev => prev.map((dd, i) =>
          i === editingIndex ? { name: editName, grid: { ...editGrid }, success: successFromGrid(editGrid) } : dd
        ));
      } else {
        // Legacy drill
        if (!editMade || !editAttempts) return;
        const success = Math.round((parseInt(editMade) / parseInt(editAttempts)) * 100);
        setDrills(prev => prev.map((dd, i) =>
          i === editingIndex ? { name: editName, made: editMade, attempts: editAttempts, success } : dd
        ));
      }
    }
    setEditingIndex(null);
    setDirty(true);
  };

  // ── Date picker ────────────────────────────────────────────────────────────

  const onPickerChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPickerVisible(false);
    if (selected) setPickerDate(selected);
  };
  const confirmDatePick = () => {
    setPickerVisible(false);
    setSessionDate(pickerDate.toISOString());
    setDirty(true);
  };

  if (!session) {
    return <View style={styles.container}><Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>Loading…</Text></View>;
  }

  // ── Drill card renderer ────────────────────────────────────────────────────

  const renderDrillCard = (d: Drill | ProximityDrill, i: number, isProx: boolean) => {
    const isEditing = editingIndex === i;
    const proxDrill = isProx ? (d as ProximityDrill) : null;
    const stdDrill = !isProx ? (d as Drill) : null;
    const hasGrid = isProx ? !!proxDrill?.grid : !!stdDrill?.grid;
    const centerLabel = getCenterLabel(proxDrill?.threshold, session.type);

    if (isEditing) {
      return (
        <View key={i} style={styles.editCard}>
          {/* Suggestions */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(GRID_SUGGESTIONS[session.type] ?? LEGACY_SUGGESTIONS[session.type]?.map(s => s.name) ?? []).map(name => (
                <TouchableOpacity
                  key={typeof name === 'string' ? name : (name as any).name}
                  style={[styles.chip, editName === (typeof name === 'string' ? name : (name as any).name) && styles.chipSelected]}
                  onPress={() => setEditName(typeof name === 'string' ? name : (name as any).name)}
                >
                  <Text style={[styles.chipText, editName === (typeof name === 'string' ? name : (name as any).name) && styles.chipTextSelected]}>
                    {typeof name === 'string' ? name : (name as any).name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TextInput value={editName} onChangeText={setEditName} placeholder="Drill name" style={[styles.input, { marginBottom: 8 }]} />

          {isProx && (
            <>
              <Text style={styles.clubLabel}>Club (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {SHORT_GAME_CLUBS.map(c => (
                    <TouchableOpacity key={c} style={[styles.chip, editClub === c && styles.chipSelected]} onPress={() => setEditClub(editClub === c ? null : c)}>
                      <Text style={[styles.chipText, editClub === c && styles.chipTextSelected]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {/* Grid or legacy input */}
          {(useGrid || hasGrid) ? (
            <>
              <GridDisplay
                grid={editGrid}
                centerLabel={centerLabel}
                editable
                onTap={key => setEditGrid(prev => ({ ...prev, [key]: prev[key] + 1 }))}
                onLongPress={key => setEditGrid(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
              />
              {sumGrid(editGrid) > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.proxPreview}>
                    {sumGrid(editGrid)} shots · {successFromGrid(editGrid)}% {session.type === 'Putting' ? 'holed' : `≤${proxDrill?.threshold ?? 2}m`}
                  </Text>
                  <TouchableOpacity onPress={() => setEditGrid(emptyGrid())} style={styles.resetBtn}>
                    <Text style={styles.resetBtnText}>↺ Reset</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.inputRow}>
              <TextInput value={editMade} onChangeText={setEditMade} placeholder="Made" keyboardType="numeric" style={[styles.input, styles.inputSmall]} />
              <TextInput value={editAttempts} onChangeText={setEditAttempts} placeholder="Total" keyboardType="numeric" style={[styles.input, styles.inputSmall]} />
            </View>
          )}

          <View style={styles.editActions}>
            <TouchableOpacity onPress={confirmEdit} style={styles.confirmBtn}>
              <Text style={styles.confirmBtnText}>✓ Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingIndex(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // View mode
    return (
      <View key={i} style={styles.drillRow}>
        <View style={styles.drillInfo}>
          {isProx ? (
            <>
              <Text style={styles.drillName}>{proxDrill!.name}{proxDrill!.club ? ` · ${proxDrill!.club}` : ''}</Text>
              {proxDrill!.grid ? (
                <>
                  <Text style={styles.drillScore}>{proxDrill!.attempts} shots · {proxDrill!.success}% ≤{proxDrill!.threshold ?? 2}m</Text>
                  {dominantMiss(proxDrill!.grid) && <Text style={styles.drillMiss}>↳ miss: {dominantMiss(proxDrill!.grid)}</Text>}
                  <GridDisplay grid={proxDrill!.grid} centerLabel={getCenterLabel(proxDrill!.threshold, session.type)} />
                </>
              ) : (
                // Legacy bucket display
                <Text style={styles.drillScore}>
                  {proxDrill!.attempts} shots · {proxDrill!.success}% ·{' '}
                  ≤1m:{proxDrill!.buckets?.inside1m ?? 0}  1–2m:{proxDrill!.buckets?.one2m ?? 0}  2–3m:{proxDrill!.buckets?.two3m ?? 0}  3m+:{proxDrill!.buckets?.beyond3m ?? 0}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.drillName}>{stdDrill!.name}</Text>
              {stdDrill!.grid ? (
                <>
                  <Text style={styles.drillScore}>{sumGrid(stdDrill!.grid)} putts · {stdDrill!.success}% holed</Text>
                  {dominantMiss(stdDrill!.grid) && <Text style={styles.drillMiss}>↳ miss: {dominantMiss(stdDrill!.grid)}</Text>}
                  <GridDisplay grid={stdDrill!.grid} centerLabel="Holed" />
                </>
              ) : (
                <Text style={styles.drillScore}>{stdDrill!.made}/{stdDrill!.attempts} · {stdDrill!.success}%</Text>
              )}
            </>
          )}
        </View>
        <View style={styles.drillActions}>
          <TouchableOpacity onPress={() => startEdit(i)} style={styles.iconBtn}><Text style={styles.iconBtnText}>✏️</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => isProx ? deleteProxDrill(i) : deleteDrill(i)} style={styles.iconBtn}><Text style={styles.iconBtnText}>🗑</Text></TouchableOpacity>
        </View>
      </View>
    );
  };

  const drillList = proximity ? proxDrills : drills;
  const drillCount = proximity ? proxDrills.length : drills.length;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={confirmBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{session.type} Session</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{formatTime(session.duration)}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Date</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={sessionDate.split('T')[0]}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e: any) => { setSessionDate(new Date(e.target.value + 'T12:00:00').toISOString()); setDirty(true); }}
                style={{ fontSize: 15, fontWeight: '600', color: '#333', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 } as any}
              />
            ) : (
              <TouchableOpacity onPress={() => { setPickerDate(new Date(sessionDate)); setPickerVisible(true); }}>
                <Text style={[styles.metaValue, styles.metaLink]}>{formatDate(sessionDate)} ✏️</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Drills</Text>
            <Text style={styles.metaValue}>{drillCount}</Text>
          </View>
        </View>

        {/* Drills section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Drills</Text>
            <TouchableOpacity onPress={() => { setAddingDrill(true); setEditingIndex(null); setNewDrillName(''); setNewGrid(emptyGrid()); setNewProxClub(null); setNewMade(''); setNewAttempts(''); }} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {proximity && proxDrills.length > 0 && (
            <Text style={styles.ballTotal}>🎱 {proxDrills.reduce((s, d) => s + d.attempts, 0)} shots total</Text>
          )}

          {drillCount === 0 && !addingDrill && <Text style={styles.empty}>No drills recorded</Text>}

          {drillList.map((d, i) => renderDrillCard(d, i, proximity))}

          {/* Add form */}
          {addingDrill && (
            <View style={styles.editCard}>
              {/* Suggestions */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(GRID_SUGGESTIONS[session.type] ?? []).map(name => (
                    <TouchableOpacity key={name} style={[styles.chip, newDrillName === name && styles.chipSelected]}
                      onPress={() => { setNewDrillName(name); setNewGrid(emptyGrid()); setNewProxClub(null); }}>
                      <Text style={[styles.chipText, newDrillName === name && styles.chipTextSelected]}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                  {(LEGACY_SUGGESTIONS[session.type] ?? []).map(s => (
                    <TouchableOpacity key={s.name} style={[styles.chip, newDrillName === s.name && styles.chipSelected]}
                      onPress={() => { setNewDrillName(s.name); setNewAttempts(s.attempts); setNewMade(''); }}>
                      <Text style={[styles.chipText, newDrillName === s.name && styles.chipTextSelected]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <TextInput value={newDrillName} onChangeText={setNewDrillName} placeholder="Drill name" style={[styles.input, { marginBottom: 8 }]} />

              {proximity && (
                <>
                  <Text style={styles.clubLabel}>Club (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {SHORT_GAME_CLUBS.map(c => (
                        <TouchableOpacity key={c} style={[styles.chip, newProxClub === c && styles.chipSelected]} onPress={() => setNewProxClub(newProxClub === c ? null : c)}>
                          <Text style={[styles.chipText, newProxClub === c && styles.chipTextSelected]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {useGrid ? (
                <>
                  <GridDisplay
                    grid={newGrid}
                    centerLabel={getCenterLabel(defaultThreshold, session.type)}
                    editable
                    onTap={key => setNewGrid(prev => ({ ...prev, [key]: prev[key] + 1 }))}
                    onLongPress={key => setNewGrid(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
                  />
                  {sumGrid(newGrid) > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={styles.proxPreview}>
                        {sumGrid(newGrid)} shots · {successFromGrid(newGrid)}% {session.type === 'Putting' ? 'holed' : `≤${defaultThreshold}m`}
                      </Text>
                      <TouchableOpacity onPress={() => setNewGrid(emptyGrid())} style={styles.resetBtn}>
                        <Text style={styles.resetBtnText}>↺ Reset</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput value={newMade} onChangeText={setNewMade} placeholder="Made" keyboardType="numeric" style={[styles.input, styles.inputSmall]} />
                  <TextInput value={newAttempts} onChangeText={setNewAttempts} placeholder="Total" keyboardType="numeric" style={[styles.input, styles.inputSmall]} />
                </View>
              )}

              <View style={styles.editActions}>
                <TouchableOpacity onPress={confirmAddDrill} style={styles.confirmBtn}>
                  <Text style={styles.confirmBtnText}>+ Add Drill</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAddingDrill(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={v => { setNotes(v); setDirty(true); }}
            placeholder="Session notes…"
            multiline
            style={styles.notesInput}
          />
        </View>

        <TouchableOpacity onPress={saveSession} style={styles.saveFullBtn}>
          <Text style={styles.saveFullBtnText}>💾 Save Session</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date picker */}
      {Platform.OS === 'ios' ? (
        <Modal visible={pickerVisible} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setPickerVisible(false)}><Text style={styles.pickerCancel}>Cancel</Text></TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={confirmDatePick}><Text style={styles.pickerDone}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={pickerDate} mode="date" display="spinner" onChange={onPickerChange} maximumDate={new Date()} style={{ height: 200 }} />
            </View>
          </View>
        </Modal>
      ) : (
        pickerVisible && (
          <DateTimePicker value={pickerDate} mode="date" display="default"
            onChange={(e, d) => { onPickerChange(e, d); if (d) { setPickerDate(d); confirmDatePick(); } }}
            maximumDate={new Date()} />
        )
      )}
    </KeyboardAvoidingView>
  );
}

// ── Grid styles ───────────────────────────────────────────────────────────────

const gridStyles = StyleSheet.create({
  container: { marginBottom: 8, gap: 3 },
  row: { flexDirection: 'row', gap: 3 },
  cell: {
    flex: 1, minHeight: 54, backgroundColor: '#f5f5f5', borderRadius: 8,
    borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  centerCell: { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
  activeCell: { backgroundColor: '#fff8e1', borderColor: '#ffc107' },
  centerActiveCell: { backgroundColor: '#c8e6c9', borderColor: '#4CAF50' },
  readOnly: { opacity: 0.9 },
  label: { fontSize: 10, color: '#666', textAlign: 'center', fontWeight: '500', lineHeight: 13 },
  centerLabelText: { fontSize: 11, color: '#2e7d32', fontWeight: '700' },
  count: { fontSize: 20, fontWeight: 'bold', color: '#e65100', marginTop: 1 },
  centerCount: { color: '#2e7d32' },
  zeroCount: { fontSize: 14, color: '#ccc', fontWeight: '400' },
  hint: { fontSize: 8, color: '#bbb', marginTop: 1 },
  editHint: { fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 4 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingTop: 16 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#222' },

  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  metaBox: { flex: 1, backgroundColor: '#f0f4f0', borderRadius: 12, padding: 12, alignItems: 'center' },
  metaLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  metaValue: { fontSize: 15, fontWeight: '600', color: '#333' },
  metaLink: { color: '#4CAF50' },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  addChip: { backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addChipText: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },

  empty: { color: '#bbb', textAlign: 'center', marginVertical: 12, fontSize: 14 },
  ballTotal: { fontSize: 13, fontWeight: '700', color: '#4CAF50', textAlign: 'center', marginBottom: 8 },

  drillRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'flex-start' },
  drillInfo: { flex: 1 },
  drillName: { fontSize: 15, fontWeight: '600', color: '#222' },
  drillScore: { fontSize: 13, color: '#4CAF50', marginTop: 2 },
  drillMiss: { fontSize: 12, color: '#e65100', marginTop: 2, marginBottom: 6 },
  drillActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 16 },

  editCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fff', marginBottom: 8 },
  inputSmall: { flex: 1 },

  chip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#f0f4f0', borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  chipSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  clubLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6 },

  proxPreview: { fontSize: 13, color: '#4CAF50', fontWeight: '600', flex: 1 },
  resetBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f0f0f0', borderRadius: 8 },
  resetBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },

  editActions: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { flex: 1, backgroundColor: '#f0f0f0', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#555', fontWeight: '600', fontSize: 14 },

  notesInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#fafafa', minHeight: 80 },
  saveFullBtn: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 14, marginTop: 4 },
  saveFullBtnText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },

  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  pickerCancel: { fontSize: 16, color: '#999' },
  pickerDone: { fontSize: 16, color: '#4CAF50', fontWeight: '700' },
});
