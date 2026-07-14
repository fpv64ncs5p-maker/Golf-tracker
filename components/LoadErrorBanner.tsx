import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Shown when Supabase reads fail (offline / outage) so a connection problem
 * doesn't look like lost data. Pair with `consumeReadError()` from storage.
 */
export default function LoadErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        ⚠️ Couldn&apos;t load your data — check your connection. Your data is safe in the cloud.
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FDECEA',
    borderColor: '#F5C6CB',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
    color: '#842029',
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#842029',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
