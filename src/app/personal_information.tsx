import { router } from 'expo-router';

import { PersonalInformationScreen } from '@/features/profile/presentation/personal_information_screen';

export default function PersonalInformationRoute() {
  return <PersonalInformationScreen onBack={() => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }} />;
}
