import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import type { PuttingCourseHole } from '../types';
import { PUTTS_PER_HOLE, puttingCourseLine } from '../constants/scoring';

/** Parse a metres entry, accepting a comma decimal ("8,5"). Blank or invalid → null. */
export const parseMetres = (text: string): number | null => {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};

/** Colour a putt count against par 2: 1-putt green, par neutral, 3+ amber. */
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
 * Hole-by-hole editor for a Putting Course drill (session detail: edit + add).
 * Holes are always numbered 1..n in order.
 */
export default function PuttingCourseEditor({
  holes, onChange,
}: { holes: PuttingCourseHole[]; onChange: (holes: PuttingCourseHole[]) => void }) {
  const renumber = (hs: PuttingCourseHole[]) => hs.map((h, i) => ({ ...h, hole: i + 1 }));
  const update = (i: number, patch: Partial<PuttingCourseHole>) =>
    onChange(holes.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.headRow}>
        <Text style={[styles.head, { width: 40 }]}>Hole</Text>
        <Text style={[styles.head, { flex: 1 }]}>From edge</Text>
        <Text style={[styles.head, { width: 118, textAlign: 'center' }]}>Putts</Text>
        <View style={{ width: 32 }} />
      </View>
      {holes.map((h, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.holeNum}>{h.hole}</Text>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MetresInput value={h.distance} onChange={v => update(i, { distance: v })} />
            <Text style={styles.unit}>m</Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => update(i, { putts: Math.max(1, h.putts - 1) })}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.putts, { color: puttColour(h.putts) }]}>{h.putts}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => update(i, { putts: h.putts + 1 })}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.delBtn} onPress={() => onChange(renumber(holes.filter((_, idx) => idx !== i)))}>
            <Text>🗑</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={styles.addHole}
        onPress={() => onChange([...holes, { hole: holes.length + 1, distance: null, putts: PUTTS_PER_HOLE }])}
      >
        <Text style={styles.addHoleText}>+ Add hole</Text>
      </TouchableOpacity>
      {holes.length > 0 && <Text style={styles.summary}>{puttingCourseLine(holes)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  head: { fontSize: 11, fontWeight: '700', color: '#888' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f3f3f3' },
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
