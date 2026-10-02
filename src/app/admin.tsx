import { router } from 'expo-router';

import { VerificationReviewScreen } from '@/features/profile/presentation/verification_review_screen';
import { signOut } from '@/features/profile/profile_store';

export default function AdminRoute() {
  return <VerificationReviewScreen title="Admin Portal" onSignOut={() => { signOut(); router.replace('/login'); }} />;
}
