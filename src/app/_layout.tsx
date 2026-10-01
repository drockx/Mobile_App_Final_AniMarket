import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { initializeAccount, useAccount } from '@/features/profile/profile_store';
import { messageService } from '@/features/messages/messages_dependencies';

export default function RootLayout() {
  const account = useAccount();
  useEffect(() => {
    void initializeAccount();
    const subscription = AppState.addEventListener('change', (state) => messageService.setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  if (account.loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}><ActivityIndicator color="#12372a" accessibilityLabel="Loading your account" /></View>;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={account.signedIn}>
        <Stack.Screen name="profile" />
        <Stack.Screen name="my_listings" />
        <Stack.Screen name="personal_information" />
        <Stack.Screen name="account_security" />
      </Stack.Protected>
    </Stack>
  );
}
