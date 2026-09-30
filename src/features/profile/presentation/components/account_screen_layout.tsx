import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const accountColors = {
  forest: '#12372a',
  green: '#2d6a4f',
  surface: '#f8fbf9',
  line: '#dfe8e2',
  text: '#17221d',
  muted: '#6b776f',
  red: '#b42318',
} as const;

export function AccountScreenLayout({ title, subtitle, onBack, children }: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.background}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 9 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={onBack} hitSlop={8} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.backButton} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: accountColors.surface },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: accountColors.surface },
  header: { paddingHorizontal: 15, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: accountColors.line },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: accountColors.forest, fontSize: 26, lineHeight: 31 },
  title: { color: accountColors.forest, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  content: { paddingHorizontal: 15, paddingTop: 18, gap: 14 },
  subtitle: { color: accountColors.muted, fontSize: 13, lineHeight: 19 },
});
