import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  compact?: boolean;
};

export function AuthButton({ label, onPress, compact = false }: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['#d1d900', '#82cb1b', '#12b774']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, compact ? styles.compactGradient : styles.loginGradient]}
      >
        <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 19,
    overflow: 'hidden',
    shadowColor: '#0b4d2a',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  gradient: { alignItems: 'center', justifyContent: 'center' },
  loginGradient: { minHeight: 60 },
  compactGradient: { minHeight: 56 },
  label: { color: '#12351f', fontSize: 22, fontWeight: '700' },
  compactLabel: { fontSize: 19 },
});
