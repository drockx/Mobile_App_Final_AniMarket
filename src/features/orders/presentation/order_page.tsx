import { NavigationIcon } from '@/components/navigation_icon';
import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkoutColors as color } from './checkout_controls';

export function OrderPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.background}>
    <StatusBar style="dark" />
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
          <NavigationIcon name="back" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text><View style={styles.back} />
      </View>
      {children}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#eef3ef' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.line },
  back: { width: 44, minHeight: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0, paddingVertical: 12, textAlign: 'center', fontSize: 24, lineHeight: 30, fontWeight: '700', color: color.green },
});
