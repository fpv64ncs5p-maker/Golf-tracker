import { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { initializeAppData } from '../../services/seed';
import type { PracticeSession } from '../../types';

export default function StartScreen() {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    initializeAppData();
  }, []);

  const types = ["Putting", "Short Game", "Long Game"];

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
        onPress={() => router.push({ pathname: '/session', params: { type: selected } })}
      >
        <Text style={styles.startText}>Start Session</Text>
      </TouchableOpacity>

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
  roundButton: { marginTop: 30, padding: 18, backgroundColor: '#4CAF50', borderRadius: 14 },
  roundText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 14, padding: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 14 },
  linkText: { textAlign: 'center', fontSize: 15, color: '#555' },
});
