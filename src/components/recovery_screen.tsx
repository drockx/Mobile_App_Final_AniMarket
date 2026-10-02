import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appColors as color, appTypography as type } from '@/constants/app_theme';

export function RecoveryScreen({ title, message, action, onAction }: {
  title: string; message: string; action: string; onAction: () => void;
}) {
  return <View style={styles.background}>
    <StatusBar style="dark" />
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{action}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: color.surface, justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 432, alignSelf: 'center', gap: 16 },
  title: { ...type.title, color: color.forest },
  message: { ...type.body, color: color.muted },
  button: { minHeight: 50, borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color.forest },
  buttonText: { ...type.button, color: color.white, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
