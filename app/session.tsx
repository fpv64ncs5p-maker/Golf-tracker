import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getSessions, saveSessions } from '../services/storage';
import type { PracticeSession, Drill } from '../types';

// Pre-loaded drills from your practice routines
const SUGGESTED_DRILLS: Record<string, { name: string; attempts: string }[]> = {
  Putting: [
    { name: 'Short Putts 1m', attempts: '25' },
    { name: 'Short Putts 2m', attempts: '15' },
    { name: 'Lag Putting 6m', attempts: '10' },
    { name: 'Lag Putting 9m', attempts: '10' },
    { name: 'Lag Putting 12m', attempts: '10' },
    { name: 'Pressure Ladder', attempts: '10' },
  ],
  'Short Game': [
    { name: 'Basic Chips', attempts: '10' },
    { name: 'Pitch Shots Low', attempts: '10' },
    { name: 'Pitch Shots High', attempts: '10' },
    { name: 'Up & Down Challenge', attempts: '10' },
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

export default function SessionScreen() {
  const { type } = useLocalSearchParams();
  const sessionType = typeof type === 'string' ? type : '';
  const [seconds, setSeconds] = useState(0);
  const [drillName, setDrillName] = useState('');
  const [made, setMade] = useState('');
  const [attempts, setAttempts] = useState('');
  const [drills, setDrills] = useState<Drill[]>([]);
  const [notes, setNotes] = useState('');

  const suggestions = SUGGESTED_DRILLS[sessionType] ?? [];

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = () => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const selectSuggestion = (drill: { name: string; attempts: string }) => {
    setDrillName(drill.name);
    setAttempts(drill.attempts);
    setMade(''); // clear made so user fills it in
  };

  const addDrill = () => {
    if (!drillName || !made || !attempts) return;
    const success = Math.round((parseInt(made) / parseInt(attempts)) * 100);
    setDrills([...drills, { name: drillName, made, attempts, success }]);
    setDrillName('');
    setMade('');
    setAttempts('');
  };

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
        type: sessionType as 'Putting' | 'Short Game' | 'Long Game',
        duration: seconds,
        drills,
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

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}>

      {/* Top section — scrollable list of logged drills */}
      <View style={styles.topSection}>
        <View style={styles.sessionHeader}>
          <Text style={styles.type}>{sessionType} Session</Text>
          <TouchableOpacity onPress={confirmDiscard} style={styles.discardBtn}>
            <Text style={styles.discardText}>✕ Discard</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.timer}>{formatTime()}</Text>

        <ScrollView>
          {drills.length === 0 ? (
            <Text style={styles.empty}>No drills yet — pick one below or type your own</Text>
          ) : (
            drills.map((item, i) => (
              <View key={i} style={styles.drillItem}>
                <Text style={styles.drillName}>{item.name}</Text>
                <Text style={styles.drillScore}>{item.made}/{item.attempts} ({item.success}%)</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Bottom section — pinned above keyboard */}
      <View style={styles.bottomSection}>

        {/* Suggested drill chips */}
        {suggestions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContainer}
          >
            {suggestions.map((drill) => {
              const isSelected = drillName === drill.name;
              return (
                <TouchableOpacity
                  key={drill.name}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => selectSuggestion(drill)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {drill.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Input row */}
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

        <TouchableOpacity style={styles.addButton} onPress={addDrill}>
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
  drillItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  drillName: { fontSize: 16, color: '#333', flex: 1, flexWrap: 'wrap' },
  drillScore: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },

  bottomSection: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },

  chipsScroll: { marginBottom: 10, overflow: 'scroll' as any },
  chipsContainer: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f0f4f0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  chipText: { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },

  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 10, width: '100%' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  inputWide: { flex: 2 },
  inputSmall: { flex: 1 },
  notesInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 10, minHeight: 44 },
  addButton: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, marginBottom: 10 },
  addText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  endButton: { backgroundColor: '#e53935', padding: 16, borderRadius: 14 },
  endText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
});
