import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { getCourses, saveRounds, getRounds } from '../services/storage';
import type { Course, Round, HoleData, RoundStats } from '../types';

export default function RoundImportScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedTee, setSelectedTee] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [totalHoles, setTotalHoles] = useState<9 | 18>(9);
  const [nineHalfSelection, setNineHalfSelection] = useState<'front' | 'back'>('front');
  const [scores, setScores] = useState<{ strokes: string; putts: string }[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getCourses();
      setCourses(data);
    };
    load();
  }, []);

  // Reset holes when course/tee/count changes
  useEffect(() => {
    setScores(Array.from({ length: totalHoles }, () => ({ strokes: '', putts: '' })));
  }, [totalHoles, selectedCourse]);

  const teeData = selectedCourse?.tees?.[selectedTee ?? ''];
  const courseHoles = selectedCourse?.holes || [];
  const isNineHoleCourse = courseHoles.length > 0 && courseHoles.length <= 9;
  const isEighteenHoleCourse = courseHoles.length > 9;
  const showFrontBackToggle = totalHoles === 9 && isEighteenHoleCourse;

  const getHolePar = (holeIndex: number) => {
    let lookupIndex = holeIndex;
    if (isNineHoleCourse && holeIndex >= 9) {
      // 18-hole round on 9-hole course: holes 10-18 mirror 1-9
      lookupIndex = holeIndex - 9;
    } else if (showFrontBackToggle && nineHalfSelection === 'back') {
      // Back 9 on 18-hole course: offset by 9
      lookupIndex = holeIndex + 9;
    }
    return courseHoles[lookupIndex]?.par ?? (selectedCourse?.name?.includes('Par 3') ? 3 : 4);
  };

  const coursePar = (() => {
    if (!teeData?.par) return null;
    if (isNineHoleCourse) return totalHoles > 9 ? teeData.par * 2 : teeData.par;
    if (totalHoles <= 9) {
      // Front or back 9: sum the actual par for those 9 holes if available
      if (courseHoles.length >= 18) {
        const offset = nineHalfSelection === 'back' ? 9 : 0;
        const nineHolePar = courseHoles.slice(offset, offset + 9).reduce((sum: number, h: any) => sum + (h.par ?? 4), 0);
        return nineHolePar > 0 ? nineHolePar : Math.round(teeData.par / 2);
      }
      return Math.round(teeData.par / 2);
    }
    return teeData.par;
  })();

  const updateScore = (i: number, field: 'strokes' | 'putts', val: string) => {
    setScores(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const totalStrokes = scores.reduce((sum, s) => sum + (parseInt(s.strokes) || 0), 0);
  const scoreVsPar = coursePar ? totalStrokes - coursePar : null;

  const saveRound = async () => {
    // Validate
    const emptyHoles = scores.filter(s => s.strokes === '').length;
    if (emptyHoles > 0) {
      Alert.alert('Missing scores', `Please fill in all ${totalHoles} hole scores.`);
      return;
    }
    if (!selectedCourse || !selectedTee) {
      Alert.alert('Missing info', 'Please select a course and tee.');
      return;
    }

    // Parse date
    const parts = date.split('/');
    const parsedDate = parts.length === 3
      ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toISOString()
      : new Date().toISOString();

    // Build hole data
    const holeOffset = showFrontBackToggle && nineHalfSelection === 'back' ? 9 : 0;
    const holeData: HoleData[] = scores.map((s, i) => {
      const hole = i + 1 + holeOffset;
      const par = getHolePar(i);
      const totalStr = parseInt(s.strokes) || 0;
      const putts = parseInt(s.putts) || 0;
      return {
        hole,
        par,
        totalStrokes: totalStr,
        putts,
        strokes: [],          // no club data on import
        fairwayHit: null,
        gir: false,
        penalties: [],
        missDirection: null,
        puttDirection: null,
      };
    });

    // Calculate stats
    const totalPutts = holeData.reduce((s, h) => s + h.putts, 0);
    const fairwayHoles = holeData.filter(h => h.par > 3);
    const stats: RoundStats = {
      totalStrokes,
      totalPutts,
      puttsPerHole: holeData.length > 0 ? (totalPutts / holeData.length).toFixed(1) : '0',
      fairwaysHit: 0,
      fairwayTotal: fairwayHoles.length,
      fairwayPct: 0,
      girCount: 0,
      girPct: 0,
      par3Gir: 0,
      par3Total: holeData.filter(h => h.par === 3).length,
      scoreVsPar,
    };

    const round: Round = {
      courseName: selectedCourse.name,
      courseId: selectedCourse.id,
      date: parsedDate,
      tee: selectedTee,
      holes: totalHoles,
      coursePar: coursePar || 0,
      courseRating: teeData?.rating ?? undefined,
      slopeRating: teeData?.slope ?? undefined,
      holeData,
      stats,
      imported: true,
      notes: '',
      weather: { wind: '', sky: '', ground: '', tempC: null },
    };

    const rounds = await getRounds();
    rounds.push(round);
    await saveRounds(rounds);
    setSaved(true);
    setTimeout(() => router.replace('/dashboard'), 1000);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>📥 Import Round</Text>
      <Text style={styles.subtitle}>Enter scores from a previous round</Text>

      {/* Course selection */}
      <Text style={styles.sectionTitle}>Course</Text>
      {selectedCourse ? (
        <View style={styles.selectedCourse}>
          <Text style={styles.selectedCourseName}>{selectedCourse.name}</Text>
          <TouchableOpacity onPress={() => { setSelectedCourse(null); setSelectedTee(null); }}>
            <Text style={styles.changeBtn}>Change ✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.courseList} nestedScrollEnabled>
          {courses.map((c: any) => (
            <TouchableOpacity key={c.id} style={styles.courseItem} onPress={() => setSelectedCourse(c)}>
              <Text style={styles.courseItemText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Tee selection */}
      {selectedCourse && (
        <>
          <Text style={styles.sectionTitle}>Tee</Text>
          <View style={styles.teeRow}>
            {Object.entries(selectedCourse.tees || {}).map(([tee, data]: any) => (
              <TouchableOpacity key={tee}
                style={[styles.teeBtn, selectedTee === tee && styles.teeBtnSelected]}
                onPress={() => setSelectedTee(tee)}>
                <Text style={[styles.teeBtnText, selectedTee === tee && styles.teeBtnTextSelected]}>{tee}</Text>
                {data.rating && <Text style={[styles.teeCR, selectedTee === tee && styles.teeBtnTextSelected]}>CR {data.rating}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Date */}
      <Text style={styles.sectionTitle}>Date</Text>
      <TextInput
        style={styles.dateInput}
        value={date}
        onChangeText={setDate}
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        blurOnSubmit={true}
      />

      {/* Holes */}
      <Text style={styles.sectionTitle}>Holes Played</Text>
      <View style={styles.holesRow}>
        {([9, 18] as const).map(n => (
          <TouchableOpacity key={n}
            style={[styles.holesBtn, totalHoles === n && styles.holesBtnSelected]}
            onPress={() => setTotalHoles(n)}>
            <Text style={[styles.holesBtnText, totalHoles === n && styles.holesBtnTextSelected]}>{n} holes</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Front 9 / Back 9 toggle — only for 9-hole play on 18-hole courses */}
      {showFrontBackToggle && (
        <>
          <Text style={styles.sectionTitle}>Which half?</Text>
          <View style={styles.holesRow}>
            {(['front', 'back'] as const).map(half => (
              <TouchableOpacity key={half}
                style={[styles.holesBtn, nineHalfSelection === half && styles.holesBtnSelected]}
                onPress={() => setNineHalfSelection(half)}>
                <Text style={[styles.holesBtnText, nineHalfSelection === half && styles.holesBtnTextSelected]}>
                  {half === 'front' ? 'Front 9 (1–9)' : 'Back 9 (10–18)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Score entry */}
      {selectedCourse && selectedTee && (
        <>
          <Text style={styles.sectionTitle}>Scores</Text>

          {/* Header */}
          <View style={styles.scoreHeader}>
            <Text style={[styles.scoreCol, styles.scoreColHole]}>Hole</Text>
            <Text style={[styles.scoreCol, styles.scoreColPar]}>Par</Text>
            <Text style={[styles.scoreCol, styles.scoreColInput]}>Strokes</Text>
            <Text style={[styles.scoreCol, styles.scoreColInput]}>Putts</Text>
          </View>

          {scores.map((s, i) => {
            const par = getHolePar(i);
            const strokes = parseInt(s.strokes) || 0;
            const diff = s.strokes ? strokes - par : null;
            const displayHoleNum = i + 1 + (showFrontBackToggle && nineHalfSelection === 'back' ? 9 : 0);
            return (
              <View key={i} style={[styles.scoreRow, i % 2 === 0 && styles.scoreRowAlt]}>
                <Text style={[styles.scoreCol, styles.scoreColHole, styles.holeNum]}>{displayHoleNum}</Text>
                <Text style={[styles.scoreCol, styles.scoreColPar, styles.holePar]}>Par {par}</Text>
                <View style={[styles.scoreColInput]}>
                  <TextInput
                    style={[styles.scoreInput, diff !== null && {
                      backgroundColor: diff < 0 ? '#e8f5e9' : diff === 0 ? '#f5f5f5' : diff === 1 ? '#fff3e0' : '#ffebee'
                    }]}
                    value={s.strokes}
                    onChangeText={v => updateScore(i, 'strokes', v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="—"
                    placeholderTextColor="#ccc"
                  />
                  {diff !== null && (
                    <Text style={[styles.diffLabel, { color: diff < 0 ? '#4CAF50' : diff === 0 ? '#888' : '#e53935' }]}>
                      {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`}
                    </Text>
                  )}
                </View>
                <View style={[styles.scoreColInput]}>
                  <TextInput
                    style={styles.scoreInput}
                    value={s.putts}
                    onChangeText={v => updateScore(i, 'putts', v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={1}
                    placeholder="—"
                    placeholderTextColor="#ccc"
                  />
                </View>
              </View>
            );
          })}

          {/* Running total */}
          {totalStrokes > 0 && (
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalScore}>{totalStrokes}</Text>
              {scoreVsPar !== null && (
                <Text style={[styles.totalVsPar, { color: scoreVsPar < 0 ? '#4CAF50' : scoreVsPar === 0 ? '#333' : '#e53935' }]}>
                  {scoreVsPar === 0 ? 'Even par' : scoreVsPar > 0 ? `+${scoreVsPar} over par` : `${scoreVsPar} under par`}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={saveRound} disabled={saved}>
            <Text style={styles.saveBtnText}>{saved ? '✅ Saved!' : '📥 Save Imported Round'}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  backBtn: { marginBottom: 4, marginTop: 4 },
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 16 },

  selectedCourse: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14 },
  selectedCourseName: { fontSize: 16, fontWeight: '600', color: '#2e7d32', flex: 1 },
  changeBtn: { fontSize: 13, color: '#e53935', fontWeight: '600' },
  courseList: { maxHeight: 200, borderWidth: 1, borderColor: '#eee', borderRadius: 12 },
  courseItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  courseItemText: { fontSize: 15, color: '#333' },

  teeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  teeBtnSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  teeBtnText: { fontSize: 14, fontWeight: '600', color: '#333' },
  teeBtnTextSelected: { color: '#fff' },
  teeCR: { fontSize: 10, color: '#888', marginTop: 2 },

  dateInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#fafafa' },

  holesRow: { flexDirection: 'row', gap: 12 },
  holesBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  holesBtnSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  holesBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  holesBtnTextSelected: { color: '#fff' },

  scoreHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: '#ddd' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  scoreRowAlt: { backgroundColor: '#fafafa' },
  scoreCol: { fontSize: 13, color: '#555' },
  scoreColHole: { width: 36, fontWeight: 'bold' },
  scoreColPar: { width: 52, color: '#888' },
  scoreColInput: { flex: 1, alignItems: 'center', flexDirection: 'row', gap: 4 },
  holeNum: { fontWeight: 'bold', color: '#222' },
  holePar: { color: '#888' },
  scoreInput: { width: 48, height: 36, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, textAlign: 'center', fontSize: 16, fontWeight: 'bold', backgroundColor: '#fff' },
  diffLabel: { fontSize: 12, fontWeight: '600', minWidth: 24 },

  totalBox: { backgroundColor: '#4CAF50', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  totalLabel: { color: '#fff', fontSize: 13, opacity: 0.8 },
  totalScore: { color: '#fff', fontSize: 48, fontWeight: 'bold', lineHeight: 56 },
  totalVsPar: { fontSize: 16, fontWeight: '600', color: '#fff' },

  saveBtn: { backgroundColor: '#111', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnDone: { backgroundColor: '#4CAF50' },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
