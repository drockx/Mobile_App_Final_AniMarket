import { PersonalInformationScreen } from '@/features/profile/presentation/personal_information_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function PersonalInformationRoute() {
  return <PersonalInformationScreen onBack={() => backOrReplace('/profile')} />;
}
