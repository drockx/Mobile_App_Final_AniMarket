import { router } from "expo-router";

import { SplashScreen } from "@/features/onboarding/presentation/splash_screen";

export default function IndexRoute() {
  return <SplashScreen onContinue={() => router.push("/login")} />;
}
