import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { getCourses, saveDraftRound } from '../services/storage';
import { TEE_COLOUR_MAP } from '../constants/theme';
import { ratingForPlay } from '../services/rating';
import { groupCourses, COUNTRY_FLAG } from '../services/courseGroups';
import { OPENWEATHER_API_KEY } from '../constants/weather';
import type { Course, DraftRound } from '../types';

const WEATHER_WIND = ['Calm', 'Light Wind', 'Strong Wind'];
const WEATHER_SKY = ['Sunny', 'Cloudy', 'Rainy'];
const WEATHER_GROUND = ['Dry', 'Normal', 'Wet'];

function mapWindSpeed(mps: number): string {
  if (mps < 3) return 'Calm';
  if (mps < 8) return 'Light Wind';
  return 'Strong Wind';
}

function mapWeatherCode(id: number): string {
  if (id >= 200 && id < 600) return 'Rainy';
  if (id >= 600 && id < 700) return 'Rainy';
  if (id >= 800 && id < 803) return 'Sunny';
  return 'Cloudy';
}

export default function RoundSetupScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedTee, setSelectedTee] = useState<string | null>(null);
  const [holes, setHoles] = useState('18');
  const [nineHalf, setNineHalf] = useState<'front' | 'back'>('front');
  const scrollRef = useRef<ScrollView>(null);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const [wind, setWind] = useState('Calm');
  const [sky, setSky] = useState('Sunny');
  const [ground, setGround] = useState('Normal');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFetched, setWeatherFetched] = useState(false);
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await getCourses();
      setCourses(data);
    };
    load();
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    if (OPENWEATHER_API_KEY === 'YOUR_API_KEY_HERE') return;
    try {
      setWeatherLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const { latitude, longitude } = loc.coords;
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${OPENWEATHER_API_KEY}`
      );
      const data = await res.json();
      setWind(mapWindSpeed(data.wind?.speed ?? 0));
      setSky(mapWeatherCode(data.weather?.[0]?.id ?? 800));
      setWeatherTemp(Math.round(data.main?.temp ?? 0));
      setWeatherFetched(true);
    } catch {
      // silently fall back to manual
    } finally {
      setWeatherLoading(false);
    }
  };

  const teeData = selectedCourse && selectedTee
    ? selectedCourse.tees[selectedTee]
    : null;

  // Front/Back nine choice only applies to 9 holes played on an 18-hole course.
  const courseHoleTotal = (selectedCourse?.holes || []).length;
  const isEighteenHoleCourse = courseHoleTotal > 9;
  const showFrontBackToggle = holes === '9' && isEighteenHoleCourse;
  const playRating = ratingForPlay(
    teeData,
    parseInt(holes),
    showFrontBackToggle ? nineHalf : undefined,
    courseHoleTotal > 0 && courseHoleTotal <= 9,
  );

  // Same country → club grouping as Manage Courses, so a long course list stays navigable
  const { countries, activeCountryKey, clubTabs, hasClubTabs, activeClubKey, visibleCourses } =
    groupCourses(courses, activeCountry, activeClub);

  const canStart = selectedCourse && selectedTee;

  const startRound = async () => {
    if (!canStart || !selectedCourse || !selectedTee) return;
    const totalHoles = parseInt(holes);
    const courseHoleCount = (selectedCourse.holes || []).length;
    const isNineHoleCourse = courseHoleCount > 0 && courseHoleCount <= 9;

    // Which nine is being played (only meaningful for 9 holes on an 18-hole course)
    const playedNine = totalHoles <= 9 && !isNineHoleCourse ? nineHalf : undefined;

    // Use saved hole data if available, taking the chosen nine for 9-hole rounds
    const allHoles = (selectedCourse.holes || []).sort((a, b) => a.hole - b.hole);
    const courseHoles = playedNine === 'back'
      ? allHoles.filter(h => h.hole > 9 && h.hole <= 18)
      : allHoles.filter(h => h.hole <= totalHoles);

    // Par / CR / Slope for the holes actually played. Uses the official 9-hole
    // rating when the tee has one, otherwise halves the 18-hole CR.
    const play = ratingForPlay(teeData, totalHoles, playedNine, isNineHoleCourse);
    // Prefer the summed par of the actual holes when we have them (a nine is not
    // always exactly half of par), falling back to the tee's rated par.
    const summedPar = courseHoles.reduce((sum, h) => sum + (h.par ?? 0), 0);
    const coursePar = summedPar > 0 ? summedPar : play.par;

    const roundData: DraftRound = {
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      tee: selectedTee,
      holes: totalHoles,
      nine: playedNine,
      coursePar: coursePar || 0,
      courseRating: play.rating ?? undefined,
      slopeRating: play.slope ?? undefined,
      weather: { wind, sky, ground, tempC: weatherTemp },
      date: new Date().toISOString(),
      notes: '',
      imported: false,
      holeData: [],
      stats: {
        totalStrokes: 0,
        totalPutts: 0,
        puttsPerHole: '0',
        fairwaysHit: 0,
        fairwayTotal: 0,
        fairwayPct: 0,
        girCount: 0,
        girPct: 0,
        par3Gir: 0,
        par3Total: 0,
        scoreVsPar: null,
      },
      courseHoles, // per-hole par + distance from course setup
    };
    await saveDraftRound(roundData);
    // Start at the first hole actually played (10 for a back nine)
    const firstHole = courseHoles[0]?.hole ?? 1;
    router.push({ pathname: '/round-hole', params: { holeNumber: firstHole, totalHoles: holes } });
  };

  const WeatherSelector = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (o: string) => void }) => (
    <View style={styles.weatherGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map(o => (
          <TouchableOpacity key={o}
            style={[styles.optionBtn, value === o && styles.optionSelected]}
            onPress={() => onChange(o)}>
            <Text style={[styles.optionText, value === o && styles.optionTextSelected]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={scrollRef} style={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏌️ New Round</Text>
        <Text style={styles.subtitle}>{new Date().toLocaleDateString()}</Text>

        {/* Course selection */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Course</Text>
          <TouchableOpacity onPress={() => router.push('/courses')}>
            <Text style={styles.manageLink}>Manage Courses →</Text>
          </TouchableOpacity>
        </View>

        {courses.length === 0 ? (
          <TouchableOpacity style={styles.addCourseBtn} onPress={() => router.push('/courses')}>
            <Text style={styles.addCourseBtnText}>+ Add your first course</Text>
          </TouchableOpacity>
        ) : selectedCourse ? (
          // Once a course is selected, show only that one + a change button
          <View>
            <View style={styles.courseSelected2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseNameSelected2}>{selectedCourse.name}</Text>
                <Text style={styles.courseDetailSelected2}>
                  {Object.keys(selectedCourse.tees || {}).length} tee{Object.keys(selectedCourse.tees || {}).length !== 1 ? 's' : ''} saved
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedCourse(null); setSelectedTee(null); }}>
                <Text style={styles.changeCourse}>Change ✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Country tabs */}
            {countries.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.countryTabBar} contentContainerStyle={styles.countryTabBarContent}>
                {countries.map(country => (
                  <TouchableOpacity key={country}
                    style={[styles.countryTab, activeCountryKey === country && styles.countryTabActive]}
                    onPress={() => { setActiveCountry(country); setActiveClub(null); }}>
                    <Text style={[styles.countryTabText, activeCountryKey === country && styles.countryTabTextActive]}>
                      {COUNTRY_FLAG[country] || '🌍'} {country}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Club sub-tabs (only when the country has more than one club) */}
            {hasClubTabs && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.clubTabBar} contentContainerStyle={styles.countryTabBarContent}>
                {clubTabs.map(club => (
                  <TouchableOpacity key={club}
                    style={[styles.clubTab, activeClubKey === club && styles.clubTabActive]}
                    onPress={() => setActiveClub(club)}>
                    <Text style={[styles.clubTabText, activeClubKey === club && styles.clubTabTextActive]}>{club}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {visibleCourses.map(course => (
              <TouchableOpacity key={course.id}
                style={styles.courseCard}
                onPress={() => {
                  setSelectedCourse(course);
                  setSelectedTee(null);
                  // Auto-detect holes: 9-hole courses default to 9, 18-hole to 18
                  const holeCount = (course.holes || []).length;
                  setHoles(holeCount > 0 && holeCount <= 9 ? '9' : '18');
                  // Selecting a course collapses the (long) list to a single card, which
                  // pulls everything above the viewport out from under you — picking a
                  // course from far down the list used to leave you staring at a greyed-out
                  // "Start Round" with the tee picker scrolled off the top. Go back to the top.
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}>
                <Text style={styles.courseName}>{course.name}</Text>
                <Text style={styles.courseDetail}>
                  {Object.keys(course.tees || {}).length} tee{Object.keys(course.tees || {}).length !== 1 ? 's' : ''} saved
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Tee selection */}
        {selectedCourse && (
          <>
            <Text style={styles.sectionTitle}>Tee Colour</Text>
            <View style={styles.teeRow}>
              {Object.keys(selectedCourse.tees || {}).map(teeName => {
                const colours = TEE_COLOUR_MAP[teeName] || { color: '#888', text: '#fff' };
                const totalDist = (selectedCourse.holes || []).reduce((sum, h) => {
                  const d = h.distanceByTee?.[teeName] ?? h.distance ?? 0;
                  return sum + d;
                }, 0);
                return (
                  <TouchableOpacity key={teeName}
                    style={[styles.teeBtn, { backgroundColor: colours.color, borderColor: colours.border || colours.color },
                      selectedTee === teeName && styles.teeSelected]}
                    onPress={() => setSelectedTee(teeName)}>
                    <Text style={[styles.teeBtnText, { color: colours.text }]}>{teeName}</Text>
                    {totalDist > 0 && (
                      <Text style={[styles.teeDistance, { color: colours.text }]}>{totalDist}m</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Show tee details */}
            {selectedTee && (
              <View style={styles.teeDetails}>
                {teeData?.par ? (
                  <>
                    <Text style={styles.teeDetailsText}>
                      Par {playRating.par ?? teeData.par}
                      {playRating.rating ? ` · CR ${playRating.rating}` : ''}
                      {playRating.slope ? ` · Slope ${playRating.slope}` : ''}
                    </Text>
                    {holes === '9' && isEighteenHoleCourse && (
                      <Text style={styles.teeRatingSourceText}>
                        {playRating.isOfficialNine
                          ? `Official ${nineHalf === 'back' ? 'back' : 'front'} nine rating`
                          : playRating.rating
                            ? 'Estimated — no official 9-hole rating for this tee'
                            : ''}
                      </Text>
                    )}
                  </>
                ) : (
                  <TouchableOpacity onPress={() => router.push('/courses')}>
                    <Text style={styles.teeNoDataText}>
                      ⚠️ No data for {selectedTee} tees — tap to add it
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {/* Holes */}
        <Text style={styles.sectionTitle}>Holes</Text>
        <View style={styles.holesRow}>
          {['9', '18'].map(h => (
            <TouchableOpacity key={h}
              style={[styles.holeBtn, holes === h && styles.holeBtnSelected]}
              onPress={() => setHoles(h)}>
              <Text style={[styles.holeBtnText, holes === h && styles.holeBtnTextSelected]}>{h} holes</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Front 9 / Back 9 — only for 9 holes on an 18-hole course */}
        {showFrontBackToggle && (
          <>
            <Text style={styles.sectionTitle}>Which Nine</Text>
            <View style={styles.holesRow}>
              {(['front', 'back'] as const).map(half => (
                <TouchableOpacity key={half}
                  style={[styles.holeBtn, nineHalf === half && styles.holeBtnSelected]}
                  onPress={() => setNineHalf(half)}>
                  <Text style={[styles.holeBtnText, nineHalf === half && styles.holeBtnTextSelected]}>
                    {half === 'front' ? 'Front 9 (1–9)' : 'Back 9 (10–18)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Weather */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weather</Text>
          {weatherLoading && <ActivityIndicator size="small" color="#4CAF50" />}
          {weatherFetched && !weatherLoading && (
            <Text style={styles.weatherAutoTag}>
              📍 Auto-filled {weatherTemp !== null ? `· ${weatherTemp}°C` : ''}
            </Text>
          )}
        </View>
        <WeatherSelector label="Wind" options={WEATHER_WIND} value={wind} onChange={setWind} />
        <WeatherSelector label="Sky" options={WEATHER_SKY} value={sky} onChange={setSky} />
        <WeatherSelector label="Ground" options={WEATHER_GROUND} value={ground} onChange={setGround} />

        <TouchableOpacity
          style={[styles.startButton, !canStart && styles.disabled]}
          disabled={!canStart}
          onPress={startRound}>
          <Text style={styles.startText}>Start Round →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  backBtn: { marginBottom: 4, marginTop: 4 },
  backText: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: 10, marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#999', marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 8 },
  manageLink: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  courseCard: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, marginBottom: 10 },
  courseSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  courseSelected2: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', borderRadius: 12, padding: 14, marginBottom: 10 },
  courseName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  courseNameSelected: { color: '#fff' },
  courseNameSelected2: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  courseDetail: { fontSize: 13, color: '#888', marginTop: 2 },
  courseDetailSelected: { color: '#e8f5e9' },
  courseDetailSelected2: { fontSize: 13, color: '#e8f5e9', marginTop: 2 },
  changeCourse: { fontSize: 13, color: '#fff', fontWeight: '600', opacity: 0.85 },
  addCourseBtn: { borderWidth: 2, borderColor: '#4CAF50', borderStyle: 'dashed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  addCourseBtnText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 15 },
  teeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  teeBtn: { flex: 1, minWidth: '18%', padding: 10, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  teeSelected: { transform: [{ scale: 1.08 }], shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  teeBtnText: { fontSize: 13, fontWeight: 'bold' },
  teeDistance: { fontSize: 10, opacity: 0.85, marginTop: 2 },
  teeDetails: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 16 },
  teeDetailsText: { fontSize: 15, color: '#333', textAlign: 'center', fontWeight: '600' },
  teeRatingSourceText: { fontSize: 12, color: '#777', textAlign: 'center', marginTop: 2 },
  countryTabBar: { marginBottom: 10, marginHorizontal: -4 },
  countryTabBarContent: { paddingHorizontal: 4, gap: 8, flexDirection: 'row' },
  countryTab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#f9f9f9' },
  countryTabActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  countryTabText: { fontSize: 14, fontWeight: '600', color: '#555' },
  countryTabTextActive: { color: '#fff' },
  clubTabBar: { marginBottom: 14, marginHorizontal: -4 },
  clubTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#c8d8f0', backgroundColor: '#eef4fc' },
  clubTabActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  clubTabText: { fontSize: 13, fontWeight: '600', color: '#1565C0' },
  clubTabTextActive: { color: '#fff' },
  teeNoDataText: { fontSize: 14, color: '#ff9800', textAlign: 'center' },
  holesRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  holeBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  holeBtnSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  holeBtnText: { fontSize: 16, color: '#333' },
  holeBtnTextSelected: { color: '#fff', fontWeight: 'bold' },
  weatherGroup: { marginBottom: 12 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  optionSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  optionText: { fontSize: 13, color: '#333' },
  optionTextSelected: { color: '#fff', fontWeight: 'bold' },
  startButton: { backgroundColor: '#000', padding: 18, borderRadius: 14, marginTop: 24, marginBottom: 60 },
  disabled: { backgroundColor: '#ccc' },
  startText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  weatherAutoTag: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
});
