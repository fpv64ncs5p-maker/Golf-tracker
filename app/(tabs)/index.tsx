import { useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { initializeAppData } from '../../services/seed';
import { getDraftRound, getDraftSession, clearDraftSession } from '../../services/storage';
import type { DraftRound, DraftSession } from '../../types';

export default function StartScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [draftRound, setDraftRound] = useState<DraftRound | null>(null);
  const [draftSession, setDraftSession] = useState<DraftSession | null>(null);

  useFocusEffect(useCallback(() => {
    initializeAppData();
    getDraftRound().then(setDraftRound);
    getDraftSession().then(setDraftSession);
  }, []));

  const types = ["Putting", "Chipping", "Pitching", "Long Game", "Range Drill"];

  const resumeSession = () => {
    if (!draftSession) return;
    router.push({ pathname: '/session', params: { type: draftSession.type, resume: '1' } });
  };

  const discardSession = () => {
    const doDiscard = () => { clearDraftSession(); setDraftSession(null); };
    if (Platform.OS === 'web') {
      if (window.confirm('Discard the unfinished session?')) doDiscard();
    } else {
      Alert.alert('Discard session?', 'Discard the unfinished session?', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: doDiscard },
      ]);
    }
  };

  const drillCount = (draftSession?.drills?.length ?? 0) + (draftSession?.proximityDrills?.length ?? 0);

  const resumeRound = () => {
    if (!draftRound) return;
    const completedHoles = (draftRound.holeData || []).map(h => h.hole);
    const total = draftRound.holes;
    // Find the first hole not yet completed
    let nextHole = 1;
    for (let h = 1; h <= total; h++) {
      if (!completedHoles.includes(h)) { nextHole = h; break; }
    }
    router.push({ pathname: '/round-hole', params: { holeNumber: nextHole, totalHoles: total } });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⛳ Start Practice</Text>
      <Text style={styles.subtitle}>What are you working on today?</Text>

      {types.map((type) => (
        <TouchableOpacity
          key={type}
          style={[styles.button, selected === type && styles.selected]}
          onPress={() => setSelected(type)}
        >
          <Text style={styles.buttonText}>{type}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.startButton, !selected && styles.disabled]}
        disabled={!selected}
        onPress={() => {
          if (selected === 'Range Drill') {
            router.push('/range-drill' as any);
          } else {
            router.push({ pathname: '/session', params: { type: selected } });
          }
        }}
      >
        <Text style={styles.startText}>Start Session</Text>
      </TouchableOpacity>

      {/* Resume session banner — only shown when an unfinished session exists */}
      {draftSession && (
        <View style={styles.resumeSessionRow}>
          <TouchableOpacity style={styles.resumeSessionMain} onPress={resumeSession}>
            <Text style={styles.resumeSessionTitle}>▶ Resume {draftSession.type} session</Text>
            <Text style={styles.resumeSessionSub}>
              {drillCount} drill{drillCount !== 1 ? 's' : ''} logged
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resumeSessionDiscard} onPress={discardSession}>
            <Text style={styles.resumeSessionDiscardText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resume round banner — only shown when a draft exists */}
      {draftRound && (
        <TouchableOpacity style={styles.resumeButton} onPress={resumeRound}>
          <View>
            <Text style={styles.resumeTitle}>▶ Resume Round</Text>
            <Text style={styles.resumeSub}>
              {draftRound.courseName} · {draftRound.holeData?.length ?? 0}/{draftRound.holes} holes done
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.roundButton}
        onPress={() => router.push('/round')}
      >
        <Text style={styles.roundText}>🏌️ Log a Round</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/round-import')}
      >
        <Text style={styles.linkText}>📥 Import Previous Round</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/courses')}
      >
        <Text style={styles.linkText}>⛳ Manage Courses</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 20, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 40 },
  button: { padding: 20, marginVertical: 8, backgroundColor: '#f0f0f0', borderRadius: 14 },
  selected: { backgroundColor: '#4CAF50' },
  buttonText: { fontSize: 18, textAlign: 'center', fontWeight: '500' },
  startButton: { marginTop: 40, padding: 20, backgroundColor: '#000', borderRadius: 14 },
  disabled: { backgroundColor: '#ccc' },
  startText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  resumeButton: {
    marginTop: 16,
    padding: 18,
    backgroundColor: '#1565C0',
    borderRadius: 14,
  },
  resumeTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'center' },
  resumeSub: { color: '#bbdefb', fontSize: 13, textAlign: 'center', marginTop: 4 },
  resumeSessionRow: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff3e0', borderRadius: 14, borderWidth: 1.5, borderColor: '#ffb74d',
    paddingVertical: 14, paddingHorizontal: 18,
  },
  resumeSessionMain: { flex: 1 },
  resumeSessionTitle: { color: '#e65100', fontSize: 16, fontWeight: 'bold' },
  resumeSessionSub: { color: '#bf6b15', fontSize: 13, marginTop: 2 },
  resumeSessionDiscard: { paddingHorizontal: 10, paddingVertical: 6 },
  resumeSessionDiscardText: { color: '#bf6b15', fontSize: 18, fontWeight: 'bold' },
  roundButton: { marginTop: 16, padding: 18, backgroundColor: '#4CAF50', borderRadius: 14 },
  roundText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 14, padding: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 14 },
  linkText: { textAlign: 'center', fontSize: 15, color: '#555' },
});
