import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AuthScreenLayoutProps = {
  children: ReactNode;
  compact?: boolean;
};

export function AuthScreenLayout({ children, compact = false }: AuthScreenLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.background}>
      <Image
        source={require('../../../../../assets/images/auth/login-bg.png')}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(8,18,12,0.10)', 'rgba(8,18,12,0.16)', 'rgba(5,14,9,0.36)']}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['rgba(16,43,30,0.94)', 'rgba(8,27,18,0.97)']}
            style={[styles.card, compact ? styles.compactCard : styles.loginCard]}
          >
            {children}
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#263a22' },
  fill: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#000',
    shadowOpacity: 0.29,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 10,
  },
  loginCard: { borderRadius: 30, paddingTop: 32, paddingHorizontal: 20, paddingBottom: 24 },
  compactCard: { borderRadius: 30, paddingTop: 26, paddingHorizontal: 20, paddingBottom: 24 },
});
