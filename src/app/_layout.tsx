import { router, Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';

import { dismissAccountError, initializeAccount, retryInitializeAccount, useAccount } from '@/features/profile/profile_store';
import { DataFeedback } from '@/components/data_feedback';
import { messageService } from '@/features/messages/messages_dependencies';
import { voiceService } from '@/features/calls/calls_dependencies';
import { CallNotice } from '@/features/calls/presentation/call_notice';
import { RecoveryScreen } from '@/components/recovery_screen';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <RecoveryScreen title="Unable to open this screen" message="Please try again. If the problem continues, close and reopen AniMarket." action="Try Again" onAction={() => { void retry(); }} />;
}

export default function RootLayout() {
  const account = useAccount();
  const pathname = usePathname();
  useEffect(() => {
    void initializeAccount();
    const subscription = AppState.addEventListener('change', (state) => {
      messageService.setActive(state === 'active');
      // Foreground calling only; release the mic when leaving the app.
      if (state !== 'inactive') voiceService.setActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);
  if (account.loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}><ActivityIndicator color="#12372a" accessibilityLabel="Loading your account" /></View>;
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={account.signedIn && account.isStaff && account.isReviewer}>
          <Stack.Screen name="admin" />
        </Stack.Protected>
        <Stack.Protected guard={!account.isStaff}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="home" />
          <Stack.Screen name="search_filter/index" />
          <Stack.Screen name="market_reference" />
          <Stack.Screen name="price_calculator" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="messages/[id]" />
          <Stack.Screen name="listings/create" />
          <Stack.Screen name="listings/id" />
          <Stack.Protected guard={account.signedIn}>
            <Stack.Screen name="users/[id]" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="my_listings" />
            <Stack.Screen name="personal_information" />
            <Stack.Screen name="account_security" />
            <Stack.Screen name="account_verification" />
            <Stack.Screen name="my_orders" />
            <Stack.Screen name="order_checkout" />
            <Stack.Screen name="order_review" />
            <Stack.Screen name="order_placed" />
            <Stack.Screen name="order_status" />
            <Stack.Screen name="voice_call" />
          </Stack.Protected>
          <Stack.Protected guard={account.signedIn && account.isReviewer}>
            <Stack.Screen name="verification_review" />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
      <CallNotice service={voiceService} hidden={pathname === '/voice_call' || !account.signedIn || account.isStaff} onOpen={() => router.push('/voice_call')} />
      {account.error && !account.signedIn && <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
        <DataFeedback error={account.error} onRetry={() => { void retryInitializeAccount(); }} />
        <Pressable accessibilityRole="button" onPress={() => { dismissAccountError(); router.replace('/login'); }} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12372a', borderRadius: 12 }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Open sign-in</Text></Pressable>
      </View>}
    </View>
  );
}
