import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import type { CourseEditorHole, ChipLie } from '../types';
import { PUTTS_PER_HOLE } from '../constants/scoring';

/** Parse a metres entry, accepting a comma decimal ("8,5"). Blank or invalid → null. */
export const parseMetres = (text: string): number | null => {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};

/** Short lie tags for chips and scorecards. */
export const LIE_SHORT: Record<ChipLie, string> = { Fairway: 'FW', Rough: 'RO', Bunker: 'BK' };

/** Colour a putt/stroke count against par 2: 1 green, par neutral, 3+ amber. */
export const puttColour = (putts: number) =>
  putts < PUTTS_PER_HOLE ? '#2e7d32' : putts === PUTTS_PER_HOLE ? '#555' : '#e65100';

// Keeps its own text so partial entries like "8." or "8," survive while typing.
function MetresInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if (parseMetres(text) !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextInput
      value={text}
      onChangeText={t => { setText(t); onChange(parseMetres(t)); }}
      placeholder="m"
      keyboardType="decimal-pad"
      style={styles.metresInput}
    />
  );
}

/**
 * Hole-by-hole editor for course drills (session detail edit + add, and the
 * live session's "Edit holes" list). Used by the Putting Course (no lies) and
 * the Chipping Course (pass `lies`). Holes are always numbered 1..n in order.
 */
export default function PuttingCourseEditor({
  holes, onChange, summary, strokesLabel = 'Putts', distanceLabel = 'From edge', lies,
}: {
  holes: CourseEditorHole[];
  onChange: (holes: CourseEditorHole[]) => void;
  summary: (holes: CourseEditorHole[]) => string;
  strokesLabel?: string;
  distanceLabel?: string;
  lies?: readonly ChipLie[];
}) {
  const renumber = (hs: CourseEditorHole[]) => hs.map((h, i) => ({ ...h, hole: i + 1 }));
  const update = (i: number, patch: Partial<CourseEditorHole>) =>
    onChange(holes.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.headRow}>
        <Text style={[styles.head, { width: 40 }]}>Hole</Text>
        <Text style={[styles.head, { flex: 1 }]}>{distanceLabel}</Text>
        <Text style={[styles.head, { width: 118, textAlign: 'center' }]}>{strokesLabel}</Text>
        <View style={{ width: 32 }} />
      </View>
      {holes.map((h, i) => (
        <View key={i} style={styles.holeBlock}>
          <View style={styles.row}>
            <Text style={styles.holeNum}>{h.hole}</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MetresInput value={h.distance} onChange={v => update(i, { distance: v })} />
              <Text style={styles.unit}>m</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => update(i, { strokes: Math.max(1, h.strokes - 1) })}>
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.putts, { color: puttColour(h.strokes) }]}>{h.strokes}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => update(i, { strokes: h.strokes + 1 })}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.delBtn} onPress={() => onChange(renumber(holes.filter((_, idx) => idx !== i)))}>
              <Text>🗑</Text>
            </TouchableOpacity>
          </View>
          {lies && (
            <View style={styles.lieRow}>
              {lies.map(l => (
                <TouchableOpacity key={l} style={[styles.lieBtn, h.lie === l && styles.lieBtnActive]} onPress={() => update(i, { lie: l })}>
                  <Text style={[styles.lieText, h.lie === l && styles.lieTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity
        style={styles.addHole}
        onPress={() => onChange([
          ...holes,
          { hole: holes.length + 1, distance: null, strokes: PUTTS_PER_HOLE, ...(lies ? { lie: holes[holes.length - 1]?.lie ?? lies[0] } : {}) },
        ])}
      >
        <Text style={styles.addHoleText}>+ Add hole</Text>
      </TouchableOpacity>
      {holes.length > 0 && <Text style={styles.summary}>{summary(holes)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  head: { fontSize: 11, fontWeight: '700', color: '#888' },
  holeBlock: { borderBottomWidth: 1, borderBottomColor: '#f3f3f3', paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  lieRow: { flexDirection: 'row', gap: 6, marginLeft: 40, marginBottom: 2 },
  lieBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  lieBtnActive: { backgroundColor: '#8d6e63', borderColor: '#8d6e63' },
  lieText: { fontSize: 12, color: '#555' },
  lieTextActive: { color: '#fff', fontWeight: '600' },
  holeNum: { width: 40, fontSize: 15, fontWeight: '700', color: '#333' },
  metresInput: { width: 64, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, fontSize: 14, backgroundColor: '#fafafa' },
  unit: { fontSize: 13, color: '#888' },
  stepper: { width: 118, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 18, color: '#333' },
  putts: { fontSize: 18, fontWeight: 'bold', width: 24, textAlign: 'center' },
  delBtn: { width: 32, alignItems: 'center' },
  addHole: { marginTop: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#a5d6a7', borderStyle: 'dashed', alignItems: 'center' },
  addHoleText: { color: '#2e7d32', fontWeight: '600' },
  summary: { marginTop: 8, fontSize: 13, color: '#4CAF50', fontWeight: '600' },
});
