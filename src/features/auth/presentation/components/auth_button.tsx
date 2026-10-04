import { platformShadow } from '@/constants/platform_shadow';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  compact?: boolean;
  disabled?: boolean;
};

export function AuthButton({ label, onPress, compact = false, disabled = false }: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && { opacity: 0.65 }]}
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
    ...platformShadow('#0b4d2a', 0.24, 14, 12, 6),
  },
  pressed: { transform: [{ scale: 0.98 }] },
  gradient: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  loginGradient: { minHeight: 60 },
  compactGradient: { minHeight: 56 },
  label: { color: '#12351f', fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  compactLabel: { fontSize: 19, lineHeight: 26 },
});
