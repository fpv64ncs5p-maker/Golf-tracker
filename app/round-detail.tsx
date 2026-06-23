import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getRounds, saveRounds } from '../services/storage';
import type { Round, HoleData, RoundStats } from '../types';

const scoreColour = (diff: number) => {
  if (diff <= -2) return '#1565C0'; // eagle or better — blue
  if (diff === -1) return '#4CAF50'; // birdie — green
  if (diff === 0) return '#333';     // par — dark
  if (diff === 1) return '#e53935';  // bogey — red
  return '#b71c1c';                  // double+ — dark red
};

const scoreLabel = (diff: number) => {
  if (diff <= -2) return `${diff}`;
  if (diff === -1) return '-1';
  if (diff === 0) return 'E';
  return `+${diff}`;
};

export default function RoundDetailScreen() {
  const { index, autoEdit } = useLocalSearchParams();
  const [round, setRound] = useState<Round | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedHoles, setEditedHoles] = useState<HoleData[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const rounds = await getRounds();
        const idx = parseInt(Array.isArray(index) ? index[0] : (index as string));
        const originalIndex = rounds.length - 1 - idx;
        const r = rounds[originalIndex] ?? null;
        setRound(r);
      } catch (e) {
        console.log('Error loading round', e);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Auto-enter edit mode once round is loaded (when launched from dashboard Edit button)
  useEffect(() => {
    if (!round) return;
    const shouldAutoEdit = Array.isArray(autoEdit) ? autoEdit[0] === '1' : autoEdit === '1';
    if (shouldAutoEdit && (round.holeData?.length ?? 0) > 0) {
      setEditedHoles(JSON.parse(JSON.stringify(round.holeData)));
      setEditMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]); // intentionally only re-runs when the round loads

  const startEdit = () => {
    if (!round) return;
    setEditedHoles(JSON.parse(JSON.stringify(round.holeData || [])));
    setEditMode(true);
  };

  const adjustHole = (holeIndex: number, field: 'totalStrokes' | 'putts', delta: number) => {
    setEditedHoles(prev => prev.map((h, i) => {
      if (i !== holeIndex) return h;
      const newVal = Math.max(0, (h[field] || 0) + delta);
      return { ...h, [field]: newVal };
    }));
  };

  const saveEdits = async () => {
    const rounds = await getRounds();
    const idx = parseInt(Array.isArray(index) ? index[0] : (index as string));
    const originalIndex = rounds.length - 1 - idx;

    // Recalculate stats
    const holes = editedHoles;
    const totalStrokes = holes.reduce((s, h) => s + (h.totalStrokes || 0), 0);
    const totalPutts = holes.reduce((s, h) => s + (h.putts || 0), 0);
    const fairwayHoles = holes.filter(h => h.par > 3);
    const fairwaysHit = fairwayHoles.filter(h => h.fairwayHit === true).length;
    const girCount = holes.filter(h => h.gir).length;
    const par3Holes = holes.filter(h => h.par === 3);
    const coursePar = rounds[originalIndex].coursePar;
    const scoreVsPar = coursePar ? totalStrokes - coursePar : null;

    const newStats: RoundStats = {
      totalStrokes, totalPutts,
      puttsPerHole: holes.length > 0 ? (totalPutts / holes.length).toFixed(1) : '0',
      fairwaysHit, fairwayTotal: fairwayHoles.length,
      fairwayPct: fairwayHoles.length > 0 ? Math.round((fairwaysHit / fairwayHoles.length) * 100) : 0,
      girCount, girPct: holes.length > 0 ? Math.round((girCount / holes.length) * 100) : 0,
      par3Gir: par3Holes.filter(h => h.gir).length, par3Total: par3Holes.length,
      scoreVsPar,
    };

    rounds[originalIndex] = { ...rounds[originalIndex], holeData: editedHoles, stats: newStats };
    await saveRounds(rounds);
    setRound(rounds[originalIndex]);
    setEditMode(false);
  };

  if (!round) return (
    <View style={styles.container}>
      <Text style={styles.loading}>Loading...</Text>
    </View>
  );

  const stats = round.stats;
  const holes = round.holeData || [];
  const vsParText = stats?.scoreVsPar !== null && stats?.scoreVsPar !== undefined
    ? (stats.scoreVsPar === 0 ? 'Even par' : stats.scoreVsPar > 0 ? `+${stats.scoreVsPar} over par` : `${stats.scoreVsPar} under par`)
    : null;

  return (
    <ScrollView style={styles.container}>

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        {!editMode ? (
          <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✏️ Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity onPress={() => setEditMode(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdits} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>✅ Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.courseName}>{round.courseName ?? 'Round'}</Text>
      <Text style={styles.meta}>
        {new Date(round.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        {'  ·  '}{round.holes} holes{'  ·  '}{round.tee} tees
      </Text>
      {round.weather && (
        <Text style={styles.weather}>
          🌤 {round.weather.sky}{'  ·  '}💨 {round.weather.wind}{'  ·  '}⛳ {round.weather.ground}
        </Text>
      )}

      {/* Score card */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Total Score</Text>
        <Text style={styles.scoreValue}>{stats?.totalStrokes ?? '—'}</Text>
        {vsParText && <Text style={styles.vsParText}>{vsParText}</Text>}
      </View>

      {/* Stats grid */}
      {stats && (
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.fairwaysHit}/{stats.fairwayTotal}</Text>
            <Text style={styles.statLabel}>Fairways</Text>
            <Text style={styles.statPct}>{stats.fairwayPct}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.girCount}/{holes.length}</Text>
            <Text style={styles.statLabel}>GIR</Text>
            <Text style={styles.statPct}>{stats.girPct}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalPutts}</Text>
            <Text style={styles.statLabel}>Putts</Text>
            <Text style={styles.statPct}>{stats.puttsPerHole}/hole</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.par3Gir}/{stats.par3Total}</Text>
            <Text style={styles.statLabel}>Par 3 GIR</Text>
            <Text style={styles.statPct}>Short game</Text>
          </View>
        </View>
      )}

      {/* Hole by hole */}
      <Text style={styles.sectionTitle}>Hole by Hole</Text>

      {/* Table header */}
      {!editMode && (
        <View style={styles.tableHeader}>
          <Text style={[styles.col, styles.colHole]}>H</Text>
          <Text style={[styles.col, styles.colPar]}>Par</Text>
          <Text style={[styles.col, styles.colScore]}>Score</Text>
          <Text style={[styles.col, styles.colVsPar]}>+/-</Text>
          <Text style={[styles.col, styles.colTotal]}>Total</Text>
          <Text style={[styles.col, styles.colFlags]}>FIR GIR Putts</Text>
        </View>
      )}

      {(editMode ? editedHoles : holes).length === 0 && (
        <View style={styles.noDataBox}>
          <Text style={styles.noDataText}>No hole-by-hole data recorded for this round.</Text>
        </View>
      )}

      {(() => {
        let runningTotal = 0;
        return (editMode ? editedHoles : holes).map((h: any, i: number) => {
          const totalStr = h.totalStrokes ?? 0;
          const holePar = h.par ?? 4;
          const diff = totalStr - holePar;
          runningTotal += totalStr;
          return (
          <View key={i}>
            {editMode ? (
              <View style={[styles.editCard, i % 2 === 0 && styles.holeRowAlt]}>
                {/* Top line: hole info + live totals */}
                <View style={styles.editCardHeader}>
                  <Text style={styles.editCardHole}>H{h.hole}</Text>
                  <Text style={styles.editCardPar}>Par {holePar}</Text>
                  <View style={styles.editCardTotals}>
                    <Text style={styles.editCardTotalLabel}>Score</Text>
                    <Text style={[styles.editCardTotalValue, { color: scoreColour(diff) }]}>
                      {totalStr}
                    </Text>
                    <Text style={[styles.editCardDiff, { color: scoreColour(diff) }]}>
                      ({scoreLabel(diff)})
                    </Text>
                  </View>
                  <View style={styles.editCardRunning}>
                    <Text style={styles.editCardTotalLabel}>Running</Text>
                    <Text style={styles.editCardRunningValue}>{runningTotal}</Text>
                  </View>
                </View>
                {/* Bottom line: +/- controls */}
                <View style={styles.editCardControls}>
                  <Text style={styles.editCtrlLabel}>Strokes</Text>
                  <TouchableOpacity onPress={() => adjustHole(i, 'totalStrokes', -1)} style={styles.adjBtn}>
                    <Text style={styles.adjBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.adjValue}>{totalStr}</Text>
                  <TouchableOpacity onPress={() => adjustHole(i, 'totalStrokes', 1)} style={styles.adjBtn}>
                    <Text style={styles.adjBtnText}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.editCtrlSep} />
                  <Text style={styles.editCtrlLabel}>Putts</Text>
                  <TouchableOpacity onPress={() => adjustHole(i, 'putts', -1)} style={styles.adjBtn}>
                    <Text style={styles.adjBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.adjValue}>{h.putts ?? 0}</Text>
                  <TouchableOpacity onPress={() => adjustHole(i, 'putts', 1)} style={styles.adjBtn}>
                    <Text style={styles.adjBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.holeRow, i % 2 === 0 && styles.holeRowAlt]}>
                <Text style={[styles.col, styles.colHole, styles.holeNum]}>{h.hole}</Text>
                <Text style={[styles.col, styles.colPar, styles.holePar]}>Par {holePar}</Text>
                <Text style={[styles.col, styles.colScore, styles.holeScore]}>{totalStr}</Text>
                <Text style={[styles.col, styles.colVsPar, styles.holeDiff, { color: scoreColour(diff) }]}>
                  {scoreLabel(diff)}
                </Text>
                <Text style={[styles.col, styles.colTotal, styles.holeTotal]}>{runningTotal}</Text>
                <Text style={[styles.col, styles.colFlags, styles.holeFlags]}>
                  {h.fairwayHit === true ? '✅' : h.fairwayHit === false ? '❌' : '—'}
                  {' '}{h.gir ? '🎯' : '·'}{' '}{h.putts}
                </Text>
              </View>
            )}

            {/* Clubs used with direction + inline penalty */}
            {h.strokes?.length > 0 && (
              <View style={styles.clubsRow}>
                <Text style={styles.clubsLabel}>Clubs: </Text>
                <Text style={styles.clubsList}>
                  {h.strokes.map((s: any) => {
                    const club = typeof s === 'string' ? s : s.club;
                    const dir = typeof s === 'string' ? null : s.direction;
                    const pen = typeof s === 'string' ? null : s.penalty;
                    const dirStr = dir && dir !== 'On Target' ? ` (${dir})` : '';
                    const penStr = pen ? ` ⚠️${pen}` : '';
                    return `${club}${dirStr}${penStr}`;
                  }).join(' → ')}
                </Text>
              </View>
            )}

            {/* Putt direction */}
            {h.puttDirection && (
              <View style={styles.missRow}>
                <Text style={styles.missText}>⛳ Putt: {h.puttDirection}</Text>
              </View>
            )}

            {/* Penalties summary (backward compat for old rounds) */}
            {(h.penalties?.length > 0) && h.penalties.filter((p: any) => p.comment !== undefined).map((p: any, pi: number) => (
              <View key={pi} style={styles.penaltyRow}>
                <Text style={styles.penaltyText}>⚠️ {p.location}{p.comment ? ` — ${p.comment}` : ''}</Text>
              </View>
            ))}
          </View>
        );
        });
      })()}

      {/* Notes */}
      {round.notes ? (
        <>
          <Text style={styles.sectionTitle}>Round Notes</Text>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{round.notes}</Text>
          </View>
        </>
      ) : null}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  loading: { textAlign: 'center', marginTop: 60, color: '#999', fontSize: 16 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  backBtn: {},
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  editBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#f0f0f0' },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#333' },
  editActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  cancelBtnText: { fontSize: 14, color: '#666' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#4CAF50' },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  editScoreRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Edit card (replaces holeRow in edit mode)
  editCard: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  editCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  editCardHole: { fontSize: 16, fontWeight: 'bold', color: '#222', minWidth: 28 },
  editCardPar: { fontSize: 13, color: '#888', minWidth: 40 },
  editCardTotals: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  editCardTotalLabel: { fontSize: 11, color: '#aaa', fontWeight: '600', textTransform: 'uppercase' },
  editCardTotalValue: { fontSize: 20, fontWeight: 'bold', marginLeft: 4 },
  editCardDiff: { fontSize: 13, fontWeight: '600' },
  editCardRunning: { alignItems: 'flex-end' },
  editCardRunningValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  editCardControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editCtrlLabel: { fontSize: 12, color: '#888', fontWeight: '600', minWidth: 44 },
  editCtrlSep: { flex: 1 },
  adjBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  adjBtnText: { fontSize: 18, fontWeight: 'bold', color: '#333', lineHeight: 20 },
  adjValue: { fontSize: 18, fontWeight: 'bold', minWidth: 28, textAlign: 'center' },
  adjSep: { color: '#ccc', marginHorizontal: 2 },
  adjLabel: { fontSize: 12, color: '#888', marginRight: 2 },

  courseName: { fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  meta: { fontSize: 14, color: '#666', marginBottom: 2 },
  weather: { fontSize: 13, color: '#999', marginBottom: 20 },

  scoreCard: { backgroundColor: '#4CAF50', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  scoreLabel: { color: '#fff', fontSize: 14, opacity: 0.8 },
  scoreValue: { color: '#fff', fontSize: 56, fontWeight: 'bold', lineHeight: 64 },
  vsParText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  statPct: { fontSize: 12, color: '#4CAF50', fontWeight: '600', marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 4 },

  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: '#ddd', marginBottom: 2 },
  col: { fontSize: 13 },
  colHole: { width: 30, fontWeight: 'bold', color: '#555' },
  colPar: { width: 40, color: '#555' },
  colScore: { width: 38, textAlign: 'center', color: '#555' },
  colVsPar: { width: 32, textAlign: 'center', color: '#555' },
  colTotal: { width: 40, textAlign: 'center', color: '#555' },
  colFlags: { flex: 1, color: '#555' },

  holeRow: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center' },
  holeRowAlt: { backgroundColor: '#fafafa' },
  holeNum: { fontWeight: 'bold', color: '#222' },
  holePar: { color: '#888' },
  holeScore: { fontWeight: '700', textAlign: 'center', fontSize: 15 },
  holeDiff: { fontWeight: 'bold', textAlign: 'center', fontSize: 14 },
  holeTotal: { fontWeight: '600', textAlign: 'center', fontSize: 13, color: '#888' },
  holeFlags: { flex: 1, color: '#555' },

  clubsRow: { flexDirection: 'row', paddingHorizontal: 4, paddingBottom: 6 },
  clubsLabel: { fontSize: 12, color: '#999' },
  clubsList: { fontSize: 12, color: '#555', flex: 1, flexWrap: 'wrap' },

  missRow: { paddingHorizontal: 4, paddingBottom: 6 },
  missText: { fontSize: 12, color: '#e65100' },

  penaltyRow: { paddingHorizontal: 4, paddingBottom: 6 },
  penaltyText: { fontSize: 12, color: '#b71c1c' },

  noDataBox: { backgroundColor: '#fff8e1', borderRadius: 10, padding: 14, marginBottom: 12 },
  noDataText: { fontSize: 14, color: '#e65100', textAlign: 'center' },
  notesBox: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, marginBottom: 10 },
  notesText: { fontSize: 15, color: '#444', lineHeight: 22 },
});
