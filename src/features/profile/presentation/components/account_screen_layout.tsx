import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { NavigationIcon } from '@/components/navigation_icon';
import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appColors, appTypography } from '@/constants/app_theme';

export const accountColors = {
  forest: '#12372a',
  green: '#2d6a4f',
  surface: '#f8fbf9',
  line: '#dfe8e2',
  text: '#17221d',
  muted: appColors.muted,
  red: '#b42318',
} as const;

export function AccountScreenLayout({ title, subtitle, onBack, onSignOut, children }: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.background}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 9 }]}>
          {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={onBack} hitSlop={8} style={[styles.backButton, onSignOut && styles.staffToolbar]}>
            <NavigationIcon name="back" />
          </Pressable> : <View style={[styles.backButton, onSignOut && styles.staffToolbar]} />}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {onSignOut ? <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.logoutButton}><Text style={styles.logoutText}>Log out</Text></Pressable> : <View style={styles.backButton} />}
        </View>
        <KeyboardScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {children}
        </KeyboardScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: accountColors.surface },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: accountColors.surface },
  header: { paddingHorizontal: 15, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: accountColors.line },
  backButton: { width: 44, minHeight: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  staffToolbar: { width: 72 },
  logoutButton: { width: 72, minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  logoutText: { ...appTypography.body, color: accountColors.forest, fontWeight: '700', textAlign: 'center' },
  title: { ...appTypography.title, flex: 1, minWidth: 0, textAlign: 'center', color: accountColors.forest },
  content: { paddingHorizontal: 15, paddingTop: 18, gap: 14 },
  subtitle: { ...appTypography.body, color: accountColors.muted },
});
