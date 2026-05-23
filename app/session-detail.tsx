import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet,
  Alert, Platform, Modal, KeyboardAvoidingView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getSessions, saveSessions } from '../services/storage';
import type { PracticeSession, Drill, ProximityDrill, ProximityBuckets } from '../types';

const SHORT_GAME_CLUBS = ['7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW'];

const STANDARD_DRILLS: Record<string, { name: string; attempts: string }[]> = {
  Putting: [
    { name: 'Short Putts 1m', attempts: '25' },
    { name: 'Short Putts 2m', attempts: '15' },
    { name: 'Lag Putting 6m', attempts: '10' },
    { name: 'Lag Putting 9m', attempts: '10' },
    { name: 'Lag Putting 12m', attempts: '10' },
    { name: 'Pressure Ladder', attempts: '10' },
  ],
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
};

const PROXIMITY_DRILLS: Record<string, string[]> = {
  Chipping: ['Chip 5m', 'Chip 10m', 'Chip 15m', 'Chip 20m', 'Chip 30m'],
  Pitching: ['Pitch 20m', 'Pitch 30m', 'Pitch 40m', 'Pitch 50m', 'Pitch 60m', 'Pitch 70m'],
};

const isProximityType = (type: string) => type === 'Chipping' || type === 'Pitching';

const calcSuccess = (buckets: ProximityBuckets, total: number) => {
  if (total === 0) return 0;
  return Math.round(((buckets.inside1m + buckets.one2m) / total) * 100);
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function SessionDetailScreen() {
  const { index } = useLocalSearchParams();
  const sessionIndex = typeof index === 'string' ? parseInt(index) : 0;

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [originalIndex, setOriginalIndex] = useState<number>(0);
  const [dirty, setDirty] = useState(false);

  // Edit state
  const [notes, setNotes] = useState('');
  const [drills, setDrills] = useState<Drill[]>([]);
  const [proxDrills, setProxDrills] = useState<ProximityDrill[]>([]);
  const [sessionDate, setSessionDate] = useState('');

  // Date picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  // Add drill form (standard)
  const [addingDrill, setAddingDrill] = useState(false);
  const [newDrillName, setNewDrillName] = useState('');
  const [newMade, setNewMade] = useState('');
  const [newAttempts, setNewAttempts] = useState('');

  // Add proximity drill form
  const [addingProx, setAddingProx] = useState(false);
  const [newProxName, setNewProxName] = useState('');
  const [newProxClub, setNewProxClub] = useState<string | null>(null);
  const [newBuckets, setNewBuckets] = useState<ProximityBuckets>({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 });

  // Inline editing
  const [editingDrillIndex, setEditingDrillIndex] = useState<number | null>(null);
  const [editDrillName, setEditDrillName] = useState('');
  const [editMade, setEditMade] = useState('');
  const [editAttempts, setEditAttempts] = useState('');

  const [editingProxIndex, setEditingProxIndex] = useState<number | null>(null);
  const [editProxName, setEditProxName] = useState('');
  const [editProxClub, setEditProxClub] = useState<string | null>(null);
  const [editBuckets, setEditBuckets] = useState<ProximityBuckets>({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 });

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    const all = await getSessions();
    // sessionIndex is position in the reversed list shown on dashboard
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
  const standardSuggestions = session ? (STANDARD_DRILLS[session.type] ?? []) : [];
  const proxSuggestions = session ? (PROXIMITY_DRILLS[session.type] ?? []) : [];

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
    if (Platform.OS === 'web') {
      alert('Session saved!');
    } else {
      Alert.alert('Saved', 'Session updated successfully.');
    }
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

  // ── Delete drill ───────────────────────────────────────────────────────────

  const deleteDrill = (i: number) => {
    setDrills(prev => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const deleteProxDrill = (i: number) => {
    setProxDrills(prev => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  // ── Add standard drill ─────────────────────────────────────────────────────

  const confirmAddDrill = () => {
    if (!newDrillName || !newMade || !newAttempts) return;
    const success = Math.round((parseInt(newMade) / parseInt(newAttempts)) * 100);
    setDrills(prev => [...prev, { name: newDrillName, made: newMade, attempts: newAttempts, success }]);
    setNewDrillName(''); setNewMade(''); setNewAttempts('');
    setAddingDrill(false);
    setDirty(true);
  };

  // ── Add proximity drill ────────────────────────────────────────────────────

  const newProxTotal = newBuckets.inside1m + newBuckets.one2m + newBuckets.two3m + newBuckets.beyond3m + newBuckets.miss;
  const newProxSuccess = calcSuccess(newBuckets, newProxTotal);

  const confirmAddProx = () => {
    if (!newProxName || newProxTotal === 0) return;
    setProxDrills(prev => [...prev, {
      name: newProxName,
      attempts: newProxTotal,
      buckets: { ...newBuckets },
      success: newProxSuccess,
      club: newProxClub ?? undefined,
    }]);
    setNewProxName(''); setNewProxClub(null);
    setNewBuckets({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 });
    setAddingProx(false);
    setDirty(true);
  };

  // ── Inline edit standard ───────────────────────────────────────────────────

  const startEditDrill = (i: number) => {
    const d = drills[i];
    setEditingDrillIndex(i);
    setEditDrillName(d.name);
    setEditMade(d.made);
    setEditAttempts(d.attempts);
  };

  const confirmEditDrill = () => {
    if (editingDrillIndex === null || !editDrillName || !editMade || !editAttempts) return;
    const success = Math.round((parseInt(editMade) / parseInt(editAttempts)) * 100);
    setDrills(prev => prev.map((d, i) =>
      i === editingDrillIndex ? { name: editDrillName, made: editMade, attempts: editAttempts, success } : d
    ));
    setEditingDrillIndex(null);
    setDirty(true);
  };

  // ── Inline edit proximity ──────────────────────────────────────────────────

  const editProxTotal = editBuckets.inside1m + editBuckets.one2m + editBuckets.two3m + editBuckets.beyond3m + editBuckets.miss;
  const editProxSuccess = calcSuccess(editBuckets, editProxTotal);

  const startEditProx = (i: number) => {
    const d = proxDrills[i];
    setEditingProxIndex(i);
    setEditProxName(d.name);
    setEditProxClub(d.club ?? null);
    setEditBuckets({ ...d.buckets });
  };

  const confirmEditProx = () => {
    if (editingProxIndex === null || !editProxName || editProxTotal === 0) return;
    setProxDrills(prev => prev.map((d, i) =>
      i === editingProxIndex ? {
        name: editProxName,
        attempts: editProxTotal,
        buckets: { ...editBuckets },
        success: editProxSuccess,
        club: editProxClub ?? undefined,
      } : d
    ));
    setEditingProxIndex(null);
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

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
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
            <Text style={styles.metaValue}>{proximity ? proxDrills.length : drills.length}</Text>
          </View>
        </View>

        {/* ── Standard drills ──────────────────────────────────────── */}
        {!proximity && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Drills</Text>
              <TouchableOpacity onPress={() => { setAddingDrill(true); setEditingDrillIndex(null); }} style={styles.addChip}>
                <Text style={styles.addChipText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {drills.length === 0 && !addingDrill && (
              <Text style={styles.empty}>No drills recorded</Text>
            )}

            {drills.map((d, i) => (
              editingDrillIndex === i ? (
                <View key={i} style={styles.editCard}>
                  <TextInput
                    value={editDrillName}
                    onChangeText={setEditDrillName}
                    placeholder="Drill name"
                    style={styles.input}
                  />
                  <View style={styles.inputRow}>
                    <TextInput
                      value={editMade}
                      onChangeText={setEditMade}
                      placeholder="Made"
                      keyboardType="numeric"
                      style={[styles.input, styles.inputSmall]}
                    />
                    <TextInput
                      value={editAttempts}
                      onChangeText={setEditAttempts}
                      placeholder="Total"
                      keyboardType="numeric"
                      style={[styles.input, styles.inputSmall]}
                    />
                  </View>
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={confirmEditDrill} style={styles.confirmBtn}>
                      <Text style={styles.confirmBtnText}>✓ Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingDrillIndex(null)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View key={i} style={styles.drillRow}>
                  <View style={styles.drillInfo}>
                    <Text style={styles.drillName}>{d.name}</Text>
                    <Text style={styles.drillScore}>{d.made}/{d.attempts} · {d.success}%</Text>
                  </View>
                  <View style={styles.drillActions}>
                    <TouchableOpacity onPress={() => startEditDrill(i)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteDrill(i)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ))}

            {/* Add drill form */}
            {addingDrill && (
              <View style={styles.editCard}>
                {standardSuggestions.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {standardSuggestions.map(s => (
                        <TouchableOpacity
                          key={s.name}
                          style={[styles.chip, newDrillName === s.name && styles.chipSelected]}
                          onPress={() => { setNewDrillName(s.name); setNewAttempts(s.attempts); setNewMade(''); }}
                        >
                          <Text style={[styles.chipText, newDrillName === s.name && styles.chipTextSelected]}>{s.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
                <TextInput
                  value={newDrillName}
                  onChangeText={setNewDrillName}
                  placeholder="Drill name"
                  style={[styles.input, { marginBottom: 8 }]}
                />
                <View style={styles.inputRow}>
                  <TextInput
                    value={newMade}
                    onChangeText={setNewMade}
                    placeholder="Made"
                    keyboardType="numeric"
                    style={[styles.input, styles.inputSmall]}
                  />
                  <TextInput
                    value={newAttempts}
                    onChangeText={setNewAttempts}
                    placeholder="Total"
                    keyboardType="numeric"
                    style={[styles.input, styles.inputSmall]}
                  />
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={confirmAddDrill} style={styles.confirmBtn}>
                    <Text style={styles.confirmBtnText}>+ Add Drill</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setAddingDrill(false); setNewDrillName(''); setNewMade(''); setNewAttempts(''); }} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Proximity drills ──────────────────────────────────────── */}
        {proximity && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Drills</Text>
              <TouchableOpacity onPress={() => { setAddingProx(true); setEditingProxIndex(null); }} style={styles.addChip}>
                <Text style={styles.addChipText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {proxDrills.length > 0 && (
              <Text style={styles.ballTotal}>
                🎱 {proxDrills.reduce((sum, d) => sum + d.attempts, 0)} balls total
              </Text>
            )}

            {proxDrills.length === 0 && !addingProx && (
              <Text style={styles.empty}>No drills recorded</Text>
            )}

            {proxDrills.map((d, i) => (
              editingProxIndex === i ? (
                <View key={i} style={styles.editCard}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {proxSuggestions.map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.chip, editProxName === s && styles.chipSelected]}
                          onPress={() => { setEditProxName(s); setEditBuckets({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 }); }}
                        >
                          <Text style={[styles.chipText, editProxName === s && styles.chipTextSelected]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <TextInput
                    value={editProxName}
                    onChangeText={setEditProxName}
                    placeholder="Drill name"
                    style={[styles.input, { marginBottom: 8 }]}
                  />
                  <Text style={styles.clubLabel}>Club (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {SHORT_GAME_CLUBS.map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.chip, editProxClub === c && styles.chipSelected]}
                          onPress={() => setEditProxClub(editProxClub === c ? null : c)}
                        >
                          <Text style={[styles.chipText, editProxClub === c && styles.chipTextSelected]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={styles.bucketRow}>
                    {([
                      { key: 'inside1m', label: '≤1m' },
                      { key: 'one2m', label: '1–2m' },
                      { key: 'two3m', label: '2–3m' },
                      { key: 'beyond3m', label: '3m+' },
                      { key: 'miss', label: '❌' },
                    ] as { key: keyof ProximityBuckets; label: string }[]).map(({ key, label }) => (
                      <View key={key} style={styles.bucketItem}>
                        <Text style={styles.bucketLabel}>{label}</Text>
                        <TextInput
                          value={editBuckets[key] === 0 ? '' : String(editBuckets[key])}
                          onChangeText={v => setEditBuckets(prev => ({ ...prev, [key]: parseInt(v) || 0 }))}
                          keyboardType="numeric"
                          style={styles.bucketInput}
                          placeholder="0"
                        />
                      </View>
                    ))}
                  </View>
                  {editProxTotal > 0 && (
                    <Text style={styles.proxPreview}>{editProxTotal} shots · {editProxSuccess}% inside 2m</Text>
                  )}
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={confirmEditProx} style={styles.confirmBtn}>
                      <Text style={styles.confirmBtnText}>✓ Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingProxIndex(null)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View key={i} style={styles.drillRow}>
                  <View style={styles.drillInfo}>
                    <Text style={styles.drillName}>{d.name}{d.club ? ` · ${d.club}` : ''}</Text>
                    <Text style={styles.drillScore}>{d.attempts} balls · {d.success}% inside 2m</Text>
                    <Text style={styles.drillBuckets}>
                      ≤1m:{d.buckets.inside1m}  1–2m:{d.buckets.one2m}  2–3m:{d.buckets.two3m}  3m+:{d.buckets.beyond3m}  ❌:{d.buckets.miss ?? 0}
                    </Text>
                  </View>
                  <View style={styles.drillActions}>
                    <TouchableOpacity onPress={() => startEditProx(i)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteProxDrill(i)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ))}

            {/* Add prox drill form */}
            {addingProx && (
              <View style={styles.editCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {proxSuggestions.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.chip, newProxName === s && styles.chipSelected]}
                        onPress={() => { setNewProxName(s); setNewBuckets({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 }); setNewProxClub(null); }}
                      >
                        <Text style={[styles.chipText, newProxName === s && styles.chipTextSelected]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <TextInput
                  value={newProxName}
                  onChangeText={setNewProxName}
                  placeholder="Drill name (e.g. Chip 10m)"
                  style={[styles.input, { marginBottom: 8 }]}
                />
                <Text style={styles.clubLabel}>Club (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {SHORT_GAME_CLUBS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.chip, newProxClub === c && styles.chipSelected]}
                        onPress={() => setNewProxClub(newProxClub === c ? null : c)}
                      >
                        <Text style={[styles.chipText, newProxClub === c && styles.chipTextSelected]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={styles.bucketRow}>
                  {([
                    { key: 'inside1m', label: '≤1m' },
                    { key: 'one2m', label: '1–2m' },
                    { key: 'two3m', label: '2–3m' },
                    { key: 'beyond3m', label: '3m+' },
                    { key: 'miss', label: '❌' },
                  ] as { key: keyof ProximityBuckets; label: string }[]).map(({ key, label }) => (
                    <View key={key} style={styles.bucketItem}>
                      <Text style={styles.bucketLabel}>{label}</Text>
                      <TextInput
                        value={newBuckets[key] === 0 ? '' : String(newBuckets[key])}
                        onChangeText={v => setNewBuckets(prev => ({ ...prev, [key]: parseInt(v) || 0 }))}
                        keyboardType="numeric"
                        style={styles.bucketInput}
                        placeholder="0"
                      />
                    </View>
                  ))}
                </View>
                {newProxTotal > 0 && (
                  <Text style={styles.proxPreview}>{newProxTotal} shots · {newProxSuccess}% inside 2m</Text>
                )}
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={confirmAddProx} style={styles.confirmBtn}>
                    <Text style={styles.confirmBtnText}>+ Add Drill</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setAddingProx(false); setNewProxName(''); setNewProxClub(null); setNewBuckets({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 }); }} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

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

        {/* Save button — always visible */}
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
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Text style={styles.pickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={confirmDatePick}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                onChange={onPickerChange}
                maximumDate={new Date()}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        pickerVisible && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={(e, d) => { onPickerChange(e, d); if (d) { setPickerDate(d); confirmDatePick(); } }}
            maximumDate={new Date()}
          />
        )
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingTop: 16 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#222' },
  saveBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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

  drillRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  drillInfo: { flex: 1 },
  drillName: { fontSize: 15, fontWeight: '600', color: '#222' },
  drillScore: { fontSize: 13, color: '#4CAF50', marginTop: 2 },
  drillBuckets: { fontSize: 11, color: '#999', marginTop: 2 },
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

  bucketRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  bucketItem: { flex: 1, alignItems: 'center' },
  bucketLabel: { fontSize: 11, fontWeight: '700', color: '#555', marginBottom: 4 },
  bucketInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 8, fontSize: 15, backgroundColor: '#fff', textAlign: 'center', width: '100%' },
  proxPreview: { fontSize: 13, color: '#4CAF50', fontWeight: '600', textAlign: 'center', marginBottom: 8 },

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
