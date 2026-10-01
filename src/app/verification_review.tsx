import { VerificationReviewScreen } from '@/features/profile/presentation/verification_review_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function VerificationReviewRoute() {
  return <VerificationReviewScreen onBack={() => backOrReplace('/profile')} />;
}
