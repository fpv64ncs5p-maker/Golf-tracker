import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getClubDistances, saveClubDistances, getRangeDrills, getRounds, consumeReadError } from '../../services/storage';
import LoadErrorBanner from '../../components/LoadErrorBanner';
import type { ClubDistance, RangeDrill } from '../../types';
import { router } from 'expo-router';
import { CLUBS, loftsFrom } from '../../data/clubs';
import { parseLCR, formatLCR, roundDirections, aimTip, type LCR } from '../../services/caddie';

const GAP_THRESHOLD = 10;     // flag a club when drill avg differs by ≥ this many metres
const MIN_DRILL_SHOTS = 3;    // need at least this many drill shots before flagging

const CLUB_NAMES: Record<string, string> = {
  '3W': '3 Wood', '5W': '5 Wood', '4H': '4 Hybrid', '5H': '5 Hybrid',
  '4i': '4 Iron', '5i': '5 Iron', '6i': '6 Iron', '7i': '7 Iron', '8i': '8 Iron', '9i': '9 Iron',
};
const CLUB_LIST = CLUBS.map(name => ({ name, label: CLUB_NAMES[name] ?? name }));

export default function ClubsScreen() {
  const [clubDistances, setClubDistances] = useState<Record<string, ClubDistance>>({});
  const [drillStats, setDrillStats] = useState<Record<string, { avg: number; count: number; min: number; max: number }>>({});
  const [editingClub, setEditingClub] = useState<string | null>(null);
  const [carry, setCarry] = useState('');
  const [total, setTotal] = useState('');
  const [ballSpeed, setBallSpeed] = useState('');
  const [loft, setLoft] = useState('');
  const [dirL, setDirL] = useState('');
  const [dirC, setDirC] = useState('');
  const [dirR, setDirR] = useState('');
  const [note, setNote] = useState('');
  const [roundDirs, setRoundDirs] = useState<Record<string, LCR>>({});
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    const data = await getClubDistances();
    setClubDistances(data);
    const drills = await getRangeDrills();
    setDrillStats(computeDrillStats(drills));
    setRoundDirs(roundDirections(await getRounds()));
    setLoadError(consumeReadError());
  };

  useFocusEffect(useCallback(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  // Aggregate every drill shot's distance by club → average / count / range.
  const computeDrillStats = (drills: RangeDrill[]) => {
    const byClub: Record<string, number[]> = {};
    for (const d of drills) {
      for (const h of d.holes) {
        for (const s of h.shots) {
          if (s.distance != null) (byClub[s.club] ??= []).push(s.distance);
        }
      }
    }
    const stats: Record<string, { avg: number; count: number; min: number; max: number }> = {};
    for (const [club, arr] of Object.entries(byClub)) {
      if (arr.length === 0) continue;
      const sum = arr.reduce((a, b) => a + b, 0);
      stats[club] = {
        avg: Math.round(sum / arr.length),
        count: arr.length,
        min: Math.min(...arr),
        max: Math.max(...arr),
      };
    }
    return stats;
  };

  // Commit the current drill average into the club's saved profile (its own field —
  // carry/total are left untouched).
  const applyDrillAvg = async (clubName: string) => {
    const ds = drillStats[clubName];
    if (!ds) return;
    const now = new Date().toISOString();
    const base: ClubDistance = clubDistances[clubName] ?? { carry: '', total: '', ballSpeed: '', updatedAt: now };
    const updated = {
      ...clubDistances,
      [clubName]: {
        ...base,
        drillAvg: String(ds.avg),
        drillCount: ds.count,
        drillUpdatedAt: now,
      },
    };
    setClubDistances(updated);
    await saveClubDistances(updated);
  };

  const startEditing = (clubName: string) => {
    const existing = clubDistances[clubName];
    setCarry(existing?.carry ?? '');
    setTotal(existing?.total ?? '');
    setBallSpeed(existing?.ballSpeed ?? '');
    setLoft(lofts[clubName] ?? '');
    const d = parseLCR(existing?.direction);
    setDirL(d?.left ? String(d.left) : '');
    setDirC(d?.centre ? String(d.centre) : '');
    setDirR(d?.right ? String(d.right) : '');
    setNote(existing?.note ?? '');
    setEditingClub(clubName);
  };

  const saveClub = async () => {
    if (!editingClub) return;
    const updated = {
      ...clubDistances,
      [editingClub]: {
        ...clubDistances[editingClub], // keep drillAvg, direction, note, etc.
        carry,
        total,
        ballSpeed,
        loft: loft.replace(/[^0-9.,]/g, '').replace(',', '.'),
        direction: formatLCR({ left: pctNum(dirL), centre: pctNum(dirC), right: pctNum(dirR) }).replace('—', ''),
        note: note.trim(),
        updatedAt: new Date().toISOString(),
      },
    };
    setClubDistances(updated);
    await saveClubDistances(updated);
    setEditingClub(null);
  };

  // Gap between the real drill average and the measured Trackman Total.
  // A drill shot logs only the distance the ball ends up at (= total), so Total is
  // the only apples-to-apples baseline; comparing against carry would just reflect roll.
  const computeGapFlags = (
    ds?: { avg: number; count: number },
    data?: ClubDistance,
  ): { text: string; shorter: boolean }[] => {
    if (!ds || ds.count < MIN_DRILL_SHOTS || !data) return [];
    const total = parseInt(data.total);
    if (isNaN(total) || total <= 0) return [];
    const g = ds.avg - total;
    if (Math.abs(g) < GAP_THRESHOLD) return [];
    return [{
      text: `${Math.abs(g)}m ${g < 0 ? 'shorter' : 'longer'} than Total (${ds.avg} vs ${total}m)`,
      shorter: g < 0,
    }];
  };

  const lofts = loftsFrom(clubDistances);
  const pctNum = (t: string) => { const n = Math.round(parseFloat(t.replace(',', '.'))); return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 0; };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🏌️ My Club Distances</Text>
        <Text style={styles.subtitle}>Log your Trackman distances as a reference for the course</Text>

        {loadError && <LoadErrorBanner onRetry={load} />}

        {CLUB_LIST.map((club) => {
          const data = clubDistances[club.name];
          const ds = drillStats[club.name];
          const gapFlags = computeGapFlags(ds, data);
          const isEditing = editingClub === club.name;

          return (
            <View key={club.name} style={[styles.card, isEditing && styles.cardEditing]}>
              <TouchableOpacity onPress={() => isEditing ? setEditingClub(null) : startEditing(club.name)}>
                <View style={styles.cardHeader}>
                  <View style={styles.clubInfo}>
                    <Text style={styles.clubName}>
                      {club.label}
                      {lofts[club.name] ? <Text style={styles.loftText}>  {lofts[club.name]}°</Text> : null}
                    </Text>
                    {data && (data.carry || data.total) ? (
                      <>
                        <Text style={styles.clubStats}>
                          Carry: <Text style={styles.statBold}>{data.carry}m</Text>
                          {'  ·  '}Total: <Text style={styles.statBold}>{data.total}m</Text>
                          {data.ballSpeed ? `  ·  Speed: ${data.ballSpeed} km/h` : ''}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.noData}>Tap to add distances</Text>
                    )}
                    {data?.direction ? (
                      <Text style={styles.directionRow}>
                        🎯 Trackman: <Text style={styles.directionText}>{data.direction}</Text>
                      </Text>
                    ) : null}
                    {roundDirs[club.name] ? (
                      <Text style={styles.directionRow}>
                        ⛳ Rounds: <Text style={styles.directionText}>{formatLCR(roundDirs[club.name])}</Text>
                        <Text style={styles.directionNote}>  · {roundDirs[club.name].shots} shot{roundDirs[club.name].shots === 1 ? '' : 's'}</Text>
                      </Text>
                    ) : null}
                    {(() => {
                      const tip = aimTip(parseLCR(data?.direction), roundDirs[club.name]);
                      return tip ? <Text style={styles.aimTip}>↳ {tip}</Text> : null;
                    })()}
                    {data?.note ? <Text style={styles.noteText}>📝 {data.note}</Text> : null}
                    {data?.drillAvg && (
                      <Text style={styles.drillSaved}>
                        🎯 Drill avg: <Text style={styles.drillSavedBold}>{data.drillAvg}m</Text>
                        {data.drillCount ? `  ·  ${data.drillCount} shots` : ''}
                      </Text>
                    )}
                    {ds && (
                      <Text style={styles.drillLive}>
                        📊 From drills: {ds.avg}m avg · {ds.count} shot{ds.count !== 1 ? 's' : ''} ({ds.min}–{ds.max}m)
                      </Text>
                    )}
                    {gapFlags.map((f, idx) => (
                      <Text key={idx} style={[styles.gapFlag, f.shorter ? styles.gapShorter : styles.gapLonger]}>
                        {f.shorter ? '⚠️' : '✅'} {f.text}
                      </Text>
                    ))}
                    {data?.updatedAt && (
                      <Text style={styles.updatedAt}>Updated {formatDate(data.updatedAt)}</Text>
                    )}
                  </View>
                  <Text style={styles.editIcon}>{isEditing ? '▲' : '✏️'}</Text>
                </View>
              </TouchableOpacity>

              {ds && data?.drillAvg !== String(ds.avg) && (
                <TouchableOpacity style={styles.applyDrillBtn} onPress={() => applyDrillAvg(club.name)}>
                  <Text style={styles.applyDrillBtnText}>
                    {data?.drillAvg ? `↻ Update drill avg to ${ds.avg}m` : `＋ Save ${ds.avg}m as drill avg`}
                  </Text>
                </TouchableOpacity>
              )}

              {isEditing && (
                <View style={styles.editForm}>
                  <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Loft (°)</Text>
                      <TextInput
                        style={styles.input}
                        value={loft}
                        onChangeText={setLoft}
                        keyboardType="numeric"
                        placeholder="optional"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Carry (m)</Text>
                      <TextInput
                        style={styles.input}
                        value={carry}
                        onChangeText={setCarry}
                        keyboardType="numeric"
                        placeholder="e.g. 210"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Total (m)</Text>
                      <TextInput
                        style={styles.input}
                        value={total}
                        onChangeText={setTotal}
                        keyboardType="numeric"
                        placeholder="e.g. 230"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Ball Speed (km/h)</Text>
                      <TextInput
                        style={styles.input}
                        value={ballSpeed}
                        onChangeText={setBallSpeed}
                        keyboardType="numeric"
                        placeholder="optional"
                        returnKeyType="done"
                        blurOnSubmit
                      />
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Trackman direction — % of shots</Text>
                  <View style={styles.inputRow}>
                    {([['Left', dirL, setDirL], ['Centre', dirC, setDirC], ['Right', dirR, setDirR]] as const).map(([lbl, val, set]) => (
                      <View key={lbl} style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{lbl} %</Text>
                        <TextInput
                          style={styles.input}
                          value={val}
                          onChangeText={set}
                          keyboardType="numeric"
                          placeholder="—"
                        />
                      </View>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Note (shown by the caddie)</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: 12 }]}
                    value={note}
                    onChangeText={setNote}
                    placeholder="e.g. Into headwind: one club more"
                  />

                  <TouchableOpacity style={styles.saveBtn} onPress={saveClub}>
                    <Text style={styles.saveBtnText}>✓ Save</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  backBtn: { marginBottom: 12, marginTop: 4 },
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },

  card: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  cardEditing: { borderColor: '#4CAF50', borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clubInfo: { flex: 1 },
  clubName: { fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 2 },
  loftText: { fontSize: 14, fontWeight: '600', color: '#1565C0' },
  clubStats: { fontSize: 13, color: '#555' },
  statBold: { fontWeight: '700', color: '#4CAF50' },
  noData: { fontSize: 13, color: '#bbb', fontStyle: 'italic' },
  directionRow: { fontSize: 12, color: '#555', marginTop: 3 },
  directionText: { fontWeight: '700', color: '#1565C0' },
  directionNote: { color: '#888', fontStyle: 'italic' },
  aimTip: { fontSize: 12, color: '#e65100', fontWeight: '600', marginTop: 3 },
  noteText: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 3 },
  drillSaved: { fontSize: 13, color: '#555', marginTop: 4 },
  drillSavedBold: { fontWeight: '700', color: '#e65100' },
  drillLive: { fontSize: 12, color: '#999', marginTop: 2 },
  gapFlag: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  gapShorter: { color: '#e65100' },
  gapLonger: { color: '#2e7d32' },
  applyDrillBtn: {
    marginTop: 10, paddingVertical: 9, borderRadius: 9,
    backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d', alignItems: 'center',
  },
  applyDrillBtnText: { color: '#e65100', fontWeight: '700', fontSize: 13 },
  updatedAt: { fontSize: 11, color: '#ccc', marginTop: 2 },
  editIcon: { fontSize: 16, marginLeft: 8 },

  editForm: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 14 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
