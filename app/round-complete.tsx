import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { getDraftRound, saveRounds, getRounds, clearDraftRound } from '../services/storage';
import type { Round, RoundStats } from '../types';

export default function RoundCompleteScreen() {
  const [round, setRound] = useState<Round | null>(null);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const draft = await getDraftRound();
      if (draft) setRound(draft);
    };
    load();
  }, []);

  const calcStats = (): RoundStats | null => {
    if (!round) return null;
    const holes = round.holeData || [];
    const totalStrokes = holes.reduce((sum, h) => sum + h.totalStrokes, 0);
    const totalPutts = holes.reduce((sum, h) => sum + h.putts, 0);
    const fairwayHoles = holes.filter(h => h.par > 3);
    const fairwaysHit = fairwayHoles.filter(h => h.fairwayHit === true).length;
    const girCount = holes.filter(h => h.gir).length;
    const par3Holes = holes.filter(h => h.par === 3);
    const par3Gir = par3Holes.filter(h => h.gir).length;
    const scoreVsPar = round.coursePar ? totalStrokes - round.coursePar : null;

    return {
      totalStrokes,
      totalPutts,
      puttsPerHole: holes.length > 0 ? (totalPutts / holes.length).toFixed(1) : '0',
      fairwaysHit,
      fairwayTotal: fairwayHoles.length,
      fairwayPct: fairwayHoles.length > 0 ? Math.round((fairwaysHit / fairwayHoles.length) * 100) : 0,
      girCount,
      girPct: holes.length > 0 ? Math.round((girCount / holes.length) * 100) : 0,
      par3Gir,
      par3Total: par3Holes.length,
      scoreVsPar,
    };
  };

  const saveRound = async () => {
    if (!round) return;
    const stats = calcStats();
    const finalRound = { ...round, notes, stats } as Round;
    const rounds = await getRounds();
    rounds.push(finalRound);
    await saveRounds(rounds);
    await clearDraftRound();
    setSaved(true);
    setTimeout(() => router.push('/'), 1000);
  };

  const stats = calcStats();

  if (!round || !stats) return (
    <View style={styles.container}>
      <Text>Loading...</Text>
    </View>
  );

  const vsParText = stats.scoreVsPar !== null
    ? (stats.scoreVsPar === 0 ? 'Even' : stats.scoreVsPar > 0 ? `+${stats.scoreVsPar}` : `${stats.scoreVsPar}`)
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>🏁 Round Complete!</Text>
      <Text style={styles.course}>{round.courseName}</Text>
      <Text style={styles.date}>{new Date(round.date).toLocaleDateString()} · {round.weather?.sky} · {round.weather?.wind}</Text>

      {/* Score */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Total Score</Text>
        <Text style={styles.scoreValue}>{stats.totalStrokes}</Text>
        {vsParText && <Text style={styles.vsParText}>{vsParText} vs par</Text>}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.fairwaysHit}/{stats.fairwayTotal}</Text>
          <Text style={styles.statLabel}>Fairways</Text>
          <Text style={styles.statPct}>{stats.fairwayPct}%</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.girCount}/{round.holeData?.length}</Text>
          <Text style={styles.statLabel}>GIR</Text>
          <Text style={styles.statPct}>{stats.girPct}%</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalPutts}</Text>
          <Text style={styles.statLabel}>Putts</Text>
          <Text style={styles.statPct}>{stats.puttsPerHole}/hole</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.par3Gir}/{stats.par3Total}</Text>
          <Text style={styles.statLabel}>Par 3 GIR</Text>
          <Text style={styles.statPct}>Short game</Text>
        </View>
      </View>

      {/* Hole by hole */}
      <Text style={styles.sectionTitle}>Hole by Hole</Text>
      {round.holeData?.map((h, i) => (
        <View key={i} style={styles.holeRow}>
          <Text style={styles.holeNum}>H{h.hole}</Text>
          <Text style={styles.holePar}>Par {h.par}</Text>
          <Text style={styles.holeStrokes}>{h.totalStrokes} strokes</Text>
          <Text style={styles.holeDiff}>
            {h.totalStrokes - h.par === 0 ? 'E' : h.totalStrokes - h.par > 0 ? `+${h.totalStrokes - h.par}` : `${h.totalStrokes - h.par}`}
          </Text>
          {h.gir && <Text style={styles.holeGir}>🎯</Text>}
          {h.fairwayHit === true && <Text style={styles.holeFairway}>✅</Text>}
        </View>
      ))}

      {/* Notes */}
      <Text style={styles.sectionTitle}>Round Notes</Text>
      <TextInput
        placeholder="How did it go? What worked, what didn't?"
        value={notes} onChangeText={setNotes}
        multiline numberOfLines={4}
        returnKeyType="done"
        blurOnSubmit={true}
        style={[styles.input, styles.textArea]} />

      <TouchableOpacity style={styles.saveBtn} onPress={saveRound}>
        <Text style={styles.saveText}>{saved ? '✅ Saved!' : 'Save Round'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
  course: { fontSize: 18, textAlign: 'center', fontWeight: '600', marginTop: 4 },
  date: { fontSize: 13, textAlign: 'center', color: '#999', marginBottom: 20 },
  scoreCard: { backgroundColor: '#4CAF50', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  scoreLabel: { color: '#fff', fontSize: 14, opacity: 0.8 },
  scoreValue: { color: '#fff', fontSize: 52, fontWeight: 'bold' },
  vsParText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 2 },
  statPct: { fontSize: 12, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 8 },
  holeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  holeNum: { width: 28, fontSize: 14, fontWeight: 'bold', color: '#333' },
  holePar: { width: 40, fontSize: 13, color: '#999' },
  holeStrokes: { flex: 1, fontSize: 14, color: '#333' },
  holeDiff: { width: 32, fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#e53935' },
  holeGir: { fontSize: 14 },
  holeFairway: { fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: '#fafafa' },
  textArea: { height: 100, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#4CAF50', padding: 18, borderRadius: 14, marginBottom: 60 },
  saveText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
});
