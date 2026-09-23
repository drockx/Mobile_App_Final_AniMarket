import { router } from "expo-router";

import { SplashScreen } from "@/features/onboarding/presentation/SplashScreen";

export default function IndexRoute() {
  return <SplashScreen onContinue={() => router.push("/login")} />;
}
