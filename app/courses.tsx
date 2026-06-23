import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { getCourses, saveCourses, getRounds } from '../services/storage';
import type { Course, Round } from '../types';

const TEE_COLOURS = [
  { name: 'Blue', color: '#1565C0', text: '#fff' },
  { name: 'White', color: '#f5f5f5', text: '#333', border: '#ddd' },
  { name: 'Yellow', color: '#F9A825', text: '#fff' },
  { name: 'Red', color: '#C62828', text: '#fff' },
  { name: 'Orange', color: '#E65100', text: '#fff' },
];

const DEFAULT_HOLES = Array.from({ length: 18 }, (_, i) => ({
  hole: i + 1, par: 4, distance: '',
}));

const COUNTRY_FLAG: Record<string, string> = {
  Netherlands: '🇳🇱',
  Portugal: '🇵🇹',
};

export default function CoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<{[id: string]: 'tees' | 'holes' | 'stats'}>({});
  const [editingTee, setEditingTee] = useState<{ courseId: string; teeName: string } | null>(null);
  const [editingHoles, setEditingHoles] = useState<string | null>(null);
  const [holeInputs, setHoleInputs] = useState(DEFAULT_HOLES);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCountry, setNewCourseCountry] = useState('');
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);

  // Tee inputs
  const [teePar, setTeePar] = useState('');
  const [teeRating, setTeeRating] = useState('');
  const [teeSlope, setTeeSlope] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCourses(); loadRounds(); }, []); // run once on mount

  const loadCourses = async () => {
    const data = await getCourses();
    setCourses(data);
    if (!activeCountry) {
      const allCountries = [...new Set(data.map((c: Course) => c.country || 'Other'))].sort() as string[];
      if (allCountries.length > 0) setActiveCountry(allCountries[0]);
    }
  };

  const loadRounds = async () => {
    const data = await getRounds();
    setRounds(data);
  };

  const getCourseRounds = (course: Course): Round[] =>
    rounds.filter(r => {
      if (r.courseId && r.courseId === course.id) return true;
      const rName = r.courseName?.trim().toLowerCase() ?? '';
      const cName = course.name?.trim().toLowerCase() ?? '';
      // Exact match or one name contains the other (catches renames like "ShortGolf Utrecht" → "ShortGolf Utrecht Par 3")
      return rName === cName || rName.includes(cName) || cName.includes(rName);
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getCourseStats = (course: Course) => {
    const cr = getCourseRounds(course);
    if (cr.length === 0) return null;
    const scores = cr.map(r => r.stats?.totalStrokes).filter(Boolean) as number[];
    const vsParScores = cr.map(r => r.stats?.scoreVsPar).filter(s => s !== null && s !== undefined) as number[];
    return {
      timesPlayed: cr.length,
      bestScore: scores.length ? Math.min(...scores) : null,
      bestVsPar: vsParScores.length ? Math.min(...vsParScores) : null,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      avgVsPar: vsParScores.length ? Math.round(vsParScores.reduce((a, b) => a + b, 0) / vsParScores.length) : null,
      lastPlayed: cr[0]?.date,
      recentRounds: cr.slice(0, 5),
    };
  };

  const updateAndSaveCourses = async (updated: Course[]) => {
    await saveCourses(updated);
    setCourses(updated);
  };

  const addCourse = async () => {
    if (!newCourseName.trim()) return;
    const newCourse: Course = {
      id: Date.now().toString(),
      name: newCourseName.trim(),
      country: newCourseCountry.trim() || 'Other',
      tees: {},
      holes: [],
    };
    await updateAndSaveCourses([...courses, newCourse]);
    setNewCourseName('');
    setNewCourseCountry('');
    setShowNewCourse(false);
    setExpandedCourse(newCourse.id);
    setActiveCountry(newCourse.country || 'Other');
    setActiveClub(null);
  };

  const deleteCourse = async (courseId: string) => {
    await updateAndSaveCourses(courses.filter(c => c.id !== courseId));
    if (expandedCourse === courseId) setExpandedCourse(null);
  };

  const startEditTee = (course: Course, teeName: string) => {
    const existing = course.tees[teeName] || {};
    setEditingTee({ courseId: course.id, teeName });
    setTeePar(existing.par?.toString() || '');
    setTeeRating(existing.rating?.toString() || '');
    setTeeSlope(existing.slope?.toString() || '');
  };

  const saveTee = async () => {
    if (!editingTee) return;
    const updated = courses.map(c => {
      if (c.id !== editingTee.courseId) return c;
      return {
        ...c,
        tees: {
          ...c.tees,
          [editingTee.teeName]: {
            par: teePar ? parseInt(teePar) : null,
            rating: teeRating ? parseFloat(teeRating) : null,
            slope: teeSlope ? parseInt(teeSlope) : null,
          }
        }
      };
    });
    await updateAndSaveCourses(updated);
    setEditingTee(null);
    setTeePar(''); setTeeRating(''); setTeeSlope('');
  };

  const cancelEdit = () => {
    setEditingTee(null);
    setTeePar(''); setTeeRating(''); setTeeSlope('');
  };

  const startEditHoles = (course: Course) => {
    const existing = course.holes || [];
    const inputs = Array.from({ length: 18 }, (_, i) => {
      const saved = existing.find(h => h.hole === i + 1);
      return { hole: i + 1, par: saved?.par ?? 4, distance: saved?.distance?.toString() ?? '' };
    });
    setHoleInputs(inputs);
    setEditingHoles(course.id);
  };

  const updateHoleInput = (holeIndex: number, field: 'par' | 'distance', value: string | number) => {
    setHoleInputs(prev => prev.map((h, i) =>
      i === holeIndex ? { ...h, [field]: value } : h
    ));
  };

  const saveHoles = async () => {
    const updated = courses.map(c => {
      if (c.id !== editingHoles) return c;
      const holes = holeInputs.map(h => ({
        hole: h.hole,
        par: h.par,
        distance: h.distance ? parseInt(h.distance) : null,
      }));
      return { ...c, holes };
    });
    await updateAndSaveCourses(updated);
    setEditingHoles(null);
  };

  const getHoleSummary = (course: Course) => {
    const holes = course.holes || [];
    if (holes.length === 0) return null;
    const withDist = holes.filter(h => h.distance);
    const totalPar = holes.reduce((sum, h) => sum + (h.par || 0), 0);
    return { count: withDist.length, totalPar };
  };

  // Level 1: country tabs (alphabetical)
  const countries = [...new Set(courses.map((c: Course) => c.country || 'Other'))].sort() as string[];
  const activeCountryKey = activeCountry || countries[0] || null;
  const coursesByCountry = courses.filter((c: Course) => (c.country || 'Other') === activeCountryKey);

  // Level 2: club sub-tabs within selected country (named clubs alphabetical, then 'Other')
  const clubMap: Record<string, Course[]> = {};
  for (const c of coursesByCountry) {
    const key = c.club || 'Other';
    if (!clubMap[key]) clubMap[key] = [];
    clubMap[key].push(c);
  }
  const clubTabs = Object.keys(clubMap).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
  const hasClubTabs = clubTabs.length > 1;
  const activeClubKey = activeClub || clubTabs[0] || null;
  const visibleCourses = activeClubKey && clubMap[activeClubKey] ? clubMap[activeClubKey] : coursesByCountry;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⛳ My Courses</Text>

        {/* Country tabs */}
        {countries.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryTabBar} contentContainerStyle={styles.countryTabBarContent}>
            {countries.map(country => (
              <TouchableOpacity
                key={country}
                style={[styles.countryTab, activeCountryKey === country && styles.countryTabActive]}
                onPress={() => { setActiveCountry(country); setActiveClub(null); setExpandedCourse(null); }}
              >
                <Text style={[styles.countryTabText, activeCountryKey === country && styles.countryTabTextActive]}>
                  {COUNTRY_FLAG[country] || '🌍'} {country}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Club sub-tabs (only when country has multiple clubs) */}
        {hasClubTabs && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clubTabBar} contentContainerStyle={styles.countryTabBarContent}>
            {clubTabs.map(club => (
              <TouchableOpacity
                key={club}
                style={[styles.clubTab, activeClubKey === club && styles.clubTabActive]}
                onPress={() => { setActiveClub(club); setExpandedCourse(null); }}
              >
                <Text style={[styles.clubTabText, activeClubKey === club && styles.clubTabTextActive]}>{club}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {visibleCourses.length === 0 && !showNewCourse && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⛳</Text>
            <Text style={styles.emptyTitle}>No courses yet</Text>
            <Text style={styles.emptySubtitle}>Add a course to track tee ratings, slope, and your stats per course.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowNewCourse(true)}>
              <Text style={styles.emptyBtnText}>+ Add Your First Course</Text>
            </TouchableOpacity>
          </View>
        )}

        {visibleCourses.map(course => {
          const tab = activeTab[course.id] || 'tees';
          const holeSummary = getHoleSummary(course);

          return (
            <View key={course.id} style={styles.courseCard}>
              {/* Course header */}
              <TouchableOpacity
                style={styles.courseHeader}
                onPress={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}>
                <Text style={styles.courseName}>{course.name}</Text>
                <Text style={styles.chevron}>{expandedCourse === course.id ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {expandedCourse === course.id && (
                <View style={styles.courseBody}>

                  {/* Tab switcher */}
                  <View style={styles.tabRow}>
                    <TouchableOpacity
                      style={[styles.tab, tab === 'tees' && styles.tabActive]}
                      onPress={() => setActiveTab(prev => ({ ...prev, [course.id]: 'tees' }))}>
                      <Text style={[styles.tabText, tab === 'tees' && styles.tabTextActive]}>🎯 Tees</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tab, tab === 'holes' && styles.tabActive]}
                      onPress={() => setActiveTab(prev => ({ ...prev, [course.id]: 'holes' }))}>
                      <Text style={[styles.tabText, tab === 'holes' && styles.tabTextActive]}>
                        📏 Holes {holeSummary ? `(${holeSummary.count}/18)` : ''}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tab, tab === 'stats' && styles.tabActive]}
                      onPress={() => setActiveTab(prev => ({ ...prev, [course.id]: 'stats' }))}>
                      <Text style={[styles.tabText, tab === 'stats' && styles.tabTextActive]}>📊 Stats</Text>
                    </TouchableOpacity>
                  </View>

                  {/* ── TEES TAB ── */}
                  {tab === 'tees' && (
                    <View>
                      {TEE_COLOURS.map(tee => {
                        const saved = course.tees[tee.name];
                        const isEditing = editingTee?.courseId === course.id && editingTee?.teeName === tee.name;
                        return (
                          <View key={tee.name} style={styles.teeRow}>
                            <View style={[styles.teeBadge, { backgroundColor: tee.color, borderColor: tee.border || tee.color }]}>
                              <Text style={[styles.teeBadgeText, { color: tee.text }]}>{tee.name}</Text>
                            </View>
                            {isEditing ? (
                              <View style={styles.teeEditForm}>
                                <View style={styles.teeInputRow}>
                                  <View style={styles.teeInputGroup}>
                                    <Text style={styles.teeInputLabel}>Par</Text>
                                    <TextInput value={teePar} onChangeText={setTeePar}
                                      placeholder="72" keyboardType="numeric" style={styles.teeInput} />
                                  </View>
                                  <View style={styles.teeInputGroup}>
                                    <Text style={styles.teeInputLabel}>CR</Text>
                                    <TextInput value={teeRating} onChangeText={setTeeRating}
                                      placeholder="71.2" keyboardType="decimal-pad" style={styles.teeInput} />
                                  </View>
                                  <View style={styles.teeInputGroup}>
                                    <Text style={styles.teeInputLabel}>Slope</Text>
                                    <TextInput value={teeSlope} onChangeText={setTeeSlope}
                                      placeholder="125" keyboardType="numeric" style={styles.teeInput} />
                                  </View>
                                </View>
                                <View style={styles.btnRow}>
                                  <TouchableOpacity style={styles.saveTeeBtn} onPress={saveTee}>
                                    <Text style={styles.saveTeeBtnText}>✅ Save</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.cancelTeeBtn} onPress={cancelEdit}>
                                    <Text style={styles.cancelTeeBtnText}>Cancel</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : (
                              <TouchableOpacity style={styles.teeInfo} onPress={() => startEditTee(course, tee.name)}>
                                {saved?.par ? (
                                  <Text style={styles.teeDetails}>Par {saved.par} · CR {saved.rating} · Slope {saved.slope}</Text>
                                ) : (
                                  <Text style={styles.teeEmpty}>Tap to add details</Text>
                                )}
                                <Text style={styles.editIcon}>✏️</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* ── HOLES TAB ── */}
                  {tab === 'holes' && (
                    <View>
                      {editingHoles === course.id ? (
                        <>
                          {/* Column headers */}
                          <View style={styles.holeHeaderRow}>
                            <Text style={[styles.holeCol, styles.holeColNum, styles.holeHeaderText]}>#</Text>
                            <Text style={[styles.holeColPar, styles.holeHeaderText]}>Par</Text>
                            <Text style={[styles.holeColDist, styles.holeHeaderText]}>Distance (m)</Text>
                          </View>
                          {holeInputs.map((h, i) => (
                            <View key={h.hole} style={[styles.holeInputRow, i % 2 === 0 && styles.holeRowAlt]}>
                              <Text style={[styles.holeCol, styles.holeColNum, styles.holeNumText]}>{h.hole}</Text>
                              {/* Par quick select */}
                              <View style={styles.holeColPar}>
                                <View style={styles.parQuickRow}>
                                  {[3, 4, 5].map(p => (
                                    <TouchableOpacity key={p}
                                      style={[styles.parQuickBtn, h.par === p && styles.parQuickSelected]}
                                      onPress={() => updateHoleInput(i, 'par', p)}>
                                      <Text style={[styles.parQuickText, h.par === p && styles.parQuickTextSelected]}>{p}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                              {/* Distance input */}
                              <View style={styles.holeColDist}>
                                <TextInput
                                  value={h.distance}
                                  onChangeText={v => updateHoleInput(i, 'distance', v)}
                                  placeholder="—"
                                  keyboardType="numeric"
                                  style={styles.distInput}
                                />
                              </View>
                            </View>
                          ))}
                          <View style={[styles.btnRow, { marginTop: 12 }]}>
                            <TouchableOpacity style={styles.saveTeeBtn} onPress={saveHoles}>
                              <Text style={styles.saveTeeBtnText}>✅ Save Holes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelTeeBtn} onPress={() => setEditingHoles(null)}>
                              <Text style={styles.cancelTeeBtnText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        <>
                          {/* Read-only hole summary */}
                          {(course.holes || []).length > 0 ? (
                            <>
                              <View style={styles.holeHeaderRow}>
                                <Text style={[styles.holeCol, styles.holeColNum, styles.holeHeaderText]}>#</Text>
                                <Text style={[styles.holeColPar, styles.holeHeaderText]}>Par</Text>
                                <Text style={[styles.holeColDist, styles.holeHeaderText]}>Distance (m)</Text>
                              </View>
                              {course.holes.map((h, i) => (
                                <View key={h.hole} style={[styles.holeInputRow, i % 2 === 0 && styles.holeRowAlt]}>
                                  <Text style={[styles.holeCol, styles.holeColNum, styles.holeNumText]}>{h.hole}</Text>
                                  <Text style={[styles.holeColPar, styles.holeReadText]}>Par {h.par}</Text>
                                  <Text style={[styles.holeColDist, styles.holeReadText]}>{h.distance ? `${h.distance}m` : '—'}</Text>
                                </View>
                              ))}
                              <TouchableOpacity style={[styles.saveTeeBtn, { marginTop: 12 }]} onPress={() => startEditHoles(course)}>
                                <Text style={styles.saveTeeBtnText}>✏️ Edit Hole Data</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity style={styles.addHolesBtn} onPress={() => startEditHoles(course)}>
                              <Text style={styles.addHolesBtnText}>📏 Add Hole Distances & Par</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  )}

                  {/* ── STATS TAB ── */}
                  {tab === 'stats' && (() => {
                    const cs = getCourseStats(course);
                    if (!cs) return (
                      <View style={styles.statsEmpty}>
                        <Text style={styles.statsEmptyText}>No rounds played here yet.</Text>
                        <Text style={styles.statsEmptySubText}>Log a round at {course.name} to see your stats!</Text>
                      </View>
                    );
                    const fmtVsPar = (v: number) => v === 0 ? 'Even' : v > 0 ? `+${v}` : `${v}`;
                    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    return (
                      <View>
                        {/* Summary cards */}
                        <View style={styles.statsGrid}>
                          <View style={styles.statsCard}>
                            <Text style={styles.statsCardValue}>{cs.timesPlayed}</Text>
                            <Text style={styles.statsCardLabel}>Rounds played</Text>
                          </View>
                          <View style={styles.statsCard}>
                            <Text style={styles.statsCardValue}>{cs.bestScore ?? '—'}</Text>
                            <Text style={styles.statsCardLabel}>Best score</Text>
                            {cs.bestVsPar !== null && <Text style={styles.statsCardSub}>{fmtVsPar(cs.bestVsPar)} vs par</Text>}
                          </View>
                          <View style={styles.statsCard}>
                            <Text style={styles.statsCardValue}>{cs.avgScore ?? '—'}</Text>
                            <Text style={styles.statsCardLabel}>Avg score</Text>
                            {cs.avgVsPar !== null && <Text style={styles.statsCardSub}>{fmtVsPar(cs.avgVsPar)} vs par</Text>}
                          </View>
                        </View>
                        {/* Recent rounds */}
                        <Text style={styles.statsRoundsTitle}>Recent rounds</Text>
                        {cs.recentRounds.map((r: Round, i: number) => {
                          const vp = r.stats?.scoreVsPar;
                          return (
                            <View key={i} style={styles.statsRoundRow}>
                              <Text style={styles.statsRoundDate}>{fmtDate(r.date)}</Text>
                              <Text style={styles.statsRoundTee}>{r.tee}</Text>
                              <Text style={styles.statsRoundScore}>{r.stats?.totalStrokes ?? '—'}</Text>
                              {vp !== null && vp !== undefined && (
                                <Text style={[styles.statsRoundVsPar, vp < 0 && styles.statsUnderPar, vp === 0 && styles.statsEvenPar]}>
                                  {fmtVsPar(vp)}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}

                  {/* Delete */}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteCourse(course.id)}>
                    <Text style={styles.deleteBtnText}>🗑 Delete Course</Text>
                  </TouchableOpacity>
                </View>
              )}
          </View>
          );
        })}

        {/* Add new course */}
        {showNewCourse ? (
          <View style={styles.newCourseForm}>
            <TextInput placeholder="Course name" value={newCourseName}
              onChangeText={setNewCourseName} style={styles.input}
              returnKeyType="next" autoFocus />
            <TextInput placeholder="Country (e.g. Netherlands)" value={newCourseCountry}
              onChangeText={setNewCourseCountry} style={styles.input}
              returnKeyType="done" />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.saveTeeBtn} onPress={addCourse}>
                <Text style={styles.saveTeeBtnText}>Add Course</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelTeeBtn} onPress={() => { setShowNewCourse(false); setNewCourseCountry(''); }}>
                <Text style={styles.cancelTeeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addCourseBtn} onPress={() => setShowNewCourse(true)}>
            <Text style={styles.addCourseBtnText}>+ Add New Course</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  backBtn: { marginBottom: 4, marginTop: 4 },
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: 10, marginBottom: 16 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20, fontSize: 15, marginBottom: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  emptyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  // Country tabs
  countryTabBar: { marginBottom: 10, marginHorizontal: -4 },
  countryTabBarContent: { paddingHorizontal: 4, gap: 8, flexDirection: 'row' },
  countryTab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#f9f9f9' },
  countryTabActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  countryTabText: { fontSize: 14, fontWeight: '600', color: '#555' },
  countryTabTextActive: { color: '#fff' },
  // Club sub-tabs
  clubTabBar: { marginBottom: 18, marginHorizontal: -4 },
  clubTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#c8d8f0', backgroundColor: '#eef4fc' },
  clubTabActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  clubTabText: { fontSize: 13, fontWeight: '600', color: '#1565C0' },
  clubTabTextActive: { color: '#fff' },
  courseCard: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f9f9f9' },
  courseName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  chevron: { fontSize: 14, color: '#999' },
  courseBody: { padding: 12 },
  // Tab switcher
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  tabText: { fontSize: 14, color: '#555', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  // Tee rows
  teeRow: { marginBottom: 10 },
  teeBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 6, borderWidth: 1 },
  teeBadgeText: { fontSize: 13, fontWeight: 'bold' },
  teeInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 10, padding: 10 },
  teeDetails: { fontSize: 14, color: '#444' },
  teeEmpty: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  editIcon: { fontSize: 14 },
  teeEditForm: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12 },
  teeInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  teeInputGroup: { flex: 1 },
  teeInputLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  teeInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 15, backgroundColor: '#fff', textAlign: 'center' },
  // Hole rows
  holeHeaderRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 2 },
  holeHeaderText: { fontSize: 12, fontWeight: 'bold', color: '#888' },
  holeInputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 2 },
  holeRowAlt: { backgroundColor: '#fafafa' },
  holeCol: { justifyContent: 'center' },
  holeColNum: { width: 28 },
  holeColPar: { flex: 1, paddingRight: 8 },
  holeColDist: { flex: 1 },
  holeNumText: { fontSize: 13, fontWeight: 'bold', color: '#555' },
  holeReadText: { fontSize: 13, color: '#444' },
  parQuickRow: { flexDirection: 'row', gap: 4 },
  parQuickBtn: { flex: 1, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
  parQuickSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  parQuickText: { fontSize: 13, color: '#333', fontWeight: '600' },
  parQuickTextSelected: { color: '#fff' },
  distInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 6, fontSize: 14, backgroundColor: '#fff', textAlign: 'center' },
  addHolesBtn: { borderWidth: 1, borderColor: '#4CAF50', borderStyle: 'dashed', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  addHolesBtnText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 15 },
  // Shared buttons
  btnRow: { flexDirection: 'row', gap: 10 },
  saveTeeBtn: { flex: 1, backgroundColor: '#4CAF50', padding: 10, borderRadius: 10, alignItems: 'center' },
  saveTeeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  cancelTeeBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 10, alignItems: 'center' },
  cancelTeeBtnText: { color: '#666', fontSize: 14 },
  deleteBtn: { marginTop: 12, padding: 10, alignItems: 'center' },
  deleteBtnText: { color: '#e53935', fontSize: 14 },
  newCourseForm: { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fff' },
  addCourseBtn: { borderWidth: 2, borderColor: '#4CAF50', borderStyle: 'dashed', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 40 },
  addCourseBtnText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 16 },
  // Stats tab
  statsEmpty: { alignItems: 'center', paddingVertical: 24 },
  statsEmptyText: { fontSize: 15, fontWeight: '600', color: '#999', marginBottom: 4 },
  statsEmptySubText: { fontSize: 13, color: '#bbb', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statsCard: { flex: 1, backgroundColor: '#f0f7ff', borderRadius: 12, padding: 12, alignItems: 'center' },
  statsCardValue: { fontSize: 24, fontWeight: 'bold', color: '#1565C0' },
  statsCardLabel: { fontSize: 11, color: '#666', marginTop: 2, textAlign: 'center' },
  statsCardSub: { fontSize: 11, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  statsRoundsTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  statsRoundRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 8 },
  statsRoundDate: { flex: 1, fontSize: 13, color: '#444' },
  statsRoundTee: { fontSize: 12, color: '#888', width: 50, textAlign: 'center' },
  statsRoundScore: { fontSize: 16, fontWeight: 'bold', color: '#333', width: 34, textAlign: 'center' },
  statsRoundVsPar: { fontSize: 13, fontWeight: '600', color: '#e53935', width: 36, textAlign: 'right' },
  statsUnderPar: { color: '#4CAF50' },
  statsEvenPar: { color: '#888' },
});
