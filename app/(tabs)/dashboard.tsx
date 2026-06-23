import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Pressable, Platform, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getSessions, saveSessions, getRounds, saveRounds } from '../../services/storage';
import type { PracticeSession, Round, Drill, ProximityDrill } from '../../types';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeTab, setActiveTab] = useState<'practice' | 'rounds'>('practice');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  // Date picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerTarget, setPickerTarget] = useState<{ type: 'session' | 'round'; index: number } | null>(null);

  const loadData = async () => {
    try {
      const sessionData = await getSessions();
      const roundData = await getRounds();
      setSessions(sessionData.reverse());
      setRounds(roundData.reverse());
    } catch (e) {
      console.log('Error loading data', e);
    }
  };

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)} min`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const scoreLabel = (score: number) => {
    if (score === 0) return 'Level par';
    if (score > 0) return `+${score} over par`;
    return `${score} under par`;
  };

  const toggleCard = (key: string) => {
    setExpandedCard(prev => prev === key ? null : key);
  };

  // ── Cross-platform confirm ──────────────────────────────────
  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onConfirm }
      ]);
    }
  };

  // ── Delete session ──────────────────────────────────────────
  const deleteSession = (index: number) => {
    confirmAction('Delete Session', 'Are you sure you want to delete this session?', async () => {
      const all = await getSessions();
      const originalIndex = all.length - 1 - index;
      all.splice(originalIndex, 1);
      await saveSessions(all);
      loadData();
      setExpandedCard(null);
    });
  };

  // ── Delete round ────────────────────────────────────────────
  const deleteRound = (index: number) => {
    confirmAction('Delete Round', 'Are you sure you want to delete this round?', async () => {
      const all = await getRounds();
      const originalIndex = all.length - 1 - index;
      all.splice(originalIndex, 1);
      await saveRounds(all);
      loadData();
      setExpandedCard(null);
    });
  };

  // ── Web date change (HTML input) ────────────────────────────
  const handleWebDateChange = async (type: 'session' | 'round', index: number, dateString: string) => {
    if (!dateString) return;
    const newDate = new Date(dateString + 'T12:00:00').toISOString();
    if (type === 'session') {
      const all = await getSessions();
      const originalIndex = all.length - 1 - index;
      all[originalIndex].date = newDate;
      await saveSessions(all);
    } else {
      const all = await getRounds();
      const originalIndex = all.length - 1 - index;
      all[originalIndex].date = newDate;
      await saveRounds(all);
    }
    loadData();
  };

  // ── Open date picker ────────────────────────────────────────
  const openDatePicker = (type: 'session' | 'round', index: number, currentDate: string) => {
    setPickerDate(new Date(currentDate));
    setPickerTarget({ type, index });
    setPickerVisible(true);
  };

  // ── Handle picker change ────────────────────────────────────
  const onPickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPickerVisible(false);
    if (selected) setPickerDate(selected);
  };

  // ── Confirm and save picked date ────────────────────────────
  const confirmDatePick = async () => {
    setPickerVisible(false);
    if (!pickerTarget) return;
    const { type, index } = pickerTarget;

    if (type === 'session') {
      const all = await getSessions();
      const originalIndex = all.length - 1 - index;
      all[originalIndex].date = pickerDate.toISOString();
      await saveSessions(all);
    } else {
      const all = await getRounds();
      const originalIndex = all.length - 1 - index;
      all[originalIndex].date = pickerDate.toISOString();
      await saveRounds(all);
    }
    loadData();
    setExpandedCard(null);
  };

  const practiceStats = () => {
    const total = sessions.length;
    const typeCount: Record<string, number> = { Putting: 0, Chipping: 0, Pitching: 0, 'Long Game': 0, 'Short Game': 0 };
    sessions.forEach((s: PracticeSession) => { if (typeCount[s.type] !== undefined) typeCount[s.type]++; });
    return { total, typeCount };
  };

  // ── Insights helpers ────────────────────────────────────────────────────────

  const calcSuccessRates = () => {
    const types: PracticeSession['type'][] = ['Putting', 'Chipping', 'Pitching', 'Long Game'];
    const result: { type: string; avg: number; label: string; count: number }[] = [];
    for (const type of types) {
      const recent = sessions.filter((s: PracticeSession) => s.type === type).slice(0, 5);
      if (recent.length === 0) continue;
      const isProx = type === 'Chipping' || type === 'Pitching';
      const allDrills = recent.flatMap((s: PracticeSession): (Drill | ProximityDrill)[] =>
        isProx ? (s.proximityDrills ?? []) : s.drills
      ).filter(d => d.success > 0);
      if (allDrills.length === 0) continue;
      const avg = Math.round(allDrills.reduce((sum, d) => sum + d.success, 0) / allDrills.length);
      const label = type === 'Putting' ? 'holed' : 'on target';
      result.push({ type, avg, label, count: recent.length });
    }
    return result;
  };

  const getPracticeRec = (rates: { type: string; avg: number; count: number }[]) => {
    const eligible = rates.filter(r => r.count >= 2);
    if (eligible.length === 0) return null;
    const worst = eligible.reduce((min, r) => r.avg < min.avg ? r : min, eligible[0]);
    return `💡 Focus on ${worst.type} — ${worst.avg}% avg over last ${worst.count} sessions`;
  };

  const getRoundRec = () => {
    if (sessions.length === 0) return null;
    const sessionsSinceLast = rounds.length === 0
      ? sessions.length
      : sessions.filter((s: PracticeSession) => new Date(s.date) > new Date(rounds[0].date)).length;
    const daysSinceLast = rounds.length === 0
      ? 999
      : Math.floor((Date.now() - new Date(rounds[0].date).getTime()) / (1000 * 60 * 60 * 24));
    if (sessionsSinceLast >= 6) return '⛳ 6+ sessions since your last round — time to test it on a full course!';
    if (sessionsSinceLast >= 3) return '⛳ 3+ practice sessions done — a Par 3 round would be a great test!';
    if (daysSinceLast >= 21) return `⛳ ${Math.floor(daysSinceLast / 7)} weeks since your last round — consider getting out!`;
    return null;
  };

  const roundStats = () => {
    const total = rounds.length;
    if (total === 0) return { total, avgScore: null, bestScore: null };
    const scores = rounds.map((r: Round) => r.stats?.scoreVsPar ?? 0).filter((s): s is number => s !== null);
    const avgScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    const bestScore = Math.min(...scores);
    return { total, avgScore, bestScore };
  };

  const ps = practiceStats();
  const rs = roundStats();
  const successRates = calcSuccessRates();
  const practiceRec = getPracticeRec(successRates);
  const roundRec = getRoundRec();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Dashboard</Text>

      {/* Summary bar */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNum}>{ps.total}</Text>
          <Text style={styles.summaryLabel}>Sessions</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNum}>{rs.total}</Text>
          <Text style={styles.summaryLabel}>Rounds</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'practice' && styles.tabActive]}
          onPress={() => setActiveTab('practice')}
        >
          <Text style={[styles.tabText, activeTab === 'practice' && styles.tabTextActive]}>🏋️ Practice</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rounds' && styles.tabActive]}
          onPress={() => setActiveTab('rounds')}
        >
          <Text style={[styles.tabText, activeTab === 'rounds' && styles.tabTextActive]}>🏌️ Rounds</Text>
        </TouchableOpacity>
      </View>

      {/* Practice tab */}
      {activeTab === 'practice' && (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {/* Session type counts */}
          <View style={styles.statsBox}>
            <Text style={styles.statText}>
              Putting: {ps.typeCount.Putting}  ·  Chipping: {ps.typeCount.Chipping}  ·  Pitching: {ps.typeCount.Pitching}  ·  Long Game: {ps.typeCount['Long Game']}
            </Text>
          </View>

          {/* Insights */}
          {successRates.length > 0 && (
            <View style={styles.insightsBox}>
              <Text style={styles.insightsTitle}>📈 Success Rates (last 5 sessions)</Text>
              {successRates.map(r => (
                <View key={r.type} style={styles.insightRow}>
                  <Text style={styles.insightType}>{r.type}</Text>
                  <View style={styles.insightBarBg}>
                    <View style={[styles.insightBarFill, { width: `${r.avg}%` as any }]} />
                  </View>
                  <Text style={styles.insightPct}>{r.avg}%</Text>
                </View>
              ))}
              {practiceRec && (
                <View style={styles.recBox}>
                  <Text style={styles.recText}>{practiceRec}</Text>
                </View>
              )}
              {roundRec && (
                <View style={styles.roundRecBox}>
                  <Text style={styles.roundRecText}>{roundRec}</Text>
                </View>
              )}
            </View>
          )}

          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏋️</Text>
              <Text style={styles.emptyTitle}>No practice sessions yet</Text>
              <Text style={styles.emptySubtitle}>Start logging your putting, short game, and long game drills to track your progress.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/')}>
                <Text style={styles.emptyBtnText}>Start a Session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sessions.map((item: PracticeSession, i: number) => {
              const key = `session-${i}`;
              const isExpanded = expandedCard === key;
              return (
                <Pressable key={key} onPress={() => toggleCard(key)}>
                  <View style={[styles.card, isExpanded && styles.cardExpanded]}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardType}>{item.type}</Text>
                      <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                    </View>
                    <Text style={styles.cardDetail}>⏱ {formatTime(item.duration)}  ·  🎯 {(item.drills?.length ?? 0) + (item.proximityDrills?.length ?? 0)} drills</Text>
                    {(item.drills?.length > 0) && (
                      <Text style={styles.cardDrills}>
                        {item.drills.map((d) => `${d.name} ${d.success}%`).join('  ·  ')}
                      </Text>
                    )}
                    {(item.proximityDrills?.length ?? 0) > 0 && (
                      <>
                        <Text style={styles.cardDrills}>
                          🎱 {item.proximityDrills!.reduce((sum, d) => sum + d.attempts, 0)} balls  ·  {item.proximityDrills!.map((d) => `${d.name} ${d.success}%`).join('  ·  ')}
                        </Text>
                      </>
                    )}
                    {item.notes ? (
                      <Text style={styles.cardNotes}>📝 {item.notes}</Text>
                    ) : null}

                    {/* Expanded actions */}
                    {isExpanded && (
                      <View style={styles.actions}>
                        {Platform.OS === 'web' ? (
                          <input
                            type="date"
                            defaultValue={item.date.split('T')[0]}
                            max={new Date().toISOString().split('T')[0]}
                            onClick={(e: any) => e.stopPropagation()}
                            onChange={(e: any) => handleWebDateChange('session', i, e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, color: '#2e7d32', backgroundColor: '#e8f5e9', cursor: 'pointer' } as any}
                          />
                        ) : (
                          <TouchableOpacity style={styles.editDateBtn} onPress={() => openDatePicker('session', i, item.date)}>
                            <Text style={styles.editDateText}>📅 Edit Date</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.detailBtn} onPress={() => router.push({ pathname: '/session-detail', params: { index: i } })}>
                          <Text style={styles.detailBtnText}>📋 View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editHolesBtn} onPress={() => router.push({ pathname: '/session-detail', params: { index: i } })}>
                          <Text style={styles.editHolesBtnText}>✏️ Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteSession(i)}>
                          <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Rounds tab */}
      {activeTab === 'rounds' && (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {rs.total > 0 && rs.avgScore !== null && rs.bestScore !== null && (
            <View style={styles.statsBox}>
              <Text style={styles.statText}>Avg score: {scoreLabel(rs.avgScore)}  ·  Best: {scoreLabel(rs.bestScore)}</Text>
            </View>
          )}

          {rounds.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⛳</Text>
              <Text style={styles.emptyTitle}>No rounds logged yet</Text>
              <Text style={styles.emptySubtitle}>Log a round to track your scores, stats, and handicap progress over time.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/round')}>
                <Text style={styles.emptyBtnText}>Log a Round</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emptySecondaryBtn} onPress={() => router.push('/round-import')}>
                <Text style={styles.emptySecondaryBtnText}>Import a Previous Round</Text>
              </TouchableOpacity>
            </View>
          ) : (
            rounds.map((item: Round, i: number) => {
              const key = `round-${i}`;
              const isExpanded = expandedCard === key;
              return (
                <Pressable key={key} onPress={() => toggleCard(key)}>
                  <View style={[styles.card, isExpanded && styles.cardExpanded]}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardType}>{item.courseName ?? 'Round'}</Text>
                      <View style={styles.cardDateRow}>
                        {item.imported && <Text style={styles.importedTag}>📥 imported</Text>}
                        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardDetail}>
                      {item.holes} holes  ·  Tee: {item.tee}  ·  {scoreLabel(item.stats?.scoreVsPar ?? 0)}
                    </Text>
                    {item.stats && (
                      <Text style={styles.cardDetail}>
                        🏳️ {item.stats.fairwayPct ?? 0}% FIR  ·  🎯 {item.stats.girPct ?? 0}% GIR  ·  ⛳ {item.stats.puttsPerHole ?? 0} putts/hole
                      </Text>
                    )}

                    {/* Expanded actions */}
                    {isExpanded && (
                      <View style={styles.actions}>
                        {Platform.OS === 'web' ? (
                          <input
                            type="date"
                            defaultValue={item.date.split('T')[0]}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e: any) => handleWebDateChange('round', i, e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, color: '#2e7d32', backgroundColor: '#e8f5e9', cursor: 'pointer' } as any}
                          />
                        ) : (
                          <TouchableOpacity style={styles.editDateBtn} onPress={() => openDatePicker('round', i, item.date)}>
                            <Text style={styles.editDateText}>📅 Edit Date</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.detailBtn} onPress={() => router.push({ pathname: '/round-detail', params: { index: i } })}>
                          <Text style={styles.detailBtnText}>📋 View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editHolesBtn} onPress={() => router.push({ pathname: '/round-detail', params: { index: i, autoEdit: '1' } })}>
                          <Text style={styles.editHolesBtnText}>✏️ Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteRound(i)}>
                          <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.homeButton} onPress={() => router.back()}>
        <Text style={styles.homeText}>← Back to Home</Text>
      </TouchableOpacity>

      {/* ── Date picker (iOS: modal sheet, Android: native dialog) ── */}
      {Platform.OS === 'ios' ? (
        <Modal visible={pickerVisible} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Text style={styles.pickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={confirmDatePick}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                onChange={onPickerChange}
                maximumDate={new Date()}
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      ) : (
        pickerVisible && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={(e, d) => { onPickerChange(e, d); if (d) { setPickerDate(d); confirmDatePick(); } }}
            maximumDate={new Date()}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryBox: { flex: 1, backgroundColor: '#f0f4f0', borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryNum: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50' },
  summaryLabel: { fontSize: 12, color: '#666', marginTop: 2 },

  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: 12, backgroundColor: '#f0f0f0', padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#333', fontWeight: '700' },

  list: { flex: 1 },
  statsBox: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 14 },
  statText: { fontSize: 13, color: '#555', textAlign: 'center' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginBottom: 10, width: '100%', alignItems: 'center' },
  emptyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  emptySecondaryBtn: { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, width: '100%', alignItems: 'center' },
  emptySecondaryBtnText: { color: '#555', fontSize: 14 },

  card: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardExpanded: { borderColor: '#4CAF50', borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' },
  cardType: { fontSize: 17, fontWeight: 'bold', color: '#222', flex: 1 },
  cardDateRow: { alignItems: 'flex-end', gap: 2 },
  importedTag: { fontSize: 10, color: '#1565C0', fontWeight: '600', backgroundColor: '#e3f2fd', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  cardDate: { fontSize: 13, color: '#999' },
  cardDetail: { fontSize: 13, color: '#555', marginTop: 2 },
  cardDrills: { fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' },
  cardNotes: { fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' },
  editDateBtn: { backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  editDateText: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
  detailBtn: { backgroundColor: '#e3f2fd', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  detailBtnText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  editHolesBtn: { backgroundColor: '#fff3e0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  editHolesBtnText: { fontSize: 13, color: '#e65100', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fdecea', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  deleteBtnText: { fontSize: 13, color: '#c62828', fontWeight: '600' },

  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  pickerCancel: { fontSize: 16, color: '#999' },
  pickerDone: { fontSize: 16, color: '#4CAF50', fontWeight: '700' },
  picker: { height: 200 },

  homeButton: { marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#ddd' },
  homeText: { textAlign: 'center', fontSize: 15, color: '#333' },

  insightsBox: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#eee' },
  insightsTitle: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 10 },
  insightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  insightType: { fontSize: 12, color: '#444', fontWeight: '600', width: 70 },
  insightBarBg: { flex: 1, height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  insightBarFill: { height: 8, backgroundColor: '#4CAF50', borderRadius: 4 },
  insightPct: { fontSize: 12, fontWeight: '700', color: '#4CAF50', width: 34, textAlign: 'right' },
  recBox: { backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginTop: 8 },
  recText: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
  roundRecBox: { backgroundColor: '#e3f2fd', borderRadius: 8, padding: 10, marginTop: 6 },
  roundRecText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
});
