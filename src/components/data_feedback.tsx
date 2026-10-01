import { Pressable, StyleSheet, Text, View } from 'react-native';

export function DataFeedback({ loading, error, onRetry }: { loading?: boolean; error?: string | null; onRetry?: () => void }) {
  if (!loading && !error) return null;
  return <View style={styles.box} accessibilityLiveRegion="polite">
    <Text style={styles.text}>{loading ? 'Loading…' : error}</Text>
    {!loading && onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}><Text style={styles.label}>Retry</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  box: { padding: 14, gap: 8, borderRadius: 12, backgroundColor: '#eaf5ed', marginVertical: 8 },
  text: { color: '#12372a', fontSize: 14, lineHeight: 20 },
  button: { minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#12372a' },
  label: { color: '#12372a', fontSize: 14, fontWeight: '700' },
});
