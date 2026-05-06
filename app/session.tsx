import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getSessions, saveSessions } from '../services/storage';
import type { PracticeSession, Drill, ProximityDrill, ProximityBuckets } from '../types';

// ── Suggested drills by session type ──────────────────────────────────────────

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

const SHORT_GAME_CLUBS = ['7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const isProximityType = (type: string) => type === 'Chipping' || type === 'Pitching';

const calcSuccess = (buckets: ProximityBuckets, total: number) => {
  if (total === 0) return 0;
  return Math.round(((buckets.inside1m + buckets.one2m) / total) * 100);
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { type } = useLocalSearchParams();
  const sessionType = typeof type === 'string' ? type : '';
  const proximity = isProximityType(sessionType);

  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');

  // Standard drill state (Putting / Long Game)
  const [drillName, setDrillName] = useState('');
  const [made, setMade] = useState('');
  const [attempts, setAttempts] = useState('');
  const [drills, setDrills] = useState<Drill[]>([]);

  // Proximity drill state (Chipping / Pitching)
  const [proxDrillName, setProxDrillName] = useState('');
  const [proxClub, setProxClub] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<ProximityBuckets>({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0, miss: 0 });
  const [proxDrills, setProxDrills] = useState<ProximityDrill[]>([]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = () => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ── Standard drill handlers ────────────────────────────────────────────────

  const selectStandardSuggestion = (drill: { name: string; attempts: string }) => {
    setDrillName(drill.name);
    setAttempts(drill.attempts);
    setMade('');
  };

  const addStandardDrill = () => {
    if (!drillName || !made || !attempts) return;
    const success = Math.round((parseInt(made) / parseInt(attempts)) * 100);
    setDrills([...drills, { name: drillName, made, attempts, success }]);
    setDrillName('');
    setMade('');
    setAttempts('');
  };

  // ── Proximity drill handlers ───────────────────────────────────────────────

  const selectProxSuggestion = (name: string) => {
    setProxDrillName(name);
    setBuckets({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0 });
    setProxClub(null);
  };

  const setBucket = (key: keyof ProximityBuckets, val: string) => {
    const n = parseInt(val) || 0;
    setBuckets(prev => ({ ...prev, [key]: n }));
  };

  const proxTotal = buckets.inside1m + buckets.one2m + buckets.two3m + buckets.beyond3m + buckets.miss;
  const proxSuccess = calcSuccess(buckets, proxTotal);

  const addProxDrill = () => {
    if (!proxDrillName || proxTotal === 0) return;
    setProxDrills([...proxDrills, {
      name: proxDrillName,
      attempts: proxTotal,
      buckets: { ...buckets },
      success: proxSuccess,
      club: proxClub ?? undefined,
    }]);
    setProxDrillName('');
    setProxClub(null);
    setBuckets({ inside1m: 0, one2m: 0, two3m: 0, beyond3m: 0 });
  };

  // ── Save / Discard ─────────────────────────────────────────────────────────

  const confirmDiscard = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Discard Session?\n\nThe timer and any drills you\'ve logged will be lost.')) {
        router.back();
      }
    } else {
      Alert.alert(
        'Discard Session?',
        'The timer and any drills you\'ve logged will be lost.',
        [
          { text: 'Keep Going', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]
      );
    }
  };

  const saveSession = async () => {
    try {
      const newSession: PracticeSession = {
        type: sessionType as PracticeSession['type'],
        duration: seconds,
        drills: proximity ? [] : drills,
        proximityDrills: proximity ? proxDrills : undefined,
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

  const standardSuggestions = STANDARD_DRILLS[sessionType] ?? [];
  const proxSuggestions = PROXIMITY_DRILLS[sessionType] ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Top section — logged drills list */}
      <View style={styles.topSection}>
        <View style={styles.sessionHeader}>
          <Text style={styles.type}>{sessionType} Session</Text>
          <TouchableOpacity onPress={confirmDiscard} style={styles.discardBtn}>
            <Text style={styles.discardText}>✕ Discard</Text>
          </TouchableOpacity>
        </View>

        <ScrollView>
          {proximity ? (
            proxDrills.length === 0 ? (
              <Text style={styles.empty}>No drills yet — pick a distance below or type your own</Text>
            ) : (
              <>
                <Text style={styles.totalBalls}>
                  🎱 {proxDrills.reduce((sum, d) => sum + d.attempts, 0)} balls total
                </Text>
                {proxDrills.map((item, i) => (
                  <View key={i} style={styles.drillItem}>
                    <View style={styles.drillNameCol}>
                      <Text style={styles.drillName}>{item.name}</Text>
                      {item.club && <Text style={styles.drillClub}>{item.club}</Text>}
                    </View>
                    <View style={styles.drillScoreCol}>
                      <Text style={styles.drillScore}>{item.attempts} balls · {item.success}% inside 2m</Text>
                      <Text style={styles.drillBuckets}>
                        ≤1m:{item.buckets.inside1m}  1–2m:{item.buckets.one2m}  2–3m:{item.buckets.two3m}  3m+:{item.buckets.beyond3m}  ❌:{item.buckets.miss ?? 0}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )
          ) : (
            drills.length === 0 ? (
              <Text style={styles.empty}>No drills yet — pick one below or type your own</Text>
            ) : (
              drills.map((item, i) => (
                <View key={i} style={styles.drillItem}>
                  <Text style={styles.drillName}>{item.name}</Text>
                  <Text style={styles.drillScore}>{item.made}/{item.attempts} ({item.success}%)</Text>
                </View>
              ))
            )
          )}
        </ScrollView>
      </View>

      {/* Bottom section — pinned input area */}
      <View style={styles.bottomSection}>

        {proximity ? (
          <>
            {/* Proximity drill chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chipsContainer}
            >
              {proxSuggestions.map((name) => {
                const isSelected = proxDrillName === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => selectProxSuggestion(name)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Drill name */}
            <TextInput
              placeholder="Drill name (e.g. Chip 10m)"
              value={proxDrillName}
              onChangeText={setProxDrillName}
              style={[styles.input, { marginBottom: 8 }]}
            />

            {/* Club selector */}
            <Text style={styles.clubSelectorLabel}>Club (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={[styles.chipsContainer, { marginBottom: 8 }]}
            >
              {SHORT_GAME_CLUBS.map((club) => {
                const isSelected = proxClub === club;
                return (
                  <TouchableOpacity
                    key={club}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setProxClub(isSelected ? null : club)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{club}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Bucket inputs */}
            <View style={styles.bucketRow}>
              {([
                { key: 'inside1m', label: '≤1m' },
                { key: 'one2m',    label: '1–2m' },
                { key: 'two3m',    label: '2–3m' },
                { key: 'beyond3m', label: '3m+' },
                { key: 'miss',     label: '❌ Miss' },
              ] as { key: keyof ProximityBuckets; label: string }[]).map(({ key, label }) => (
                <View key={key} style={styles.bucketItem}>
                  <Text style={styles.bucketLabel}>{label}</Text>
                  <TextInput
                    value={buckets[key] === 0 ? '' : String(buckets[key])}
                    onChangeText={val => setBucket(key, val)}
                    keyboardType="numeric"
                    style={styles.bucketInput}
                    placeholder="0"
                  />
                </View>
              ))}
            </View>

            {/* Live preview */}
            {proxTotal > 0 && (
              <Text style={styles.proxPreview}>
                {proxTotal} shots · {proxSuccess}% inside 2m
              </Text>
            )}
          </>
        ) : (
          <>
            {/* Standard drill chips */}
            {standardSuggestions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsContainer}
              >
                {standardSuggestions.map((drill) => {
                  const isSelected = drillName === drill.name;
                  return (
                    <TouchableOpacity
                      key={drill.name}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => selectStandardSuggestion(drill)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {drill.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Standard input row */}
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

        <TouchableOpacity
          style={styles.addButton}
          onPress={proximity ? addProxDrill : addStandardDrill}
        >
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff', maxWidth: '100%', overflow: 'hidden' as any },
  topSection: { flex: 1, padding: 16 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  type: { fontSize: 22, fontWeight: 'bold' },
  discardBtn: { padding: 4 },
  discardText: { fontSize: 13, color: '#999', fontWeight: '500' },
  timer: { fontSize: 52, fontWeight: 'bold', textAlign: 'center', marginVertical: 16, color: '#4CAF50' },
  empty: { textAlign: 'center', color: '#bbb', marginTop: 20, fontSize: 14, paddingHorizontal: 10 },
  drillItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  drillName: { fontSize: 16, color: '#333', flex: 1, flexWrap: 'wrap' },
  drillScore: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  totalBalls: { fontSize: 13, fontWeight: '700', color: '#4CAF50', textAlign: 'center', marginBottom: 8, marginTop: 4 },
  drillNameCol: { flex: 1 },
  drillClub: { fontSize: 12, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  drillScoreCol: { alignItems: 'flex-end' },
  drillBuckets: { fontSize: 11, color: '#999', marginTop: 2 },
  clubSelectorLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6 },

  bottomSection: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },

  chipsScroll: { marginBottom: 10, overflow: 'scroll' as any },
  chipsContainer: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f0f4f0', borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  chipSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },

  inputRow: { flexDirection: 'row', gap: 6, marginBottom: 10, width: '100%' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fafafa' },
  inputWide: { flex: 3 },
  inputSmall: { width: 58 },

  // Proximity bucket grid
  bucketRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  bucketItem: { flex: 1, alignItems: 'center' },
  bucketLabel: { fontSize: 11, fontWeight: '700', color: '#555', marginBottom: 4 },
  bucketInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 8, fontSize: 16, backgroundColor: '#fafafa', textAlign: 'center', width: '100%' },
  proxPreview: { fontSize: 13, color: '#4CAF50', fontWeight: '600', textAlign: 'center', marginBottom: 8 },

  notesInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 10, minHeight: 44 },
  addButton: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, marginBottom: 10 },
  addText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  endButton: { backgroundColor: '#e53935', padding: 16, borderRadius: 14 },
  endText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
});
