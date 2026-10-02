import { Redirect, router } from "expo-router";

import { SplashScreen } from "@/features/onboarding/presentation/splash_screen";
import { useAccount } from "@/features/profile/profile_store";

export default function IndexRoute() {
  const account = useAccount();
  if (account.signedIn) return <Redirect href={account.isStaff ? '/admin' : '/home'} />;
  return <SplashScreen onContinue={() => router.replace("/login")} />;
}
