import { router, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { initializeAccount, useAccount } from '@/features/profile/profile_store';
import { messageService } from '@/features/messages/messages_dependencies';
import { voiceService } from '@/features/calls/calls_dependencies';
import { CallNotice } from '@/features/calls/presentation/call_notice';

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
        <Stack.Protected guard={account.signedIn}>
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
      </Stack>
      <CallNotice service={voiceService} hidden={pathname === '/voice_call' || !account.signedIn} onOpen={() => router.push('/voice_call')} />
    </View>
  );
}
