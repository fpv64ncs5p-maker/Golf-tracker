import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getClubDistances, saveClubDistances, getRangeDrills } from '../../services/storage';
import type { ClubDistance, RangeDrill } from '../../types';
import { router } from 'expo-router';

const GAP_THRESHOLD = 10;     // flag a club when drill avg differs by ≥ this many metres
const MIN_DRILL_SHOTS = 3;    // need at least this many drill shots before flagging

const CLUB_LIST = [
  { name: 'Driver', label: 'Driver',    emoji: '🏌️' },
  { name: '3W',     label: '3 Wood',    emoji: '🌲' },
  { name: '5W',     label: '5 Wood',    emoji: '🌲' },
  { name: '4H',     label: '4 Hybrid',  emoji: '🔧' },
  { name: '5H',     label: '5 Hybrid',  emoji: '🔧' },
  { name: '4i',     label: '4 Iron',    emoji: '🔩' },
  { name: '5i',     label: '5 Iron',    emoji: '🔩' },
  { name: '6i',     label: '6 Iron',    emoji: '🔩' },
  { name: '7i',     label: '7 Iron',    emoji: '🔩' },
  { name: '8i',     label: '8 Iron',    emoji: '🔩' },
  { name: '9i',     label: '9 Iron',    emoji: '🔩' },
  { name: 'PW',     label: 'PW',        emoji: '🥏' },
  { name: 'GW',     label: 'GW',        emoji: '🥏' },
  { name: 'SW',     label: 'SW',        emoji: '🥏' },
  { name: 'LW',     label: 'LW',        emoji: '🥏' },
];

export default function ClubsScreen() {
  const [clubDistances, setClubDistances] = useState<Record<string, ClubDistance>>({});
  const [drillStats, setDrillStats] = useState<Record<string, { avg: number; count: number; min: number; max: number }>>({});
  const [editingClub, setEditingClub] = useState<string | null>(null);
  const [carry, setCarry] = useState('');
  const [total, setTotal] = useState('');
  const [ballSpeed, setBallSpeed] = useState('');

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const data = await getClubDistances();
      setClubDistances(data);
      const drills = await getRangeDrills();
      setDrillStats(computeDrillStats(drills));
    };
    load();
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
                    <Text style={styles.clubName}>{club.label}</Text>
                    {data ? (
                      <>
                        <Text style={styles.clubStats}>
                          Carry: <Text style={styles.statBold}>{data.carry}m</Text>
                          {'  ·  '}Total: <Text style={styles.statBold}>{data.total}m</Text>
                          {data.ballSpeed ? `  ·  Speed: ${data.ballSpeed} km/h` : ''}
                        </Text>
                        {data.direction ? (
                          <Text style={styles.directionRow}>
                            🎯 <Text style={styles.directionText}>{data.direction}</Text>
                            {data.note ? <Text style={styles.directionNote}>  · {data.note}</Text> : null}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.noData}>Tap to add distances</Text>
                    )}
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
  clubStats: { fontSize: 13, color: '#555' },
  statBold: { fontWeight: '700', color: '#4CAF50' },
  noData: { fontSize: 13, color: '#bbb', fontStyle: 'italic' },
  directionRow: { fontSize: 12, color: '#555', marginTop: 3 },
  directionText: { fontWeight: '700', color: '#1565C0' },
  directionNote: { color: '#888', fontStyle: 'italic' },
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
