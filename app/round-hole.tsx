import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getDraftRound, saveDraftRound, getClubDistances } from '../services/storage';
import type { Stroke, HoleData, DraftRound, ClubDistance } from '../types';

const CLUBS = [
  'Driver', '3W', '5W', '4H', '5H',
  '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'PW', 'GW', 'SW', 'LW', 'Putter'
];

const PENALTY_TYPES = ['Water', 'OB', 'Hazard', 'Other'];
const PUTT_DIRECTIONS = ['Short', 'Long', 'Left', 'Right'];

// Personal yardage guide (from My Bag Reference spreadsheet, Jan 2026)
const YARDAGE_GUIDE = [
  { min: 0,   max: 44,  club: 'SW', swing: 100, label: 'SW (bump & run)',  alt: 'PW (chip)',    note: 'Keep it low and rolling' },
  { min: 45,  max: 52,  club: 'SW', swing: 100, label: 'SW full',          alt: 'PW ½',         note: 'Perfect for short par-3 holes' },
  { min: 53,  max: 60,  club: 'SW', swing: 85,  label: 'SW ¾',             alt: 'PW ½',         note: 'Controlled landing, reliable' },
  { min: 61,  max: 68,  club: 'PW', swing: 100, label: 'PW full',          alt: 'SW (punch)',   note: 'Scoring zone – be precise' },
  { min: 69,  max: 75,  club: 'PW', swing: 85,  label: 'PW ¾',             alt: '9i ½',         note: 'Smooth swing = better direction' },
  { min: 76,  max: 83,  club: '9i', swing: 100, label: '9i full',          alt: 'PW ¾',         note: '⚠️ 9i goes right — aim left of target' },
  { min: 84,  max: 90,  club: '9i', swing: 85,  label: '9i ¾',             alt: '8i ½',         note: 'Into headwind: use 8i instead' },
  { min: 91,  max: 98,  club: '7i', swing: 100, label: '7i full',          alt: '8i full',      note: 'Perfect distance, aim center' },
  { min: 99,  max: 107, club: '7i', swing: 85,  label: '7i ¾',             alt: '6i full',      note: 'Aim for middle of green' },
  { min: 108, max: 115, club: '6i', swing: 90,  label: '6i / 5i 90%',     alt: '5W half',      note: 'Uphill (e.g. Campo Real): add 1 club' },
  { min: 116, max: 130, club: '4H', swing: 90,  label: '4H / Hybrid 90%', alt: '5i full',      note: 'Aim short if green is above you' },
  { min: 131, max: 145, club: '5W', swing: 90,  label: '5W 90%',           alt: '4H',           note: 'Land short, let it roll' },
  { min: 146, max: 999, club: '5W', swing: 100, label: '5W full',          alt: '4H full',      note: 'Maximum distance — commit fully' },
];

// Personal mental rules (from My Bag Reference spreadsheet)
const MENTAL_RULES = [
  { icon: '🏌️', title: 'Default tee club',    note: '5W → 4H → 3W only on wide holes' },
  { icon: '🔄', title: 'Back 9 rule',          note: '80–85% swing. Reliable club, not longest.' },
  { icon: '📐', title: 'Par-4 strategy',       note: 'Tee: 5W/Hybrid → Lay-up: 8i/7i (90–100m) → Approach: PW/9i' },
  { icon: '💨', title: 'Into headwind',        note: 'Club DOWN + 80% swing — saves 6–10 strokes' },
  { icon: '😓', title: 'Tired or windy',       note: '4 Hybrid. Always. No exceptions.' },
  { icon: '🌬️', title: 'Golden wind rule',    note: 'Tired OR into wind → club DOWN, swing SMOOTH' },
  { icon: '⭕', title: 'Lag putting (>8m)',    note: '2-putt only target. Forget the hole.' },
  { icon: '🏖️', title: 'Bunker (hard sand)',  note: 'Chip clean with SW. NOT splash. Consider unplayable.' },
  { icon: '🌲', title: 'Ball in trees',        note: 'Option A: low punch under branches. Option B: chip out sideways.' },
];

export default function RoundHoleScreen() {
  const { holeNumber, totalHoles } = useLocalSearchParams();
  const hole = parseInt(holeNumber as string);
  const total = parseInt(totalHoles as string);

  const [par, setPar] = useState(4);
  const [holeDistance, setHoleDistance] = useState<number | null>(null);
  const [savedHoles, setSavedHoles] = useState<HoleData[]>([]);
  const [clubDistances, setClubDistances] = useState<Record<string, ClubDistance>>({});
  const [showRules, setShowRules] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [putts, setPutts] = useState(0);
  const [puttDirection, setPuttDirection] = useState<string | null>(null);

  // 3-step picker state: club → direction → penalty
  const [selectingClub, setSelectingClub] = useState(false);
  const [pendingClub, setPendingClub] = useState<string | null>(null);
  const [pendingDirection, setPendingDirection] = useState<string | null>(null);

  // Load hole data — par/distance from course setup, strokes/putts if going back
  useEffect(() => {
    // Reset state for the new hole
    setStrokes([]);
    setPutts(0);
    setPuttDirection(null);
    setPendingClub(null);
    setPendingDirection(null);
    setSelectingClub(false);

    const loadHoleData = async () => {
      const distData = await getClubDistances();
      setClubDistances(distData);

      const draft = await getDraftRound();
      if (!draft) return;
      const round = draft;

      // Load par + distance from course setup
      const holeInfo = (round.courseHoles || []).find(h => h.hole === hole);
      if (holeInfo) {
        if (holeInfo.par) setPar(holeInfo.par);
        const tee = round.tee;
        const dist = tee && holeInfo.distanceByTee?.[tee]
          ? holeInfo.distanceByTee[tee]
          : holeInfo.distance;
        if (dist) setHoleDistance(dist);
      }

      // Load all saved holes for the progress strip
      setSavedHoles(round.holeData || []);

      // If going back, reload previously saved stroke data for this hole
      const saved = (round.holeData || []).find(h => h.hole === hole);
      if (saved) {
        setStrokes(saved.strokes || []);
        setPutts(saved.putts || 0);
        setPar(saved.par || holeInfo?.par || 4);
      }
    };
    loadHoleData();
  }, [hole]);

  const isTeeShotNext = strokes.length === 0;
  const targetLabel = isTeeShotNext ? (par === 3 ? 'Green' : 'Fairway') : 'On Target';

  const selectClub = (club: string) => {
    setPendingClub(club);
    setSelectingClub(false);
  };

  const selectDirection = (direction: string) => {
    setPendingDirection(direction);
  };

  const confirmStroke = (penalty: string | null) => {
    if (!pendingClub || !pendingDirection) return;
    setStrokes([...strokes, { club: pendingClub, direction: pendingDirection, penalty }]);
    setPendingClub(null);
    setPendingDirection(null);
  };

  const removeLastStroke = () => {
    if (showPicker) {
      // Cancel mid-selection: step back through picker stages
      if (pendingDirection) {
        setPendingDirection(null); // back to direction step
      } else if (pendingClub) {
        setPendingClub(null);      // back to club step
        setSelectingClub(true);
      } else {
        setSelectingClub(false);   // close picker entirely
      }
    } else {
      setStrokes(strokes.slice(0, -1));
    }
  };

  const penaltyCount = strokes.filter(s => s.penalty).length;
  const totalStrokes = strokes.length + putts + penaltyCount;
  const isGIR = strokes.length <= (par - 2) && strokes.length > 0;

  const saveHoleAndContinue = async () => {
    const firstStroke = strokes[0];
    const hitTarget = firstStroke?.direction === 'Fairway' || firstStroke?.direction === 'Green';

    const holeData: HoleData = {
      hole,
      par,
      strokes,
      putts,
      totalStrokes,
      fairwayHit: hitTarget,
      missDirection: !hitTarget ? firstStroke?.direction ?? null : null,
      puttDirection: putts > 0 ? puttDirection : null,
      gir: isGIR,
      penalties: strokes
        .filter(s => s.penalty)
        .map(s => ({ location: s.penalty!, stroke: s.club, direction: s.direction })),
    };

    const draft = await getDraftRound();
    if (!draft) return; // Can't save if no draft round
    const round = draft;
    // Upsert: replace existing entry for this hole if going back and re-saving
    const existing = (round.holeData || []).filter(h => h.hole !== hole);
    round.holeData = [...existing, holeData].sort((a, b) => a.hole - b.hole);
    await saveDraftRound(round);

    if (hole >= total) {
      router.push('/round-complete');
    } else {
      router.replace({ pathname: '/round-hole', params: { holeNumber: hole + 1, totalHoles: total } });
    }
  };

  const goToPreviousHole = async () => {
    if (hole <= 1) return;
    router.replace({ pathname: '/round-hole', params: { holeNumber: hole - 1, totalHoles: total } });
  };

  // Which step is the picker on?
  const pickerStep = !pendingClub ? 'club' : !pendingDirection ? 'direction' : 'penalty';
  const showPicker = !!(selectingClub || pendingClub);

  // Caddie: use personal yardage guide for hole distance
  const getCaddieAdvice = () => {
    if (!holeDistance) return null;
    const match = YARDAGE_GUIDE.find(g => holeDistance >= g.min && holeDistance <= g.max);
    if (!match) return null;
    // Also get one entry lower as lay-up option
    const matchIdx = YARDAGE_GUIDE.indexOf(match);
    const layup = matchIdx > 0 ? YARDAGE_GUIDE[matchIdx - 1] : null;
    return { match, layup };
  };

  const confirmExitRound = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Exit Round?\n\nYour progress so far is saved, but the current hole will not be. Are you sure you want to leave?')) {
        router.push('/');
      }
    } else {
      Alert.alert(
        'Exit Round?',
        'Your progress so far is saved, but the current hole will not be. Are you sure you want to leave?',
        [
          { text: 'Keep Playing', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: () => router.push('/') },
        ]
      );
    }
  };

  const caddieAdvice = getCaddieAdvice();
  // Keep caddieClub for club picker highlighting (backwards compat)
  const caddieClub = caddieAdvice ? {
    best: { club: caddieAdvice.match.club, carry: parseInt(clubDistances[caddieAdvice.match.club]?.carry) || 0 },
    conservative: caddieAdvice.layup ? { club: caddieAdvice.layup.club, carry: parseInt(clubDistances[caddieAdvice.layup.club]?.carry) || 0 } : null,
  } : null;

  const getChipColor = (diff: number | null, isCurrent: boolean) => {
    if (isCurrent) return '#111';
    if (diff === null) return '#e0e0e0';
    if (diff <= -2) return '#1565C0'; // eagle or better: blue
    if (diff === -1) return '#e8f5e9'; // birdie: light green
    if (diff === 0) return '#4CAF50'; // par: green
    if (diff === 1) return '#ffcdd2'; // bogey: light red
    return '#e53935'; // double+: red
  };

  const getChipTextColor = (diff: number | null, isCurrent: boolean) => {
    if (isCurrent) return '#fff';
    if (diff === null) return '#aaa';
    if (diff <= -2) return '#fff';
    if (diff === -1) return '#2e7d32';
    if (diff === 0) return '#fff';
    if (diff === 1) return '#c62828';
    return '#fff';
  };

  return (
    <ScrollView style={styles.container}>
      {/* Exit round */}
      <TouchableOpacity onPress={confirmExitRound} style={styles.exitBtn}>
        <Text style={styles.exitText}>✕ Exit Round</Text>
      </TouchableOpacity>

      {/* Hole progress strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.holeStrip} contentContainerStyle={styles.holeStripContent}>
        {Array.from({ length: total }, (_, i) => i + 1).map(h => {
          const saved = savedHoles.find(s => s.hole === h);
          const isCurrent = h === hole;
          const diff = saved ? saved.totalStrokes - saved.par : null;
          const chipBg = getChipColor(diff, isCurrent);
          const chipText = getChipTextColor(diff, isCurrent);
          return (
            <TouchableOpacity
              key={h}
              style={[styles.holeChip, { backgroundColor: chipBg }, isCurrent && styles.holeChipCurrent]}
              onPress={() => router.replace({ pathname: '/round-hole', params: { holeNumber: h, totalHoles: total } })}>
              <Text style={[styles.holeChipNum, { color: chipText }]}>H{h}</Text>
              {saved && diff !== null && (
                <Text style={[styles.holeChipScore, { color: chipText }]}>
                  {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.holeTitle}>Hole {hole} <Text style={styles.of}>of {total}</Text></Text>
        <Text style={styles.progress}>{Math.round((hole / total) * 100)}%</Text>
      </View>

      {/* Hole info: Par + Distance */}
      <View style={styles.holeInfoRow}>
        <View style={styles.holeInfoCard}>
          <Text style={styles.holeInfoLabel}>PAR</Text>
          <Text style={styles.holeInfoValue}>{par}</Text>
        </View>
        {holeDistance && (
          <View style={[styles.holeInfoCard, styles.holeInfoCardBlue]}>
            <Text style={[styles.holeInfoLabel, styles.holeInfoLabelBlue]}>DISTANCE</Text>
            <Text style={[styles.holeInfoValue, styles.holeInfoValueBlue]}>{holeDistance}m</Text>
          </View>
        )}
      </View>

      {/* Caddie suggestion */}
      {caddieAdvice && isTeeShotNext && (
        <View style={styles.caddieBox}>
          <Text style={styles.caddieLabel}>🎒 Caddie — {holeDistance}m</Text>
          <View style={styles.caddieRow}>
            <View style={styles.caddieClubBadge}>
              <Text style={styles.caddieClubName}>{caddieAdvice.match.label}</Text>
              {caddieClub?.best.carry ? (
                <Text style={styles.caddieClubDist}>{caddieClub.best.carry}m carry</Text>
              ) : null}
            </View>
            {caddieAdvice.match.alt && (
              <>
                <Text style={styles.caddieOr}>alt:</Text>
                <View style={[styles.caddieClubBadge, styles.caddieClubBadgeAlt]}>
                  <Text style={[styles.caddieClubName, styles.caddieClubNameAlt]}>{caddieAdvice.match.alt}</Text>
                </View>
              </>
            )}
          </View>
          {caddieAdvice.match.note ? (
            <Text style={styles.caddieNote}>{caddieAdvice.match.note}</Text>
          ) : null}
        </View>
      )}

      {/* Par selector */}
      <Text style={styles.sectionTitle}>Adjust Par</Text>
      <View style={styles.parRow}>
        {[3, 4, 5].map(p => (
          <TouchableOpacity key={p}
            style={[styles.parBtn, par === p && styles.parSelected]}
            onPress={() => setPar(p)}>
            <Text style={[styles.parText, par === p && styles.parTextSelected]}>Par {p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Strokes list */}
      <Text style={styles.sectionTitle}>Strokes (before putting)</Text>
      <View style={styles.strokesList}>
        {strokes.map((s, i) => (
          <View key={i} style={styles.strokeItem}>
            <Text style={styles.strokeNumber}>{i + 1}</Text>
            <Text style={styles.strokeClub}>{s.club}</Text>
            <Text style={[
              styles.strokeDir,
              s.direction === 'Fairway' || s.direction === 'Green' || s.direction === 'On Target'
                ? styles.strokeDirGood : styles.strokeDirMiss
            ]}>
              {s.direction}
            </Text>
            {s.penalty && (
              <Text style={styles.strokePenalty}>⚠️ {s.penalty}</Text>
            )}
          </View>
        ))}
        {isGIR && strokes.length > 0 && (
          <View style={styles.girBadge}>
            <Text style={styles.girText}>🎯 GIR</Text>
          </View>
        )}
      </View>

      <View style={styles.strokeButtons}>
        <TouchableOpacity style={styles.addStrokeBtn} onPress={() => setSelectingClub(true)}>
          <Text style={styles.addStrokeText}>
            {isTeeShotNext ? '🏌️ Add Tee Shot' : '+ Add Stroke'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.undoBtn, (!showPicker && strokes.length === 0) && styles.undoBtnDisabled]}
          disabled={!showPicker && strokes.length === 0}
          onPress={removeLastStroke}>
          <Text style={[styles.undoText, (!showPicker && strokes.length === 0) && styles.undoTextDisabled]}>↩ Undo</Text>
        </TouchableOpacity>
      </View>

      {/* 3-step picker: Club → Direction → Penalty */}
      {showPicker && (
        <View style={styles.pickerBox}>

          {/* Step 1: Club */}
          {pickerStep === 'club' && (
            <>
              <Text style={styles.pickerTitle}>Select Club</Text>
              <View style={styles.clubGrid}>
                {CLUBS.map(club => {
                  const dist = clubDistances[club];
                  const carry = dist?.carry ? parseInt(dist.carry) : null;
                  // Highlight: club whose carry best matches holeDistance
                  const isRecommended = caddieClub?.best.club === club;
                  const isLayup = caddieClub?.conservative?.club === club;
                  return (
                    <TouchableOpacity
                      key={club}
                      style={[
                        styles.clubBtn,
                        isRecommended && styles.clubBtnRecommended,
                        isLayup && styles.clubBtnLayup,
                      ]}
                      onPress={() => selectClub(club)}>
                      <Text style={[styles.clubText, isRecommended && styles.clubTextRecommended]}>{club}</Text>
                      {carry && (
                        <Text style={[styles.clubDist, isRecommended && styles.clubDistRecommended]}>
                          {carry}m
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Step 2: Direction */}
          {pickerStep === 'direction' && (
            <>
              <Text style={styles.pickerTitle}>
                {isTeeShotNext ? `Tee Shot — ${pendingClub}` : `Shot Result — ${pendingClub}`}
              </Text>
              <TouchableOpacity style={[styles.dirBtnFull, styles.dirTarget]} onPress={() => selectDirection(targetLabel)}>
                <Text style={styles.dirBtnFullText}>✅ {targetLabel}</Text>
              </TouchableOpacity>
              <View style={styles.dirRow}>
                {['Left', 'Right', 'Short', 'Long'].map(dir => (
                  <TouchableOpacity key={dir} style={styles.dirMissBtn} onPress={() => selectDirection(dir)}>
                    <Text style={styles.dirMissBtnText}>{dir}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Step 3: Penalty */}
          {pickerStep === 'penalty' && (
            <>
              <Text style={styles.pickerTitle}>⚠️ Any Penalty?</Text>
              <View style={styles.dirRow}>
                {PENALTY_TYPES.map(type => (
                  <TouchableOpacity key={type} style={styles.penaltyTypeBtn} onPress={() => confirmStroke(type)}>
                    <Text style={styles.penaltyTypeBtnText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.noPenaltyBtn} onPress={() => confirmStroke(null)}>
                <Text style={styles.noPenaltyText}>✅ No Penalty</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      )}

      {/* Putts */}
      <Text style={styles.sectionTitle}>Putts</Text>
      <View style={styles.puttsRow}>
        <TouchableOpacity style={styles.counterBtn} onPress={() => setPutts(Math.max(0, putts - 1))}>
          <Text style={styles.counterText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.puttsCount}>{putts}</Text>
        <TouchableOpacity style={styles.counterBtn} onPress={() => setPutts(putts + 1)}>
          <Text style={styles.counterText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Putt direction */}
      {putts > 0 && (
        <>
          <Text style={styles.sectionTitle}>Putt Direction</Text>
          <View style={styles.dirRow}>
            {PUTT_DIRECTIONS.map(dir => (
              <TouchableOpacity key={dir}
                style={[styles.dirMissBtn, puttDirection === dir && styles.dirMissBtnSelected]}
                onPress={() => setPuttDirection(puttDirection === dir ? null : dir)}>
                <Text style={[styles.dirMissBtnText, puttDirection === dir && styles.dirMissBtnTextSelected]}>{dir}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Score summary */}
      {totalStrokes > 0 && (
        <View style={styles.scoreSummary}>
          <Text style={styles.scoreText}>
            Score: {totalStrokes} ({totalStrokes - par > 0 ? '+' : ''}{totalStrokes - par} vs par)
          </Text>
          {penaltyCount > 0 && (
            <Text style={styles.scoreSub}>
              {strokes.length} strokes + {penaltyCount} penalty{penaltyCount > 1 ? 's' : ''} + {putts} putts
            </Text>
          )}
        </View>
      )}

      {/* Mental rules (collapsible) */}
      <TouchableOpacity style={styles.rulesToggle} onPress={() => setShowRules(v => !v)}>
        <Text style={styles.rulesToggleText}>🧠 Mental Rules</Text>
        <Text style={styles.rulesToggleChevron}>{showRules ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {showRules && (
        <View style={styles.rulesBox}>
          {MENTAL_RULES.map((r, i) => (
            <View key={i} style={styles.ruleRow}>
              <Text style={styles.ruleIcon}>{r.icon}</Text>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleTitle}>{r.title}</Text>
                <Text style={styles.ruleNote}>{r.note}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Hole navigation */}
      <View style={styles.holeNavRow}>
        <TouchableOpacity
          style={[styles.holeNavBtn, styles.holeNavPrev, hole <= 1 && styles.holeNavDisabled]}
          disabled={hole <= 1}
          onPress={goToPreviousHole}>
          <Text style={[styles.holeNavText, hole <= 1 && styles.holeNavTextDisabled]}>
            ← H{hole - 1}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.holeNavBtn, styles.holeNavNext, strokes.length === 0 && styles.holeNavDisabled]}
          disabled={strokes.length === 0}
          onPress={saveHoleAndContinue}>
          <Text style={[styles.holeNavNextText, strokes.length === 0 && styles.holeNavTextDisabled]}>
            {hole >= total ? '🏁 Finish' : `H${hole + 1} →`}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  exitBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  exitText: { fontSize: 13, color: '#999', fontWeight: '500' },
  holeStrip: { marginHorizontal: -24, marginBottom: 16, marginTop: 8 },
  holeStripContent: { paddingHorizontal: 24, gap: 6, flexDirection: 'row', alignItems: 'center' },
  holeChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 40 },
  holeChipCurrent: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  holeChipNum: { fontSize: 11, fontWeight: '700' },
  holeChipScore: { fontSize: 12, fontWeight: 'bold', marginTop: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 },
  holeTitle: { fontSize: 26, fontWeight: 'bold', flex: 1 },
  of: { fontSize: 18, color: '#999', fontWeight: 'normal' },
  progress: { fontSize: 13, color: '#4CAF50', fontWeight: '600', minWidth: 36, textAlign: 'right' },
  holeInfoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  holeInfoCard: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 14, padding: 14, alignItems: 'center' },
  holeInfoCardBlue: { backgroundColor: '#e3f2fd' },
  holeInfoLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1, marginBottom: 4 },
  holeInfoLabelBlue: { color: '#1565C0' },
  holeInfoValue: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  holeInfoValueBlue: { color: '#1565C0' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 8 },
  parRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  parBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  parSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  parText: { fontSize: 16, color: '#333' },
  parTextSelected: { color: '#fff', fontWeight: 'bold' },
  // Strokes list
  strokesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  strokeItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
  strokeNumber: { fontSize: 12, color: '#999' },
  strokeClub: { fontSize: 15, fontWeight: '600' },
  strokeDir: { fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  strokeDirGood: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  strokeDirMiss: { backgroundColor: '#ffebee', color: '#c62828' },
  strokePenalty: { fontSize: 12, color: '#e65100', fontWeight: '600' },
  girBadge: { backgroundColor: '#e8f5e9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  girText: { fontSize: 14, color: '#4CAF50', fontWeight: 'bold' },
  strokeButtons: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  addStrokeBtn: { flex: 1, backgroundColor: '#4CAF50', padding: 14, borderRadius: 12 },
  addStrokeText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  undoBtn: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  undoBtnDisabled: { borderColor: '#eee', backgroundColor: '#fafafa' },
  undoText: { color: '#333', fontSize: 15 },
  undoTextDisabled: { color: '#ccc' },
  // Picker box (all 3 steps share same container)
  pickerBox: { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 16 },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  clubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clubBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  clubBtnRecommended: { backgroundColor: '#e8f5e9', borderColor: '#4CAF50', borderWidth: 2 },
  clubBtnLayup: { backgroundColor: '#fff8e1', borderColor: '#FF9800' },
  clubText: { fontSize: 14, fontWeight: '600', color: '#333' },
  clubTextRecommended: { color: '#2e7d32' },
  clubDist: { fontSize: 11, color: '#999', marginTop: 2 },
  clubDistRecommended: { color: '#4CAF50', fontWeight: '600' },
  // Caddie box
  caddieBox: { backgroundColor: '#e3f2fd', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#1565C0' },
  caddieLabel: { fontSize: 12, fontWeight: '700', color: '#1565C0', marginBottom: 8, letterSpacing: 0.5 },
  caddieRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caddieClubBadge: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  caddieClubBadgeAlt: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1565C0' },
  caddieClubName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  caddieClubNameAlt: { color: '#1565C0' },
  caddieClubDist: { fontSize: 12, color: '#bbdefb', marginTop: 2 },
  caddieClubDistAlt: { color: '#1565C0' },
  caddieOr: { fontSize: 12, color: '#1565C0', fontStyle: 'italic' },
  caddieNote: { fontSize: 12, color: '#1565C0', marginTop: 8, fontStyle: 'italic' },
  // Direction
  dirBtnFull: { width: '100%', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  dirBtnFullText: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  dirTarget: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  dirRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dirMissBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', backgroundColor: '#fff' },
  dirMissBtnSelected: { backgroundColor: '#e53935', borderColor: '#e53935' },
  dirMissBtnText: { fontSize: 14, color: '#333', fontWeight: '600' },
  dirMissBtnTextSelected: { color: '#fff' },
  // Penalty step
  penaltyTypeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ff9800', alignItems: 'center', backgroundColor: '#fff3e0' },
  penaltyTypeBtnText: { fontSize: 14, color: '#e65100', fontWeight: '600' },
  noPenaltyBtn: { width: '100%', padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#4CAF50', marginTop: 4 },
  noPenaltyText: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  // Putts
  puttsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 },
  counterBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  counterText: { fontSize: 24, color: '#333' },
  puttsCount: { fontSize: 36, fontWeight: 'bold', width: 60, textAlign: 'center' },
  // Score
  scoreSummary: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' },
  scoreText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  scoreSub: { fontSize: 13, color: '#e65100', marginTop: 4 },
  // Mental rules
  rulesToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  rulesToggleText: { fontSize: 14, fontWeight: '700', color: '#333' },
  rulesToggleChevron: { fontSize: 12, color: '#888' },
  rulesBox: { backgroundColor: '#fffde7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#ffe082' },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  ruleIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  ruleContent: { flex: 1 },
  ruleTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 2 },
  ruleNote: { fontSize: 12, color: '#555', lineHeight: 17 },
  holeNavRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 60 },
  holeNavBtn: { flex: 1, padding: 18, borderRadius: 14, alignItems: 'center' },
  holeNavPrev: { backgroundColor: '#f0f0f0' },
  holeNavNext: { backgroundColor: '#111', flex: 2 },
  holeNavDisabled: { backgroundColor: '#e8e8e8' },
  holeNavText: { fontSize: 16, fontWeight: '700', color: '#444' },
  holeNavNextText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  holeNavTextDisabled: { color: '#bbb' },
});
