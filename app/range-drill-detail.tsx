import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, Platform, Modal, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, router } from 'expo-router';
import { getRangeDrills, saveRangeDrills } from '../services/storage';
import type { RangeDrill, RangeDrillHole } from '../types';
import { PUTTS_PER_HOLE } from '../constants/scoring';

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
const fmtDate = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Component ─────────────────────────────────────────────────────────────────

export default function RangeDrillDetailScreen() {
  const { index, autoEdit } = useLocalSearchParams();
  const drillIndex = typeof index === 'string' ? parseInt(index) : 0;

  const [drill, setDrill] = useState<RangeDrill | null>(null);
  const [originalIndex, setOriginalIndex] = useState(0);
  const [expandedHole, setExpandedHole] = useState<number | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHoles, setEditHoles] = useState<RangeDrillHole[]>([]);
  const [clubPicker, setClubPicker] = useState<{ holeIdx: number; shotIdx: number } | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []); // run once on mount

  const load = async () => {
    const all = await getRangeDrills();
    const orig = all.length - 1 - drillIndex; // list is shown reversed (newest first)
    const d = all[orig] ?? null;
    setOriginalIndex(orig);
    setDrill(d);
    // Opened straight into edit mode from the Dashboard's Edit button
    if (d && autoEdit === '1') {
      setEditNotes(d.notes ?? '');
      setEditDate(d.date);
      setEditHoles(d.holes.map(h => ({ ...h, shots: h.shots.map(s => ({ ...s })) })));
      setEditing(true);
    }
  };

  // ── Edit actions ───────────────────────────────────────────────────────────

  const startEdit = () => {
    if (!drill) return;
    setEditNotes(drill.notes ?? '');
    setEditDate(drill.date);
    // Deep copy so edits don't mutate the loaded drill until saved
    setEditHoles(drill.holes.map(h => ({ ...h, shots: h.shots.map(s => ({ ...s })) })));
    setExpandedHole(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setClubPicker(null);
  };

  const updateShotDistance = (holeIdx: number, shotIdx: number, text: string) => {
    const n = parseInt(text);
    setEditHoles(prev => prev.map((h, hi) => hi !== holeIdx ? h : {
      ...h,
      shots: h.shots.map((s, si) => si !== shotIdx ? s : { ...s, distance: isNaN(n) ? null : n }),
    }));
  };

  const setShotClub = (club: string) => {
    if (!clubPicker) return;
    const { holeIdx, shotIdx } = clubPicker;
    setEditHoles(prev => prev.map((h, hi) => hi !== holeIdx ? h : {
      ...h,
      shots: h.shots.map((s, si) => si !== shotIdx ? s : { ...s, club }),
    }));
    setClubPicker(null);
  };

  const removeShot = (holeIdx: number, shotIdx: number) => {
    setEditHoles(prev => prev.map((h, hi) => hi !== holeIdx ? h : {
      ...h,
      shots: h.shots.filter((_, si) => si !== shotIdx),
    }));
  };

  const addShot = (holeIdx: number) => {
    setEditHoles(prev => prev.map((h, hi) => hi !== holeIdx ? h : {
      ...h,
      shots: [...h.shots, { club: h.shots[h.shots.length - 1]?.club ?? '7i', distance: null }],
    }));
  };

  const alertMsg = (title: string, msg: string) => {
    if (Platform.OS === 'web') alert(msg); else Alert.alert(title, msg);
  };

  const saveEdits = async () => {
    if (!drill) return;
    // Every shot must have a distance, and every hole at least one shot.
    for (const h of editHoles) {
      if (h.shots.length === 0) {
        alertMsg('Empty hole', `Hole ${h.hole} has no shots. Add at least one, or delete the drill.`);
        return;
      }
      for (const s of h.shots) {
        if (s.distance == null || s.distance <= 0) {
          alertMsg('Distance required', `Every shot needs a distance (check hole ${h.hole}).`);
          return;
        }
      }
    }
    const updated: RangeDrill = { ...drill, date: editDate, notes: editNotes, holes: editHoles };
    try {
      const all = await getRangeDrills();
      all[originalIndex] = updated;
      await saveRangeDrills(all);
      setDrill(updated);
      setEditing(false);
    } catch (e) {
      console.error('Error saving drill edits', e);
      alertMsg('Save failed', 'Could not save your changes. Check your connection and try again.');
    }
  };

  const deleteDrill = () => {
    const doDelete = async () => {
      try {
        const all = await getRangeDrills();
        all.splice(originalIndex, 1);
        await saveRangeDrills(all);
        router.back();
      } catch (e) {
        console.error('Error deleting drill', e);
        alertMsg('Delete failed', 'Could not delete this drill. Try again.');
      }
    };
    const msg = 'Delete this range drill? This can\'t be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Delete drill?', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Date picker ──────────────────────────────────────────────────────────────

  const openDatePicker = () => {
    setPickerDate(new Date(editDate));
    setDatePickerVisible(true);
  };
  const onPickerChange = (_e: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setDatePickerVisible(false);
    if (selected) {
      setPickerDate(selected);
      if (Platform.OS === 'android') setEditDate(selected.toISOString());
    }
  };
  const confirmDatePick = () => {
    setDatePickerVisible(false);
    setEditDate(pickerDate.toISOString());
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!drill) {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.notFound}>Drill not found.</Text>
      </ScrollView>
    );
  }

  const holes = editing ? editHoles : drill.holes;
  const shotsToGreen = holes.reduce((s, h) => s + h.shots.length, 0);
  const totalPutts = holes.length * PUTTS_PER_HOLE;
  const totalStrokes = shotsToGreen + totalPutts;
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const totalVsPar = totalStrokes - totalPar;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => editing ? cancelEdit() : router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{editing ? '✕ Cancel' : '← Back'}</Text>
          </TouchableOpacity>
          {!editing && (
            <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.title}>{drill.courseName}</Text>

        {/* Date */}
        {editing ? (
          Platform.OS === 'web' ? (
            // @ts-ignore — HTML input on web
            <input
              type="date"
              value={editDate.split('T')[0]}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e: any) => e.target.value && setEditDate(new Date(e.target.value + 'T12:00:00').toISOString())}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, marginBottom: 16, color: '#1565C0' } as any}
            />
          ) : (
            <TouchableOpacity onPress={openDatePicker} style={styles.dateEditBtn}>
              <Text style={styles.dateEditText}>📅 {fmtDate(editDate)}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={styles.subtitle}>{fmtDate(drill.date)}</Text>
        )}

        {/* Summary card */}
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
              <Text style={styles.summaryValue}>{fmtTime(drill.duration)}</Text>
              <Text style={styles.summaryLabel}>Duration</Text>
            </View>
          </View>
        </View>

        <Text style={styles.scoreCaption}>
          Score = {shotsToGreen} shots to green + {totalPutts} putts ({PUTTS_PER_HOLE}/hole)
        </Text>

        {/* Notes */}
        {editing ? (
          <TextInput
            placeholder="Notes (optional)..."
            value={editNotes}
            onChangeText={setEditNotes}
            style={styles.notesInput}
            multiline
          />
        ) : (
          drill.notes ? <Text style={styles.notes}>📝 {drill.notes}</Text> : null
        )}

        {/* ── View mode: scorecard ── */}
        {!editing && (
          <>
            <Text style={styles.scorecardTitle}>Scorecard</Text>
            <View style={styles.scorecardHeader}>
              <Text style={[styles.colHole, styles.headerText]}>#</Text>
              <Text style={[styles.colPar, styles.headerText]}>Par</Text>
              <Text style={[styles.colStrokes, styles.headerText]}>Strokes</Text>
              <Text style={[styles.colVsPar, styles.headerText]}>+/-</Text>
              <Text style={[styles.colClubs, styles.headerText]}>Clubs</Text>
            </View>
            {drill.holes.map((h, i) => {
              const holeScore = h.shots.length + PUTTS_PER_HOLE;
              const vp = holeScore - h.par;
              const clubSummary = h.shots.map(s => s.club).join(', ');
              const isOpen = expandedHole === i;
              return (
                <View key={i}>
                  <TouchableOpacity
                    style={[styles.scorecardRow, i % 2 === 0 && styles.scorecardRowAlt]}
                    onPress={() => setExpandedHole(isOpen ? null : i)}
                  >
                    <Text style={[styles.colHole, styles.holeNum]}>{h.hole}</Text>
                    <Text style={[styles.colPar, styles.cellText]}>{h.par}</Text>
                    <Text style={[styles.colStrokes, styles.cellText]}>{holeScore}</Text>
                    <Text style={[
                      styles.colVsPar,
                      vp < 0 && styles.underPar,
                      vp === 0 && styles.evenPar,
                      vp > 0 && styles.overPar,
                      styles.vsParText,
                    ]}>
                      {fmtVsPar(vp)}
                    </Text>
                    <Text style={[styles.colClubs, styles.clubText]} numberOfLines={1}>{clubSummary}</Text>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.shotList}>
                      {h.courseDistance != null && (
                        <Text style={styles.holeMeta}>📏 Course distance: {h.courseDistance}m</Text>
                      )}
                      {h.shots.map((s, j) => (
                        <View key={j} style={styles.shotRow}>
                          <Text style={styles.shotNum}>#{j + 1}</Text>
                          <Text style={styles.shotClub}>{s.club}</Text>
                          <Text style={styles.shotDist}>{s.distance != null ? `${s.distance}m` : '—'}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── Edit mode: per-hole shot editor ── */}
        {editing && (
          <>
            <Text style={styles.scorecardTitle}>Edit shots</Text>
            {editHoles.map((h, hi) => (
              <View key={hi} style={styles.editHoleCard}>
                <Text style={styles.editHoleTitle}>Hole {h.hole} · Par {h.par}</Text>
                {h.shots.map((s, si) => (
                  <View key={si} style={styles.editShotRow}>
                    <Text style={styles.editShotNum}>#{si + 1}</Text>
                    <TouchableOpacity
                      style={styles.editClubBtn}
                      onPress={() => setClubPicker({ holeIdx: hi, shotIdx: si })}
                    >
                      <Text style={styles.editClubText}>{s.club} ▾</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.editDistInput}
                      value={s.distance != null ? String(s.distance) : ''}
                      onChangeText={(t) => updateShotDistance(hi, si, t)}
                      keyboardType="numeric"
                      placeholder="m"
                    />
                    <TouchableOpacity onPress={() => removeShot(hi, si)} style={styles.editRemoveBtn}>
                      <Text style={styles.editRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addShotBtn} onPress={() => addShot(hi)}>
                  <Text style={styles.addShotText}>＋ Add shot</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.saveBtn} onPress={saveEdits}>
              <Text style={styles.saveBtnText}>💾 Save changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={deleteDrill}>
              <Text style={styles.deleteBtnText}>🗑 Delete drill</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Club picker */}
      <Modal visible={!!clubPicker} transparent animationType="fade" onRequestClose={() => setClubPicker(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setClubPicker(null)}>
          <TouchableOpacity style={styles.clubSheet} activeOpacity={1}>
            <Text style={styles.clubSheetTitle}>Pick a club</Text>
            <View style={styles.clubGrid}>
              {CLUBS.map(c => (
                <TouchableOpacity key={c} style={styles.clubGridItem} onPress={() => setShotClub(c)}>
                  <Text style={styles.clubGridText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Native date picker */}
      {Platform.OS === 'ios' ? (
        <Modal visible={datePickerVisible} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                  <Text style={styles.pickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={confirmDatePick}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={pickerDate} mode="date" display="spinner" onChange={onPickerChange} maximumDate={new Date()} />
            </View>
          </View>
        </Modal>
      ) : (
        datePickerVisible && (
          <DateTimePicker value={pickerDate} mode="date" display="default" onChange={onPickerChange} maximumDate={new Date()} />
        )
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 16, color: '#1565C0', fontWeight: '600' },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f0f7ff', borderRadius: 8 },
  editBtnText: { fontSize: 14, color: '#1565C0', fontWeight: '700' },
  notFound: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 40 },

  title: { fontSize: 24, fontWeight: 'bold', color: '#222' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 2, marginBottom: 16 },
  dateEditBtn: { alignSelf: 'flex-start', backgroundColor: '#e8f5e9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 6, marginBottom: 16 },
  dateEditText: { fontSize: 14, color: '#2e7d32', fontWeight: '600' },

  summaryCard: { backgroundColor: '#f0f7ff', borderRadius: 16, padding: 16, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 26, fontWeight: 'bold', color: '#1565C0' },
  summaryLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  underPar: { color: '#2e7d32' },
  evenPar: { color: '#888' },
  overPar: { color: '#e53935' },

  scoreCaption: { fontSize: 12, color: '#999', marginBottom: 16 },
  notes: { fontSize: 14, color: '#555', fontStyle: 'italic', marginBottom: 16 },
  notesInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12,
    fontSize: 15, backgroundColor: '#fafafa', minHeight: 60, marginBottom: 16, textAlignVertical: 'top',
  },

  scorecardTitle: {
    fontSize: 13, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  scorecardHeader: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 2,
  },
  headerText: { fontSize: 11, fontWeight: 'bold', color: '#999' },
  scorecardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
  scorecardRowAlt: { backgroundColor: '#fafafa' },

  colHole: { width: 32 },
  colPar: { width: 44, textAlign: 'center' },
  colStrokes: { width: 64, textAlign: 'center' },
  colVsPar: { width: 40, textAlign: 'center' },
  colClubs: { flex: 1, paddingLeft: 8 },

  holeNum: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  cellText: { fontSize: 14, color: '#555' },
  vsParText: { fontSize: 14, fontWeight: 'bold' },
  clubText: { fontSize: 13, color: '#888' },

  shotList: {
    backgroundColor: '#f7faff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6,
  },
  holeMeta: { fontSize: 12, color: '#888', marginBottom: 4 },
  shotRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  shotNum: { width: 28, fontSize: 12, color: '#aaa', fontWeight: '600' },
  shotClub: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  shotDist: { fontSize: 15, color: '#4CAF50', fontWeight: '600', width: 60, textAlign: 'right' },

  // Edit mode
  editHoleCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  editHoleTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  editShotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  editShotNum: { width: 24, fontSize: 12, color: '#aaa', fontWeight: '600' },
  editClubBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, minWidth: 80 },
  editClubText: { fontSize: 14, fontWeight: '600', color: '#1565C0' },
  editDistInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, backgroundColor: '#fff' },
  editRemoveBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  editRemoveText: { fontSize: 16, color: '#e53935' },
  addShotBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  addShotText: { fontSize: 14, color: '#4CAF50', fontWeight: '700' },

  saveBtn: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  deleteBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: '#e53935' },
  deleteBtnText: { color: '#e53935', fontWeight: 'bold', fontSize: 15 },

  // Club picker modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  clubSheet: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  clubSheetTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', textAlign: 'center', marginBottom: 14 },
  clubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  clubGridItem: { backgroundColor: '#f0f7ff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, minWidth: 60, alignItems: 'center' },
  clubGridText: { fontSize: 15, fontWeight: '700', color: '#1565C0' },

  // Native date picker sheet
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 20 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerCancel: { fontSize: 16, color: '#888' },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  pickerDone: { fontSize: 16, color: '#1565C0', fontWeight: '700' },
});
