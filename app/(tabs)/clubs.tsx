import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getClubDistances, saveClubDistances } from '../../services/storage';
import type { ClubDistance } from '../../types';
import { router } from 'expo-router';

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
  const [editingClub, setEditingClub] = useState<string | null>(null);
  const [carry, setCarry] = useState('');
  const [total, setTotal] = useState('');
  const [ballSpeed, setBallSpeed] = useState('');

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const data = await getClubDistances();
      setClubDistances(data);
    };
    load();
  }, []));

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
                    {data?.updatedAt && (
                      <Text style={styles.updatedAt}>Updated {formatDate(data.updatedAt)}</Text>
                    )}
                  </View>
                  <Text style={styles.editIcon}>{isEditing ? '▲' : '✏️'}</Text>
                </View>
              </TouchableOpacity>

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
