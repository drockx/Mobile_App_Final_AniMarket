import { Stack } from 'expo-router';

import { useAccount } from '@/features/profile/profile_store';

export default function RootLayout() {
  const account = useAccount();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={account.signedIn}>
        <Stack.Screen name="profile" />
        <Stack.Screen name="personal_information" />
        <Stack.Screen name="account_security" />
      </Stack.Protected>
    </Stack>
  );
}
