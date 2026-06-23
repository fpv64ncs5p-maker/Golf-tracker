import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getSessions, getRounds, getCourses, getClubDistances } from '../../services/storage';
import type { PracticeSession, Round, Course, ClubDistance } from '../../types';

// Club order for display (tee to green)
const CLUB_ORDER = ['Driver','3W','5W','4H','5H','3i','4i','5i','6i','7i','8i','9i','PW','GW','SW','LW','Putter'];

// World Handicap System: how many best differentials to use per rounds played
const WHS_TABLE: Record<number, number> = {
  3: 1, 4: 1, 5: 1,
  6: 2, 7: 2, 8: 2,
  9: 3, 10: 3, 11: 3,
  12: 4, 13: 4, 14: 4,
  15: 5, 16: 5,
  17: 6, 18: 6,
  19: 7, 20: 8,
};

export default function InsightsScreen() {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [clubDistances, setClubDistances] = useState<Record<string, ClubDistance>>({});

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const sessionData = await getSessions();
      const roundData = await getRounds();
      const courseData = await getCourses();
      const clubData = await getClubDistances();
      setSessions(sessionData);
      setRounds(roundData);
      setCourses(courseData);
      setClubDistances(clubData);
    };
    load();
  }, []));

  // ── Practice stats ──────────────────────────────────────────
  const calcPracticeStats = () => {
    if (sessions.length === 0) return null;
    let totalTime = 0;
    let typeCount: Record<string, number> = { Putting: 0, Chipping: 0, Pitching: 0, 'Long Game': 0, 'Short Game': 0 };

    // Track success scores per type to find weakest
    // Standard types: aggregate made/attempts; Proximity types: average success %
    let typeScores: Record<string, { totalSuccess: number; count: number }> = {
      Putting: { totalSuccess: 0, count: 0 },
      Chipping: { totalSuccess: 0, count: 0 },
      Pitching: { totalSuccess: 0, count: 0 },
      'Long Game': { totalSuccess: 0, count: 0 },
      'Short Game': { totalSuccess: 0, count: 0 },
    };

    sessions.forEach((s: PracticeSession) => {
      totalTime += s.duration;
      if (typeCount[s.type] !== undefined) typeCount[s.type]++;
      // Standard drills
      s.drills?.forEach((d) => {
        if (d.made && d.attempts && typeScores[s.type]) {
          typeScores[s.type].totalSuccess += d.success;
          typeScores[s.type].count++;
        }
      });
      // Proximity drills
      s.proximityDrills?.forEach((d) => {
        if (typeScores[s.type]) {
          typeScores[s.type].totalSuccess += d.success;
          typeScores[s.type].count++;
        }
      });
    });

    let weakest = 'N/A';
    let weakestScore = 101;
    Object.keys(typeScores).forEach(t => {
      const { totalSuccess, count } = typeScores[t];
      if (count > 0) {
        const rate = Math.round(totalSuccess / count);
        if (rate < weakestScore) { weakestScore = rate; weakest = t; }
      }
    });

    const mostPracticed = Object.keys(typeCount).reduce((a, b) => typeCount[a] > typeCount[b] ? a : b);
    let totalSuccess = 0, totalDrillCount = 0;
    Object.values(typeScores).forEach(({ totalSuccess: ts, count }) => { totalSuccess += ts; totalDrillCount += count; });
    const overallSuccess = totalDrillCount > 0 ? Math.round(totalSuccess / totalDrillCount) : 0;

    return { totalTime, typeCount, weakest, weakestScore, mostPracticed, overallSuccess };
  };

  // ── Look up CR/Slope from courses when missing from round ───
  const enrichRound = (r: Round) => {
    if (r.courseRating && r.slopeRating) return r;
    // Try to find the matching course and tee
    const course = courses.find((c: Course) => {
      if (r.courseId && c.id === r.courseId) return true;
      const rName = r.courseName?.trim().toLowerCase() ?? '';
      const cName = c.name?.trim().toLowerCase() ?? '';
      return rName === cName || rName.includes(cName) || cName.includes(rName);
    });
    if (!course) return r;
    const tee = r.tee;
    const teeData = course.tees?.[tee];
    if (!teeData?.rating || !teeData?.slope) return r;
    return { ...r, courseRating: teeData.rating, slopeRating: teeData.slope };
  };

  // ── Handicap calculation (WHS formula) ─────────────────────
  const calcHandicap = () => {
    // Enrich rounds with CR/Slope from course data if missing
    const enriched = rounds.map(enrichRound);
    // Filter rounds that have all needed data (explicitly exclude null/undefined scoreVsPar)
    const validRounds = enriched.filter((r: Round) =>
      r.courseRating && r.slopeRating && r.coursePar &&
      r.stats?.scoreVsPar != null
    );

    if (validRounds.length < 3) return null;

    // Use only last 20 rounds
    const recent = validRounds.slice(-20);

    // Calculate score differential for each round
    const differentials = recent.map((r: Round) => {
      const grossScore = r.coursePar + (r.stats?.scoreVsPar ?? 0);
      // For 9-hole rounds on 18-hole courses, use half the CR/Slope
      // (stored CR is the full 18-hole value, so we need the 9-hole equivalent)
      const isNineOnEighteen = r.holes === 9 && r.coursePar > 20;
      const effectiveCR = isNineOnEighteen ? (r.courseRating ?? 0) / 2 : (r.courseRating ?? 0);
      const effectiveSlope = r.slopeRating ?? 113; // slope doesn't need halving
      let diff = (grossScore - effectiveCR) * 113 / effectiveSlope;
      // Double 9-hole differentials to convert to 18-hole equivalent
      if (r.holes === 9) diff = diff * 2;
      return parseFloat(diff.toFixed(1));
    });

    const count = recent.length;
    const useBest = WHS_TABLE[Math.min(count, 20)] ?? 8;

    // Sort and take best (lowest) differentials
    const sorted = [...differentials].sort((a, b) => a - b);
    const best = sorted.slice(0, useBest);
    const avg = best.reduce((a, b) => a + b, 0) / best.length;
    const handicap = parseFloat((avg * 0.96).toFixed(1));

    return {
      handicap,
      roundsUsed: useBest,
      roundsTotal: count,
      differentials: differentials.map(d => d.toFixed(1)),
    };
  };

  // ── Club stats from round stroke data ──────────────────────
  const calcClubStats = () => {
    const allStrokes: { club: string; direction: string; penalty: string | null }[] = [];
    rounds.forEach((r: Round) => {
      (r.holeData || []).forEach((h) => {
        (h.strokes || []).forEach((s) => {
          if (s && typeof s === 'object' && s.club) allStrokes.push(s);
        });
      });
    });
    if (allStrokes.length === 0) return null;

    type ClubStat = { count: number; onTarget: number; left: number; right: number; short: number; long: number; penalties: number };
    const map: Record<string, ClubStat> = {};

    allStrokes.forEach(s => {
      if (!map[s.club]) map[s.club] = { count: 0, onTarget: 0, left: 0, right: 0, short: 0, long: 0, penalties: 0 };
      map[s.club].count++;
      const d = s.direction;
      if (d === 'Fairway' || d === 'Green' || d === 'On Target') {
        map[s.club].onTarget++;
      } else {
        if (d.includes('Left')) map[s.club].left++;
        if (d.includes('Right')) map[s.club].right++;
        if (d.includes('Short')) map[s.club].short++;
        if (d.includes('Long')) map[s.club].long++;
      }
      if (s.penalty) map[s.club].penalties++;
    });

    // Sort by CLUB_ORDER for display
    const sorted = Object.entries(map).sort((a, b) => {
      const ai = CLUB_ORDER.indexOf(a[0]);
      const bi = CLUB_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Accuracy per club (min 3 shots to count)
    const withAccuracy = sorted
      .map(([club, s]) => ({ club, ...s, accuracy: Math.round((s.onTarget / s.count) * 100) }))
      .filter(c => c.count >= 3);

    const weakest = withAccuracy.length > 0
      ? [...withAccuracy].sort((a, b) => a.accuracy - b.accuracy)[0]
      : null;

    const mostPenalized = sorted
      .map(([club, s]) => ({ club, ...s }))
      .filter(c => c.penalties > 0)
      .sort((a, b) => b.penalties - a.penalties)[0] ?? null;

    // Overall miss tendency (excluding putts)
    const nonPuttStrokes = allStrokes.filter(s => s.club !== 'Putter');
    let totalLeft = 0, totalRight = 0, totalShort = 0, totalLong = 0;
    nonPuttStrokes.forEach((s) => {
      const d = s.direction;
      if (d.includes('Left')) totalLeft++;
      if (d.includes('Right')) totalRight++;
      if (d.includes('Short')) totalShort++;
      if (d.includes('Long')) totalLong++;
    });

    const missTendency = (() => {
      const max = Math.max(totalLeft, totalRight, totalShort, totalLong);
      if (max === 0) return null;
      if (max === totalLeft) return 'Left';
      if (max === totalRight) return 'Right';
      if (max === totalShort) return 'Short';
      return 'Long';
    })();

    // Most used club (excl. putter)
    const byUsage = sorted.filter(([c]) => c !== 'Putter').sort((a, b) => b[1].count - a[1].count);
    const mostUsed = byUsage[0]?.[0] ?? null;

    return { sorted, withAccuracy, weakest, mostPenalized, missTendency, mostUsed, totalStrokes: allStrokes.length };
  };

  // Identify yardage ranges where club accuracy is weak
  const calcYardageGaps = (clubStats: any) => {
    if (!clubStats?.withAccuracy || clubStats.withAccuracy.length === 0) return null;

    // Rough carry distances by club (from your bag)
    const clubRanges: Record<string, { min: number; max: number }> = {
      'Driver': { min: 85, max: 95 },
      '3W': { min: 80, max: 85 },
      '5W': { min: 105, max: 112 },
      '4H': { min: 95, max: 100 },
      '5i': { min: 100, max: 105 },
      '6i': { min: 100, max: 108 },
      '7i': { min: 82, max: 88 },
      '8i': { min: 100, max: 108 },
      '9i': { min: 107, max: 112 },
      'PW': { min: 72, max: 76 },
      'SW': { min: 95, max: 100 },
    };

    const weak = clubStats.withAccuracy.filter((c: any) => c.accuracy < 60);
    const gaps = weak
      .map((w: any) => clubRanges[w.club] ? `${w.club} (${clubRanges[w.club].min}–${clubRanges[w.club].max}m)` : null)
      .filter(Boolean);

    return gaps.length > 0 ? gaps : null;
  };

  const getClubTrainingTip = (clubStats: any) => {
    if (!clubStats) return null;
    const tips = [];

    if (clubStats.weakest) {
      const w = clubStats.weakest;
      const missDir = w.left > w.right ? 'left' : w.right > w.left ? 'right' : w.short > w.long ? 'short' : 'long';

      // Cross-reference with bag data to personalize
      const bagData: ClubDistance | undefined = clubDistances[w.club];
      let bagContext = '';
      if (bagData?.direction) {
        const bagNote = bagData.note ? ` (${bagData.note})` : '';
        bagContext = ` Your bag data shows ${bagData.direction}${bagNote}.`;
      }

      // Suggest specific drill based on miss direction
      let drillSuggestion = '';
      if (missDir === 'left') drillSuggestion = ' Try: alignment sticks, swing path video, or hit 10 shots aiming 5° right.';
      else if (missDir === 'right') drillSuggestion = ' Try: pre-swing alignment check, hinge practice, or hit 10 to target boxes.';
      else if (missDir === 'short') drillSuggestion = ' Try: tempo drills or full-swing 7-8-9 ladder (increasing commitment).';
      else if (missDir === 'long') drillSuggestion = ' Try: swing-length control or club selection (consider one club less).';

      tips.push(`Your ${w.club} is ${w.accuracy}% accurate (missing ${missDir}).${bagContext}${drillSuggestion}`);
    }

    if (clubStats.mostPenalized) {
      const p = clubStats.mostPenalized;
      const bagData: ClubDistance | undefined = clubDistances[p.club];
      let conservative = '';
      if (bagData?.note && bagData.note.includes('Risky')) {
        conservative = ' Your bag notes say this club is risky — use a go-to tee club instead (e.g. 5W or 4H).';
      } else {
        conservative = ' Consider a more conservative club choice off the tee.';
      }
      tips.push(`${p.club} caused ${p.penalties} penalt${p.penalties === 1 ? 'y' : 'ies'}.${conservative}`);
    }

    if (clubStats.missTendency) {
      let focusArea = clubStats.missTendency === 'Left' || clubStats.missTendency === 'Right' ? 'swing path' : 'distance control';
      tips.push(`Across all clubs, you miss ${clubStats.missTendency.toLowerCase()} most. Priority: work on ${focusArea}. Check your bag's weakest clubs (6i–PW) — they have the same tendency.`);
    }

    return tips;
  };

  const getRecommendation = (stats: any, clubStats: any) => {
    if (!stats) return '';

    // Base recommendation on weakest practice area
    let baseRec = '';
    if (stats.weakest === 'Putting') {
      baseRec = 'Spend 40% of your next session on short putts (1–2m). Focus on consistent tempo. Also: lag putting 8m+ (2-putt target only).';
    } else if (stats.weakest === 'Chipping') {
      baseRec = 'Work on getting chips inside 2m. Start close (5m) and build distance. Focus on landing spot consistency rather than swing power.';
    } else if (stats.weakest === 'Pitching') {
      baseRec = 'Focus on distance control in pitching. Try 10 shots each at 30m, 40m, 50m — aim for 80% inside 2m at each distance.';
    } else if (stats.weakest === 'Short Game') {
      baseRec = 'Work on chip-and-run shots (SW) and up-and-downs. Aim for 10 attempts per drill. Review: bunker saves with SW (chip clean, don\'t splash).';
    } else if (stats.weakest === 'Long Game') {
      baseRec = 'Focus on fairway accuracy and approach shots. Track your misses (left/right). Default tee: 5W → 4H → 3W only on wide holes.';
    } else {
      baseRec = 'Keep practicing consistently across all areas!';
    }

    // Add club-specific guidance if there's weak club data
    if (clubStats?.weakest && clubStats.weakest.accuracy < 50) {
      const w = clubStats.weakest;
      baseRec += ` | ${w.club} needs work (${w.accuracy}% accurate) — add dedicated drills.`;
    }

    return baseRec;
  };

  const stats = calcPracticeStats();
  const handicap = calcHandicap();
  const clubStats = calcClubStats();
  const clubTips = getClubTrainingTip(clubStats);
  const yardageGaps = calcYardageGaps(clubStats);

  const hasNoData = rounds.length === 0 && sessions.length === 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧠 Your Insights</Text>

      {/* ── Onboarding empty state ── */}
      {hasNoData && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Nothing to analyse yet</Text>
          <Text style={styles.emptySubtitle}>
            Log practice sessions and rounds to unlock your handicap index, club accuracy, and personalised recommendations.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/')}>
            <Text style={styles.emptyBtnText}>Start a Practice Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.emptySecondaryBtn} onPress={() => router.push('/round')}>
            <Text style={styles.emptySecondaryBtnText}>Log a Round</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Handicap card ── */}
      <View style={[styles.card, styles.handicapCard]}>
        <Text style={styles.heading}>🏅 Training Handicap Index</Text>
        {handicap ? (
          <>
            <Text style={styles.handicapValue}>{handicap.handicap}</Text>
            <Text style={styles.handicapSub}>
              Based on best {handicap.roundsUsed} of {handicap.roundsTotal} rounds · WHS formula
            </Text>
          </>
        ) : (
          <Text style={styles.sub}>
            {(() => {
              const enriched = rounds.map(enrichRound);
              const valid = enriched.filter((r: any) => r.courseRating && r.slopeRating && r.coursePar);
              if (rounds.length === 0) return 'Log some rounds to get started';
              if (valid.length < 3) return `${valid.length} of ${rounds.length} rounds have CR & Slope — need 3 qualifying rounds (${valid.length}/3)`;
              return 'Not enough qualifying rounds yet';
            })()}
          </Text>
        )}
      </View>

      {/* ── Club analytics ── */}
      {!clubStats ? (
        <View style={styles.card}>
          <Text style={styles.heading}>🏌️ Club Analytics</Text>
          <Text style={styles.sub}>Log rounds with club data to unlock accuracy insights.</Text>
        </View>
      ) : (
        <>
          {/* Miss tendency + most used */}
          <View style={styles.card}>
            <Text style={styles.heading}>🏌️ Club Overview</Text>
            <View style={styles.overviewRow}>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>SHOTS TRACKED</Text>
                <Text style={styles.overviewValue}>{clubStats.totalStrokes}</Text>
              </View>
              {clubStats.mostUsed && (
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>MOST USED</Text>
                  <Text style={styles.overviewValue}>{clubStats.mostUsed}</Text>
                </View>
              )}
              {clubStats.missTendency && (
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>MISS PATTERN</Text>
                  <Text style={[styles.overviewValue, styles.overviewMiss]}>{clubStats.missTendency}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Per-club accuracy bars */}
          {clubStats.withAccuracy.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.heading}>🎯 Accuracy by Club</Text>
              <Text style={styles.sub}>On-target % (min. 3 shots)</Text>
              {clubStats.withAccuracy
                .sort((a: any, b: any) => b.accuracy - a.accuracy)
                .map((c: any) => (
                  <View key={c.club} style={styles.accuracyRow}>
                    <Text style={styles.accuracyClub}>{c.club}</Text>
                    <View style={styles.accuracyBarBg}>
                      <View style={[styles.accuracyBarFill, {
                        width: `${c.accuracy}%` as any,
                        backgroundColor: c.accuracy >= 70 ? '#4CAF50' : c.accuracy >= 50 ? '#FF9800' : '#e53935'
                      }]} />
                    </View>
                    <Text style={styles.accuracyPct}>{c.accuracy}%</Text>
                    <Text style={styles.accuracyCount}>({c.count})</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Yardage gaps */}
          {yardageGaps && yardageGaps.length > 0 && (
            <View style={[styles.card, styles.gapCard]}>
              <Text style={styles.heading}>📏 Yardage Gaps</Text>
              <Text style={styles.sub}>These distance ranges need practice focus:</Text>
              {yardageGaps.map((gap: string, i: number) => (
                <Text key={i} style={[styles.body, { color: '#D32F2F', fontWeight: '600' }]}>• {gap}</Text>
              ))}
            </View>
          )}

          {/* Penalty alert */}
          {clubStats.mostPenalized && (
            <View style={[styles.card, styles.alertCard]}>
              <Text style={styles.heading}>⚠️ Penalty Watch</Text>
              <Text style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{clubStats.mostPenalized.club}</Text> has led to{' '}
                <Text style={{ fontWeight: 'bold', color: '#e65100' }}>{clubStats.mostPenalized.penalties} penalt{clubStats.mostPenalized.penalties === 1 ? 'y' : 'ies'}</Text>.
                Consider a more conservative option when in doubt.
              </Text>
            </View>
          )}

          {/* Club-based training tips */}
          {clubTips && clubTips.length > 0 && (
            <View style={[styles.card, styles.tipCard]}>
              <Text style={styles.heading}>💡 Training Tips (from your rounds)</Text>
              {clubTips.map((tip: string, i: number) => (
                <Text key={i} style={[styles.body, { marginBottom: 6 }]}>• {tip}</Text>
              ))}
            </View>
          )}
        </>
      )}

      {/* ── Practice insights ── */}
      {!stats ? (
        !hasNoData && (
          <View style={styles.card}>
            <Text style={styles.heading}>🏋️ Practice Insights</Text>
            <Text style={styles.sub}>Complete some practice sessions to unlock drill success rates, weakest areas, and personalised recommendations.</Text>
            <TouchableOpacity style={[styles.emptyBtn, { marginTop: 12 }]} onPress={() => router.push('/')}>
              <Text style={styles.emptyBtnText}>Start a Session</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>⚠️ Weakest Area</Text>
            <Text style={styles.highlight}>{stats.weakest}</Text>
            {stats.weakestScore < 101 && <Text style={styles.sub}>{stats.weakestScore}% drill success rate</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>🎯 Recommendation</Text>
            <Text style={styles.body}>{getRecommendation(stats, clubStats)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>📈 Practice Distribution</Text>
            <Text style={styles.body}>Putting: {stats.typeCount.Putting} sessions</Text>
            <Text style={styles.body}>Chipping: {stats.typeCount.Chipping} sessions</Text>
            <Text style={styles.body}>Pitching: {stats.typeCount.Pitching} sessions</Text>
            <Text style={styles.body}>Long Game: {stats.typeCount['Long Game']} sessions</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>✅ Overall Drill Success</Text>
            <Text style={styles.highlight}>{stats.overallSuccess}%</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>⏱ Total Practice Time</Text>
            <Text style={styles.highlight}>{Math.floor(stats.totalTime / 60)} min</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, marginTop: 10 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20, fontSize: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginBottom: 10, width: '100%', alignItems: 'center' },
  emptyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  emptySecondaryBtn: { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, width: '100%', alignItems: 'center' },
  emptySecondaryBtnText: { color: '#555', fontSize: 14 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 14, padding: 16, marginBottom: 16 },
  handicapCard: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#4CAF50' },
  heading: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  highlight: { fontSize: 28, fontWeight: 'bold', color: '#4CAF50' },
  handicapValue: { fontSize: 52, fontWeight: 'bold', color: '#2e7d32', textAlign: 'center', marginVertical: 8 },
  handicapSub: { fontSize: 13, color: '#555', textAlign: 'center' },
  sub: { fontSize: 14, color: '#666', marginTop: 4 },
  body: { fontSize: 15, color: '#444', marginBottom: 4 },
  // Club analytics
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewLabel: { fontSize: 10, fontWeight: '700', color: '#999', letterSpacing: 0.8, marginBottom: 4 },
  overviewValue: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  overviewMiss: { color: '#e53935' },
  accuracyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  accuracyClub: { fontSize: 13, fontWeight: '700', color: '#333', width: 44 },
  accuracyBarBg: { flex: 1, height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden' },
  accuracyBarFill: { height: 10, borderRadius: 5 },
  accuracyPct: { fontSize: 13, fontWeight: '700', color: '#333', width: 34, textAlign: 'right' },
  accuracyCount: { fontSize: 11, color: '#999', width: 28 },
  alertCard: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#FF9800' },
  gapCard: { backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#D32F2F' },
  tipCard: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#4CAF50' },
});
